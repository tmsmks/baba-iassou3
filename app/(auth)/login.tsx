import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { font, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, '6 caractères minimum'),
});

export default function Login() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  const loginEmail = async () => {
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides');
      return;
    }
    setBusy('email');
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(null);
    if (error) setError(error.message);
  };

  const loginGoogle = async () => {
    setBusy('google');
    try {
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'babaiassou3', path: 'auth' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error('URL OAuth manquante');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success' && res.url) {
        const url = new URL(res.url);
        const code = url.searchParams.get('code');
        if (code) {
          const { error: ex } = await supabase.auth.exchangeCodeForSession(code);
          if (ex) throw ex;
        }
      }
    } catch (e: any) {
      Alert.alert('Connexion Google', e?.message ?? 'Échec');
    } finally {
      setBusy(null);
    }
  };

  const loginApple = async () => {
    setBusy('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("Apple n'a pas renvoyé d'identityToken");
      const prenom = credential.fullName?.givenName ?? undefined;
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        options: prenom ? { data: { prenom } } : undefined,
      });
      if (error) throw error;
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Connexion Apple', e?.message ?? 'Échec');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={[styles.title, { color: t.text }]}>
                Avant tout choix,{'\n'}laisse-Le te parler.
              </Text>
              <Text style={[styles.sub, { color: t.textMuted }]}>
                10ème édition « Suis-moi » — Les choix.
              </Text>
            </View>
            <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          </View>

          <View style={{ gap: spacing.md }}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
            />
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {error ? <Text style={{ color: t.danger, fontSize: font.caption }}>{error}</Text> : null}
            <Button label="Se connecter" onPress={loginEmail} loading={busy === 'email'} />
            <Link href="/(auth)/register" asChild>
              <Pressable hitSlop={10}>
                <Text style={[styles.link, { color: t.primary }]}>
                  Pas encore de compte ? Crée-le.
                </Text>
              </Pressable>
            </Link>
          </View>

          {false && (
            <>
              <View style={[styles.sep, { backgroundColor: t.border }]} />

              <View style={{ gap: spacing.md }}>
                <Button
                  label="Continuer avec Google"
                  variant="secondary"
                  onPress={loginGoogle}
                  loading={busy === 'google'}
                  icon={<Ionicons name="logo-google" size={20} color={t.text} />}
                />
                {Platform.OS === 'ios' ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={
                      t.isDark
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    cornerRadius={16}
                    style={{ height: 52 }}
                    onPress={loginApple}
                  />
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, gap: spacing.xl },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  heroText: { flex: 1, gap: spacing.sm },
  mascot: { width: 130, height: 170 },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: font.display, fontWeight: '800', lineHeight: 34 },
  sub: { fontSize: font.body },
  sep: { height: 1, marginVertical: spacing.md },
  link: { textAlign: 'center', fontSize: font.body, fontWeight: '600', paddingVertical: spacing.sm },
});
