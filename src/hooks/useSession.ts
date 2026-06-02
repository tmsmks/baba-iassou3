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
    }, 7000);
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
          // Timeout sur la requête profile : si le réseau hange au cold start,
          // on débloque quand même l'UI (le failsafe global est à 7 s, on prend
          // une marge en dessous). 5 s laisse le temps à un réseau lent de
          // répondre avant de basculer sur la boucle de retry de app/index.tsx.
          const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .maybeSingle();
          const timeout = new Promise<{ data: null }>((resolve) =>
            setTimeout(() => resolve({ data: null }), 5000),
          );
          const { data: prof } = (await Promise.race([profilePromise, timeout])) as {
            data: any;
          };
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
      const prevUserId = useSessionStore.getState().user?.id;
      setSession(session);
      if (session?.user) {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        // Si on change vraiment d'utilisateur, on met à jour systématiquement.
        // Sinon (même user, échec réseau transitoire) on ne clobber pas le profile
        // existant avec null — ça forcerait à tort un redirect vers /onboarding.
        const userChanged = prevUserId !== session.user.id;
        if (prof) {
          setProfile(prof as any);
        } else if (userChanged && !error) {
          setProfile(null);
        }
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
