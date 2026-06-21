import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { font, radius, spacing, useTheme, lettreColors } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { TypingDots } from './TypingDots';
import { TypewriterText } from './TypewriterText';
import type { Lettre } from '@/types/database';

interface Props {
  from: 'ai' | 'user';
  text: string;
  lettre?: Lettre;
  score?: number | null;
  showAvatar?: boolean;
  /** Bulle « IAssou3 réfléchit… » (3 dots animés + mascotte qui rebondit). */
  thinking?: boolean;
  /** Anime l'apparition du texte en mode typewriter (pour la bulle qui vient d'arriver). */
  typewriter?: boolean;
  onTypewriterDone?: () => void;
}

export function ChatBubble({
  from,
  text,
  lettre,
  score,
  showAvatar = true,
  thinking = false,
  typewriter = false,
  onTypewriterDone,
}: Props) {
  const t = useTheme();
  const isAI = from === 'ai';

  const bg = isAI ? t.surface : t.primary;
  const color = isAI ? t.text : t.isDark ? t.bg : '#FFFFFF';
  const accent = lettre ? lettreColors[lettre] : t.accent;

  // Animation mascotte : doux balancement quand l'IA réfléchit
  const bounce = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (!isAI || !showAvatar) return;
    if (thinking) {
      bounce.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
      tilt.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(bounce);
      cancelAnimation(tilt);
      bounce.value = withTiming(0, { duration: 200 });
      tilt.value = withTiming(0, { duration: 200 });
    }
  }, [thinking, isAI, showAvatar, bounce, tilt]);

  const avatarAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }, { rotate: `${tilt.value}deg` }],
  }));

  return (
    <View
      style={[
        styles.row,
        { justifyContent: isAI ? 'flex-start' : 'flex-end', alignItems: 'flex-end' },
      ]}
    >
      {isAI ? (
        showAvatar ? (
          <Animated.View
            style={[
              styles.avatar,
              { backgroundColor: t.surfaceAlt, borderColor: t.border },
              avatarAnim,
            ]}
          >
            <Image source={assets.mascot} style={styles.avatarImg} resizeMode="contain" />
          </Animated.View>
        ) : (
          <View style={styles.avatarSpacer} />
        )
      ) : null}

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
        {isAI ? (
          <View style={[styles.tag, { backgroundColor: accent }]}>
            <Text style={styles.tagTxt}>IAssou3</Text>
            {lettre ? <Text style={styles.tagLettre}> · {lettre}</Text> : null}
          </View>
        ) : null}

        {thinking ? (
          <TypingDots color={t.textMuted} />
        ) : isAI && typewriter ? (
          <TypewriterText
            text={text}
            style={[styles.text, { color }]}
            onDone={onTypewriterDone}
          />
        ) : (
          <Text style={[styles.text, { color }]}>{text}</Text>
        )}

        {!isAI && typeof score === 'number' ? (
          <Text style={[styles.score, { color }]}>+{score} pts</Text>
        ) : null}
      </View>
    </View>
  );
}

const AVATAR = 40;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs, gap: spacing.sm },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: AVATAR + 4, height: AVATAR + 4 },
  avatarSpacer: { width: AVATAR },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagTxt: { color: '#FFFFFF', fontSize: font.micro, fontWeight: '800', letterSpacing: 0.3 },
  tagLettre: { color: '#FFFFFF', fontSize: font.micro, fontWeight: '800', opacity: 0.85 },
  text: { fontSize: font.body, lineHeight: 22 },
  score: { fontSize: font.micro, opacity: 0.8, alignSelf: 'flex-end' },
});
