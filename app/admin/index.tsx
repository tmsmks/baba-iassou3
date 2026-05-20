import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { font, lettreColors, radius, spacing, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import { sendQuestion } from '@/lib/ai';
import type { ConferenceState, Lettre, ProgramItem, Question } from '@/types/database';

const LETTRES: Lettre[] = ['C', 'H', 'O', 'I', 'X'];

export default function Admin() {
  const t = useTheme();
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);

  if (isAdmin === false) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={{ color: t.danger }}>Accès réservé aux administrateurs.</Text>
          <Button label="Retour" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Admin conférence</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SendQuestionCard />
        <ConferenceStateCard />
        <ProgramEditorCard />
      </ScrollView>
    </Screen>
  );
}

function SendQuestionCard() {
  const t = useTheme();
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customLettre, setCustomLettre] = useState<Lettre>('C');
  const [customTexte, setCustomTexte] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('questions')
      .select('*')
      .order('lettre')
      .order('ordre')
      .then(({ data }) => setQuestions(data ?? []));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<Lettre, Question[]> = { C: [], H: [], O: [], I: [], X: [] };
    questions.forEach((q) => map[q.lettre].push(q));
    return map;
  }, [questions]);

  const send = async () => {
    setBusy(true);
    setLastResult(null);
    try {
      const res =
        tab === 'catalog' && selectedId
          ? await sendQuestion({ question_id: selectedId })
          : await sendQuestion({ lettre: customLettre, texte: customTexte });
      setLastResult(
        `Envoyé à ${res.users_targeted} utilisateur(s), ${res.devices_pushed} device(s) push.`,
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const canSend =
    !busy && (tab === 'catalog' ? !!selectedId : customTexte.trim().length > 5);

  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>Envoyer une question</Text>
      <View style={styles.tabsRow}>
        <TabBtn label="Catalogue" active={tab === 'catalog'} onPress={() => setTab('catalog')} />
        <TabBtn label="Custom" active={tab === 'custom'} onPress={() => setTab('custom')} />
      </View>

      {tab === 'catalog' ? (
        <View style={{ gap: spacing.md }}>
          {LETTRES.map((l) => (
            <View key={l} style={{ gap: spacing.xs }}>
              <Text style={[styles.groupTitle, { color: lettreColors[l] }]}>{l}</Text>
              {grouped[l].length === 0 ? (
                <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                  Aucune question, crée-en une en onglet « Custom ».
                </Text>
              ) : (
                grouped[l].map((q) => (
                  <Pressable
                    key={q.id}
                    onPress={() => setSelectedId(q.id)}
                    style={[
                      styles.qRow,
                      {
                        backgroundColor: selectedId === q.id ? t.primarySoft : t.surfaceAlt,
                        borderColor: selectedId === q.id ? t.primary : t.border,
                      },
                    ]}
                  >
                    <Text style={{ color: t.text, fontSize: font.body }}>{q.texte}</Text>
                  </Pressable>
                ))
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.tabsRow}>
            {LETTRES.map((l) => (
              <Pressable
                key={l}
                onPress={() => setCustomLettre(l)}
                style={[
                  styles.lettreChip,
                  {
                    backgroundColor: customLettre === l ? lettreColors[l] : t.surfaceAlt,
                    borderColor: t.border,
                  },
                ]}
              >
                <Text style={{ color: customLettre === l ? '#FFFFFF' : t.text, fontWeight: '800' }}>
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={customTexte}
            onChangeText={setCustomTexte}
            multiline
            placeholder="Texte de la question…"
            placeholderTextColor={t.textMuted}
            style={[
              styles.customInput,
              { color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border },
            ]}
          />
        </View>
      )}

      <Button label="Envoyer la notification à tous" onPress={send} loading={busy} disabled={!canSend} />
      {lastResult ? <Text style={{ color: t.success, fontSize: font.caption }}>{lastResult}</Text> : null}
    </View>
  );
}

function ConferenceStateCard() {
  const t = useTheme();
  const [state, setState] = useState<ConferenceState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('conference_state')
      .select('*')
      .eq('id', true)
      .single()
      .then(({ data }) => setState(data as ConferenceState | null));
  }, []);

  const toggle = async (val: boolean) => {
    if (!state) return;
    setSaving(true);
    const { error } = await supabase
      .from('conference_state')
      .update({ is_finished: val, updated_at: new Date().toISOString() })
      .eq('id', true);
    setSaving(false);
    if (error) Alert.alert('Erreur', error.message);
    else setState({ ...state, is_finished: val });
  };

  if (!state) return null;

  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>Fin de la conférence</Text>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: font.body, fontWeight: '600' }}>
            Conférence terminée
          </Text>
          <Text style={{ color: t.textMuted, fontSize: font.caption }}>
            Active pour débloquer la carte « verset personnel » à tous les participants.
          </Text>
        </View>
        <Switch
          value={state.is_finished}
          onValueChange={toggle}
          disabled={saving}
          thumbColor={state.is_finished ? t.accent : undefined}
        />
      </View>
    </View>
  );
}

function ProgramEditorCard() {
  const t = useTheme();
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ titre: '', intervenant: '', description: '', heure_debut: '', heure_fin: '' });

  const load = () =>
    supabase
      .from('program')
      .select('*')
      .order('heure_debut')
      .then(({ data }) => setItems(data ?? []));

  useEffect(() => {
    load();
  }, []);

  const startEdit = (it: ProgramItem) => {
    setEditingId(it.id);
    setDraft({
      titre: it.titre,
      intervenant: it.intervenant ?? '',
      description: it.description ?? '',
      heure_debut: it.heure_debut,
      heure_fin: it.heure_fin,
    });
  };

  const save = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from('program')
      .update({
        titre: draft.titre,
        intervenant: draft.intervenant || null,
        description: draft.description || null,
        heure_debut: draft.heure_debut,
        heure_fin: draft.heure_fin,
      })
      .eq('id', editingId);
    if (error) Alert.alert('Erreur', error.message);
    else {
      setEditingId(null);
      load();
    }
  };

  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>Programme</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Tape une session pour éditer ses détails. Format ISO 8601 attendu pour les horaires (ex : 2026-05-20T09:00:00+02:00).
      </Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {items.map((it) =>
          editingId === it.id ? (
            <View key={it.id} style={[styles.editor, { borderColor: t.primary, backgroundColor: t.primarySoft }]}>
              <TextField label="Titre" value={draft.titre} onChangeText={(v) => setDraft({ ...draft, titre: v })} />
              <TextField
                label="Intervenant"
                value={draft.intervenant}
                onChangeText={(v) => setDraft({ ...draft, intervenant: v })}
              />
              <TextField
                label="Description"
                value={draft.description}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                multiline
              />
              <TextField
                label="Début (ISO)"
                value={draft.heure_debut}
                onChangeText={(v) => setDraft({ ...draft, heure_debut: v })}
                autoCapitalize="none"
              />
              <TextField
                label="Fin (ISO)"
                value={draft.heure_fin}
                onChangeText={(v) => setDraft({ ...draft, heure_fin: v })}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Annuler" variant="ghost" onPress={() => setEditingId(null)} style={{ flex: 1 }} />
                <Button label="Enregistrer" onPress={save} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Pressable
              key={it.id}
              onPress={() => startEdit(it)}
              style={[styles.qRow, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
            >
              <Text style={{ color: t.text, fontWeight: '700' }}>{it.titre}</Text>
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                {new Date(it.heure_debut).toLocaleString('fr-FR')} → {new Date(it.heure_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabBtn,
        {
          backgroundColor: active ? t.primary : t.surfaceAlt,
          borderColor: t.border,
        },
      ]}
    >
      <Text style={{ color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const card = (t: ReturnType<typeof useTheme>) => ({
  backgroundColor: t.surface,
  borderColor: t.border,
  borderWidth: 1,
  borderRadius: radius.lg,
  padding: spacing.lg,
  gap: spacing.md,
});

const h2 = (t: ReturnType<typeof useTheme>) => ({
  color: t.text,
  fontSize: font.subtitle,
  fontWeight: '800' as const,
});

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: font.subtitle, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tabBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1 },
  groupTitle: { fontWeight: '900', fontSize: font.body, letterSpacing: 1 },
  qRow: { padding: spacing.md, borderRadius: 12, borderWidth: 1, gap: 2 },
  lettreChip: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  customInput: {
    minHeight: 100,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: font.body,
    textAlignVertical: 'top',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  editor: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
});
