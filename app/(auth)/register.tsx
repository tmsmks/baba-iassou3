import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { font, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { supabase } from '@/lib/supabase';
import { ageFromDate, maskDateFR, parseDateFR } from '@/lib/display';

const schema = z.object({
  prenom: z.string().trim().min(1, 'Ton prénom est requis').max(60),
  nom: z.string().trim().min(1, 'Ton nom est requis').max(80),
  dateNaissance: z
    .string()
    .trim()
    .refine((v) => v === '' || parseDateFR(v) !== null, 'Date invalide (JJ/MM/AAAA)')
    .transform((v) => (v === '' ? null : parseDateFR(v))),
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(6, '6 caractères minimum'),
});

export default function Register() {
  const t = useTheme();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const computedAge = ageFromDate(parseDateFR(dateNaissance));

  const submit = async () => {
    setError(null);
    if (!accepted) {
      setError("Tu dois accepter les conditions d'utilisation pour créer un compte.");
      return;
    }
    const parsed = schema.safeParse({ prenom, nom, dateNaissance, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          prenom: parsed.data.prenom,
          nom: parsed.data.nom,
          date_naissance: parsed.data.dateNaissance,
        },
      } as any,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Enregistre l'acceptation du CLUF (cochée à l'inscription).
    if (data.session) {
      (supabase.rpc as any)('accept_eula').then(() => {}).catch(() => {});
    }
    if (!data.session) {
      Alert.alert(
        'Vérifie ta boîte mail',
        'Un mail de confirmation t\'a été envoyé. Confirme, puis reviens te connecter.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={[styles.title, { color: t.text }]}>Bienvenue !{'\n'}Faisons connaissance.</Text>
              <Text style={[styles.sub, { color: t.textMuted }]}>
                IAssou3 l'utilisera pour s'adresser personnellement à toi.
              </Text>
            </View>
            <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          </View>
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <TextField
              label="Prénom"
              value={prenom}
              onChangeText={setPrenom}
              autoCapitalize="words"
              autoComplete="name-given"
            />
            <TextField
              label="Nom"
              value={nom}
              onChangeText={setNom}
              autoCapitalize="words"
              autoComplete="name-family"
            />
            <TextField
              label="Date de naissance (facultatif)"
              value={dateNaissance}
              onChangeText={(v) => setDateNaissance(maskDateFR(v))}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
              placeholder="JJ/MM/AAAA"
              returnKeyType="done"
            />
            {computedAge != null ? (
              <Text style={{ color: t.textMuted, fontSize: font.caption, marginTop: -spacing.xs }}>
                {computedAge} an{computedAge > 1 ? 's' : ''}
              </Text>
            ) : null}
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
            />
            <Pressable
              onPress={() => setAccepted((v) => !v)}
              style={styles.eulaRow}
              hitSlop={6}
            >
              <Ionicons
                name={accepted ? 'checkbox' : 'square-outline'}
                size={24}
                color={accepted ? t.primary : t.textMuted}
              />
              <Text style={{ color: t.textMuted, fontSize: font.caption, flex: 1, lineHeight: 18 }}>
                J'ai lu et j'accepte les{' '}
                <Text
                  style={{ color: t.primary, fontWeight: '700' }}
                  onPress={() => router.push('/eula?mode=read' as Href)}
                >
                  conditions d'utilisation
                </Text>
                .
              </Text>
            </Pressable>
            {error ? <Text style={{ color: t.danger, fontSize: font.caption }}>{error}</Text> : null}
            <Button label="Créer mon compte" onPress={submit} loading={busy} disabled={!accepted} />
            <Button label="Retour" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, gap: spacing.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroText: { flex: 1, gap: spacing.sm },
  mascot: { width: 110, height: 140 },
  title: { fontSize: font.display, fontWeight: '800', lineHeight: 34 },
  sub: { fontSize: font.body, marginTop: spacing.sm },
  eulaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
