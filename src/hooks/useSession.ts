import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

export function useSessionBootstrap(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const setProfile = useSessionStore((s) => s.setProfile);
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle();
        if (active) setProfile(prof ?? null);
      }
      if (active) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        setProfile(prof ?? null);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);
}
