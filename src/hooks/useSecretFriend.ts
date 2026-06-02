import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

export interface SecretFriendRow {
  receiver_id: string;
  prenom: string;
  nom: string;
}

export function useSecretFriend() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery<SecretFriendRow | null>({
    queryKey: ['secret-friend', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_my_secret_friend');
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as SecretFriendRow | undefined) : null;
      return row ?? null;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`secret-friend-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'secret_friends',
          filter: `giver_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['secret-friend', userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}
