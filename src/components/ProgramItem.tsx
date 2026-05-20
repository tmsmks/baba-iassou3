import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import type { ProgramItemWithFav } from '@/hooks/useProgram';

interface Props {
  item: ProgramItemWithFav;
  isLive: boolean;
  onToggleFav: () => void;
}

function formatHM(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function ProgramRow({ item, isLive, onToggleFav }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.surface,
          borderColor: isLive ? t.accent : t.border,
          borderWidth: isLive ? 2 : 1,
        },
      ]}
    >
      <View style={styles.hours}>
        <Text style={[styles.h, { color: isLive ? t.accent : t.text }]}>
          {formatHM(item.heure_debut)}
        </Text>
        <Text style={[styles.h2, { color: t.textMuted }]}>{formatHM(item.heure_fin)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
            {item.titre}
          </Text>
          {isLive ? (
            <View style={[styles.liveBadge, { backgroundColor: t.accent }]}>
              <Text style={styles.liveTxt}>EN COURS</Text>
            </View>
          ) : null}
        </View>
        {item.intervenant ? (
          <Text style={[styles.intervenant, { color: t.textMuted }]}>{item.intervenant}</Text>
        ) : null}
        {item.description ? (
          <Text style={[styles.desc, { color: t.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onToggleFav} hitSlop={10} style={styles.fav}>
        <Ionicons
          name={item.isFavorite ? 'star' : 'star-outline'}
          size={22}
          color={item.isFavorite ? t.accent : t.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  hours: { width: 64, paddingTop: 2 },
  h: { fontSize: font.subtitle, fontWeight: '800' },
  h2: { fontSize: font.caption, marginTop: 2 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: font.subtitle, fontWeight: '700', flexShrink: 1 },
  liveBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  liveTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  intervenant: { fontSize: font.caption, fontStyle: 'italic' },
  desc: { fontSize: font.caption, marginTop: spacing.xs },
  fav: { paddingLeft: spacing.sm, justifyContent: 'center' },
});
