import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Screen } from '@/components/Screen';
import { FaqPanel } from '@/components/sermons/FaqPanel';
import { ScoringPanel } from '@/components/sermons/ScoringPanel';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useActiveSermons, type ActiveSermon } from '@/hooks/useSermons';
import { useFaqBadge } from '@/hooks/useFaqBadge';

type SubTab = 'faq' | 'scoring';

export default function SermonsScreen() {
  const t = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const params = useLocalSearchParams<{ sermon_id?: string; tab?: string }>();
  const { data: active, isLoading } = useActiveSermons();
  const { markFaqSeen } = useFaqBadge();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sub, setSub] = useState<SubTab>('faq');

  const sermon: ActiveSermon | null = useMemo(() => {
    if (!active?.length) return null;
    return active.find((s) => s.id === selectedId) ?? active[0];
  }, [active, selectedId]);

  // Deep-link depuis une notif : sélectionne le sermon + le sous-onglet voulu.
  useEffect(() => {
    if (params.sermon_id && active?.some((s) => s.id === params.sermon_id)) {
      setSelectedId(params.sermon_id);
      setSub(params.tab === 'scoring' ? 'scoring' : 'faq');
    }
  }, [params.sermon_id, params.tab, active]);

  // Onglet par défaut selon ce qui est ouvert pour le sermon courant.
  useEffect(() => {
    if (!sermon) return;
    if (!sermon.faqOpen && (sermon.quizBeforeOpen || sermon.quizAfterOpen)) {
      setSub('scoring');
    }
  }, [sermon?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Efface le badge FAQ dès qu'une FAQ ouverte est visible.
  useEffect(() => {
    if (active?.some((s) => s.faqOpen)) markFaqSeen();
  }, [active, markFaqSeen]);

  if (isLoading) {
    return (
      <Screen edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  if (!sermon) {
    return (
      <Screen edges={[]} padded>
        <View style={styles.center}>
          <Ionicons name="time-outline" size={48} color={t.textMuted} />
          <Text style={[styles.kicker, { color: t.accent }]}>Aucun sermon actif</Text>
          <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
            L'organisateur n'a encore rien lancé. Reviens dès qu'un sermon commence.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight + tabBarHeight}
      >
        {active && active.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sermonRow}
          >
            {active.map((s) => {
              const isActive = s.id === sermon.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  style={[
                    styles.sermonChip,
                    {
                      backgroundColor: isActive ? t.primary : t.surfaceAlt,
                      borderColor: isActive ? t.primary : t.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: isActive ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                      fontWeight: '700',
                      fontSize: font.caption,
                    }}
                  >
                    {s.intervenant}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Sous-onglets FAQ / Scoring */}
        <View style={[styles.segment, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          {(['faq', 'scoring'] as SubTab[]).map((key) => {
            const isActive = sub === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSub(key)}
                style={[styles.segmentBtn, isActive && { backgroundColor: t.primary }]}
              >
                <Ionicons
                  name={key === 'faq' ? 'help-buoy-outline' : 'bar-chart-outline'}
                  size={16}
                  color={isActive ? (t.isDark ? t.bg : '#FFFFFF') : t.textMuted}
                />
                <Text
                  style={{
                    color: isActive ? (t.isDark ? t.bg : '#FFFFFF') : t.textMuted,
                    fontWeight: '800',
                    fontSize: font.caption,
                  }}
                >
                  {key === 'faq' ? 'FAQ' : 'Scoring'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* En-tête sermon */}
        <View style={styles.sermonHeader}>
          <Text style={[styles.sermonKicker, { color: t.accent }]}>{sermon.intervenant}</Text>
          <Text style={[styles.sermonTheme, { color: t.text }]}>{sermon.theme}</Text>
        </View>

        <View style={{ flex: 1 }}>
          {sub === 'faq' ? <FaqPanel sermon={sermon} /> : <ScoringPanel sermon={sermon} />}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  body: { fontSize: font.body, lineHeight: 22, maxWidth: 320 },
  sermonRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sermonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
  },
  segment: {
    flexDirection: 'row',
    margin: spacing.lg,
    marginBottom: spacing.sm,
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  sermonHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, gap: 2 },
  sermonKicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  sermonTheme: { fontSize: font.subtitle, fontWeight: '800' },
});
