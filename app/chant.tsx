import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/Screen';
import { font, spacing, useTheme } from '@/lib/theme';
import { localChantUriOrFallback } from '@/hooks/useChantsPrefetch';
import type { Chant } from '@/types/database';

/**
 * Visualiseur de chant : affiche le PDF directement dans l'app (WebView) plutôt
 * que d'ouvrir Safari avec la barre d'URL. Utilise la version locale précachée
 * si dispo (ouverture hors-ligne), sinon l'URL distante.
 */
export default function ChantViewer() {
  const t = useTheme();
  const { id, url, titre } = useLocalSearchParams<{ id: string; url: string; titre: string }>();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!url) return;
      const resolved = await localChantUriOrFallback({ id, url } as Chant);
      if (!cancelled) setUri(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, url]);

  // Pour un fichier local (file://), WKWebView exige un accès lecture au dossier.
  const source =
    uri && uri.startsWith('file://')
      ? { uri, allowingReadAccessToURL: uri.slice(0, uri.lastIndexOf('/') + 1) }
      : uri
        ? { uri }
        : null;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={[styles.headerRow, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Fermer">
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
          {titre ?? 'Chant'}
        </Text>
        <View style={{ width: 26 }} />
      </View>
      {source ? (
        <WebView
          source={source}
          style={{ flex: 1, backgroundColor: t.bg }}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, { backgroundColor: t.bg }]}>
              <ActivityIndicator color={t.primary} />
            </View>
          )}
        />
      ) : (
        <View style={[styles.center, { backgroundColor: t.bg }]}>
          <ActivityIndicator color={t.primary} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.subtitle, fontWeight: '700' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
