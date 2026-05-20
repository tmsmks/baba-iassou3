import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, radius, spacing, font } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
}: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: t.primary,
    secondary: t.surfaceAlt,
    ghost: 'transparent',
    danger: t.danger,
  }[variant];

  const color = {
    primary: t.isDark ? t.bg : '#FFFFFF',
    secondary: t.text,
    ghost: t.primary,
    danger: '#FFFFFF',
  }[variant];

  const borderColor = variant === 'ghost' ? t.border : 'transparent';

  return (
    <Pressable
      onPress={async () => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: { fontSize: font.subtitle, fontWeight: '600' },
});
