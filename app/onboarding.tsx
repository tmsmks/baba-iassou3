import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, lettreColors, radius, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import { registerForPushAndStore } from '@/lib/notifications';
import type { Lettre } from '@/types/database';

type Likert = 1 | 2 | 3 | 4 | 5;

type Q = { lettre: Lettre; texte: string };

const QUESTIONS: Q[] = [
  { lettre: 'C', texte: 'Je sais quelle valeur me guide quand je dois choisir entre 2 options qui paraissent toutes les deux bonnes — devant moi et devant Dieu.' },
  { lettre: 'H', texte: "Je peux nommer quelque chose (péché, habitude, motivation cachée) que je traîne depuis longtemps et que je n'ai pas vraiment lâché." },
  { lettre: 'O', texte: "Mes choix de cette année (filière, relations, temps, argent) vont vraiment dans le sens de qui Dieu m'appelle à devenir." },
  { lettre: 'I', texte: 'Quand un proche (ami, parent, frère/sœur dans la foi) me reprend, je l\'écoute avant de me défendre.' },
  { lettre: 'X', texte: 'Je peux faire un choix important sans tout maîtriser, en remettant le reste à Dieu.' },
];

const LABELS: Record<Likert, string> = {
  1: 'Pas du tout',
  2: 'Plutôt non',
  3: 'Mitigé',
  4: 'Plutôt oui',
  5: 'Tout à fait',
};

export default function Onboarding() {
  const t = useTheme();
  const setProfile = useSessionStore((s) => s.setProfile);
  const user = useSessionStore((s) => s.user);
  const [answers, setAnswers] = useState<Partial<Record<Lettre, Likert>>>({});
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = QUESTIONS.every((q) => answers[q.lettre] !== undefined);

  const submit = async () => {
    if (!allAnswered || !user) return;
    setSubmitting(true);
    const { error } = await (supabase.rpc as any)('complete_onboarding', { answers });
    if (error) {
      setSubmitting(false);
      Alert.alert('Erreur', error.message);
      return;
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (prof) setProfile(prof);
    await registerForPushAndStore(user.id).catch((e) =>
      console.warn('Push register after onboarding failed', e),
    );
    setSubmitting(false);
    router.replace('/(tabs)/chat');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          <Text style={[styles.title, { color: t.text }]}>
            Apprenons à nous connaître
          </Text>
          <Text style={[styles.lede, { color: t.textMuted }]}>
            5 questions pour que IAssou3 personnalise tes échanges. Pas de bonne ou de mauvaise réponse — sois honnête avec toi-même.
          </Text>
        </View>

        {QUESTIONS.map((q, idx) => {
          const value = answers[q.lettre];
          return (
            <View
              key={q.lettre}
              style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <View style={styles.qHeader}>
                <View style={[styles.lettrePill, { backgroundColor: lettreColors[q.lettre] }]}>
                  <Text style={styles.lettreTxt}>{q.lettre}</Text>
                </View>
                <Text style={[styles.qIdx, { color: t.textMuted }]}>
                  Question {idx + 1} / 5
                </Text>
              </View>
              <Text style={[styles.qTexte, { color: t.text }]}>{q.texte}</Text>

              <View style={styles.likertRow}>
                {([1, 2, 3, 4, 5] as Likert[]).map((v) => {
                  const selected = value === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setAnswers((a) => ({ ...a, [q.lettre]: v }))}
                      style={[
                        styles.likertBtn,
                        {
                          backgroundColor: selected ? t.primary : t.surfaceAlt,
                          borderColor: selected ? t.primary : t.border,
                        },
                      ]}
                      accessibilityLabel={`${q.lettre} : ${LABELS[v]}`}
                    >
                      <Text
                        style={[
                          styles.likertNum,
                          { color: selected ? '#FFFFFF' : t.text },
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.likertLabels}>
                <Text style={[styles.likertLabel, { color: t.textMuted }]}>{LABELS[1]}</Text>
                <Text style={[styles.likertLabel, { color: t.textMuted }]}>{LABELS[5]}</Text>
              </View>
            </View>
          );
        })}

        <Button
          label={allAnswered ? 'Terminer' : `Réponds aux 5 questions`}
          onPress={submit}
          loading={submitting}
          disabled={!allAnswered}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  mascot: { width: 96, height: 128 },
  title: { fontSize: font.title, fontWeight: '800', textAlign: 'center' },
  lede: { fontSize: font.body, lineHeight: 22, textAlign: 'center' },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lettrePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettreTxt: { color: '#FFFFFF', fontWeight: '900', fontSize: font.body },
  qIdx: { fontSize: font.caption, fontWeight: '700', letterSpacing: 1 },
  qTexte: { fontSize: font.body, lineHeight: 22, fontWeight: '600' },
  likertRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  likertBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likertNum: { fontSize: font.subtitle, fontWeight: '800' },
  likertLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  likertLabel: { fontSize: font.caption },
});
