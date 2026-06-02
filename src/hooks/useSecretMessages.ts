import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

export const SECRET_REACTIONS = ['❤️', '🙏', '😂', '🔥', '👍'] as const;
export type SecretReaction = (typeof SECRET_REACTIONS)[number];

export interface SecretMessage {
  id: string;
  contenu: string;
  read_at: string | null;
  created_at: string;
  reaction: string | null;
}

export function useSecretInbox() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery<SecretMessage[]>({
    queryKey: ['secret-inbox', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_my_secret_inbox');
      if (error) throw error;
      return (data ?? []) as SecretMessage[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`secret-inbox-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'secret_messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['secret-inbox', userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  return query;
}

export function useSecretOutbox() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery<SecretMessage[]>({
    queryKey: ['secret-outbox', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_my_secret_outbox');
      if (error) throw error;
      return (data ?? []) as SecretMessage[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`secret-outbox-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'secret_messages',
          filter: `sender_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['secret-outbox', userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  return query;
}

export function useSendSecretMessage() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ receiverId, contenu }: { receiverId: string; contenu: string }) => {
      if (!userId) throw new Error('Non authentifié');
      const { error } = await (supabase.from('secret_messages') as any).insert({
        sender_id: userId,
        receiver_id: receiverId,
        contenu: contenu.trim(),
      });
      if (error) throw error;
      // Best-effort : notif push silencieuse au receveur (l'edge function dérive le token via user_id)
      await supabase.functions
        .invoke('broadcast-notification', {
          body: {
            title: 'Ton ami secret t\'a écrit ✉️',
            body: 'Une nouvelle attention t\'attend dans ta boîte.',
            data: { type: 'secret_message' },
            user_ids: [receiverId],
          },
        })
        .catch(() => {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secret-outbox', userId] }),
  });
}

export function useMarkSecretMessageRead() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await (supabase.rpc as any)('mark_secret_message_read', {
        message_id: messageId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secret-inbox', userId] }),
  });
}

export function useReactToSecretMessage() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string | null }) => {
      const { error } = await (supabase.rpc as any)('react_to_secret_message', {
        message_id: messageId,
        emoji: emoji ?? '',
      });
      if (error) throw error;
    },
    onMutate: async ({ messageId, emoji }) => {
      await qc.cancelQueries({ queryKey: ['secret-inbox', userId] });
      const prev = qc.getQueryData<SecretMessage[]>(['secret-inbox', userId]);
      if (prev) {
        qc.setQueryData<SecretMessage[]>(
          ['secret-inbox', userId],
          prev.map((m) => (m.id === messageId ? { ...m, reaction: emoji } : m)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['secret-inbox', userId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['secret-inbox', userId] });
      qc.invalidateQueries({ queryKey: ['secret-outbox'] });
    },
  });
}
