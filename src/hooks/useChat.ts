import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import { postChatResponse } from '@/lib/ai';
import type { Lettre } from '@/types/database';

export interface ChatResponse {
  id: string;
  contenu: string;
  ai_feedback: string | null;
  score: number | null;
  created_at: string;
}

export interface ChatThreadItem {
  delivery_id: string;
  question_id: string;
  question_texte: string;
  lettre: Lettre;
  sent_at: string;
  /** Toutes les réponses de l'utilisateur à cette question, ordonnées chronologiquement. */
  responses: ChatResponse[];
}

export function useChatThread() {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery<ChatThreadItem[]>({
    queryKey: ['chat-thread', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: deliveries, error } = await supabase
        .from('question_deliveries')
        .select(
          'id, question_id, sent_at, questions!inner(texte, lettre, is_onboarding), responses(id, contenu, ai_feedback, score, created_at)',
        )
        .eq('user_id', userId!)
        .eq('questions.is_onboarding', false)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return (deliveries ?? []).map((d: any) => {
        const responses: ChatResponse[] = (Array.isArray(d.responses) ? d.responses : d.responses ? [d.responses] : [])
          .slice()
          .sort((a: ChatResponse, b: ChatResponse) => a.created_at.localeCompare(b.created_at));
        return {
          delivery_id: d.id,
          question_id: d.question_id,
          question_texte: d.questions.texte,
          lettre: d.questions.lettre as Lettre,
          sent_at: d.sent_at,
          responses,
        };
      });
    },
  });
}

export function useSendChatResponse() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { deliveryId: string; contenu: string }) =>
      postChatResponse(vars.deliveryId, vars.contenu),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-thread', userId] });
      qc.invalidateQueries({ queryKey: ['gauges', userId] });
    },
  });
}
