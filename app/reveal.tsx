import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  withDelay,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { supabase } from '@/lib/supabase';
import { useConferenceState } from '@/hooks/useGauges';

interface RevealRow {
  giver_prenom: string | null;
  giver_nom: string | null;
  receiver_prenom: string | null;
  receiver_nom: string | null;
}

export default function Reveal() {
  const t = useTheme();
  const { data: conf } = useConferenceState();
  const [data, setData] = useState<RevealRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const giverFlip = useSharedValue(0);
  const receiverFlip = useSharedValue(0);

  useEffect(() => {
    if (!conf?.secret_reveal_at) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await (supabase.rpc as any)('get_secret_reveal');
      if (error) setError(error.message);
      else setData((Array.isArray(data) ? data[0] : data) ?? null);
      setLoading(false);
      // Démarre l'animation après un court délai
      giverFlip.value = withDelay(600, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
      receiverFlip.value = withDelay(1600, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    })();
  }, [conf?.secret_reveal_at, giverFlip, receiverFlip]);

  const giverFront = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(giverFlip.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: giverFlip.value < 0.5 ? 1 : 0,
  }));
  const giverBack = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(giverFlip.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: giverFlip.value >= 0.5 ? 1 : 0,
  }));
  const receiverFront = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(receiverFlip.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: receiverFlip.value < 0.5 ? 1 : 0,
  }));
  const receiverBack = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(receiverFlip.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: receiverFlip.value >= 0.5 ? 1 : 0,
  }));

  const tap = (sv: typeof giverFlip) => {
    sv.value = withSpring(sv.value > 0.5 ? 0 : 1, { damping: 14, stiffness: 90 });
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  if (!conf?.secret_reveal_at) {
    return (
      <Screen>
        <View style={styles.center}>
          <Image source={assets.mascot} style={{ width: 120, height: 120, opacity: 0.6 }} resizeMode="contain" />
          <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>Le reveal arrive…</Text>
          <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: font.body, maxWidth: 320 }}>
            L'organisateur lancera la grande révélation à la cérémonie de clôture. Reste connecté(e).
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={{ color: t.primary, fontSize: font.body, fontWeight: '700', paddingVertical: spacing.lg }}>
              Retour
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={{ color: t.danger }}>{error}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: t.primary, paddingVertical: spacing.lg }}>Retour</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const giverName =
    [data?.giver_prenom, data?.giver_nom].filter(Boolean).join(' ').trim() || '—';
  const receiverName =
    [data?.receiver_prenom, data?.receiver_nom].filter(Boolean).join(' ').trim() || '—';

  return (
    <Screen padded={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>Grande révélation</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.kicker, { color: t.accent }]}>Suis-Moi X</Text>
        <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>
          Le moment de vérité
        </Text>
        <Text style={[styles.intro, { color: t.textMuted, textAlign: 'center' }]}>
          Tape sur chaque carte pour la retourner.
        </Text>

        <Pressable onPress={() => tap(giverFlip)} style={styles.cardWrap}>
          <Animated.View style={[styles.card, { backgroundColor: t.primary }, giverFront]}>
            <Ionicons name="gift-outline" size={42} color="#FFFFFF" />
            <Text style={styles.cardFrontKicker}>Qui m'a gâté(e) ?</Text>
            <Text style={styles.cardFrontHint}>Tap pour découvrir</Text>
          </Animated.View>
          <Animated.View style={[styles.card, styles.cardBack, { backgroundColor: t.surface, borderColor: t.primary }, giverBack]}>
            <Text style={[styles.cardBackKicker, { color: t.accent }]}>Mon donneur secret</Text>
            <Text style={[styles.cardBackName, { color: t.text }]}>{giverName}</Text>
            <Text style={[styles.cardBackHint, { color: t.textMuted }]}>
              C'est lui/elle qui te déposait des attentions en cachette 🎁
            </Text>
          </Animated.View>
        </Pressable>

        <Pressable onPress={() => tap(receiverFlip)} style={styles.cardWrap}>
          <Animated.View style={[styles.card, { backgroundColor: t.accent }, receiverFront]}>
            <Ionicons name="heart-outline" size={42} color="#FFFFFF" />
            <Text style={styles.cardFrontKicker}>Qui j'ai gâté(e) ?</Text>
            <Text style={styles.cardFrontHint}>Tap pour découvrir</Text>
          </Animated.View>
          <Animated.View style={[styles.card, styles.cardBack, { backgroundColor: t.surface, borderColor: t.accent }, receiverBack]}>
            <Text style={[styles.cardBackKicker, { color: t.accent }]}>J'étais l'ami(e) secret(e) de</Text>
            <Text style={[styles.cardBackName, { color: t.text }]}>{receiverName}</Text>
            <Text style={[styles.cardBackHint, { color: t.textMuted }]}>
              Maintenant tu peux lui dire que c'était toi 💌
            </Text>
          </Animated.View>
        </Pressable>
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
  },
  headerTitle: { fontSize: font.subtitle, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  body: { flex: 1, alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: font.display, fontWeight: '900' },
  intro: { fontSize: font.body, marginBottom: spacing.md },
  cardWrap: {
    width: '100%',
    maxWidth: 380,
    height: 200,
    marginBottom: spacing.md,
  },
  card: {
    position: 'absolute',
    inset: 0,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backfaceVisibility: 'hidden',
  },
  cardBack: { borderWidth: 2 },
  cardFrontKicker: { color: '#FFFFFF', fontSize: font.subtitle, fontWeight: '800' },
  cardFrontHint: { color: '#FFFFFF', fontSize: font.caption, opacity: 0.85 },
  cardBackKicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  cardBackName: { fontSize: 32, fontWeight: '900', textAlign: 'center' },
  cardBackHint: { fontSize: font.caption, textAlign: 'center', marginTop: spacing.xs },
});
