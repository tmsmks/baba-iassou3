import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { Gauges, ConferenceState } from '@/types/database';

export function useGauges() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery<Gauges | null>({
    queryKey: ['gauges', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('gauges')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`gauges:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gauges', filter: `user_id=eq.${userId}` },
        (payload) => {
          qc.setQueryData(['gauges', userId], payload.new as Gauges);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}

export function useConferenceState() {
  return useQuery<ConferenceState | null>({
    queryKey: ['conference_state'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conference_state')
        .select('*')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return data as ConferenceState | null;
    },
    refetchInterval: 30_000,
  });
}
