import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

/**
 * Souscrit aux changements Supabase Realtime ciblant l'utilisateur courant pour que
 * l'app réagisse en direct quand l'admin reset sa conversation ou modifie son profil.
 *
 * - profiles UPDATE : si onboarding_completed_at devient null → refetch profile (redirige
 *   vers /onboarding via le Bootstrap).
 * - question_deliveries DELETE : invalide chat-thread + gauges pour vider l'UI.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  const setProfile = useSessionStore((s) => s.setProfile);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        async () => {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          if (prof) {
            setProfile(prof as any);
            if (!(prof as any).onboarding_completed_at) {
              router.replace('/onboarding');
            }
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'question_deliveries',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.setQueryData(['chat-thread', userId], []);
          qc.invalidateQueries({ queryKey: ['chat-thread', userId] });
          qc.invalidateQueries({ queryKey: ['gauges', userId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'question_deliveries',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['chat-thread', userId] });
        },
      )
      .subscribe();

    // Quand l'app revient au premier plan, refetch le profil au cas où Realtime
    // aurait raté un event pendant que l'app était en background.
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !userId) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (prof) {
        setProfile(prof as any);
        if (!(prof as any).onboarding_completed_at) {
          router.replace('/onboarding');
        }
      }
      qc.invalidateQueries({ queryKey: ['chat-thread', userId] });
      qc.invalidateQueries({ queryKey: ['gauges', userId] });
    });

    return () => {
      supabase.removeChannel(channel);
      appStateSub.remove();
    };
  }, [userId, qc, setProfile]);
}
