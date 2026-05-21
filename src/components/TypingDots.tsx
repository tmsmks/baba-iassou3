import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  color: string;
  size?: number;
}

export function TypingDots({ color, size = 8 }: Props) {
  const a = useSharedValue(0.3);
  const b = useSharedValue(0.3);
  const c = useSharedValue(0.3);

  useEffect(() => {
    const bounce = (val: typeof a, delay: number) => {
      val.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 420 }),
            withTiming(0.3, { duration: 420 }),
          ),
          -1,
          false,
        ),
      );
    };
    bounce(a, 0);
    bounce(b, 180);
    bounce(c, 360);
  }, [a, b, c]);

  const sA = useAnimatedStyle(() => ({ opacity: a.value, transform: [{ scale: 0.85 + a.value * 0.3 }] }));
  const sB = useAnimatedStyle(() => ({ opacity: b.value, transform: [{ scale: 0.85 + b.value * 0.3 }] }));
  const sC = useAnimatedStyle(() => ({ opacity: c.value, transform: [{ scale: 0.85 + c.value * 0.3 }] }));

  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };

  return (
    <View style={styles.row}>
      <Animated.View style={[dot, sA]} />
      <Animated.View style={[dot, sB]} />
      <Animated.View style={[dot, sC]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingVertical: 6 },
});
