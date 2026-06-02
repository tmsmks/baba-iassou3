import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * DSN Sentry : lu depuis app.config (extra.sentryDsn ← EXPO_PUBLIC_SENTRY_DSN).
 * Tant qu'il n'est pas renseigné, Sentry reste désactivé (no-op) — l'app
 * fonctionne normalement sans monitoring.
 */
const dsn =
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ??
  process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Crash reporting seul (léger). Mettre > 0 pour échantillonner les perfs.
    tracesSampleRate: 0,
    // On n'envoie pas les erreurs depuis le simulateur / dev pour ne pas polluer.
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // Évite d'envoyer des données personnelles (emails, IP) par défaut.
    sendDefaultPii: false,
  });
}

export { Sentry };
