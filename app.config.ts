import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'baba IAssou3',
  slug: 'baba-iassou3',
  scheme: 'babaiassou3',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1A1230',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'church.suismoi.babaiassou3',
    usesAppleSignIn: true,
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      NSUserTrackingUsageDescription:
        "Aucun tracking publicitaire. Cette permission n'est utilisée que pour les notifications de la conférence.",
    },
  },
  android: {
    package: 'church.suismoi.babaiassou3',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1A1230',
    },
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
  },
  notification: {
    icon: './assets/notification-icon.png',
    color: '#C9A961',
    iosDisplayInForeground: true,
    androidMode: 'default',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-apple-authentication',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#C9A961',
        sounds: [],
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
  owner: process.env.EXPO_OWNER,
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: process.env.EAS_PROJECT_ID
      ? `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`
      : undefined,
  },
};

export default config;
