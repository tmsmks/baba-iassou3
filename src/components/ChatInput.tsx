import { useState } from 'react';
import { StyleSheet, TextInput, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => Promise<void> | void;
  placeholder?: string;
}

export function ChatInput({ disabled, sending, onSend, placeholder }: Props) {
  const t = useTheme();
  const [value, setValue] = useState('');

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    setValue('');
    await onSend(trimmed);
  };

  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!disabled && !sending}
        placeholder={placeholder ?? 'Écris ta réponse à IAssou3…'}
        placeholderTextColor={t.textMuted}
        multiline
        keyboardAppearance={t.isDark ? 'dark' : 'light'}
        style={[
          styles.input,
          {
            color: t.text,
            backgroundColor: t.surfaceAlt,
            borderColor: t.border,
          },
        ]}
      />
      <Pressable
        onPress={handleSend}
        disabled={!value.trim() || sending || disabled}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: t.primary,
            opacity: !value.trim() || sending || disabled ? 0.4 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons name="send" size={20} color={t.isDark ? t.bg : '#FFFFFF'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: font.body,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 140,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
