import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { FaqQuestion, Sermon } from '@/types/database';

const STALE = 30_000;

export function useSermons() {
  return useQuery<Sermon[]>({
    queryKey: ['sermons'],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sermons')
        .select('*')
        .order('debut_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Sermon[];
    },
  });
}

/** Sermons dont la FAQ a été lancée manuellement par l'admin (manual_open=true). */
export function useOpenSermons() {
  const { data: all, ...rest } = useSermons();
  const open = (all ?? []).filter((s) => s.manual_open === true);
  return { ...rest, data: open };
}

export interface ActiveSermon extends Sermon {
  faqOpen: boolean;
  quizId: string | null;
  quizBeforeOpen: boolean;
  quizAfterOpen: boolean;
}

/**
 * Sermons « actifs » dans l'onglet Sermons : ceux dont la FAQ est ouverte OU
 * dont le quiz a une phase (avant/après) ouverte. Sert à la visibilité de
 * l'onglet et au sélecteur de sermon. Realtime sur sermons + sermon_quiz.
 */
export function useActiveSermons() {
  const qc = useQueryClient();
  // Nom de canal unique par instance du hook : useActiveSermons est consommé à
  // plusieurs endroits (tab layout + écran Sermons). Supabase réutilise un canal
  // par nom, donc un nom partagé ferait échouer le .on() après le 1er subscribe().
  const channelId = useId();

  const query = useQuery<ActiveSermon[]>({
    queryKey: ['active-sermons'],
    staleTime: STALE,
    queryFn: async () => {
      const [{ data: sermons, error: e1 }, { data: quizzes, error: e2 }] = await Promise.all([
        supabase.from('sermons').select('*').order('debut_at', { ascending: true }),
        supabase.from('sermon_quiz').select('id, sermon_id, before_open, after_open'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const quizBySermon = new Map<
        string,
        { id: string; before_open: boolean; after_open: boolean }
      >();
      for (const q of (quizzes ?? []) as {
        id: string;
        sermon_id: string;
        before_open: boolean;
        after_open: boolean;
      }[]) {
        quizBySermon.set(q.sermon_id, q);
      }

      return ((sermons ?? []) as Sermon[])
        .map((s) => {
          const q = quizBySermon.get(s.id);
          return {
            ...s,
            faqOpen: s.manual_open === true,
            quizId: q?.id ?? null,
            quizBeforeOpen: q?.before_open === true,
            quizAfterOpen: q?.after_open === true,
          };
        })
        .filter((s) => s.faqOpen || s.quizBeforeOpen || s.quizAfterOpen);
    },
  });

  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ['active-sermons'] });
    const channel = supabase
      .channel(`active-sermons-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sermons' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sermon_quiz' }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, channelId]);

  return query;
}

export interface FaqQuestionWithLikes extends FaqQuestion {
  likes_count: number;
  liked_by_me: boolean;
}

export function useFaqQuestions(sermonId: string | null) {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  const query = useQuery<FaqQuestionWithLikes[]>({
    queryKey: ['faq-questions', sermonId, userId],
    enabled: !!sermonId,
    staleTime: 10_000,
    queryFn: async () => {
      const [{ data: qs, error: e1 }, { data: likes, error: e2 }] = await Promise.all([
        supabase
          .from('faq_questions')
          .select('*')
          .eq('sermon_id', sermonId!),
        supabase
          .from('faq_likes')
          .select('question_id, user_id'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const countByQ = new Map<string, number>();
      const likedByMe = new Set<string>();
      for (const l of (likes ?? []) as { question_id: string; user_id: string }[]) {
        countByQ.set(l.question_id, (countByQ.get(l.question_id) ?? 0) + 1);
        if (l.user_id === userId) likedByMe.add(l.question_id);
      }

      const result: FaqQuestionWithLikes[] = ((qs ?? []) as FaqQuestion[]).map((q) => ({
        ...q,
        likes_count: countByQ.get(q.id) ?? 0,
        liked_by_me: likedByMe.has(q.id),
      }));

      // Tri : épinglées d'abord, puis nb de likes desc, puis récentes en premier
      result.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.likes_count !== b.likes_count) return b.likes_count - a.likes_count;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return result;
    },
  });

  useEffect(() => {
    if (!sermonId) return;
    const channel = supabase
      .channel(`faq-${sermonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faq_questions', filter: `sermon_id=eq.${sermonId}` },
        () => qc.invalidateQueries({ queryKey: ['faq-questions', sermonId, userId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faq_likes' },
        () => qc.invalidateQueries({ queryKey: ['faq-questions', sermonId, userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sermonId, qc, userId]);

  return query;
}

export function useToggleFaqLike() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async ({ questionId, liked }: { questionId: string; liked: boolean }) => {
      if (!userId) throw new Error('Non authentifié');
      if (liked) {
        const { error } = await supabase
          .from('faq_likes')
          .delete()
          .eq('question_id', questionId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('faq_likes') as any).insert({
          question_id: questionId,
          user_id: userId,
        });
        if (error) throw error;
      }
    },
    // Optimistic update : on bascule liked_by_me / likes_count localement avant la confirmation serveur
    onMutate: async ({ questionId, liked }) => {
      await qc.cancelQueries({ queryKey: ['faq-questions'] });
      const snapshots: [readonly unknown[], FaqQuestionWithLikes[] | undefined][] = [];
      const queries = qc.getQueriesData<FaqQuestionWithLikes[]>({ queryKey: ['faq-questions'] });
      for (const [key, value] of queries) {
        snapshots.push([key, value]);
        if (!value) continue;
        const next = value.map((q) =>
          q.id === questionId
            ? {
                ...q,
                liked_by_me: !liked,
                likes_count: Math.max(0, q.likes_count + (liked ? -1 : 1)),
              }
            : q,
        );
        // Re-tri immédiat pour que les likes remontent
        next.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          if (a.likes_count !== b.likes_count) return b.likes_count - a.likes_count;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        qc.setQueryData(key, next);
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, value] of ctx.snapshots) {
        qc.setQueryData(key, value);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['faq-questions'] }),
  });
}

export function useSendFaqQuestion() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async ({ sermonId, texte }: { sermonId: string; texte: string }) => {
      if (!userId) throw new Error('Non authentifié');
      // Les questions sont 100 % anonymes : le trigger DB force prenom à null à l'insertion.
      const { error } = await (supabase.from('faq_questions') as any).insert({
        sermon_id: sermonId,
        user_id: userId,
        texte: texte.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['faq-questions', vars.sermonId] }),
  });
}
