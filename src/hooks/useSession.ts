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

    // Charge le profil HORS du callback onAuthStateChange. Faire un appel
    // Supabase awaité À L'INTÉRIEUR de ce callback peut bloquer le verrou
    // d'authentification interne de supabase-js (deadlock) : getSession() reste
    // alors pendu au cold start / sur TOKEN_REFRESHED → spinner infini, qui
    // se reproduit après reconnexion. C'était la cause #1 du chargement infini.
    const loadProfile = async (userId: string, userChanged: boolean) => {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!active) return;
        // Si on change vraiment d'utilisateur, on met à jour systématiquement.
        // Sinon (même user, échec réseau transitoire) on ne clobber pas le profil
        // existant avec null — ça forcerait à tort un redirect vers /onboarding.
        if (prof) {
          setProfile(prof as any);
        } else if (userChanged && !error) {
          setProfile(null);
        }
      } catch {
        // échec réseau transitoire — on garde le profil existant ; app/index.tsx
        // dispose d'une boucle de retry en filet de sécurité.
      }
    };

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
          // une marge en dessous). loadProfile posera le profil quand il répond,
          // même au-delà des 5 s ; sinon app/index.tsx reprend en boucle de retry.
          const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
          await Promise.race([loadProfile(data.session.user.id, false), timeout]);
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

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // ⚠️ Ce callback DOIT rester synchrone et ne faire AUCUN appel Supabase
      // awaité directement (cf. loadProfile ci-dessus). Tout travail réseau est
      // différé via setTimeout(0) pour s'exécuter hors du verrou d'auth.
      if (event === 'TOKEN_REFRESHED' && !session) {
        // TOKEN_REFRESHED avec session=null = refresh a échoué → on purge proprement
        setSession(null);
        setProfile(null);
        setTimeout(() => {
          clearLocalSession();
        }, 0);
        return;
      }
      const prevUserId = useSessionStore.getState().user?.id;
      setSession(session);
      if (session?.user) {
        const userChanged = prevUserId !== session.user.id;
        const uid = session.user.id;
        setTimeout(() => {
          loadProfile(uid, userChanged);
        }, 0);
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
