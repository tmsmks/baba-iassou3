import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { font, lettreColors, radius, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';

type Step = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const STEPS: Step[] = [
  {
    icon: 'notifications-outline',
    title: 'Reçois les questions',
    body: "baba IAssou3 t'envoie une notification dès qu'une nouvelle question est prête. Touche-la pour ouvrir le chat directement.",
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Réponds dans le chat',
    body: "Une seule réponse par question. Pas de bonne ou de mauvaise réponse — sois honnête avec toi-même. baba IAssou3 te renvoie un retour personnalisé.",
  },
  {
    icon: 'stats-chart-outline',
    title: 'Suis tes 5 jauges',
    body: "Chaque question est rattachée à une lettre du mot CHOIX. Plus tu réponds, plus tes jauges se précisent. Les jauges se débloquent après le premier workshop.",
  },
  {
    icon: 'calendar-outline',
    title: 'Consulte le programme',
    body: "L'onglet « Programme » regroupe les sessions jour par jour. Navigue entre les 3 jours de la conférence avec les sous-onglets.",
  },
  {
    icon: 'help-circle-outline',
    title: 'Pose tes questions aux évêques',
    body: "Quand une FAQ s'ouvre, pose tes questions de façon anonyme. Like les questions des autres pour les faire remonter !",
  },
  {
    icon: 'people-outline',
    title: 'Amis secrets',
    body: "Tu reçois un ami secret à encourager pendant la conférence. Envoie-lui des messages anonymes via la boîte aux lettres. La grande révélation a lieu à la fin !",
  },
  {
    icon: 'camera-outline',
    title: 'Mur de photos',
    body: "Partage tes plus beaux moments de la conférence sur le mur de photos. Like les photos des autres !",
  },
];

export default function TutorielScreen() {
  const t = useTheme();

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>Tutoriel</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.xl }}>
        <View style={styles.mascotRow}>
          <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          <Text style={[styles.lede, { color: t.text }]}>
            Bienvenue ! Voici comment fonctionne baba IAssou3.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {STEPS.map((step, idx) => (
            <View
              key={step.title}
              style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <View style={[styles.iconCircle, { backgroundColor: t.surfaceAlt }]}>
                <Ionicons name={step.icon} size={22} color={t.primary} />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[styles.stepTitle, { color: t.text }]}>
                  {idx + 1}. {step.title}
                </Text>
                <Text style={[styles.body, { color: t.textMuted }]}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.lettresCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.h2, { color: t.text }]}>Les 5 lettres de CHOIX</Text>
          <View style={styles.lettresRow}>
            {(['C', 'H', 'O', 'I', 'X'] as const).map((l) => (
              <View key={l} style={[styles.lettrePill, { backgroundColor: lettreColors[l] }]}>
                <Text style={styles.lettreTxt}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.body, { color: t.textMuted }]}>
            Chaque lettre représente une dimension de tes choix. baba IAssou3 t'aide à les explorer une par une.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.subtitle, fontWeight: '800' },
  mascotRow: { alignItems: 'center', gap: spacing.md },
  mascot: { width: 120, height: 160 },
  lede: { fontSize: font.subtitle, fontWeight: '700', textAlign: 'center' },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontSize: font.body, fontWeight: '800' },
  body: { fontSize: font.body, lineHeight: 22 },
  lettresCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  h2: { fontSize: font.subtitle, fontWeight: '800' },
  lettresRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lettrePill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettreTxt: { color: '#FFFFFF', fontWeight: '900', fontSize: font.subtitle },
});
