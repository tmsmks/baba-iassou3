import { useRef } from 'react';
import { Link, Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { font, spacing, useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';
import { useOpenSermons } from '@/hooks/useSermons';
import { useConferenceState } from '@/hooks/useGauges';
import { useFaqBadge } from '@/hooks/useFaqBadge';
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
  const { data: openSermons } = useOpenSermons();
  const { data: conf } = useConferenceState();
  const { hasNewFaq } = useFaqBadge();
  const showFaq = (openSermons?.length ?? 0) > 0;
  const showSecret = !!conf?.secret_friends_revealed;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.bg, height: 100 },
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
              {showSecret ? (
                <Link href="/amis-secret" asChild>
                  <Pressable
                    hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                    style={{ paddingLeft: spacing.md }}
                    accessibilityLabel="Mon ami secret"
                    accessibilityRole="button"
                  >
                    <Ionicons name="mail" size={24} color={t.accent} />
                  </Pressable>
                </Link>
              ) : null}
            </View>
          ),
          headerRight: () => (
            <View style={styles.chatHeaderRight}>
              <Pressable
                onPress={() => navigateOnce('/photos')}
                hitSlop={8}
                style={[styles.photosHeaderBtn, { backgroundColor: t.primary }]}
                accessibilityLabel="Mur photos"
              >
                <Ionicons name="camera" size={18} color={t.isDark ? t.bg : '#FFFFFF'} />
                <Text style={[styles.photosHeaderBtnTxt, { color: t.isDark ? t.bg : '#FFFFFF' }]}>
                  Photos
                </Text>
              </Pressable>
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
        name="faq"
        options={{
          title: 'Q/R sermon',
          tabBarLabel: 'FAQ',
          tabBarIcon: ({ color, size }) => <Ionicons name="help-buoy" size={size} color={color} />,
          href: showFaq ? '/faq' : null,
          tabBarBadge: showFaq && hasNewFaq ? '' : undefined,
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
  // pointerEvents none : le logo (280px) déborde sur les icônes du headerLeft ;
  // sans ceci il capterait leurs taps et rendrait l'enveloppe quasi incliquable.
  logo: { width: 280, height: 79, pointerEvents: 'none' },
  headerLeftRow: { flexDirection: 'row', alignItems: 'center' },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: 16,
  },
  photosHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  photosHeaderBtnTxt: { fontSize: font.caption, fontWeight: '800' },
});
