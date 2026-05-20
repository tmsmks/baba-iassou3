import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, padded = true, style }: Props) {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={[styles.flex, padded && styles.pad, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
});
