import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { ProgramRow } from '@/components/ProgramItem';
import { font, spacing, useTheme } from '@/lib/theme';
import { useProgram, useToggleFavorite } from '@/hooks/useProgram';

export default function ProgrammeScreen() {
  const t = useTheme();
  const { data, isLoading, refetch, isRefetching } = useProgram();
  const toggleFav = useToggleFavorite();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={data ?? []}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
            <Text style={[styles.kicker, { color: t.accent }]}>Aujourd'hui</Text>
            <Text style={[styles.title, { color: t.text }]}>Programme « Suis-moi »</Text>
          </View>
        }
        renderItem={({ item }) => {
          const start = new Date(item.heure_debut).getTime();
          const end = new Date(item.heure_fin).getTime();
          const isLive = now >= start && now <= end;
          return (
            <ProgramRow
              item={item}
              isLive={isLive}
              onToggleFav={() => toggleFav.mutate({ programId: item.id, isFav: item.isFavorite })}
            />
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
});
