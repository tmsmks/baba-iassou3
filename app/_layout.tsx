import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from 'react-native';
import { useSessionBootstrap } from '@/hooks/useSession';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { isQuestionPayload } from '@/lib/notifications';
import { usePushRegistration } from '@/hooks/usePushRegistration';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

function Bootstrap() {
  useSessionBootstrap();
  useRealtimeSync();
  usePushRegistration();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data;
      if (isQuestionPayload(data)) {
        router.push({
          pathname: '/(tabs)/chat',
          params: { delivery_id: data.delivery_id },
        });
      }
    });
    receivedListener.current = Notifications.addNotificationReceivedListener(() => {});

    Notifications.getLastNotificationResponseAsync().then((resp) => {
      const data = resp?.notification.request.content.data;
      if (isQuestionPayload(data)) {
        router.push({
          pathname: '/(tabs)/chat',
          params: { delivery_id: data.delivery_id },
        });
      }
    });

    return () => {
      responseListener.current?.remove();
      receivedListener.current?.remove();
    };
  }, []);

  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Bootstrap />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="admin/index" options={{ presentation: 'modal' }} />
            <Stack.Screen name="verset-final" options={{ presentation: 'modal' }} />
            <Stack.Screen name="tutoriel" options={{ presentation: 'modal' }} />
            <Stack.Screen name="onboarding" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
