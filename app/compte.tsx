import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';
import { supabase } from '@/lib/supabase';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/lib/legal';

export default function CompteScreen() {
  const t = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const user = useSessionStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  const fullName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ');
  const email = profile?.email ?? user?.email ?? '';

  const handleLogout = () => {
    Alert.alert('Se déconnecter ?', 'Tu devras te reconnecter pour accéder à l’app.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          // La garde d'auth (Bootstrap) redirige automatiquement vers /login.
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer mon compte ?',
      'Ton compte et toutes tes données (profil, réponses, jauges, photos, messages, ami secret) seront DÉFINITIVEMENT supprimés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: () => {
            // Double confirmation pour une action irréversible.
            Alert.alert(
              'Dernière confirmation',
              'Confirmer la suppression définitive de ton compte ?',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    try {
                      const { error } = await (supabase.rpc as any)('delete_my_account');
                      if (error) throw error;
                      // Compte supprimé → on purge la session locale et on retombe sur /login.
                      await supabase.auth.signOut({ scope: 'local' } as any);
                    } catch (e: any) {
                      setBusy(false);
                      Alert.alert('Erreur', e?.message ?? 'La suppression a échoué. Réessaie.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const openPrivacy = () => {
    if (!PRIVACY_POLICY_URL) return;
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
  };

  return (
    <Screen padded={false} edges={['top']}>
      <View style={[styles.headerRow, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Fermer">
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>Mon compte</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.xl }}>
        {/* Infos utilisateur */}
        <View style={[styles.infoCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          {!!fullName && (
            <Text style={{ color: t.text, fontSize: font.subtitle, fontWeight: '700' }}>
              {fullName}
            </Text>
          )}
          {!!email && (
            <Text style={{ color: t.textMuted, fontSize: font.body }}>{email}</Text>
          )}
        </View>

        {/* Liens légaux */}
        <View style={{ gap: spacing.sm }}>
          {!!PRIVACY_POLICY_URL && (
            <Pressable
              onPress={openPrivacy}
              style={[styles.linkRow, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={t.textMuted} />
              <Text style={{ color: t.text, fontSize: font.body, flex: 1 }}>
                Politique de confidentialité
              </Text>
              <Ionicons name="open-outline" size={18} color={t.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
            style={[styles.linkRow, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <Ionicons name="mail-outline" size={20} color={t.textMuted} />
            <Text style={{ color: t.text, fontSize: font.body, flex: 1 }}>Contacter le support</Text>
            <Ionicons name="open-outline" size={18} color={t.textMuted} />
          </Pressable>
        </View>

        {/* Actions compte */}
        <View style={{ gap: spacing.md }}>
          <Button label="Se déconnecter" variant="secondary" onPress={handleLogout} />
          <Button
            label="Supprimer mon compte"
            variant="danger"
            loading={busy}
            onPress={handleDelete}
          />
          <Text style={{ color: t.textMuted, fontSize: font.caption, textAlign: 'center' }}>
            La suppression efface définitivement toutes tes données et est irréversible.
          </Text>
        </View>
      </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.subtitle, fontWeight: '700' },
  infoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
