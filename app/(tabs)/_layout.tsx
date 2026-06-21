import { useRef } from 'react';
import { Link, Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { spacing, useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';
import { useActiveSermons } from '@/hooks/useSermons';
import { useConferenceState } from '@/hooks/useGauges';
import { useFaqBadge } from '@/hooks/useFaqBadge';
import { useSecretMessagesBadge } from '@/hooks/useSecretMessagesBadge';
import { assets } from '@/lib/assets';

function LogoTitle() {
  return (
    <Image
      source={assets.logo}
      style={styles.logo}
      resizeMode="contain"
      accessibilityLabel="IAssou3"
    />
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);
  const isModerator = useSessionStore((s) => s.profile?.is_moderator);
  // Anti-rebond pour éviter qu'un double-tap empile deux fois la même modale
  const navLockRef = useRef(false);
  const navigateOnce = (href: any) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    Haptics.selectionAsync().catch(() => {});
    router.push(href);
    setTimeout(() => {
      navLockRef.current = false;
    }, 500);
  };
  // L'icône admin (construct) reste visible partout pour les admins.
  // L'icône modérateur (shield) n'apparaît que sur l'onglet FAQ.
  const showAdminButton = !!isAdmin;
  const { data: activeSermons } = useActiveSermons();
  const { data: conf } = useConferenceState();
  const { hasNewFaq } = useFaqBadge();
  const showSermons = (activeSermons?.length ?? 0) > 0;
  // Le badge ne concerne que la FAQ : on ne le montre que si une FAQ est ouverte.
  const hasOpenFaq = (activeSermons ?? []).some((s) => s.faqOpen);
  const showSecret = !!conf?.secret_friends_revealed;
  const { unreadCount: secretUnreadCount } = useSecretMessagesBadge(showSecret);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.bg, height: 110 },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '800' },
        headerTitleAlign: 'center',
        // box-none : le conteneur du titre ne capte pas les touches lui-même
        // (ses enfants oui), pour laisser passer les taps vers les icônes du
        // headerLeft que le large logo recouvre.
        headerTitleContainerStyle: {
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'box-none',
        },
        tabBarStyle: {
          backgroundColor: t.bg,
          borderTopColor: t.border,
        },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        headerRight: showAdminButton
          ? () => (
              <Pressable
                onPress={() => navigateOnce('/admin')}
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
            <View style={styles.headerLeftRow}>
              <Link href="/tutoriel" asChild>
                <Pressable
                  hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
                  style={{ paddingLeft: 16 }}
                  accessibilityLabel="Ouvrir le tutoriel"
                  accessibilityRole="button"
                >
                  <Ionicons name="help-circle-outline" size={26} color={t.text} />
                </Pressable>
              </Link>
              <Link href="/compte" asChild>
                <Pressable
                  hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                  style={{ paddingLeft: spacing.md }}
                  accessibilityLabel="Mon compte"
                  accessibilityRole="button"
                >
                  <Ionicons name="person-circle-outline" size={26} color={t.text} />
                </Pressable>
              </Link>
            </View>
          ),
          headerRight: () => (
            <View style={styles.chatHeaderRight}>
              {showSecret ? (
                <Link href="/amis-secret" asChild>
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel={
                      secretUnreadCount > 0
                        ? `Mon ami secret, ${secretUnreadCount} nouveau${secretUnreadCount > 1 ? 'x' : ''} message${secretUnreadCount > 1 ? 's' : ''}`
                        : 'Mon ami secret'
                    }
                    accessibilityRole="button"
                  >
                    <View>
                      <Ionicons name="mail" size={24} color={t.accent} />
                      {secretUnreadCount > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeTxt}>
                            {secretUnreadCount > 99 ? '99+' : secretUnreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </Link>
              ) : null}
              {showAdminButton ? (
                <Pressable
                  onPress={() => navigateOnce('/admin')}
                  hitSlop={10}
                  accessibilityLabel="Administration"
                >
                  <Ionicons name="construct-outline" size={26} color={t.accent} />
                </Pressable>
              ) : null}
            </View>
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
      <Tabs.Screen
        name="sermons"
        options={{
          title: 'Sermons',
          tabBarLabel: 'Sermons',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          href: showSermons ? '/sermons' : null,
          tabBarBadge: showSermons && hasOpenFaq && hasNewFaq ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: t.danger,
            minWidth: 10,
            maxWidth: 10,
            height: 10,
            borderRadius: 5,
            transform: [{ translateY: 4 }, { translateX: -2 }],
          },
          // Sur la FAQ uniquement : modérateurs voient le shield, admins voient construct.
          headerRight:
            isAdmin || isModerator
              ? () => (
                  <Pressable
                    onPress={() => navigateOnce('/admin')}
                    hitSlop={10}
                    style={{ paddingRight: 16 }}
                    accessibilityLabel={isAdmin ? 'Administration' : 'Modération FAQ'}
                  >
                    <Ionicons
                      name={isAdmin ? 'construct-outline' : 'shield-checkmark-outline'}
                      size={26}
                      color={t.accent}
                    />
                  </Pressable>
                )
              : () => <View style={{ width: 26 + 16 }} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // pointerEvents none : le logo déborde sur les icônes du headerLeft ;
  // sans ceci il capterait leurs taps et rendrait l'enveloppe quasi incliquable.
  logo: { width: 340, height: 96, pointerEvents: 'none' },
  headerLeftRow: { flexDirection: 'row', alignItems: 'center' },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeTxt: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});
