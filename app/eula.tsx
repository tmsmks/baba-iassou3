import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { EULA_SECTIONS } from '@/lib/eula';
import { useAcceptEula } from '@/hooks/useModeration';
import { supabase } from '@/lib/supabase';

/**
 * Écran du Contrat de Licence Utilisateur Final.
 * - mode « gate » (par défaut) : bloquant, présenté après connexion tant que le
 *   CLUF n'est pas accepté (Guideline 1.2 : EULA avant utilisation).
 * - mode « read » (?mode=read) : simple lecture depuis un lien (réglages, register).
 */
export default function Eula() {
  const t = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const readOnly = params.mode === 'read';
  const accept = useAcceptEula();

  const [busy, setBusy] = useState(false);

  const onAccept = async () => {
    setBusy(true);
    try {
      await accept.mutateAsync();
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'enregistrer ton acceptation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.headerRow}>
        {readOnly ? (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={26} color={t.text} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
        <Text style={[styles.headerTitle, { color: t.text }]}>Conditions d'utilisation</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.banner, { backgroundColor: t.primarySoft, borderColor: t.primary }]}>
          <Ionicons name="shield-checkmark" size={22} color={t.primary} />
          <Text style={{ color: t.text, fontSize: font.caption, flex: 1, fontWeight: '600' }}>
            IAssou3 applique une tolérance zéro envers les contenus offensants et les
            utilisateurs abusifs.
          </Text>
        </View>

        {EULA_SECTIONS.map((s) => (
          <View key={s.title} style={{ gap: 4 }}>
            <Text style={{ color: t.text, fontSize: font.body, fontWeight: '800' }}>{s.title}</Text>
            <Text style={{ color: t.textMuted, fontSize: font.body, lineHeight: 22 }}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      {!readOnly ? (
        <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.bg }]}>
          <Button label="J'accepte les conditions" onPress={onAccept} loading={busy} />
          <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8} style={{ paddingVertical: spacing.sm }}>
            <Text style={{ color: t.textMuted, fontSize: font.caption, textAlign: 'center' }}>
              Refuser et se déconnecter
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.subtitle, fontWeight: '800' },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.xs,
  },
});
