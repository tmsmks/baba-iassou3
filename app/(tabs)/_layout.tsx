import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';

export default function TabsLayout() {
  const t = useTheme();
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '800' },
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
                <Ionicons name="construct-outline" size={22} color={t.accent} />
              </Pressable>
            )
          : undefined,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'baba IAssou3',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
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
    </Tabs>
  );
}
