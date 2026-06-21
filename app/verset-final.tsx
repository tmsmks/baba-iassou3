import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, lettreColors, radius, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { fetchFinalVerse } from '@/lib/ai';
import { useSessionStore } from '@/store/session';
import type { FinalVerse } from '@/types/database';

export default function VersetFinal() {
  const t = useTheme();
  const prenom = useSessionStore((s) => s.profile?.prenom);
  const [verse, setVerse] = useState<FinalVerse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const v = await fetchFinalVerse();
        if (active) setVerse(v);
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Erreur');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const shareText = async () => {
    if (!verse) return;
    await Share.share({
      message: `« ${verse.verset_texte} » — ${verse.verset_ref}\n\n${verse.explication}\n\nSuis-Moi X`,
    });
  };

  const shareImage = async () => {
    if (!verse || !cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager ma carte verset',
        });
      } else {
        Alert.alert('Partage indisponible', 'Le partage n\'est pas disponible sur ce device.');
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de générer l\'image.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        {verse ? (
          <Pressable onPress={shareText} hitSlop={10}>
            <Ionicons name="share-outline" size={22} color={t.text} />
          </Pressable>
        ) : <View />}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
          <Text style={{ color: t.textMuted, marginTop: spacing.md }}>
            IAssou3 choisit un verset pour toi…
          </Text>
        </View>
      ) : error || !verse ? (
        <View style={styles.center}>
          <Text style={{ color: t.danger, textAlign: 'center' }}>{error ?? 'Impossible de charger le verset.'}</Text>
          <Button label="Réessayer" variant="ghost" onPress={() => router.replace('/verset-final')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.lg }}>
          <View style={styles.mascotRow}>
            <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          </View>
          <View style={[styles.tag, { backgroundColor: lettreColors[verse.lettre_faible] }]}>
            <Text style={styles.tagTxt}>Pour ta lettre « {verse.lettre_faible} »</Text>
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.ref, { color: t.accent }]}>{verse.verset_ref}</Text>
            <Text style={[styles.texte, { color: t.text }]}>« {verse.verset_texte} »</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.h2, { color: t.text }]}>Ce que tu peux faire</Text>
            <Text style={[styles.body, { color: t.text }]}>{verse.conseil}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.h2, { color: t.text }]}>Pourquoi ce verset, pour toi</Text>
            <Text style={[styles.body, { color: t.text }]}>{verse.explication}</Text>
          </View>

          {/* Vue à capturer pour partager — invisible, dessinée hors écran */}
          <View style={styles.captureWrap}>
            <ViewShot ref={cardRef as any} options={{ format: 'png', quality: 1 }}>
              <ShareableCard verse={verse} prenom={prenom ?? null} />
            </ViewShot>
          </View>

          <Button
            label="Partager ma carte"
            icon={<Ionicons name="share-social" size={18} color={t.isDark ? t.bg : '#FFFFFF'} />}
            onPress={shareImage}
            loading={sharing}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

function ShareableCard({ verse, prenom }: { verse: FinalVerse; prenom: string | null }) {
  const color = lettreColors[verse.lettre_faible];
  return (
    <View style={cardStyles.root}>
      <View style={[cardStyles.accent, { backgroundColor: color }]} />
      <View style={cardStyles.body}>
        <View style={cardStyles.header}>
          <Text style={cardStyles.kicker}>SUIS-MOI X · Dix ans, dix choix, un chemin</Text>
          <Image source={assets.mascot} style={cardStyles.mascot} resizeMode="contain" />
        </View>
        {prenom ? (
          <Text style={cardStyles.greeting}>Pour {prenom}</Text>
        ) : null}
        <View style={[cardStyles.lettrePill, { backgroundColor: color }]}>
          <Text style={cardStyles.lettreTxt}>Lettre « {verse.lettre_faible} »</Text>
        </View>
        <Text style={cardStyles.ref}>{verse.verset_ref}</Text>
        <Text style={cardStyles.verseText}>« {verse.verset_texte} »</Text>
        <View style={cardStyles.divider} />
        <Text style={cardStyles.conseilLabel}>Ton conseil</Text>
        <Text style={cardStyles.conseil}>{verse.conseil}</Text>
        <Text style={cardStyles.footer}>IAssou3 · Suis-Moi X 2026</Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  root: {
    width: 720,
    backgroundColor: '#F5F0E8',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accent: { width: 12 },
  body: { flex: 1, padding: 36, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: '#A07828', fontWeight: '800', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase', flex: 1 },
  mascot: { width: 80, height: 100 },
  greeting: { color: '#1A1208', fontSize: 28, fontWeight: '900', marginTop: 4 },
  lettrePill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginVertical: 8 },
  lettreTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  ref: { color: '#A07828', fontSize: 18, fontWeight: '800', marginTop: 4 },
  verseText: { color: '#1A1208', fontSize: 26, fontWeight: '500', lineHeight: 34, marginVertical: 4 },
  divider: { height: 1, backgroundColor: '#D8CDB5', marginVertical: 12 },
  conseilLabel: { color: '#A07828', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  conseil: { color: '#1A1208', fontSize: 16, lineHeight: 23 },
  footer: { color: '#7A6B5A', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 16, textAlign: 'right' },
});

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  mascotRow: { alignItems: 'center' },
  mascot: { width: 120, height: 160 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  tagTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: font.caption, letterSpacing: 1 },
  card: { padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  ref: { fontSize: font.subtitle, fontWeight: '800' },
  texte: { fontSize: font.title, lineHeight: 32, fontWeight: '500' },
  section: { gap: spacing.sm },
  h2: { fontSize: font.subtitle, fontWeight: '800' },
  body: { fontSize: font.body, lineHeight: 23 },
  // Vue capturée : positionnée hors écran (gauche : -10000) pour que ViewShot puisse la rendre
  // sans qu'elle s'affiche dans la scrollview.
  captureWrap: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
});
