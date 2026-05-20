import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { font, radius, spacing, useTheme } from '@/lib/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, Props>(({ label, error, style, ...rest }, ref) => {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.textMuted}
        {...rest}
        style={[
          styles.input,
          {
            color: t.text,
            backgroundColor: t.surface,
            borderColor: error ? t.danger : t.border,
          },
          style,
        ]}
      />
      {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
    </View>
  );
});

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: font.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: font.body,
  },
  error: { fontSize: font.caption },
});
