import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useChants } from '@/hooks/useChants';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import type { Chant } from '@/types/database';

export default function ChantsScreen() {
  const t = useTheme();
  const { data, isLoading } = useChants();
  const { refreshing, onRefresh } = useAppRefresh();

  const openChant = (chant: Chant) => {
    // Ouvre le PDF dans le visualiseur intégré (app/chant.tsx) au lieu de Safari.
    router.push({
      pathname: '/chant',
      params: { id: chant.id, url: chant.url, titre: chant.titre },
    });
  };

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
      <FlatList
        data={data ?? []}
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
          <View style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
            <Text style={[styles.kicker, { color: t.accent }]}>Louange</Text>
            <Text style={[styles.title, { color: t.text }]}>Carnet de chants</Text>
            <Text style={[styles.subtitle, { color: t.textMuted }]}>
              Tape un chant pour ouvrir le PDF des paroles.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openChant(item)}
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={[styles.iconBox, { backgroundColor: t.primarySoft }]}>
              <Ionicons name="musical-notes" size={22} color={t.primary} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={2}>
                {item.titre}
              </Text>
              <Text style={[styles.cardMeta, { color: t.textMuted }]}>PDF · paroles</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
            Aucun chant publié pour l'instant.
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
  subtitle: { fontSize: font.caption, marginTop: 2 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  cardTitle: { fontSize: font.subtitle, fontWeight: '700' },
  cardMeta: { fontSize: font.caption },
});
