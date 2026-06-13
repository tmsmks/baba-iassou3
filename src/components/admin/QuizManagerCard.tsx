import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type { Lettre, Sermon, SermonQuiz, SermonQuizOption } from '@/types/database';

const LETTERS: { key: Lettre; label: string }[] = [
  { key: 'C', label: 'Clarté' },
  { key: 'H', label: 'Honnêteté' },
  { key: 'O', label: 'Orientation' },
  { key: 'I', label: 'Impartialité' },
  { key: 'X', label: 'X factor' },
];

interface OptionDraft {
  id: string | null;
  texte: string;
  ordre: number;
  is_positive: boolean;
  score: number;
}

const emptyOptions = (): OptionDraft[] =>
  [0, 1, 2, 3].map((i) => ({ id: null, texte: '', ordre: i, is_positive: false, score: 0 }));

/** Éditeur de quiz d'un sermon : question + lettre CHOIX + 4 réponses + phases avant/après. */
export function QuizManagerCard({ sermon, onClose }: { sermon: Sermon; onClose: () => void }) {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [lettre, setLettre] = useState<Lettre>('C');
  const [options, setOptions] = useState<OptionDraft[]>(emptyOptions());
  const [beforeOpen, setBeforeOpen] = useState(false);
  const [afterOpen, setAfterOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sermon_quiz')
      .select('*, options:sermon_quiz_options(*)')
      .eq('sermon_id', sermon.id)
      .maybeSingle();
    if (error) {
      Alert.alert('Erreur', error.message);
      setLoading(false);
      return;
    }
    if (data) {
      const q = data as SermonQuiz & { options: SermonQuizOption[] };
      setQuizId(q.id);
      setQuestion(q.question);
      setLettre(q.lettre);
      setBeforeOpen(q.before_open);
      setAfterOpen(q.after_open);
      const sorted = [...(q.options ?? [])].sort((a, b) => a.ordre - b.ordre);
      const drafts: OptionDraft[] = [0, 1, 2, 3].map((i) => {
        const o = sorted[i];
        return o
          ? { id: o.id, texte: o.texte, ordre: i, is_positive: o.is_positive, score: o.score }
          : { id: null, texte: '', ordre: i, is_positive: false, score: 0 };
      });
      setOptions(drafts);
    } else {
      setQuizId(null);
      setQuestion('');
      setLettre('C');
      setBeforeOpen(false);
      setAfterOpen(false);
      setOptions(emptyOptions());
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [sermon.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOption = (i: number, patch: Partial<OptionDraft>) =>
    setOptions((list) => list.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const save = async () => {
    if (question.trim().length < 3) {
      Alert.alert('Question requise', 'Saisis la question du quiz.');
      return;
    }
    if (options.some((o) => o.texte.trim().length === 0)) {
      Alert.alert('Réponses incomplètes', 'Les 4 réponses doivent être renseignées.');
      return;
    }
    setBusy(true);
    try {
      let id = quizId;
      if (id) {
        const { error } = await (supabase.from('sermon_quiz') as any)
          .update({ question: question.trim(), lettre })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase.from('sermon_quiz') as any)
          .insert({ sermon_id: sermon.id, question: question.trim(), lettre })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
        setQuizId(id);
      }

      // Met à jour les options existantes par id, insère les nouvelles (sans
      // supprimer : un delete cascaderait sur les votes déjà enregistrés).
      const nextOptions = [...options];
      for (let i = 0; i < nextOptions.length; i++) {
        const o = nextOptions[i];
        const payload = {
          texte: o.texte.trim(),
          ordre: i,
          is_positive: o.is_positive,
          score: o.is_positive ? Math.max(1, o.score) : o.score,
        };
        if (o.id) {
          const { error } = await (supabase.from('sermon_quiz_options') as any)
            .update(payload)
            .eq('id', o.id);
          if (error) throw error;
        } else {
          const { data, error } = await (supabase.from('sermon_quiz_options') as any)
            .insert({ quiz_id: id, ...payload })
            .select('id')
            .single();
          if (error) throw error;
          nextOptions[i] = { ...o, id: (data as { id: string }).id };
        }
      }
      setOptions(nextOptions);
      Alert.alert('Quiz enregistré');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const togglePhase = async (phase: 'before' | 'after', value: boolean) => {
    if (!quizId) {
      Alert.alert('Enregistre d’abord', 'Enregistre le quiz avant d’ouvrir une phase.');
      return;
    }
    const col = phase === 'before' ? 'before_open' : 'after_open';
    const { error } = await (supabase.from('sermon_quiz') as any).update({ [col]: value }).eq('id', quizId);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    if (phase === 'before') setBeforeOpen(value);
    else setAfterOpen(value);
  };

  const announce = () =>
    Alert.alert('Annoncer le vote ?', 'Envoyer un push à tous pour ouvrir le vote du quiz.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Envoyer',
        onPress: async () => {
          const { error } = await supabase.functions.invoke('broadcast-notification', {
            body: {
              title: `Quiz — ${sermon.intervenant}`,
              body: 'Donne ton avis avant le sermon 🗳️',
              data: { type: 'sermon_quiz', sermon_id: sermon.id },
            },
          });
          if (error) Alert.alert('Erreur', error.message);
          else Alert.alert('Notification envoyée');
        },
      },
    ]);

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.accent }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.h2, { color: t.text }]}>Quiz — {sermon.intervenant}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color={t.text} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={t.primary} />
      ) : (
        <>
          <TextField label="Question" value={question} onChangeText={setQuestion} multiline />

          <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Jauge alimentée (lettre CHOIX)</Text>
          <View style={styles.letterRow}>
            {LETTERS.map((l) => {
              const active = lettre === l.key;
              return (
                <Pressable
                  key={l.key}
                  onPress={() => setLettre(l.key)}
                  style={[
                    styles.letterChip,
                    { backgroundColor: active ? t.primary : t.surfaceAlt, borderColor: active ? t.primary : t.border },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                      fontWeight: '800',
                      fontSize: font.caption,
                    }}
                  >
                    {l.key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: t.textMuted, fontSize: font.micro }}>
            {LETTERS.find((l) => l.key === lettre)?.label} — les réponses « positives » votées APRÈS le
            sermon ajoutent leurs points à cette jauge.
          </Text>

          {options.map((o, i) => (
            <View key={i} style={[styles.optionCard, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              <TextField
                label={`Réponse ${i + 1}`}
                value={o.texte}
                onChangeText={(v) => setOption(i, { texte: v })}
              />
              <View style={styles.optionControls}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Switch
                    value={o.is_positive}
                    onValueChange={(v) => setOption(i, { is_positive: v, score: v ? Math.max(1, o.score) : 0 })}
                    thumbColor={o.is_positive ? t.accent : undefined}
                  />
                  <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700' }}>Positive</Text>
                </View>
                {o.is_positive ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: t.textMuted, fontSize: font.micro }}>Points</Text>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = o.score === n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => setOption(i, { score: n })}
                          style={[
                            styles.scoreChip,
                            { backgroundColor: active ? t.primary : t.surface, borderColor: active ? t.primary : t.border },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                              fontWeight: '800',
                              fontSize: font.caption,
                            }}
                          >
                            {n}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          <Button label="Enregistrer le quiz" onPress={save} loading={busy} />

          {/* Phases */}
          <View style={[styles.phaseRow, { borderColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: font.caption }}>Vote AVANT le sermon</Text>
              <Text style={{ color: t.textMuted, fontSize: font.micro }}>Ouvre le 1er vote.</Text>
            </View>
            <Switch
              value={beforeOpen}
              onValueChange={(v) => togglePhase('before', v)}
              thumbColor={beforeOpen ? t.accent : undefined}
            />
          </View>
          <View style={[styles.phaseRow, { borderColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: font.caption }}>Vote APRÈS le sermon</Text>
              <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                Rouvre la question — les choix positifs marquent des points.
              </Text>
            </View>
            <Switch
              value={afterOpen}
              onValueChange={(v) => togglePhase('after', v)}
              thumbColor={afterOpen ? t.accent : undefined}
            />
          </View>

          <Pressable
            onPress={announce}
            style={[styles.announceBtn, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
          >
            <Ionicons name="megaphone-outline" size={16} color={t.text} />
            <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700' }}>Annoncer le vote</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h2: { fontSize: font.subtitle, fontWeight: '800' },
  fieldLabel: { fontSize: font.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  letterRow: { flexDirection: 'row', gap: spacing.sm },
  letterChip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  optionCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  optionControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  scoreChip: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  announceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
