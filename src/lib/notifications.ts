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

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('questions', {
    name: 'Questions de baba IAssou3',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 300, 200],
    lightColor: '#C9A961',
    sound: 'default',
  });
}

export async function registerForPushAndStore(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ||
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const expoToken = tokenResponse.data;
  if (!expoToken) return null;

  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_token: expoToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    },
    { onConflict: 'user_id,expo_token' },
  );

  return expoToken;
}

export type NotifPayload = {
  type: 'question';
  delivery_id: string;
  question_id: string;
  lettre: 'C' | 'H' | 'O' | 'I' | 'X';
};

export function isQuestionPayload(data: unknown): data is NotifPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as NotifPayload).type === 'question' &&
    typeof (data as NotifPayload).delivery_id === 'string'
  );
}
