import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getEasProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ||
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId ||
    undefined
  );
}

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('questions', {
    name: 'Questions de baba IAssou3',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 300, 200],
    lightColor: '#C9973A',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('broadcasts', {
    name: 'Annonces conférence',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 300, 200],
    lightColor: '#C9973A',
    sound: 'default',
  });
}

/**
 * Demande les permissions, récupère le token Expo Push et le stocke dans Supabase.
 * Retourne null sur simulateur, permission refusée ou erreur réseau.
 */
export async function registerForPushAndStore(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push : simulateur / pas un appareil physique');
    return null;
  }

  await ensureAndroidChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push : permission refusée');
    return null;
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn('Push : EAS projectId manquant (extra.eas.projectId dans app.config)');
  }

  let expoToken: string;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    expoToken = tokenResponse.data;
  } catch (e) {
    console.warn('Push : échec getExpoPushTokenAsync', e);
    return null;
  }

  if (!expoToken?.startsWith('ExponentPushToken[')) {
    console.warn('Push : token invalide', expoToken);
    return null;
  }

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_token: expoToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    },
    { onConflict: 'user_id,expo_token' },
  );

  if (error) {
    console.warn('Push : échec enregistrement Supabase', error.message);
    return null;
  }

  return expoToken;
}

export type NotifPayload = {
  type: 'question';
  delivery_id: string;
  question_id: string;
  lettre: 'C' | 'H' | 'O' | 'I' | 'X';
};

export type SecretFriendPayload = { type: 'secret_friend' };

export function isQuestionPayload(data: unknown): data is NotifPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as NotifPayload).type === 'question' &&
    typeof (data as NotifPayload).delivery_id === 'string'
  );
}

export function isSecretFriendPayload(data: unknown): data is SecretFriendPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: string }).type === 'secret_friend'
  );
}
