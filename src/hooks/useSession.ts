import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

/** Détecte les erreurs de refresh token invalide pour purger la session locale. */
function isInvalidRefreshError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  return /refresh token|jwt expired|invalid token/i.test(msg);
}

async function clearLocalSession() {
  try {
    // scope 'local' : purge AsyncStorage sans appel réseau (le refresh token est déjà mort)
    await supabase.auth.signOut({ scope: 'local' } as any);
  } catch {
    // ignore — on a déjà perdu la session de toute façon
  }
}

export function useSessionBootstrap(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const setProfile = useSessionStore((s) => s.setProfile);
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    let active = true;
    // Garde-fou : si Supabase met trop de temps à répondre (réseau lent au cold start
    // TestFlight, AsyncStorage bloqué…), on débloque l'UI plutôt que rester sur le spinner.
    const failsafe = setTimeout(() => {
      if (active) setLoading(false);
    }, 8000);
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error && isInvalidRefreshError(error)) {
          await clearLocalSession();
          if (active) {
            setSession(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }
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
      } catch (err) {
        if (isInvalidRefreshError(err)) {
          await clearLocalSession();
        } else {
          console.warn('Session bootstrap failed:', err);
        }
        if (active) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED avec session=null = refresh a échoué → on purge proprement
      if (event === 'TOKEN_REFRESHED' && !session) {
        await clearLocalSession();
        setSession(null);
        setProfile(null);
        return;
      }
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
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);
}
