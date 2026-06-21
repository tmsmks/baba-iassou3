import { useEffect, useRef } from 'react';
import { Stack, router, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from 'react-native';
import { useSessionBootstrap } from '@/hooks/useSession';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useChantsPrefetch } from '@/hooks/useChantsPrefetch';
import { isQuestionPayload, isSecretFriendPayload } from '@/lib/notifications';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useSessionStore } from '@/store/session';
import { Sentry, initSentry } from '@/lib/sentry';

// Initialise le monitoring d'erreurs le plus tôt possible (no-op si pas de DSN).
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // gcTime à 24h pour que les caches restent persistés même sans réseau
      gcTime: 1000 * 60 * 60 * 24,
    },
    mutations: { retry: 0 },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'baba-iassou3-rq-cache-v1',
  throttleTime: 1500,
});

function Bootstrap() {
  useSessionBootstrap();
  useRealtimeSync();
  usePushRegistration();
  useChantsPrefetch();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);
  const qc = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const profile = useSessionStore((s) => s.profile);
  const loading = useSessionStore((s) => s.loading);
  const segments = useSegments();
  const wasAuthed = useRef<boolean>(false);

  // Garde globale d'auth :
  //  - si on n'a plus de session et qu'on était auth → on purge le cache et on va sur /login
  //  - si on a une session ET que le profil est CHARGÉ et qu'on est sur /(auth)/* → on bascule sur l'app
  //    (on n'attend PAS sur profile=null pour rediriger, sinon on envoie sur /onboarding pendant que
  //     la requête de profil est encore en vol, ce qui force à refaire les 5 questions à chaque login)
  useEffect(() => {
    if (loading) return;
    const first = (segments[0] as string | undefined) ?? '';
    const inAuthGroup = first === '(auth)';

    if (session?.user) {
      wasAuthed.current = true;
      if (inAuthGroup && profile && profile.id === session.user.id) {
        if (profile.banned_at) {
          // Compte suspendu : index.tsx affiche l'écran de suspension.
          router.replace('/');
        } else if (profile.onboarding_completed_at) {
          router.replace('/(tabs)/chat');
        } else {
          router.replace('/onboarding');
        }
      }
      return;
    }
    if (wasAuthed.current) {
      wasAuthed.current = false;
      qc.clear();
      router.replace('/(auth)/login');
    }
  }, [session, profile, loading, segments, qc]);

  useEffect(() => {
    const route = (data: unknown) => {
      if (isQuestionPayload(data)) {
        router.push({
          pathname: '/(tabs)/chat',
          params: { delivery_id: data.delivery_id },
        });
      } else if (isSecretFriendPayload(data)) {
        router.push('/amis-secret');
      } else if (data && typeof data === 'object' && (data as any).type === 'secret_message') {
        router.push('/amis-secret');
      } else if (data && typeof data === 'object' && (data as any).type === 'secret_reveal') {
        router.push('/reveal');
      } else if (data && typeof data === 'object' && (data as any).type === 'sermon_faq') {
        router.push({
          pathname: '/(tabs)/sermons',
          params: { sermon_id: (data as any).sermon_id, tab: 'faq' },
        });
      } else if (data && typeof data === 'object' && (data as any).type === 'sermon_quiz') {
        // Le vote du quiz se fait dans le chat principal (IAssou3 pose la question).
        router.push('/(tabs)/chat');
      }
    };

    responseListener.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      route(resp.notification.request.content.data);
    });
    receivedListener.current = Notifications.addNotificationReceivedListener(() => {});

    Notifications.getLastNotificationResponseAsync().then((resp) => {
      route(resp?.notification.request.content.data);
    });

    return () => {
      responseListener.current?.remove();
      receivedListener.current?.remove();
    };
  }, []);

  return null;
}

function RootLayout() {
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
            // On exclut les queries sensibles ou trop volatiles du cache disque
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => {
                const k = query.queryKey?.[0];
                if (typeof k !== 'string') return false;
                // Bons candidats à persister : programme, chants, sermons, programme
                return ['program', 'chants', 'sermons', 'conference_state'].includes(k);
              },
            },
          }}
        >
          <Bootstrap />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="admin/index" options={{ presentation: 'modal' }} />
            <Stack.Screen name="verset-final" options={{ presentation: 'modal' }} />
            <Stack.Screen name="tutoriel" options={{ presentation: 'modal' }} />
            <Stack.Screen name="amis-secret" options={{ presentation: 'modal' }} />
            <Stack.Screen name="reveal" options={{ presentation: 'modal' }} />
            <Stack.Screen name="photos" options={{ presentation: 'modal' }} />
            <Stack.Screen name="chant" options={{ presentation: 'modal' }} />
            <Stack.Screen name="compte" options={{ presentation: 'modal' }} />
            <Stack.Screen name="eula" options={{ presentation: 'modal' }} />
            <Stack.Screen name="onboarding" />
          </Stack>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap : capture les erreurs de rendu React + attache le contexte navigation.
export default Sentry.wrap(RootLayout);
