import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
  /**
   * Safe area edges à insérer. Par défaut ['top'].
   * Passe [] sur un écran qui est déjà sous un header de navigator (qui gère le top inset).
   */
  edges?: Edge[];
}

export function Screen({ children, padded = true, style, edges = ['top'] }: Props) {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.bg }]} edges={edges}>
      <View style={[styles.flex, padded && styles.pad, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
});
