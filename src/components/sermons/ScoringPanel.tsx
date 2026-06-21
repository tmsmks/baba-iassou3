import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useSermonQuiz, type SermonQuizData } from '@/hooks/useSermonQuiz';
import type { ActiveSermon } from '@/hooks/useSermons';
import type { Lettre, QuizPhase } from '@/types/database';

const LETTER_LABEL: Record<Lettre, string> = {
  C: 'Clarté',
  H: 'Honnêteté',
  O: 'Orientation',
  I: 'Impartialité',
  X: 'X factor',
};

/**
 * Panneau Scoring (lecture seule) : affiche les histogrammes des réponses de
 * tous les utilisateurs, un AVANT et un APRÈS le sermon. Le vote lui-même se
 * fait dans le chat principal (IAssou3 pose la question).
 */
export function ScoringPanel({ sermon }: { sermon: ActiveSermon }) {
  const t = useTheme();
  const { data, isLoading } = useSermonQuiz(sermon.id);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons name="bar-chart-outline" size={48} color={t.textMuted} />
        <Text style={[styles.kicker, { color: t.accent }]}>Pas de quiz</Text>
        <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
          Aucune question n'a été préparée pour ce sermon.
        </Text>
      </View>
    );
  }

  // Bandeau changement d'avis (si l'utilisateur a voté avant ET après)
  let banner: string | null = null;
  if (data.myVote.after) {
    const afterOpt = data.options.find((o) => o.id === data.myVote.after);
    const beforeOpt = data.options.find((o) => o.id === data.myVote.before);
    if (afterOpt?.is_positive) {
      banner =
        beforeOpt && !beforeOpt.is_positive
          ? `Le sermon t'a fait changer d'avis 👏 +${afterOpt.score} sur la jauge ${LETTER_LABEL[data.quiz.lettre]}`
          : `Beau choix 🙌 +${afterOpt.score} sur la jauge ${LETTER_LABEL[data.quiz.lettre]}`;
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.questionCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.letterBadge, { backgroundColor: t.primarySoft }]}>
          <Text style={{ color: t.accent, fontWeight: '800', fontSize: font.micro, letterSpacing: 1 }}>
            JAUGE {LETTER_LABEL[data.quiz.lettre].toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.question, { color: t.text }]}>{data.quiz.question}</Text>
      </View>

      <PhaseResult data={data} phase="before" title="Avant le sermon" icon="hourglass-outline" />
      <PhaseResult data={data} phase="after" title="Après le sermon" icon="checkmark-done-outline" banner={banner} />
    </ScrollView>
  );
}

function PhaseResult({
  data,
  phase,
  title,
  icon,
  banner,
}: {
  data: SermonQuizData;
  phase: QuizPhase;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  banner?: string | null;
}) {
  const t = useTheme();
  const total = data.totals[phase];

  return (
    <View style={styles.phase}>
      <View style={styles.phaseHeader}>
        <Ionicons name={icon} size={18} color={t.accent} />
        <Text style={[styles.phaseTitle, { color: t.text }]}>{title}</Text>
        <Text style={{ color: t.textMuted, fontSize: font.caption, marginLeft: 'auto' }}>
          {total} {total > 1 ? 'votes' : 'vote'}
        </Text>
      </View>

      {total === 0 ? (
        <View style={[styles.placeholder, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={{ color: t.textMuted, fontSize: font.body, textAlign: 'center' }}>
            {phase === 'before'
              ? 'Aucun vote pour l’instant — la question est posée dans le chat.'
              : 'Les résultats apparaîtront après le sermon.'}
          </Text>
        </View>
      ) : (
        <Histogram data={data} phase={phase} />
      )}

      {banner ? (
        <View style={[styles.banner, { backgroundColor: t.primarySoft, borderColor: t.accent }]}>
          <Ionicons name="sparkles" size={16} color={t.accent} />
          <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700', flex: 1 }}>{banner}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Histogram({ data, phase }: { data: SermonQuizData; phase: QuizPhase }) {
  const t = useTheme();
  const total = data.totals[phase];
  const myOptionId = data.myVote[phase];
  const max = Math.max(1, ...data.options.map((o) => (phase === 'before' ? o.before_count : o.after_count)));

  return (
    <View style={{ gap: spacing.sm }}>
      {data.options.map((o) => {
        const count = phase === 'before' ? o.before_count : o.after_count;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const mine = o.id === myOptionId;
        return (
          <View key={o.id} style={{ gap: 4 }}>
            <View style={styles.barLabelRow}>
              <Text
                numberOfLines={2}
                style={{ color: t.text, fontSize: font.caption, fontWeight: mine ? '800' : '500', flex: 1 }}
              >
                {o.texte}
                {o.is_positive ? '  ✓' : ''}
                {mine ? '  · toi' : ''}
              </Text>
              <Text style={{ color: t.textMuted, fontSize: font.caption, fontWeight: '700' }}>{pct}%</Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: t.surfaceAlt }]}>
              <View
                style={{
                  width: `${Math.max(count > 0 ? 6 : 0, (count / max) * 100)}%`,
                  height: '100%',
                  borderRadius: radius.sm,
                  backgroundColor: mine ? t.primary : o.is_positive ? t.success : t.accent,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  body: { fontSize: font.body, lineHeight: 22, maxWidth: 320 },
  questionCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  letterBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  question: { fontSize: font.subtitle, fontWeight: '700', lineHeight: 24 },
  phase: { gap: spacing.sm },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  phaseTitle: { fontSize: font.body, fontWeight: '800' },
  placeholder: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  barLabelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  barTrack: { height: 14, borderRadius: radius.sm, overflow: 'hidden' },
});
