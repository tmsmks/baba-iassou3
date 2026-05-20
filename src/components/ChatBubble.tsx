import { StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, useTheme, lettreColors } from '@/lib/theme';
import type { Lettre } from '@/types/database';

interface Props {
  from: 'ai' | 'user';
  text: string;
  lettre?: Lettre;
  score?: number | null;
}

export function ChatBubble({ from, text, lettre, score }: Props) {
  const t = useTheme();
  const isAI = from === 'ai';

  const bg = isAI ? t.surface : t.primary;
  const color = isAI ? t.text : t.isDark ? t.bg : '#FFFFFF';
  const accent = lettre ? lettreColors[lettre] : t.accent;

  return (
    <View style={[styles.row, { justifyContent: isAI ? 'flex-start' : 'flex-end' }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bg,
            borderColor: isAI ? t.border : 'transparent',
            borderTopLeftRadius: isAI ? radius.sm : radius.lg,
            borderTopRightRadius: isAI ? radius.lg : radius.sm,
          },
        ]}
      >
        {isAI && lettre ? (
          <View style={[styles.tag, { backgroundColor: accent }]}>
            <Text style={styles.tagTxt}>{lettre}</Text>
          </View>
        ) : null}
        <Text style={[styles.text, { color }]}>{text}</Text>
        {!isAI && typeof score === 'number' ? (
          <Text style={[styles.score, { color }]}>+{score} pts</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tag: {
    alignSelf: 'flex-start',
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagTxt: { color: '#FFFFFF', fontSize: font.caption, fontWeight: '800' },
  text: { fontSize: font.body, lineHeight: 22 },
  score: { fontSize: font.micro, opacity: 0.8, alignSelf: 'flex-end' },
});
