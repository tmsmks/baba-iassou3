import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { font, radius, spacing, useTheme, lettreColors } from '@/lib/theme';
import type { Lettre } from '@/types/database';

interface Props {
  lettre: Lettre;
  nom: string;
  enjeu: string;
  score: number; // 0..5
  count: number;
}

export function Gauge({ lettre, nom, enjeu, score, count }: Props) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, score / 5));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const color = lettreColors[lettre];

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.row}>
        <View style={[styles.bubble, { backgroundColor: color }]}>
          <Text style={styles.bubbleTxt}>{lettre}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nom, { color: t.text }]}>{nom}</Text>
          <Text style={[styles.enjeu, { color: t.textMuted }]} numberOfLines={2}>
            {enjeu}
          </Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreVal, { color: t.text }]}>{score.toFixed(1)}</Text>
          <Text style={[styles.scoreMax, { color: t.textMuted }]}>/ 5</Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
        <Animated.View style={[styles.fill, animatedStyle, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.count, { color: t.textMuted }]}>
        {count === 0
          ? "Pas encore de réponse"
          : count === 1
          ? '1 réponse'
          : `${count} réponses`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTxt: { color: '#FFFFFF', fontSize: font.title, fontWeight: '800' },
  nom: { fontSize: font.subtitle, fontWeight: '700' },
  enjeu: { fontSize: font.caption, marginTop: 2 },
  scoreCol: { alignItems: 'flex-end' },
  scoreVal: { fontSize: font.title, fontWeight: '800' },
  scoreMax: { fontSize: font.micro },
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  count: { fontSize: font.micro },
});
