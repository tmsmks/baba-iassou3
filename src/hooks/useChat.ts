import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import { postChatResponse } from '@/lib/ai';
import type { Lettre } from '@/types/database';

export interface ChatThreadItem {
  delivery_id: string;
  question_id: string;
  question_texte: string;
  lettre: Lettre;
  sent_at: string;
  answered_at: string | null;
  user_contenu: string | null;
  ai_feedback: string | null;
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
          'id, question_id, sent_at, answered_at, questions!inner(texte, lettre), responses(contenu, ai_feedback)',
        )
        .eq('user_id', userId!)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return (deliveries ?? []).map((d: any) => {
        const r = Array.isArray(d.responses) ? d.responses[0] : d.responses;
        return {
          delivery_id: d.id,
          question_id: d.question_id,
          question_texte: d.questions.texte,
          lettre: d.questions.lettre as Lettre,
          sent_at: d.sent_at,
          answered_at: d.answered_at,
          user_contenu: r?.contenu ?? null,
          ai_feedback: r?.ai_feedback ?? null,
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
