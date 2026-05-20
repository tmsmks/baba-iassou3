import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/lib/theme';

export default function Index() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.primary} />
    </View>
  );
}
