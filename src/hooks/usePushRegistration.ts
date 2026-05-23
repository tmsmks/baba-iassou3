import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { registerForPushAndStore } from '@/lib/notifications';
import { useSessionStore } from '@/store/session';

/** Enregistre / met à jour le token Expo Push à la connexion et au retour sur l'app. */
export function usePushRegistration(): void {
  const userId = useSessionStore((s) => s.user?.id);
  const onboardingDone = useSessionStore((s) => s.profile?.onboarding_completed_at);
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !onboardingDone) return;

    const register = () => {
      registerForPushAndStore(userId)
        .then((token) => {
          if (token) lastToken.current = token;
        })
        .catch((e) => console.warn('Push register failed', e));
    };

    register();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') register();
    });

    return () => sub.remove();
  }, [userId, onboardingDone]);
}
