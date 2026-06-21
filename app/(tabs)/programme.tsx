import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { ProgramRow } from '@/components/ProgramItem';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useProgram } from '@/hooks/useProgram';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import type { ProgramItem } from '@/types/database';

interface DayGroup {
  key: string; // YYYY-MM-DD
  label: string; // ex: "Vendredi"
  dateLabel: string; // ex: "3 juillet"
  items: ProgramItem[];
}

/** Clé locale "YYYY-MM-DD" stable peu importe le fuseau du device. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function groupByDay(items: ProgramItem[]): DayGroup[] {
  const map = new Map<string, ProgramItem[]>();
  for (const it of items) {
    const k = dayKey(it.heure_debut);
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, arr]) => {
      const d = new Date(arr[0].heure_debut);
      return {
        key: k,
        label: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dateLabel: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
        items: arr.sort(
          (a, b) => new Date(a.heure_debut).getTime() - new Date(b.heure_debut).getTime(),
        ),
      };
    });
}

export default function ProgrammeScreen() {
  const t = useTheme();
  const { data, isLoading } = useProgram();
  const [now, setNow] = useState(() => Date.now());
  const { refreshing, onRefresh } = useAppRefresh();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(() => groupByDay(data ?? []), [data]);

  const todayKey = useMemo(() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [now]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Si pas de jour sélectionné, on prend "aujourd'hui" si présent, sinon le 1er jour.
  const activeKey = useMemo(() => {
    if (selectedKey && days.some((d) => d.key === selectedKey)) return selectedKey;
    const today = days.find((d) => d.key === todayKey);
    return today?.key ?? days[0]?.key ?? null;
  }, [selectedKey, days, todayKey]);

  const activeDay = useMemo(
    () => days.find((d) => d.key === activeKey) ?? null,
    [days, activeKey],
  );

  if (isLoading) {
    return (
      <Screen edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      {days.length > 0 ? (
        <View style={[styles.dayTabsWrap, { borderBottomColor: t.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabs}
          >
            {days.map((d, idx) => {
              const active = d.key === activeKey;
              const isToday = d.key === todayKey;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => setSelectedKey(d.key)}
                  style={[
                    styles.dayTab,
                    {
                      backgroundColor: active ? t.primary : t.surfaceAlt,
                      borderColor: active ? t.primary : t.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.textMuted,
                      fontWeight: '700',
                      fontSize: font.micro,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Jour {idx + 1}
                    {isToday ? ' · auj.' : ''}
                  </Text>
                  <Text
                    style={{
                      color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                      fontWeight: '800',
                      fontSize: font.body,
                      textTransform: 'capitalize',
                    }}
                  >
                    {d.label}
                  </Text>
                  <Text
                    style={{
                      color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.textMuted,
                      fontSize: font.caption,
                    }}
                  >
                    {d.dateLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={activeDay?.items ?? []}
        keyExtractor={(it) => it.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          activeDay ? (
            <View style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
              <Text style={[styles.kicker, { color: t.accent }]}>
                {activeDay.key === todayKey ? "Aujourd'hui" : `Jour ${days.findIndex((d) => d.key === activeDay.key) + 1}`}
              </Text>
              <Text style={[styles.title, { color: t.text, textTransform: 'capitalize' }]}>
                {activeDay.label} {activeDay.dateLabel}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const start = new Date(item.heure_debut).getTime();
          const end = new Date(item.heure_fin).getTime();
          const isLive = now >= start && now <= end;
          return (
            <ProgramRow item={item} isLive={isLive} />
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
            Le programme sera publié sous peu.
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: font.title, fontWeight: '800' },
  dayTabsWrap: { borderBottomWidth: 1 },
  dayTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 110,
    gap: 2,
  },
});
