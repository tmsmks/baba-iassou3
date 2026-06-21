import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useSessionStore } from '@/store/session';
import { supabase } from '@/lib/supabase';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Index() {
  const t = useTheme();
  const loading = useSessionStore((s) => s.loading);
  const user = useSessionStore((s) => s.user);
  const profile = useSessionStore((s) => s.profile);
  const setProfile = useSessionStore((s) => s.setProfile);

  // Nombre de tentatives manuelles : permet de relancer la boucle de retry sans
  // relancer l'app quand le profil ne charge pas (cold start réseau lent / token).
  const [retryToken, setRetryToken] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  // Si on est connecté mais que le profil n'a pas pu être chargé (timeout réseau
  // au cold start), on retente le fetch en boucle avec backoff au lieu de rester
  // bloqué indéfiniment sur le spinner — la cause #1 du "il faut relancer l'app".
  useEffect(() => {
    if (loading || !user || profile) return;
    let cancelled = false;
    setExhausted(false);
    (async () => {
      // backoff progressif, plafonné — on retente longtemps car le réseau peut
      // mettre plusieurs secondes à être prêt au cold start TestFlight.
      const delays = [0, 800, 1500, 2500, 4000, 6000];
      // Sentinel renvoyé quand la requête reste pendue (verrou d'auth Supabase
      // au cold start) : sans timeout par tentative, le await bloquerait à vie.
      const TIMED_OUT = Symbol('timeout');
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (cancelled) return;
        if (delays[attempt] > 0) await sleep(delays[attempt]);
        if (cancelled) return;
        const query = supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        const res = await Promise.race([
          query,
          sleep(4000).then(() => TIMED_OUT),
        ]);
        if (cancelled) return;
        // Requête pendue → on abandonne cette tentative et on retente
        if (res === TIMED_OUT) continue;
        const { data, error } = res as { data: any; error: any };
        if (data) {
          setProfile(data as any);
          return;
        }
        // data null SANS erreur = le serveur a répondu "aucune ligne" → profil
        // réellement absent, inutile d'insister.
        if (!error) break;
      }
      if (!cancelled) setExhausted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, setProfile, retryToken]);

  const spinner = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.primary} />
    </View>
  );

  if (loading) return spinner;

  if (!user) return <Redirect href="/(auth)/login" />;

  // user connecté mais profile pas encore chargé : on attend plutôt que de rediriger
  // vers /onboarding par erreur. Le useEffect ci-dessus retente le fetch en boucle.
  if (!profile) {
    // Après épuisement des tentatives, on offre une porte de sortie plutôt qu'un
    // spinner infini : réessayer, ou se reconnecter.
    if (exhausted) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.bg,
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <Text style={{ color: t.text, fontSize: font.subtitle, textAlign: 'center' }}>
            Connexion au serveur impossible.
          </Text>
          <Text style={{ color: t.textMuted, fontSize: font.body, textAlign: 'center' }}>
            Vérifie ta connexion internet puis réessaie.
          </Text>
          <Pressable
            onPress={() => setRetryToken((n) => n + 1)}
            style={{
              backgroundColor: t.primary,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.pill,
            }}
          >
            <Text style={{ color: t.bg, fontSize: font.body, fontWeight: '600' }}>Réessayer</Text>
          </Pressable>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={{ color: t.textMuted, fontSize: font.caption }}>Se reconnecter</Text>
          </Pressable>
        </View>
      );
    }
    return spinner;
  }

  // Utilisateurs existants sans eula_accepted_at : acceptation silencieuse en arrière-plan.
  // Les nouveaux inscrits ont déjà accept_eula() appelé dans register.tsx.
  if (!profile.eula_accepted_at) {
    (supabase.rpc as any)('accept_eula').then(() => {}).catch(() => {});
  }

  // Compte suspendu pour contenu répréhensible (Guideline 1.2) : accès bloqué.
  if (profile.banned_at) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.bg,
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <Text style={{ color: t.danger, fontSize: font.subtitle, fontWeight: '800', textAlign: 'center' }}>
          Compte suspendu
        </Text>
        <Text style={{ color: t.textMuted, fontSize: font.body, textAlign: 'center' }}>
          Ton compte a été suspendu pour non-respect des conditions d'utilisation (contenu
          inapproprié). Contacte l'organisation si tu penses qu'il s'agit d'une erreur.
        </Text>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{
            backgroundColor: t.primary,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.pill,
          }}
        >
          <Text style={{ color: t.bg, fontSize: font.body, fontWeight: '600' }}>Se déconnecter</Text>
        </Pressable>
      </View>
    );
  }

  if (!profile.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/chat" />;
}
