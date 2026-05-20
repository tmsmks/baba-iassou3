import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { z } from 'zod';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { font, spacing, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  prenom: z.string().min(1, 'Ton prénom est requis').max(60),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, '6 caractères minimum'),
});

export default function Register() {
  const t = useTheme();
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const parsed = schema.safeParse({ prenom, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { prenom: parsed.data.prenom } },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
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
          <Text style={[styles.title, { color: t.text }]}>Bienvenue,{'\n'}quel est ton prénom ?</Text>
          <Text style={[styles.sub, { color: t.textMuted }]}>
            baba IAssou3 l'utilisera pour s'adresser personnellement à toi.
          </Text>
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <TextField
              label="Prénom"
              value={prenom}
              onChangeText={setPrenom}
              autoCapitalize="words"
              autoComplete="name-given"
            />
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
            {error ? <Text style={{ color: t.danger, fontSize: font.caption }}>{error}</Text> : null}
            <Button label="Créer mon compte" onPress={submit} loading={busy} />
            <Button label="Retour" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, gap: spacing.sm },
  title: { fontSize: font.display, fontWeight: '800', lineHeight: 34 },
  sub: { fontSize: font.body, marginTop: spacing.sm },
});
