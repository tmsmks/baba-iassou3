import type { ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const here = (p: string) => resolve(__dirname, p);
const exists = (p: string) => existsSync(here(p));

/** Projet EAS @thomaks/baba-iassou3 (non secret — requis en dur pour config dynamique). */
const EAS_PROJECT_ID =
  process.env.EAS_PROJECT_ID ?? '9a422c86-ab2b-4fe8-b8e3-811733699b2a';
const EXPO_OWNER = process.env.EXPO_OWNER ?? 'thomaks';

// Fallback : si pas d'icon.png dédié, on utilise la mascotte.
const iconPath = exists('./assets/icon.png')
  ? './assets/icon.png'
  : exists('./assets/mascot.png')
    ? './assets/mascot.png'
    : undefined;
const adaptiveIconPath = exists('./assets/adaptive-icon.png')
  ? './assets/adaptive-icon.png'
  : iconPath;
const splashPath = exists('./assets/splash.png') ? './assets/splash.png' : undefined;
const notifIconPath = exists('./assets/notification-icon.png')
  ? './assets/notification-icon.png'
  : undefined;
const googleServicesPath =
  process.env.GOOGLE_SERVICES_JSON && existsSync(process.env.GOOGLE_SERVICES_JSON)
    ? process.env.GOOGLE_SERVICES_JSON
    : exists('./google-services.json')
      ? './google-services.json'
      : undefined;

/** Nom sous l'icône sur l'écran d'accueil (iOS + Android). */
const APP_DISPLAY_NAME = 'baba IAssou3';

const config: ExpoConfig = {
  name: APP_DISPLAY_NAME,
  slug: 'baba-iassou3',
  scheme: 'babaiassou3',
  version: '1.0.0',
  orientation: 'portrait',
  ...(iconPath ? { icon: iconPath } : {}),
  userInterfaceStyle: 'automatic',
  ...(splashPath
    ? {
        splash: {
          image: splashPath,
          resizeMode: 'contain',
          backgroundColor: '#1A1208',
        },
      }
    : {}),
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'suismoi.babaiassou3',
    usesAppleSignIn: true,
    infoPlist: {
      CFBundleDisplayName: APP_DISPLAY_NAME,
      CFBundleName: APP_DISPLAY_NAME,
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    package: 'suismoi.babaiassou3',
    ...(adaptiveIconPath
      ? {
          adaptiveIcon: {
            foregroundImage: adaptiveIconPath,
            backgroundColor: '#1A1208',
          },
        }
      : {}),
    ...(googleServicesPath ? { googleServicesFile: googleServicesPath } : {}),
    permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
  },
  ...(notifIconPath
    ? {
        notification: {
          icon: notifIconPath,
          color: '#C9973A',
          iosDisplayInForeground: true,
          androidMode: 'default',
        },
      }
    : {}),
  plugins: [
    './plugins/withAppDisplayName.js',
    './plugins/withFmtXcode26Fix.js',
    '@sentry/react-native',
    'expo-dev-client',
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-apple-authentication',
    [
      'expo-notifications',
      {
        ...(notifIconPath ? { icon: notifIconPath } : {}),
        color: '#C9973A',
        sounds: [],
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: { projectId: EAS_PROJECT_ID },
  },
  owner: EXPO_OWNER,
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
};

export default config;
