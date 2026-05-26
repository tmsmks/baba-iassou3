import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';

export default function Index() {
  const t = useTheme();
  const loading = useSessionStore((s) => s.loading);
  const user = useSessionStore((s) => s.user);
  const profile = useSessionStore((s) => s.profile);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!profile || !profile.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/chat" />;
}
