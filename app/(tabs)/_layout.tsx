import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';
import { assets } from '@/lib/assets';

function LogoTitle() {
  return (
    <Image
      source={assets.logo}
      style={styles.logo}
      resizeMode="contain"
      accessibilityLabel="baba IAssou3"
    />
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.bg, height: 100 },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '800' },
        headerTitleAlign: 'center',
        headerLeftContainerStyle: { width: 58 },
        headerRightContainerStyle: { width: 58 },
        headerTitleContainerStyle: { alignItems: 'center', justifyContent: 'center' },
        tabBarStyle: {
          backgroundColor: t.bg,
          borderTopColor: t.border,
        },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        headerRight: isAdmin
          ? () => (
              <Pressable
                onPress={() => router.push('/admin')}
                hitSlop={10}
                style={{ paddingRight: 16 }}
              >
                <Ionicons name="construct-outline" size={26} color={t.accent} />
              </Pressable>
            )
          : () => <View style={{ width: 26 + 16 }} />,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: '',
          headerTitle: () => <LogoTitle />,
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
          headerLeft: () => (
            <Pressable
              onPress={() => router.push('/tutoriel')}
              hitSlop={10}
              style={{ paddingLeft: 16 }}
              accessibilityLabel="Ouvrir le tutoriel"
            >
              <Ionicons name="help-circle-outline" size={26} color={t.text} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="jauges"
        options={{
          title: 'Les 5 jauges',
          tabBarLabel: 'Jauges',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="programme"
        options={{
          title: 'Programme',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chants"
        options={{
          title: 'Chants',
          tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logo: { width: 280, height: 79 },
});
