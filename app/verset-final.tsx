import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, lettreColors, radius, spacing, useTheme } from '@/lib/theme';
import { fetchFinalVerse } from '@/lib/ai';
import type { FinalVerse } from '@/types/database';

export default function VersetFinal() {
  const t = useTheme();
  const [verse, setVerse] = useState<FinalVerse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const v = await fetchFinalVerse();
        if (active) setVerse(v);
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Erreur');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const share = async () => {
    if (!verse) return;
    await Share.share({
      message: `« ${verse.verset_texte} » — ${verse.verset_ref}\n\n${verse.explication}\n\nbaba IAssou3`,
    });
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        {verse ? (
          <Pressable onPress={share} hitSlop={10}>
            <Ionicons name="share-outline" size={22} color={t.text} />
          </Pressable>
        ) : <View />}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
          <Text style={{ color: t.textMuted, marginTop: spacing.md }}>
            baba IAssou3 choisit un verset pour toi…
          </Text>
        </View>
      ) : error || !verse ? (
        <View style={styles.center}>
          <Text style={{ color: t.danger, textAlign: 'center' }}>{error ?? 'Impossible de charger le verset.'}</Text>
          <Button label="Réessayer" variant="ghost" onPress={() => router.replace('/verset-final')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.lg }}>
          <View style={[styles.tag, { backgroundColor: lettreColors[verse.lettre_faible] }]}>
            <Text style={styles.tagTxt}>Pour ta lettre « {verse.lettre_faible} »</Text>
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.ref, { color: t.accent }]}>{verse.verset_ref}</Text>
            <Text style={[styles.texte, { color: t.text }]}>« {verse.verset_texte} »</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.h2, { color: t.text }]}>Ce que tu peux faire</Text>
            <Text style={[styles.body, { color: t.text }]}>{verse.conseil}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.h2, { color: t.text }]}>Pourquoi ce verset, pour toi</Text>
            <Text style={[styles.body, { color: t.text }]}>{verse.explication}</Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  tagTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: font.caption, letterSpacing: 1 },
  card: { padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  ref: { fontSize: font.subtitle, fontWeight: '800' },
  texte: { fontSize: font.title, lineHeight: 32, fontWeight: '500' },
  section: { gap: spacing.sm },
  h2: { fontSize: font.subtitle, fontWeight: '800' },
  body: { fontSize: font.body, lineHeight: 23 },
});
