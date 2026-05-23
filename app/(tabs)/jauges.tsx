import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Gauge } from '@/components/Gauge';
import { Button } from '@/components/Button';
import { font, spacing, useTheme } from '@/lib/theme';
import { useGauges, useConferenceState } from '@/hooks/useGauges';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import type { Lettre } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

const META: Record<Lettre, { nom: string; enjeu: string }> = {
  C: { nom: 'Clarté', enjeu: 'Je me connais et je sais ce que je valorise.' },
  H: { nom: 'Honnêteté', enjeu: 'Je suis honnête sur ce que je peux vraiment faire.' },
  O: { nom: 'Orientation', enjeu: 'Ce choix me rapproche-t-il du but de ma vie ?' },
  I: { nom: 'Impartialité', enjeu: 'Je vois les red flags évidents.' },
  X: { nom: 'X factor', enjeu: 'J\'accepte de ne pas tout maîtriser.' },
};

const ORDER: Lettre[] = ['C', 'H', 'O', 'I', 'X'];

async function signOut() {
  await supabase.auth.signOut();
}

export default function Jauges() {
  const t = useTheme();
  const { data: gauges, isLoading } = useGauges();
  const { data: conf } = useConferenceState();
  const prenom = useSessionStore((s) => s.profile?.prenom);
  const userId = useSessionStore((s) => s.user?.id);
  const { refreshing, onRefresh } = useAppRefresh([
    ['gauges', userId],
    ['conference_state'],
  ]);

  const totals = useMemo(() => {
    if (!gauges) return { answered: 0, total: 0 };
    const answered = gauges.c_count + gauges.h_count + gauges.o_count + gauges.i_count + gauges.x_count;
    return { answered, total: Math.max(answered, 5) };
  }, [gauges]);

  if (isLoading) {
    return (
      <Screen edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  const data = ORDER.map((l) => ({
    lettre: l,
    nom: META[l].nom,
    enjeu: META[l].enjeu,
    score: gauges ? Number((gauges as any)[`${l.toLowerCase()}_score`]) : 0,
    count: gauges ? Number((gauges as any)[`${l.toLowerCase()}_count`]) : 0,
  }));

  return (
    <Screen padded={false} edges={[]}>
      <FlatList
        data={data}
        keyExtractor={(d) => d.lettre}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={[styles.kicker, { color: t.accent }]}>
              Processus du choix
            </Text>
            <Text style={[styles.title, { color: t.text }]}>
              {prenom ? `${prenom}, voici tes 5 jauges.` : 'Tes 5 jauges.'}
            </Text>
            <Text style={[styles.sub, { color: t.textMuted }]}>
              {totals.answered === 0
                ? 'Tes jauges se rempliront au fil de tes réponses.'
                : `${totals.answered} réponse${totals.answered > 1 ? 's' : ''} enregistrée${totals.answered > 1 ? 's' : ''}.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Gauge lettre={item.lettre} nom={item.nom} enjeu={item.enjeu} score={item.score} count={item.count} />
        )}
        ListFooterComponent={
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {conf?.is_finished ? (
              <Button
                label="Recevoir mon verset personnel"
                onPress={() => router.push('/verset-final')}
              />
            ) : (
              <View style={[styles.notFinished, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                <Text style={{ color: t.textMuted, fontSize: font.caption, textAlign: 'center' }}>
                  La carte finale (verset personnel) sera disponible à la fin de la conférence.
                </Text>
              </View>
            )}
            <Pressable onPress={signOut} hitSlop={10}>
              <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: font.caption, paddingVertical: spacing.lg }}>
                Se déconnecter
              </Text>
            </Pressable>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: font.title, fontWeight: '800' },
  sub: { fontSize: font.body },
  notFinished: { padding: spacing.md, borderRadius: 12, borderWidth: 1 },
});
