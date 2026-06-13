import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { Lettre, QuizPhase, SermonQuiz, SermonQuizOption, SermonQuizVote } from '@/types/database';

export interface QuizOptionWithCount extends SermonQuizOption {
  before_count: number;
  after_count: number;
}

export interface SermonQuizData {
  quiz: SermonQuiz;
  options: QuizOptionWithCount[];
  totals: { before: number; after: number };
  /** option_id voté par l'utilisateur courant, par phase (null si pas voté) */
  myVote: { before: string | null; after: string | null };
}

/**
 * Charge le quiz d'un sermon (question + 4 options) avec l'agrégat des votes par
 * phase (histogramme) et le vote personnel de l'utilisateur. Realtime sur le quiz
 * (ouverture des phases par l'admin) et sur les votes (histogramme live).
 */
export function useSermonQuiz(sermonId: string | null) {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  const query = useQuery<SermonQuizData | null>({
    queryKey: ['sermon-quiz', sermonId, userId],
    enabled: !!sermonId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data: quiz, error: e1 } = await supabase
        .from('sermon_quiz')
        .select('*, options:sermon_quiz_options(*)')
        .eq('sermon_id', sermonId!)
        .maybeSingle();
      if (e1) throw e1;
      if (!quiz) return null;

      const rawOptions = ((quiz as any).options ?? []) as SermonQuizOption[];
      const { data: votes, error: e2 } = await supabase
        .from('sermon_quiz_votes')
        .select('phase, option_id, user_id')
        .eq('quiz_id', (quiz as SermonQuiz).id);
      if (e2) throw e2;

      const beforeByOption = new Map<string, number>();
      const afterByOption = new Map<string, number>();
      let beforeTotal = 0;
      let afterTotal = 0;
      const myVote = { before: null as string | null, after: null as string | null };

      for (const v of (votes ?? []) as Pick<SermonQuizVote, 'phase' | 'option_id' | 'user_id'>[]) {
        if (v.phase === 'before') {
          beforeByOption.set(v.option_id, (beforeByOption.get(v.option_id) ?? 0) + 1);
          beforeTotal++;
          if (v.user_id === userId) myVote.before = v.option_id;
        } else {
          afterByOption.set(v.option_id, (afterByOption.get(v.option_id) ?? 0) + 1);
          afterTotal++;
          if (v.user_id === userId) myVote.after = v.option_id;
        }
      }

      const options: QuizOptionWithCount[] = rawOptions
        .map((o) => ({
          ...o,
          before_count: beforeByOption.get(o.id) ?? 0,
          after_count: afterByOption.get(o.id) ?? 0,
        }))
        .sort((a, b) => a.ordre - b.ordre);

      return {
        quiz: quiz as SermonQuiz,
        options,
        totals: { before: beforeTotal, after: afterTotal },
        myVote,
      };
    },
  });

  useEffect(() => {
    if (!sermonId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ['sermon-quiz', sermonId, userId] });
    const channel = supabase
      .channel(`sermon-quiz-${sermonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sermon_quiz', filter: `sermon_id=eq.${sermonId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sermon_quiz_votes' },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sermonId, userId, qc]);

  return query;
}

/** Enregistre (ou met à jour) le vote de l'utilisateur pour une phase donnée. */
export function useSubmitQuizVote() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async ({
      quizId,
      phase,
      optionId,
    }: {
      quizId: string;
      phase: QuizPhase;
      optionId: string;
    }) => {
      if (!userId) throw new Error('Non authentifié');
      const { error } = await (supabase.from('sermon_quiz_votes') as any).upsert(
        {
          quiz_id: quizId,
          user_id: userId,
          phase,
          option_id: optionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'quiz_id,user_id,phase' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sermon-quiz'] });
      qc.invalidateQueries({ queryKey: ['quiz-chat-prompts'] });
      if (userId) qc.invalidateQueries({ queryKey: ['gauges', userId] });
    },
  });
}

export interface QuizPromptOption {
  id: string;
  texte: string;
  ordre: number;
  is_positive: boolean;
  score: number;
}

export interface QuizChatPrompt {
  quizId: string;
  phase: QuizPhase;
  lettre: Lettre;
  question: string;
  sermonDebutAt: string;
  options: QuizPromptOption[];
  myOptionId: string | null;
  myOptionTexte: string | null;
}

/**
 * Quiz à poser dans le chat principal : pour chaque quiz dont une phase est
 * ouverte (avant/après), une entrée par phase ouverte avec le vote éventuel de
 * l'utilisateur. Realtime sur l'ouverture des phases et les votes de l'user.
 */
export function useOpenQuizPrompts() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  const channelId = useId();

  const query = useQuery<QuizChatPrompt[]>({
    queryKey: ['quiz-chat-prompts', userId],
    enabled: !!userId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data: quizzes, error } = await supabase
        .from('sermon_quiz')
        .select('*, sermon:sermons(debut_at), options:sermon_quiz_options(*)')
        .or('before_open.eq.true,after_open.eq.true');
      if (error) throw error;

      const quizIds = (quizzes ?? []).map((q: any) => q.id);
      const myVote = new Map<string, string>(); // `${quizId}:${phase}` -> option_id
      if (quizIds.length) {
        const { data: votes, error: e2 } = await supabase
          .from('sermon_quiz_votes')
          .select('quiz_id, phase, option_id')
          .eq('user_id', userId!)
          .in('quiz_id', quizIds);
        if (e2) throw e2;
        for (const v of (votes ?? []) as { quiz_id: string; phase: QuizPhase; option_id: string }[]) {
          myVote.set(`${v.quiz_id}:${v.phase}`, v.option_id);
        }
      }

      const sorted = [...(quizzes ?? [])].sort((a: any, b: any) =>
        (a.sermon?.debut_at ?? '').localeCompare(b.sermon?.debut_at ?? ''),
      );

      const prompts: QuizChatPrompt[] = [];
      for (const q of sorted as any[]) {
        const options: QuizPromptOption[] = [...(q.options ?? [])]
          .sort((a: any, b: any) => a.ordre - b.ordre)
          .map((o: any) => ({
            id: o.id,
            texte: o.texte,
            ordre: o.ordre,
            is_positive: o.is_positive,
            score: o.score,
          }));
        for (const phase of ['before', 'after'] as QuizPhase[]) {
          const open = phase === 'before' ? q.before_open : q.after_open;
          if (!open) continue;
          const optId = myVote.get(`${q.id}:${phase}`) ?? null;
          prompts.push({
            quizId: q.id,
            phase,
            lettre: q.lettre,
            question: q.question,
            sermonDebutAt: q.sermon?.debut_at ?? '',
            options,
            myOptionId: optId,
            myOptionTexte: optId ? options.find((o) => o.id === optId)?.texte ?? null : null,
          });
        }
      }
      return prompts;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ['quiz-chat-prompts', userId] });
    const channel = supabase
      .channel(`quiz-prompts-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sermon_quiz' }, invalidate)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sermon_quiz_votes', filter: `user_id=eq.${userId}` },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc, channelId]);

  return query;
}
