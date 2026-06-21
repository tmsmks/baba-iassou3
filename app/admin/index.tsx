import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { font, lettreColors, radius, spacing, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import { sendQuestion } from '@/lib/ai';
import { QuizManagerCard } from '@/components/admin/QuizManagerCard';
import type { Chant, ConferenceState, FaqQuestion, Lettre, ProgramItem, Question, Sermon } from '@/types/database';
import { ageFromDate, displayName, formatDateFR } from '@/lib/display';

const LETTRES: Lettre[] = ['C', 'H', 'O', 'I', 'X'];

type AdminTab = 'stats' | 'envoi' | 'conference' | 'sermons' | 'chants' | 'users' | 'messages';

const TABS: { id: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { id: 'envoi', label: 'Envoi', icon: 'send-outline' },
  { id: 'conference', label: 'Conférence', icon: 'calendar-outline' },
  { id: 'sermons', label: 'Sermons', icon: 'help-buoy-outline' },
  { id: 'messages', label: 'Modération', icon: 'flag-outline' },
  { id: 'chants', label: 'Chants', icon: 'musical-notes-outline' },
  { id: 'users', label: 'Utilisateurs', icon: 'people-outline' },
];

export default function Admin() {
  const t = useTheme();
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);
  const isModerator = useSessionStore((s) => s.profile?.is_moderator);
  const allowed = !!(isAdmin || isModerator);
  // Modérateurs : accès uniquement à l'onglet Sermons (FAQ)
  const visibleTabs = useMemo(
    () => (isAdmin ? TABS : TABS.filter((tab) => tab.id === 'sermons')),
    [isAdmin],
  );
  const [activeTab, setActiveTab] = useState<AdminTab>(isAdmin ? 'stats' : 'sermons');

  if (!allowed) {
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
        <Text style={[styles.title, { color: t.text }]}>
          {isAdmin ? 'Admin conférence' : 'Modération FAQ'}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.adminTabBtn,
                {
                  backgroundColor: active ? t.primary : t.surfaceAlt,
                  borderColor: active ? t.primary : t.border,
                },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={active ? (t.isDark ? t.bg : '#FFFFFF') : t.text}
              />
              <Text
                style={{
                  color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                  fontWeight: '700',
                  fontSize: font.caption,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
      >
        {activeTab === 'stats' && <StatsCard />}
        {activeTab === 'envoi' && (
          <>
            <SendQuestionCard />
            <BroadcastNotificationCard />
          </>
        )}
        {activeTab === 'conference' && (
          <>
            <ConferenceStateCard />
            <SecretFriendsPairingsCard />
            <ProgramEditorCard />
          </>
        )}
        {activeTab === 'sermons' && <SermonsManagerCard />}
        {activeTab === 'messages' && (
          <>
            <ReportsModCard />
            <SecretMessagesModCard />
          </>
        )}
        {activeTab === 'chants' && <ChantsManagerCard />}
        {activeTab === 'users' && (
          <>
            <ResetConversationsCard />
            <DeleteUsersCard />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

interface StatsPayload {
  total_participants: number;
  onboarded_participants: number;
  pending_invites: number;
  responses_today: number;
  responses_total: number;
  chat_questions_sent: number;
  gauges: { c: number; h: number; o: number; i: number; x: number };
  sermons: {
    id: string;
    intervenant: string;
    theme: string;
    debut_at: string;
    manual_open: boolean;
    questions_count: number;
    answered_count: number;
    total_likes: number;
  }[];
  photos_count: number;
  secret_messages_count: number;
  secret_friends_assigned: number;
  updated_at: string;
}

function StatsCard() {
  const t = useTheme();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_stats');
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setStats(data as StatsPayload);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading && !stats) {
    return (
      <View style={[card(t)]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (!stats) return null;

  const onboardedPct = stats.total_participants
    ? Math.round((stats.onboarded_participants / stats.total_participants) * 100)
    : 0;

  const lettres: { l: 'c' | 'h' | 'o' | 'i' | 'x'; nom: string; color: string }[] = [
    { l: 'c', nom: 'Clarté', color: lettreColors.C },
    { l: 'h', nom: 'Honnêteté', color: lettreColors.H },
    { l: 'o', nom: 'Orientation', color: lettreColors.O },
    { l: 'i', nom: 'Impartialité', color: lettreColors.I },
    { l: 'x', nom: 'X factor', color: lettreColors.X },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[card(t)]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[h2(t)]}>Vue d'ensemble</Text>
          <Pressable onPress={load} hitSlop={8}>
            <Ionicons name="refresh" size={20} color={t.textMuted} />
          </Pressable>
        </View>
        <View style={styles.statGrid}>
          <StatBox value={stats.total_participants} label="Participants" t={t} />
          <StatBox value={stats.onboarded_participants} label={`Onboardés (${onboardedPct}%)`} t={t} color={t.success} />
          <StatBox value={stats.responses_today} label="Réponses aujourd'hui" t={t} color={t.accent} />
          <StatBox value={stats.responses_total} label="Réponses total" t={t} />
          <StatBox value={stats.chat_questions_sent} label="Q. chat envoyées" t={t} />
          <StatBox value={stats.photos_count} label="Photos partagées" t={t} />
          <StatBox value={stats.secret_messages_count} label="Msg amis secrets" t={t} />
          <StatBox value={stats.secret_friends_assigned} label="Amis secrets" t={t} />
        </View>
        <Text style={{ color: t.textMuted, fontSize: font.micro, textAlign: 'right' }}>
          Maj : {new Date(stats.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
      </View>

      <View style={[card(t)]}>
        <Text style={[h2(t)]}>Distribution moyenne des jauges</Text>
        <View style={{ gap: spacing.sm }}>
          {lettres.map((row) => {
            const val = stats.gauges[row.l] ?? 0;
            const pct = Math.max(0, Math.min(1, val / 5));
            return (
              <View key={row.l} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>
                    {row.l.toUpperCase()} · {row.nom}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: font.caption }}>{val.toFixed(2)} / 5</Text>
                </View>
                <View style={{ height: 8, backgroundColor: t.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}>
                  <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: row.color }} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[card(t)]}>
        <Text style={[h2(t)]}>FAQ par sermon</Text>
        {stats.sermons.length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: font.caption }}>Aucun sermon programmé.</Text>
        ) : (
          stats.sermons.map((s) => {
            const answeredPct = s.questions_count
              ? Math.round((s.answered_count / s.questions_count) * 100)
              : 0;
            return (
              <View key={s.id} style={[styles.qRow, { backgroundColor: t.surfaceAlt, borderColor: t.border, gap: 4 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ color: t.text, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                    {s.intervenant}
                  </Text>
                  {s.manual_open ? (
                    <View style={[styles.badgeStat, { backgroundColor: t.success }]}>
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>OUVERT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: t.textMuted, fontSize: font.caption }}>{s.theme}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4, flexWrap: 'wrap' }}>
                  <Text style={{ color: t.text, fontSize: font.caption }}>
                    💬 <Text style={{ fontWeight: '800' }}>{s.questions_count}</Text> question
                    {s.questions_count > 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: t.text, fontSize: font.caption }}>
                    ✅ <Text style={{ fontWeight: '800' }}>{s.answered_count}</Text> répondue
                    {s.answered_count > 1 ? 's' : ''} ({answeredPct}%)
                  </Text>
                  <Text style={{ color: t.text, fontSize: font.caption }}>
                    ❤️ <Text style={{ fontWeight: '800' }}>{s.total_likes}</Text> likes
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function StatBox({
  value,
  label,
  t,
  color,
}: {
  value: number;
  label: string;
  t: ReturnType<typeof useTheme>;
  color?: string;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <Text style={{ color: color ?? t.text, fontSize: 28, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption, textAlign: 'center' }}>{label}</Text>
    </View>
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
      const tokens = res.tokens_registered ?? res.devices_pushed;
      setLastResult(
        `${res.users_targeted} participant(s) · ${res.devices_pushed} notif(s) push (${tokens} appareil(s) enregistré(s)).`,
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
  const [saving, setSaving] = useState<null | 'finished' | 'gauges' | 'secret'>(null);
  const [secretCount, setSecretCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('conference_state')
      .select('*')
      .eq('id', true)
      .single()
      .then(({ data }) => setState(data as ConferenceState | null));
  }, []);

  const update = async (
    key: keyof Pick<ConferenceState, 'is_finished' | 'gauges_unlocked' | 'secret_friends_revealed'>,
    val: boolean,
    busy: 'finished' | 'gauges' | 'secret',
  ) => {
    if (!state) return;
    setSaving(busy);
    const patch: Partial<ConferenceState> = { updated_at: new Date().toISOString() };
    patch[key] = val;
    const { error } = await supabase
      .from('conference_state')
      .update(patch)
      .eq('id', true);
    setSaving(null);
    if (error) Alert.alert('Erreur', error.message);
    else setState({ ...state, [key]: val });
  };

  const launchSecretFriends = () => {
    if (!state) return;
    Alert.alert(
      'Lancer les amis secrets ?',
      "Tous les participants (admins inclus) seront tirés au sort (cycle unique → personne ne tombe sur soi-même). Chaque participant recevra une notification avec le prénom de son ami secret. Tu peux relancer plus tard, ça écrase le tirage précédent.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          style: 'default',
          onPress: async () => {
            setSaving('secret');
            try {
              const { data: count, error } = await (supabase.rpc as any)(
                'admin_assign_secret_friends',
              );
              if (error) throw error;
              setSecretCount(typeof count === 'number' ? count : null);
              // Persister le flag en base pour que tous les clients le voient
              await supabase
                .from('conference_state')
                .update({ secret_friends_revealed: true })
                .eq('id', state.id);
              setState({ ...state, secret_friends_revealed: true });
              // Notification push à tous
              const { error: notifErr } = await supabase.functions.invoke('broadcast-notification', {
                body: {
                  title: 'Ton ami secret est arrivé !',
                  body: 'Découvre qui tu dois gâter durant la conférence (en secret 🤫).',
                  data: { type: 'secret_friend' },
                },
              });
              if (notifErr) {
                Alert.alert(
                  'Tirage OK',
                  `${count ?? '?'} participant(s) appariés. Notification non envoyée : ${notifErr.message}`,
                );
              } else {
                Alert.alert(
                  'Amis secrets lancés',
                  `${count ?? '?'} participant(s) appariés. Notification envoyée à tous.`,
                );
              }
            } catch (e: any) {
              Alert.alert('Erreur', e?.message ?? 'Échec du tirage');
            } finally {
              setSaving(null);
            }
          },
        },
      ],
    );
  };

  if (!state) return null;

  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>État de la conférence</Text>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: font.body, fontWeight: '600' }}>
            Débloquer les jauges
          </Text>
          <Text style={{ color: t.textMuted, fontSize: font.caption }}>
            À activer après le Workshop 1 (Ruth). Les participants découvrent leurs 5 indicateurs.
          </Text>
        </View>
        <Switch
          value={state.gauges_unlocked}
          onValueChange={(v) => update('gauges_unlocked', v, 'gauges')}
          disabled={saving !== null}
          thumbColor={state.gauges_unlocked ? t.accent : undefined}
        />
      </View>

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
          onValueChange={(v) => update('is_finished', v, 'finished')}
          disabled={saving !== null}
          thumbColor={state.is_finished ? t.accent : undefined}
        />
      </View>

      <View style={[styles.toggleRow, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: font.body, fontWeight: '600' }}>
            Amis secrets
          </Text>
          <Text style={{ color: t.textMuted, fontSize: font.caption }}>
            {state.secret_friends_revealed
              ? 'Tirage effectué — chaque participant peut voir son ami secret.'
              : 'À lancer une fois tous les participants inscrits.'}
          </Text>
          {secretCount !== null ? (
            <Text style={{ color: t.success, fontSize: font.caption, marginTop: 4 }}>
              Dernier tirage : {secretCount} participant(s).
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        label={state.secret_friends_revealed ? 'Relancer le tirage' : 'Lancer les amis secrets'}
        onPress={launchSecretFriends}
        loading={saving === 'secret'}
        variant={state.secret_friends_revealed ? 'secondary' : 'primary'}
      />

      {state.secret_friends_revealed ? (
        <View style={[styles.toggleRow, { marginTop: spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: font.body, fontWeight: '600' }}>
              Grande révélation
            </Text>
            <Text style={{ color: t.textMuted, fontSize: font.caption }}>
              {state.secret_reveal_at
                ? `Active depuis ${new Date(state.secret_reveal_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Tout le monde peut voir son donneur et son receveur.`
                : 'À lancer à la cérémonie de clôture. Une notification push est envoyée à tous.'}
            </Text>
          </View>
          <Switch
            value={!!state.secret_reveal_at}
            onValueChange={async (val) => {
              setSaving('secret');
              try {
                const { error } = await (supabase.rpc as any)('admin_toggle_secret_reveal', { value: val });
                if (error) throw error;
                setState({
                  ...state,
                  secret_reveal_at: val ? new Date().toISOString() : null,
                });
                if (val) {
                  await supabase.functions
                    .invoke('broadcast-notification', {
                      body: {
                        title: 'La grande révélation est lancée ! 🎉',
                        body: 'Découvre qui était ton ami secret.',
                        data: { type: 'secret_reveal' },
                      },
                    })
                    .catch(() => {});
                }
              } catch (e: any) {
                Alert.alert('Erreur', e?.message ?? 'Échec');
              } finally {
                setSaving(null);
              }
            }}
            disabled={saving !== null}
            thumbColor={state.secret_reveal_at ? t.accent : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

interface AdminPairing {
  giver_id: string;
  giver_prenom: string;
  giver_nom: string;
  receiver_id: string;
  receiver_prenom: string;
  receiver_nom: string;
}

function SecretFriendsPairingsCard() {
  const t = useTheme();
  const profiles = useAdminProfiles();
  const [pairings, setPairings] = useState<AdminPairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGiver, setEditingGiver] = useState<string | null>(null);
  const [chosenReceiver, setChosenReceiver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchPairings = async () => {
    setLoading(true);
    const { data } = await (supabase.rpc as any)('admin_list_secret_friends');
    setPairings((data ?? []) as AdminPairing[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPairings();
  }, []);

  const profilesById = useMemo(() => {
    const map = new Map<string, AdminProfile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  // Givers sans appariement (utile pour ajouter un nouvel appariement)
  const unpaired = useMemo(() => {
    const pairedIds = new Set(pairings.map((p) => p.giver_id));
    return profiles.filter((p) => !pairedIds.has(p.id));
  }, [profiles, pairings]);

  const startEdit = (giverId: string) => {
    setEditingGiver(giverId);
    const current = pairings.find((p) => p.giver_id === giverId);
    setChosenReceiver(current?.receiver_id ?? null);
  };

  const saveEdit = async () => {
    if (!editingGiver || !chosenReceiver) return;
    if (editingGiver === chosenReceiver) {
      Alert.alert('Erreur', "Un participant ne peut pas s'apparier à lui-même.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)('admin_set_secret_friend', {
        giver_uid: editingGiver,
        receiver_uid: chosenReceiver,
      });
      if (error) throw error;
      await fetchPairings();
      setEditingGiver(null);
      setChosenReceiver(null);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[card(t)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[h2(t)]}>Appariements amis secrets</Text>
        <Pressable onPress={fetchPairings} hitSlop={10}>
          <Ionicons name="refresh" size={20} color={t.textMuted} />
        </Pressable>
      </View>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Modifie qui doit gâter qui. Utile si quelqu'un est absent ou si tu veux imposer un appariement précis.
      </Text>

      {loading ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: spacing.md }} />
      ) : pairings.length === 0 ? (
        <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: spacing.md }}>
          Aucun appariement. Lance d'abord le tirage ou crée-en un manuellement ci-dessous.
        </Text>
      ) : (
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          {pairings.map((p) => {
            const isEditing = editingGiver === p.giver_id;
            return (
              <View key={p.giver_id} style={{ gap: spacing.xs }}>
                <Pressable
                  onPress={() => (isEditing ? setEditingGiver(null) : startEdit(p.giver_id))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: isEditing ? t.primarySoft : t.surfaceAlt,
                    borderWidth: 1,
                    borderColor: isEditing ? t.primary : t.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '700' }}>
                      {p.giver_prenom} {p.giver_nom}
                    </Text>
                    <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                      gâte → {p.receiver_prenom} {p.receiver_nom}
                    </Text>
                  </View>
                  <Ionicons
                    name={isEditing ? 'chevron-up' : 'create-outline'}
                    size={18}
                    color={t.textMuted}
                  />
                </Pressable>

                {isEditing ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: t.border,
                      borderRadius: radius.md,
                      padding: spacing.sm,
                      gap: spacing.sm,
                    }}
                  >
                    <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                      Choisis le nouveau receveur pour {p.giver_prenom} :
                    </Text>
                    <View style={{ maxHeight: 200 }}>
                      <ScrollView nestedScrollEnabled>
                        <View style={{ gap: 4 }}>
                          {profiles
                            .filter((pp) => pp.id !== p.giver_id)
                            .map((pp) => {
                              const sel = chosenReceiver === pp.id;
                              return (
                                <Pressable
                                  key={pp.id}
                                  onPress={() => setChosenReceiver(pp.id)}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing.sm,
                                    padding: spacing.sm,
                                    borderRadius: radius.sm,
                                    backgroundColor: sel ? t.primarySoft : 'transparent',
                                  }}
                                >
                                  <Ionicons
                                    name={sel ? 'radio-button-on' : 'radio-button-off'}
                                    size={18}
                                    color={sel ? t.primary : t.textMuted}
                                  />
                                  <Text style={{ color: t.text, fontWeight: sel ? '700' : '500' }}>
                                    {displayName(pp) || pp.email}
                                  </Text>
                                </Pressable>
                              );
                            })}
                        </View>
                      </ScrollView>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Button
                        label="Annuler"
                        variant="ghost"
                        onPress={() => setEditingGiver(null)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label="Enregistrer"
                        onPress={saveEdit}
                        loading={busy}
                        disabled={!chosenReceiver || chosenReceiver === p.giver_id}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {unpaired.length > 0 ? (
        <View
          style={{
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: t.border,
            gap: spacing.sm,
          }}
        >
          <Text style={{ color: t.text, fontWeight: '700', fontSize: font.body }}>
            Participants sans appariement ({unpaired.length})
          </Text>
          {unpaired.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => {
                setEditingGiver(u.id);
                setChosenReceiver(null);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: editingGiver === u.id ? t.primarySoft : t.surfaceAlt,
                borderWidth: 1,
                borderColor: editingGiver === u.id ? t.primary : t.border,
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={t.accent} />
              <Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>
                {displayName(u) || u.email}
              </Text>
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>Apparier…</Text>
            </Pressable>
          ))}
          {editingGiver && unpaired.some((u) => u.id === editingGiver) ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: radius.md,
                padding: spacing.sm,
                gap: spacing.sm,
              }}
            >
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                Receveur pour {profilesById.get(editingGiver)?.prenom ?? '?'} :
              </Text>
              <View style={{ maxHeight: 200 }}>
                <ScrollView nestedScrollEnabled>
                  <View style={{ gap: 4 }}>
                    {profiles
                      .filter((pp) => pp.id !== editingGiver)
                      .map((pp) => {
                        const sel = chosenReceiver === pp.id;
                        return (
                          <Pressable
                            key={pp.id}
                            onPress={() => setChosenReceiver(pp.id)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: spacing.sm,
                              padding: spacing.sm,
                              borderRadius: radius.sm,
                              backgroundColor: sel ? t.primarySoft : 'transparent',
                            }}
                          >
                            <Ionicons
                              name={sel ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={sel ? t.primary : t.textMuted}
                            />
                            <Text style={{ color: t.text, fontWeight: sel ? '700' : '500' }}>
                              {displayName(pp) || pp.email}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </ScrollView>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Annuler"
                  variant="ghost"
                  onPress={() => setEditingGiver(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Apparier"
                  onPress={saveEdit}
                  loading={busy}
                  disabled={!chosenReceiver || chosenReceiver === editingGiver}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function programDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-07-03T18:15:00+02:00" → "18:15" (heure locale du device, idem que ce que voit le user) */
function timeFromIso(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Force le format HH:mm pendant la saisie — n'accepte que des chiffres + insère ":" au bon endroit. */
function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidHHmm(v: string): boolean {
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && mn >= 0 && mn <= 59;
}

/** Combine un dayKey "YYYY-MM-DD" + une heure "HH:mm" → ISO complète (UTC) */
function isoFromDayAndTime(dayKey: string, hhmm: string): string {
  const [y, mo, da] = dayKey.split('-').map((n) => parseInt(n, 10));
  const [h, mn] = hhmm.split(':').map((n) => parseInt(n, 10));
  return new Date(y, mo - 1, da, h, mn, 0, 0).toISOString();
}

function ProgramEditorCard() {
  const t = useTheme();
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    titre: '',
    intervenant: '',
    description: '',
    heure_debut: '', // "HH:mm"
    heure_fin: '', // "HH:mm"
    dayKey: '', // "YYYY-MM-DD" de l'élément édité (immuable pendant l'édition)
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = () =>
    (supabase.from('program') as any)
      .select('*')
      .order('heure_debut')
      .then(({ data }: { data: ProgramItem[] | null }) => setItems(data ?? []));

  useEffect(() => {
    load();
  }, []);

  const days = useMemo(() => {
    const map = new Map<string, ProgramItem[]>();
    for (const it of items) {
      const k = programDayKey(it.heure_debut);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, arr], idx) => {
        const d = new Date(arr[0].heure_debut);
        return {
          key,
          index: idx + 1,
          label: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
          dateLabel: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          items: arr,
        };
      });
  }, [items]);

  const activeKey = selectedDay && days.some((d) => d.key === selectedDay) ? selectedDay : days[0]?.key ?? null;
  const activeDay = days.find((d) => d.key === activeKey) ?? null;

  const startEdit = (it: ProgramItem) => {
    setEditingId(it.id);
    setDraft({
      titre: it.titre,
      intervenant: it.intervenant ?? '',
      description: it.description ?? '',
      heure_debut: timeFromIso(it.heure_debut),
      heure_fin: timeFromIso(it.heure_fin),
      dayKey: programDayKey(it.heure_debut),
    });
  };

  const save = async () => {
    if (!editingId) return;
    if (!isValidHHmm(draft.heure_debut) || !isValidHHmm(draft.heure_fin)) {
      Alert.alert('Heure invalide', 'Saisis les heures au format HH:mm (00-23 : 00-59).');
      return;
    }
    const debutIso = isoFromDayAndTime(draft.dayKey, draft.heure_debut);
    let finIso = isoFromDayAndTime(draft.dayKey, draft.heure_fin);
    // Si la fin est avant le début (ex. 23:30 → 00:30), on bascule sur le jour suivant
    if (new Date(finIso).getTime() <= new Date(debutIso).getTime()) {
      const d = new Date(finIso);
      d.setDate(d.getDate() + 1);
      finIso = d.toISOString();
    }
    const { error } = await (supabase.from('program') as any)
      .update({
        titre: draft.titre,
        intervenant: draft.intervenant || null,
        description: draft.description || null,
        heure_debut: debutIso,
        heure_fin: finIso,
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
        Tape une session pour éditer ses détails. Heures au format HH:mm (le jour reste celui du sous-onglet).
      </Text>

      {days.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs }}
        >
          {days.map((d) => {
            const active = d.key === activeKey;
            return (
              <Pressable
                key={d.key}
                onPress={() => setSelectedDay(d.key)}
                style={[
                  styles.adminDayChip,
                  {
                    backgroundColor: active ? t.primary : t.surfaceAlt,
                    borderColor: active ? t.primary : t.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.textMuted,
                    fontWeight: '700',
                    fontSize: font.micro,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Jour {d.index}
                </Text>
                <Text
                  style={{
                    color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                    fontWeight: '800',
                    fontSize: font.caption,
                    textTransform: 'capitalize',
                  }}
                >
                  {d.label}
                </Text>
                <Text
                  style={{
                    color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.textMuted,
                    fontSize: font.micro,
                  }}
                >
                  {d.dateLabel} · {d.items.length}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {(activeDay?.items ?? []).map((it) =>
          editingId === it.id ? (
            <View key={it.id} style={[styles.editor, { borderColor: t.primary, backgroundColor: t.primarySoft }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={14} color={t.textMuted} />
                <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                  {new Date(draft.dayKey).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
              </View>
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
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Début"
                    value={draft.heure_debut}
                    onChangeText={(v) => setDraft({ ...draft, heure_debut: maskTimeInput(v) })}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="HH:mm"
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Fin"
                    value={draft.heure_fin}
                    onChangeText={(v) => setDraft({ ...draft, heure_fin: maskTimeInput(v) })}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="HH:mm"
                    autoCapitalize="none"
                  />
                </View>
              </View>
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
                {new Date(it.heure_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(it.heure_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          ),
        )}
        {activeDay && activeDay.items.length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: font.caption, textAlign: 'center' }}>
            Aucune session ce jour-là.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type ChantDraft = {
  id: string | null;
  titre: string;
  ordre: string;
  url: string;
  storagePath: string | null;
  /** Nom original du fichier choisi (pour titre par défaut) */
  pdfFileName: string | null;
};

const EMPTY_DRAFT: ChantDraft = {
  id: null,
  titre: '',
  ordre: '0',
  url: '',
  storagePath: null,
  pdfFileName: null,
};

function titleFromPdfFileName(fileName: string): string {
  const base = decodeURIComponent(fileName)
    .replace(/^.*\//, '')
    .replace(/\.pdf$/i, '')
    .replace(/^\d+-/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!base) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function resolveChantTitle(draft: ChantDraft): string {
  const manual = draft.titre.trim();
  if (manual) return manual;
  if (draft.pdfFileName) {
    const fromPicker = titleFromPdfFileName(draft.pdfFileName);
    if (fromPicker) return fromPicker;
  }
  if (draft.storagePath) {
    const fromStorage = titleFromPdfFileName(draft.storagePath.split('/').pop() ?? '');
    if (fromStorage) return fromStorage;
  }
  if (draft.url) {
    try {
      const path = decodeURIComponent(new URL(draft.url).pathname);
      const fromUrl = titleFromPdfFileName(path.split('/').pop() ?? '');
      if (fromUrl) return fromUrl;
    } catch {
      const fromUrl = titleFromPdfFileName(draft.url.split('/').pop() ?? '');
      if (fromUrl) return fromUrl;
    }
  }
  return '';
}

function extractStoragePath(url: string): string | null {
  const marker = '/storage/v1/object/public/chants/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function ChantsManagerCard() {
  const t = useTheme();
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  const [items, setItems] = useState<Chant[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ChantDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chants')
      .select('*')
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setItems((data ?? []) as Chant[]);
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => setDraft({ ...EMPTY_DRAFT, ordre: String(items.length) });
  const startEdit = (c: Chant) =>
    setDraft({
      id: c.id,
      titre: c.titre,
      ordre: String(c.ordre),
      url: c.url,
      storagePath: extractStoragePath(c.url),
      pdfFileName: null,
    });

  const pickPdf = async () => {
    if (!draft) return;
    setUploading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const ext = (asset.name?.split('.').pop() ?? 'pdf').toLowerCase();
      const safeName = (asset.name ?? `chant-${Date.now()}.${ext}`)
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-');
      const path = `${userId ?? 'admin'}/${Date.now()}-${safeName}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: upErr } = await supabase.storage
        .from('chants')
        .upload(path, arrayBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('chants').getPublicUrl(path);
      const pdfFileName = asset.name ?? '';
      const autoTitle = titleFromPdfFileName(pdfFileName);
      setDraft({
        ...draft,
        url: pub.publicUrl,
        storagePath: path,
        pdfFileName: pdfFileName || null,
        titre: draft.titre.trim() || autoTitle,
      });
    } catch (e: any) {
      Alert.alert('Échec de l’upload', e?.message ?? 'Vérifie que le bucket « chants » existe et est public.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const titre = resolveChantTitle(draft);
    if (titre.length < 1) {
      Alert.alert('Titre manquant', 'Donne un titre ou choisis un PDF (le nom du fichier sera utilisé).');
      return;
    }
    if (!draft.url) {
      Alert.alert('PDF manquant', 'Choisis un PDF ou colle une URL.');
      return;
    }
    const ordre = Number.parseInt(draft.ordre, 10);
    setSaving(true);
    try {
      if (draft.id) {
        const { error } = await supabase
          .from('chants')
          .update({
            titre,
            ordre: Number.isFinite(ordre) ? ordre : 0,
            url: draft.url,
          })
          .eq('id', draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chants').insert({
          titre,
          ordre: Number.isFinite(ordre) ? ordre : 0,
          url: draft.url,
          created_by: userId ?? null,
        });
        if (error) throw error;
      }
      setDraft(null);
      await load();
      qc.invalidateQueries({ queryKey: ['chants'] });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const remove = (chant: Chant) => {
    Alert.alert(
      'Supprimer ce chant ?',
      `« ${chant.titre} » sera retiré de la liste. Le PDF sera également effacé du stockage si possible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('chants').delete().eq('id', chant.id);
              if (error) throw error;
              const path = extractStoragePath(chant.url);
              if (path) {
                await supabase.storage.from('chants').remove([path]).catch(() => {});
              }
              await load();
              qc.invalidateQueries({ queryKey: ['chants'] });
            } catch (e: any) {
              Alert.alert('Erreur', e?.message ?? 'Échec de la suppression');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>Chants</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Uploade les PDFs des chants. Ils sont accessibles à tous les utilisateurs depuis l’onglet « Chants ». L’ordre détermine la position dans la liste.
      </Text>

      {loading ? (
        <ActivityIndicator color={t.primary} />
      ) : items.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: font.caption }}>Aucun chant pour l’instant.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((c) => (
            <View
              key={c.id}
              style={[styles.qRow, { backgroundColor: t.surfaceAlt, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{c.titre}</Text>
                <Text style={{ color: t.textMuted, fontSize: font.caption }} numberOfLines={1}>
                  Ordre {c.ordre} · {c.url}
                </Text>
              </View>
              <Pressable onPress={() => startEdit(c)} hitSlop={8} style={{ padding: 6 }}>
                <Ionicons name="create-outline" size={20} color={t.text} />
              </Pressable>
              <Pressable onPress={() => remove(c)} hitSlop={8} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={20} color={t.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {draft ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={[styles.editor, { borderColor: t.primary, backgroundColor: t.primarySoft }]}>
            <Text style={{ color: t.text, fontWeight: '800' }}>
              {draft.id ? 'Modifier un chant' : 'Nouveau chant'}
            </Text>
            <TextField
              label="Titre"
              value={draft.titre}
              onChangeText={(v) => setDraft({ ...draft, titre: v })}
              placeholder="Ex : Tu es saint"
            />
            <TextField
              label="Ordre"
              value={draft.ordre}
              onChangeText={(v) => setDraft({ ...draft, ordre: v.replace(/[^0-9-]/g, '') })}
              keyboardType="number-pad"
            />
            <TextField
              label="URL publique (optionnel si PDF uploadé)"
              value={draft.url}
              onChangeText={(v) => {
                const storagePath = extractStoragePath(v);
                const next: ChantDraft = { ...draft, url: v, storagePath };
                if (!draft.titre.trim() && v.trim()) {
                  const fromUrl = resolveChantTitle({ ...next, titre: '' });
                  if (fromUrl) next.titre = fromUrl;
                }
                setDraft(next);
              }}
              placeholder="https://…/chant.pdf"
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                PDF {draft.storagePath ? '(uploadé)' : draft.url ? '(lien ci-dessus)' : ''}
              </Text>
              {draft.url ? (
                <Text style={{ color: t.text, fontSize: font.caption }} numberOfLines={2}>
                  {draft.url}
                </Text>
              ) : null}
              <Button
                label={draft.url ? 'Remplacer le PDF' : 'Choisir un PDF'}
                variant="secondary"
                loading={uploading}
                icon={<Ionicons name="cloud-upload-outline" size={18} color={t.text} />}
                onPress={pickPdf}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Annuler" variant="ghost" onPress={() => setDraft(null)} style={{ flex: 1 }} />
              <Button label={draft.id ? 'Enregistrer' : 'Ajouter'} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <Button
          label="Ajouter un chant"
          icon={<Ionicons name="add" size={18} color={t.isDark ? t.bg : '#FFFFFF'} />}
          onPress={startCreate}
        />
      )}
    </View>
  );
}

function DangerZoneCard() {
  const t = useTheme();
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const resetConversation = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      // Identifie d'abord les deliveries non-onboarding pour ne pas casser l'onboarding du user.
      const { data: deliveries, error: selErr } = await supabase
        .from('question_deliveries')
        .select('id, questions!inner(is_onboarding)')
        .eq('user_id', userId)
        .eq('questions.is_onboarding', false);
      if (selErr) throw selErr;
      const ids = (deliveries ?? []).map((d: any) => d.id);
      if (ids.length === 0) {
        Alert.alert('Rien à effacer', 'Aucune question (hors onboarding) à supprimer.');
        return;
      }
      const { error } = await supabase
        .from('question_deliveries')
        .delete()
        .in('id', ids);
      if (error) throw error;
      qc.setQueryData(['chat-thread', userId], []);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['chat-thread', userId] }),
        qc.invalidateQueries({ queryKey: ['gauges', userId] }),
      ]);
      Alert.alert('Conversation effacée', 'Tes messages et tes jauges (hors onboarding) ont été remis à zéro.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec de la réinitialisation');
    } finally {
      setBusy(false);
    }
  };

  const resetFinalVerse = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const { data: deleted, error } = await supabase
        .from('final_verse')
        .delete()
        .eq('user_id', userId)
        .select('user_id');
      if (error) throw error;
      if (!deleted?.length) {
        Alert.alert('Rien à effacer', 'Aucun verset final enregistré pour ton compte.');
        return;
      }
      Alert.alert('Verset effacé', 'Tu pourras en regénérer un.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const confirm = (title: string, message: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: action },
    ]);
  };

  return (
    <View style={[card(t), { borderColor: t.danger }]}>
      <Text style={[h2(t), { color: t.danger }]}>Zone de test</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Réservé aux comptes admin pour tester l'app. Ces actions n'affectent QUE ton propre compte.
      </Text>
      <Button
        label="Réinitialiser ma conversation"
        variant="danger"
        loading={busy}
        onPress={() =>
          confirm(
            'Réinitialiser ?',
            "Toutes tes questions reçues, réponses et jauges seront effacées. Action irréversible.",
            resetConversation,
          )
        }
      />
      <Button
        label="Effacer mon verset final"
        variant="ghost"
        loading={busy}
        onPress={() =>
          confirm(
            'Effacer le verset ?',
            'Tu pourras en regénérer un en rouvrant la carte finale.',
            resetFinalVerse,
          )
        }
      />
    </View>
  );
}

interface AdminProfile {
  id: string;
  prenom: string;
  nom: string | null;
  date_naissance: string | null;
  email: string;
  is_moderator?: boolean;
  is_admin?: boolean;
}

function useAdminProfiles() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, prenom, nom, date_naissance, email')
      .order('prenom')
      .then(({ data }) => setProfiles((data ?? []) as AdminProfile[]));
  }, []);
  return profiles;
}

function UserMultiSelector({
  profiles,
  selected,
  onChange,
}: {
  profiles: AdminProfile[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const t = useTheme();
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const allSelected = selected.size === profiles.length && profiles.length > 0;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          label={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          variant="ghost"
          onPress={() => onChange(allSelected ? new Set() : new Set(profiles.map((p) => p.id)))}
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ maxHeight: 220 }}>
        <ScrollView nestedScrollEnabled>
          <View style={{ gap: spacing.xs }}>
            {profiles.map((p) => {
              const isSel = selected.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => toggle(p.id)}
                  style={[
                    styles.qRow,
                    {
                      backgroundColor: isSel ? t.primarySoft : t.surfaceAlt,
                      borderColor: isSel ? t.primary : t.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name={isSel ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isSel ? t.primary : t.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '700' }}>
                      {displayName(p) || p.email}
                    </Text>
                    {(() => {
                      const age = ageFromDate(p.date_naissance);
                      return age != null ? (
                        <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                          {age} an{age > 1 ? 's' : ''} · né(e) le {formatDateFR(p.date_naissance)}
                        </Text>
                      ) : null;
                    })()}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        {selected.size === 0
          ? 'Aucun utilisateur sélectionné = tous les utilisateurs'
          : `${selected.size} utilisateur${selected.size > 1 ? 's' : ''} sélectionné${selected.size > 1 ? 's' : ''}`}
      </Text>
    </View>
  );
}

function BroadcastNotificationCard() {
  const t = useTheme();
  const profiles = useAdminProfiles();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setLastResult(null);
    try {
      const userIds = selected.size > 0 ? Array.from(selected) : undefined;
      const { data, error } = await supabase.functions.invoke<{
        users_targeted: number;
        devices_pushed: number;
        devices_failed: number;
        tokens_registered?: number;
      }>('broadcast-notification', {
        body: { title: title.trim(), body: body.trim(), user_ids: userIds },
      });
      if (error) throw error;
      if (!data) throw new Error('Réponse vide');
      setLastResult(
        `${data.users_targeted} utilisateur(s) · ${data.devices_pushed} notif(s) push (${data.tokens_registered ?? data.devices_pushed} appareil(s) enregistré(s)).`,
      );
      setTitle('');
      setBody('');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const canSend = !busy && title.trim().length > 0 && body.trim().length > 0;

  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>Envoyer une notification</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Notification libre, sans création de question. Pour cibler quelques utilisateurs, sélectionne-les ci-dessous. Sinon, laisse vide pour envoyer à tous.
      </Text>
      <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="Ex : Rappel session de 14h" />
      <View>
        <Text style={{ color: t.textMuted, fontSize: font.caption, marginBottom: 4 }}>Message</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Le contenu de la notification…"
          placeholderTextColor={t.textMuted}
          style={[
            styles.customInput,
            { color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border },
          ]}
        />
      </View>
      <UserMultiSelector profiles={profiles} selected={selected} onChange={setSelected} />
      <Button label="Envoyer la notification" onPress={send} loading={busy} disabled={!canSend} />
      {lastResult ? <Text style={{ color: t.success, fontSize: font.caption }}>{lastResult}</Text> : null}
    </View>
  );
}

function ResetConversationsCard() {
  const t = useTheme();
  const qc = useQueryClient();
  const currentUserId = useSessionStore((s) => s.user?.id);
  const setProfile = useSessionStore((s) => s.setProfile);
  const profiles = useAdminProfiles();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      const targetIds = selected.size > 0 ? Array.from(selected) : null;
      const { data, error } = await (supabase.rpc as any)('admin_reset_conversations', {
        target_user_ids: targetIds,
      });
      if (error) throw error;
      // Invalide les caches locaux du compte courant si concerné
      if (!targetIds || (currentUserId && targetIds.includes(currentUserId))) {
        qc.setQueryData(['chat-thread', currentUserId], []);
        qc.invalidateQueries({ queryKey: ['chat-thread', currentUserId] });
        qc.invalidateQueries({ queryKey: ['gauges', currentUserId] });
        if (currentUserId) {
          // Refetch le profil pour récupérer onboarding_completed_at backfillé par le RPC
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUserId)
            .maybeSingle();
          if (prof) setProfile(prof as any);
        }
      }
      Alert.alert(
        'Conversations réinitialisées',
        `${data ?? 0} livraison(s) supprimée(s). Les jauges sont recalculées automatiquement.`,
      );
      setSelected(new Set());
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    const label = selected.size === 0
      ? 'TOUS les utilisateurs'
      : `${selected.size} utilisateur${selected.size > 1 ? 's' : ''}`;
    Alert.alert(
      'Reset complet ?',
      `Conversations, jauges et onboarding seront effacés pour ${label}. Ils repasseront par l'écran d'onboarding au prochain lancement. Action irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Réinitialiser', style: 'destructive', onPress: reset },
      ],
    );
  };

  return (
    <View style={[card(t), { borderColor: t.danger }]}>
      <Text style={[h2(t), { color: t.danger }]}>Réinitialiser les conversations</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Reset complet pour les utilisateurs sélectionnés (ou tous si rien n'est sélectionné) : conversations effacées, jauges remises à zéro, onboarding à refaire au prochain lancement de l'app. Action irréversible.
      </Text>
      <UserMultiSelector profiles={profiles} selected={selected} onChange={setSelected} />
      <Button label="Réinitialiser" variant="danger" onPress={confirm} loading={busy} />
    </View>
  );
}

function DeleteUsersCard() {
  const t = useTheme();
  const currentUserId = useSessionStore((s) => s.user?.id);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, prenom, nom, date_naissance, email, is_moderator, is_admin')
      .order('prenom');
    setProfiles((data ?? []) as AdminProfile[]);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleModerator = async (p: AdminProfile) => {
    const next = !p.is_moderator;
    const { error } = await (supabase.rpc as any)('admin_set_moderator', {
      target_user_id: p.id,
      value: next,
    });
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setProfiles((list) => list.map((x) => (x.id === p.id ? { ...x, is_moderator: next } : x)));
  };

  const toggleAdmin = (p: AdminProfile) => {
    const next = !p.is_admin;
    const label = displayName(p) || p.email;
    Alert.alert(
      next ? 'Promouvoir administrateur ?' : 'Retirer le rôle admin ?',
      next
        ? `« ${label} » aura un accès admin complet : envoi de questions, gestion conférence, suppression de comptes…`
        : `« ${label} » perdra tout accès administrateur.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: next ? 'Promouvoir' : 'Rétrograder',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await (supabase.rpc as any)('admin_set_admin', {
              target_user_id: p.id,
              value: next,
            });
            if (error) {
              Alert.alert('Erreur', error.message);
              return;
            }
            setProfiles((list) =>
              list.map((x) =>
                x.id === p.id
                  ? { ...x, is_admin: next, is_moderator: next ? false : x.is_moderator }
                  : x,
              ),
            );
          },
        },
      ],
    );
  };

  const handleDelete = (p: AdminProfile) => {
    if (p.id === currentUserId) {
      Alert.alert('Impossible', 'Tu ne peux pas te supprimer toi-même.');
      return;
    }
    const label = displayName(p) || p.email;
    Alert.alert(
      'Supprimer cet utilisateur ?',
      `« ${label} » (${p.email}) sera DÉFINITIVEMENT supprimé : compte auth, profil, jauges, réponses, ami secret, FAQ, etc. Action irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setBusy(p.id);
            try {
              const { error } = await (supabase.rpc as any)('admin_delete_user', {
                target_user_id: p.id,
              });
              if (error) throw error;
              setProfiles((list) => list.filter((x) => x.id !== p.id));
            } catch (e: any) {
              Alert.alert('Erreur', e?.message ?? 'Échec de la suppression');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.prenom.toLowerCase().includes(q) ||
        (p.nom ?? '').toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [profiles, filter]);

  return (
    <View style={[card(t), { borderColor: t.danger }]}>
      <Text style={[h2(t), { color: t.danger }]}>Gérer les utilisateurs</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Bouton étoile ⭐ : promeut/rétrograde un administrateur (accès complet).{'\n'}
        Bouton bouclier 🛡️ : promeut/rétrograde un modérateur (accès à la modération FAQ uniquement).{'\n'}
        Bouton corbeille 🗑️ : supprime DÉFINITIVEMENT un compte (irréversible).
      </Text>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filtrer par prénom ou email…"
        placeholderTextColor={t.textMuted}
        autoCapitalize="none"
        style={[
          styles.qRow,
          { color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border, fontSize: font.body },
        ]}
      />
      <View style={{ maxHeight: 320 }}>
        <ScrollView nestedScrollEnabled>
          <View style={{ gap: spacing.xs }}>
            {filtered.length === 0 ? (
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>Aucun résultat.</Text>
            ) : (
              filtered.map((p) => {
                const isSelf = p.id === currentUserId;
                return (
                  <View
                    key={p.id}
                    style={[
                      styles.qRow,
                      {
                        backgroundColor: t.surfaceAlt,
                        borderColor: t.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: '700' }}>
                        {displayName(p) || p.email}
                        {isSelf ? ' (toi)' : ''}
                        {p.is_admin ? ' · admin' : p.is_moderator ? ' · modérateur' : ''}
                      </Text>
                      {(() => {
                        const age = ageFromDate(p.date_naissance);
                        return age != null ? (
                          <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                            {age} an{age > 1 ? 's' : ''} · {formatDateFR(p.date_naissance)}
                          </Text>
                        ) : null;
                      })()}
                    </View>
                    <Pressable
                      onPress={() => toggleAdmin(p)}
                      disabled={isSelf && p.is_admin}
                      hitSlop={8}
                      style={{ padding: 8, opacity: isSelf && p.is_admin ? 0.3 : 1 }}
                      accessibilityLabel={p.is_admin ? 'Retirer le rôle admin' : 'Promouvoir administrateur'}
                    >
                      <Ionicons
                        name={p.is_admin ? 'star' : 'star-outline'}
                        size={22}
                        color={p.is_admin ? t.primary : t.textMuted}
                      />
                    </Pressable>
                    {!p.is_admin ? (
                      <Pressable
                        onPress={() => toggleModerator(p)}
                        hitSlop={8}
                        style={{ padding: 8 }}
                        accessibilityLabel={p.is_moderator ? 'Retirer le rôle de modérateur' : 'Promouvoir modérateur'}
                      >
                        <Ionicons
                          name={p.is_moderator ? 'shield-checkmark' : 'shield-outline'}
                          size={22}
                          color={p.is_moderator ? t.accent : t.textMuted}
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => handleDelete(p)}
                      disabled={isSelf || busy === p.id}
                      hitSlop={8}
                      style={{
                        padding: 8,
                        opacity: isSelf ? 0.3 : 1,
                      }}
                    >
                      {busy === p.id ? (
                        <ActivityIndicator color={t.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={22} color={t.danger} />
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

interface AdminSecretMessage {
  id: string;
  contenu: string;
  created_at: string;
  sender_prenom: string;
  sender_nom: string;
  receiver_prenom: string;
  receiver_nom: string;
}

interface AdminReport {
  id: string;
  content_type: 'photo' | 'secret_message';
  content_id: string;
  reason: string | null;
  content_excerpt: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter_prenom: string | null;
  author_id: string | null;
  author_prenom: string | null;
  author_nom: string | null;
  author_banned: boolean;
}

function ReportsModCard() {
  const t = useTheme();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_list_reports');
    if (!error && data) setReports(data as AdminReport[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const resolve = async (report: AdminReport, action: 'remove_content' | 'ban_author' | 'dismiss') => {
    setBusyId(report.id);
    try {
      const { error } = await (supabase.rpc as any)('admin_resolve_report', {
        p_report_id: report.id,
        p_action: action,
      });
      if (error) throw error;
      await fetchReports();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusyId(null);
    }
  };

  const onResolve = (report: AdminReport) => {
    const authorLabel = `${report.author_prenom ?? '?'} ${report.author_nom ?? ''}`.trim();
    Alert.alert(
      'Traiter ce signalement',
      `Contenu ${report.content_type === 'photo' ? 'photo' : 'message'} de ${authorLabel}.`,
      [
        {
          text: 'Retirer le contenu',
          style: 'destructive',
          onPress: () => resolve(report, 'remove_content'),
        },
        {
          text: "Retirer + bannir l'auteur",
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Bannir cet utilisateur ?',
              `${authorLabel} sera exclu : son contenu est retiré et il ne pourra plus accéder à l'app.`,
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Bannir', style: 'destructive', onPress: () => resolve(report, 'ban_author') },
              ],
            ),
        },
        { text: 'Ignorer le signalement', onPress: () => resolve(report, 'dismiss') },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  const pending = reports.filter((r) => r.status === 'pending');

  return (
    <View style={[card(t)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[h2(t)]}>Signalements{pending.length > 0 ? ` · ${pending.length}` : ''}</Text>
        <Pressable onPress={fetchReports} hitSlop={10}>
          <Ionicons name="refresh" size={20} color={t.textMuted} />
        </Pressable>
      </View>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        À traiter sous 24 h : retire le contenu inapproprié et bannis l'auteur si besoin.
      </Text>

      {loading ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: spacing.md }} />
      ) : reports.length === 0 ? (
        <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: spacing.md }}>
          Aucun signalement. 🎉
        </Text>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {reports.map((r) => {
            const resolved = r.status !== 'pending';
            return (
              <View
                key={r.id}
                style={{
                  backgroundColor: t.surfaceAlt,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: 6,
                  opacity: resolved ? 0.55 : 1,
                  borderWidth: 1,
                  borderColor: r.author_banned ? t.danger : t.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={r.content_type === 'photo' ? 'image-outline' : 'mail-outline'}
                    size={14}
                    color={t.accent}
                  />
                  <Text style={{ color: t.accent, fontSize: font.micro, fontWeight: '700', flex: 1 }}>
                    {r.content_type === 'photo' ? 'Photo' : 'Message'} de{' '}
                    {r.author_prenom ?? '?'} {r.author_nom ?? ''}
                    {r.author_banned ? ' · BANNI' : ''}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                    {new Date(r.created_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {r.content_excerpt ? (
                  <Text style={{ color: t.text, fontSize: font.body, lineHeight: 20 }} numberOfLines={3}>
                    « {r.content_excerpt} »
                  </Text>
                ) : null}
                <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                  Motif : {r.reason ?? '—'} · signalé par {r.reporter_prenom ?? '?'}
                </Text>
                {resolved ? (
                  <Text style={{ color: t.success, fontSize: font.micro, fontWeight: '700' }}>
                    {r.status === 'resolved' ? 'Traité ✓' : 'Ignoré'}
                  </Text>
                ) : (
                  <Button
                    label={busyId === r.id ? 'Traitement…' : 'Traiter'}
                    onPress={() => onResolve(r)}
                    loading={busyId === r.id}
                    variant="secondary"
                    style={{ height: 40, marginTop: 4 }}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SecretMessagesModCard() {
  const t = useTheme();
  const [messages, setMessages] = useState<AdminSecretMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_get_secret_messages');
    if (!error && data) setMessages(data as AdminSecretMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const deleteMessage = (msg: AdminSecretMessage) => {
    Alert.alert(
      'Supprimer ce message ?',
      `De ${msg.sender_prenom} à ${msg.receiver_prenom} :\n"${msg.contenu.slice(0, 80)}${msg.contenu.length > 80 ? '…' : ''}"`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('secret_messages').delete().eq('id', msg.id);
            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[card(t)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[h2(t)]}>Messages amis secrets</Text>
        <Pressable onPress={fetchMessages} hitSlop={10}>
          <Ionicons name="refresh" size={20} color={t.textMuted} />
        </Pressable>
      </View>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        Tous les messages échangés entre amis secrets. Supprime ceux qui ne sont pas appropriés.
      </Text>

      {loading ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: spacing.md }} />
      ) : messages.length === 0 ? (
        <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: spacing.md }}>
          Aucun message envoyé pour l'instant.
        </Text>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={{
                backgroundColor: t.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: t.accent, fontSize: font.micro, fontWeight: '700', flex: 1 }}>
                  {msg.sender_prenom} {msg.sender_nom} → {msg.receiver_prenom} {msg.receiver_nom}
                </Text>
                <Pressable onPress={() => deleteMessage(msg)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={t.danger} />
                </Pressable>
              </View>
              <Text style={{ color: t.text, fontSize: font.body, lineHeight: 20 }}>{msg.contenu}</Text>
              <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                {new Date(msg.created_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SermonsManagerCard() {
  const t = useTheme();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Sermon>>({});
  const [busy, setBusy] = useState(false);
  const [openSermonForFaq, setOpenSermonForFaq] = useState<Sermon | null>(null);
  const [openSermonForQuiz, setOpenSermonForQuiz] = useState<Sermon | null>(null);
  const [faqList, setFaqList] = useState<(FaqQuestion & { likes_count: number })[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from('sermons')
      .select('*')
      .order('debut_at', { ascending: true });
    if (error) Alert.alert('Erreur', error.message);
    else setSermons((data ?? []) as Sermon[]);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openSermonForFaq) return;
    const reload = async () => {
      const [{ data: qs }, { data: likes }] = await Promise.all([
        supabase.from('faq_questions').select('*').eq('sermon_id', openSermonForFaq.id),
        supabase.from('faq_likes').select('question_id'),
      ]);
      const countByQ = new Map<string, number>();
      for (const l of (likes ?? []) as { question_id: string }[]) {
        countByQ.set(l.question_id, (countByQ.get(l.question_id) ?? 0) + 1);
      }
      const withLikes: (FaqQuestion & { likes_count: number })[] = ((qs ?? []) as FaqQuestion[]).map(
        (q) => ({ ...q, likes_count: countByQ.get(q.id) ?? 0 }),
      );
      withLikes.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.likes_count !== b.likes_count) return b.likes_count - a.likes_count;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setFaqList(withLikes);
    };
    reload();
    const ch = supabase
      .channel(`admin-faq-${openSermonForFaq.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'faq_questions',
          filter: `sermon_id=eq.${openSermonForFaq.id}`,
        },
        reload,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faq_likes' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [openSermonForFaq?.id]);

  const startCreate = () =>
    setDraft({
      titre: '',
      intervenant: '',
      theme: '',
      description: '',
      debut_at: '',
      fin_at: '',
      faq_offset_minutes: 120,
    });

  const startEdit = (s: Sermon) => {
    setEditingId(s.id);
    setDraft({ ...s });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft({});
  };

  const save = async () => {
    if (!draft.titre || !draft.intervenant || !draft.theme || !draft.debut_at || !draft.fin_at) {
      Alert.alert('Champs requis', 'Titre, intervenant, thème, début et fin sont obligatoires.');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const { error } = await (supabase.from('sermons') as any).update(draft).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('sermons') as any).insert(draft);
        if (error) throw error;
      }
      cancel();
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const remove = (s: Sermon) =>
    Alert.alert('Supprimer ce sermon ?', `« ${s.titre} » et ses Q/R seront effacés.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('sermons').delete().eq('id', s.id);
          if (error) Alert.alert('Erreur', error.message);
          else await load();
        },
      },
    ]);

  const togglePinned = async (q: FaqQuestion) => {
    const { error } = await (supabase.from('faq_questions') as any)
      .update({ is_pinned: !q.is_pinned })
      .eq('id', q.id);
    if (error) Alert.alert('Erreur', error.message);
  };

  const toggleAnswered = async (q: FaqQuestion) => {
    const { error } = await (supabase.from('faq_questions') as any)
      .update({ is_answered: !q.is_answered })
      .eq('id', q.id);
    if (error) Alert.alert('Erreur', error.message);
  };

  const removeFaq = async (q: FaqQuestion) => {
    const { error } = await supabase.from('faq_questions').delete().eq('id', q.id);
    if (error) Alert.alert('Erreur', error.message);
  };

  const announceFaqOpen = (s: Sermon) =>
    Alert.alert(
      'Annoncer la FAQ ?',
      `Envoyer un push à tous : « La FAQ de ${s.intervenant} est ouverte ». Le thème sera inclus.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            const { error } = await supabase.functions.invoke('broadcast-notification', {
              body: {
                title: `FAQ ouverte — ${s.intervenant}`,
                body: `Pose tes questions sur « ${s.theme} » avant et pendant la wa3za.`,
                data: { type: 'sermon_faq', sermon_id: s.id },
              },
            });
            if (error) Alert.alert('Erreur', error.message);
            else Alert.alert('Notification envoyée');
          },
        },
      ],
    );

  const toggleManualOpen = async (s: Sermon) => {
    const next = !s.manual_open;
    const { error } = await (supabase.from('sermons') as any)
      .update({ manual_open: next })
      .eq('id', s.id);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setSermons((list) => list.map((x) => (x.id === s.id ? { ...x, manual_open: next } : x)));
  };


  return (
    <View style={[card(t)]}>
      <Text style={[h2(t)]}>Sermons & FAQ</Text>
      <Text style={{ color: t.textMuted, fontSize: font.caption }}>
        La FAQ s'ouvre automatiquement 2 h avant chaque sermon. Tu peux aussi annoncer manuellement.
      </Text>

      <View style={{ gap: spacing.sm }}>
        {sermons.map((s) =>
          editingId === s.id ? (
            <View key={s.id} style={[styles.editor, { borderColor: t.primary, backgroundColor: t.primarySoft }]}>
              <TextField label="Titre" value={draft.titre ?? ''} onChangeText={(v) => setDraft({ ...draft, titre: v })} />
              <TextField
                label="Intervenant"
                value={draft.intervenant ?? ''}
                onChangeText={(v) => setDraft({ ...draft, intervenant: v })}
              />
              <TextField label="Thème" value={draft.theme ?? ''} onChangeText={(v) => setDraft({ ...draft, theme: v })} />
              <TextField
                label="Description"
                value={draft.description ?? ''}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                multiline
              />
              <TextField
                label="Début (ISO)"
                value={draft.debut_at ?? ''}
                onChangeText={(v) => setDraft({ ...draft, debut_at: v })}
                autoCapitalize="none"
              />
              <TextField
                label="Fin (ISO)"
                value={draft.fin_at ?? ''}
                onChangeText={(v) => setDraft({ ...draft, fin_at: v })}
                autoCapitalize="none"
              />
              <TextField
                label="Délai d'ouverture FAQ (minutes avant début)"
                value={String(draft.faq_offset_minutes ?? 120)}
                onChangeText={(v) =>
                  setDraft({ ...draft, faq_offset_minutes: Number.parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })
                }
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Annuler" variant="ghost" onPress={cancel} style={{ flex: 1 }} />
                <Button label="Enregistrer" onPress={save} loading={busy} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View
              key={s.id}
              style={[styles.qRow, { backgroundColor: t.surfaceAlt, borderColor: t.border, gap: spacing.xs }]}
            >
              <Text style={{ color: t.text, fontWeight: '800' }}>{s.titre}</Text>
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                {s.intervenant} · « {s.theme} »
              </Text>
              <Text style={{ color: t.textMuted, fontSize: font.caption }}>
                {new Date(s.debut_at).toLocaleString('fr-FR')} → {new Date(s.fin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginTop: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: 10,
                  backgroundColor: s.manual_open ? t.primarySoft : 'transparent',
                  borderWidth: 1,
                  borderColor: s.manual_open ? t.primary : t.border,
                }}
              >
                <Ionicons
                  name={s.manual_open ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={s.manual_open ? t.primary : t.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: font.caption }}>
                    FAQ {s.manual_open ? 'lancée' : 'fermée'}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                    {s.manual_open
                      ? 'L\'onglet FAQ est visible chez tous les participants.'
                      : 'Bascule pour ouvrir la FAQ et faire apparaître l\'onglet.'}
                  </Text>
                </View>
                <Switch
                  value={s.manual_open}
                  onValueChange={() => toggleManualOpen(s)}
                  thumbColor={s.manual_open ? t.accent : undefined}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => setOpenSermonForFaq(s)}
                  style={[styles.miniBtn, { backgroundColor: t.primarySoft, borderColor: t.primary }]}
                >
                  <Ionicons name="chatbubbles-outline" size={14} color={t.text} />
                  <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700' }}>Q/R</Text>
                </Pressable>
                <Pressable
                  onPress={() => setOpenSermonForQuiz(s)}
                  style={[styles.miniBtn, { backgroundColor: t.primarySoft, borderColor: t.primary }]}
                >
                  <Ionicons name="bar-chart-outline" size={14} color={t.text} />
                  <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700' }}>Quiz</Text>
                </Pressable>
                <Pressable
                  onPress={() => announceFaqOpen(s)}
                  style={[styles.miniBtn, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
                >
                  <Ionicons name="megaphone-outline" size={14} color={t.text} />
                  <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700' }}>Annoncer</Text>
                </Pressable>
                <Pressable
                  onPress={() => startEdit(s)}
                  style={[styles.miniBtn, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
                >
                  <Ionicons name="create-outline" size={14} color={t.text} />
                  <Text style={{ color: t.text, fontSize: font.caption, fontWeight: '700' }}>Éditer</Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(s)}
                  style={[styles.miniBtn, { backgroundColor: t.surfaceAlt, borderColor: t.danger }]}
                >
                  <Ionicons name="trash-outline" size={14} color={t.danger} />
                  <Text style={{ color: t.danger, fontSize: font.caption, fontWeight: '700' }}>Suppr.</Text>
                </Pressable>
              </View>
            </View>
          ),
        )}
      </View>

      {editingId === null && !draft.titre ? (
        <Button label="Ajouter un sermon" onPress={startCreate} variant="secondary" />
      ) : editingId === null ? (
        <View style={[styles.editor, { borderColor: t.primary, backgroundColor: t.primarySoft }]}>
          <Text style={{ color: t.text, fontWeight: '800' }}>Nouveau sermon</Text>
          <TextField label="Titre" value={draft.titre ?? ''} onChangeText={(v) => setDraft({ ...draft, titre: v })} />
          <TextField
            label="Intervenant"
            value={draft.intervenant ?? ''}
            onChangeText={(v) => setDraft({ ...draft, intervenant: v })}
          />
          <TextField label="Thème" value={draft.theme ?? ''} onChangeText={(v) => setDraft({ ...draft, theme: v })} />
          <TextField
            label="Description"
            value={draft.description ?? ''}
            onChangeText={(v) => setDraft({ ...draft, description: v })}
            multiline
          />
          <TextField
            label="Début (ISO)"
            value={draft.debut_at ?? ''}
            onChangeText={(v) => setDraft({ ...draft, debut_at: v })}
            autoCapitalize="none"
          />
          <TextField
            label="Fin (ISO)"
            value={draft.fin_at ?? ''}
            onChangeText={(v) => setDraft({ ...draft, fin_at: v })}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label="Annuler" variant="ghost" onPress={cancel} style={{ flex: 1 }} />
            <Button label="Créer" onPress={save} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      {openSermonForQuiz ? (
        <QuizManagerCard sermon={openSermonForQuiz} onClose={() => setOpenSermonForQuiz(null)} />
      ) : null}

      {openSermonForFaq ? (
        <View style={[card(t), { borderColor: t.accent }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[h2(t)]}>Q/R — {openSermonForFaq.intervenant}</Text>
            <Pressable onPress={() => setOpenSermonForFaq(null)} hitSlop={10}>
              <Ionicons name="close" size={22} color={t.text} />
            </Pressable>
          </View>
          {faqList.length === 0 ? (
            <Text style={{ color: t.textMuted, fontSize: font.caption }}>Aucune question pour l'instant.</Text>
          ) : (
            faqList.map((q) => (
              <View
                key={q.id}
                style={[
                  styles.qRow,
                  {
                    backgroundColor: q.is_answered ? t.primarySoft : t.surfaceAlt,
                    borderColor: q.is_pinned ? t.accent : t.border,
                    borderWidth: q.is_pinned ? 2 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="eye-off-outline" size={14} color={t.textMuted} />
                    <Text style={{ color: t.textMuted, fontWeight: '700', fontSize: font.caption }}>
                      Question anonyme
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="heart" size={14} color={t.danger} />
                    <Text style={{ color: t.text, fontWeight: '800', fontSize: font.caption }}>
                      {q.likes_count}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: t.text, fontSize: font.body, marginTop: 2 }}>{q.texte}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => togglePinned(q)}
                    style={[styles.miniBtn, { backgroundColor: q.is_pinned ? t.accent : t.surfaceAlt, borderColor: t.border }]}
                  >
                    <Ionicons name={q.is_pinned ? 'pin' : 'pin-outline'} size={14} color={q.is_pinned ? '#FFFFFF' : t.text} />
                    <Text style={{ color: q.is_pinned ? '#FFFFFF' : t.text, fontSize: font.caption, fontWeight: '700' }}>
                      {q.is_pinned ? 'Désépingler' : 'Épingler'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleAnswered(q)}
                    style={[styles.miniBtn, { backgroundColor: q.is_answered ? t.success : t.surfaceAlt, borderColor: t.border }]}
                  >
                    <Ionicons
                      name={q.is_answered ? 'checkmark-circle' : 'checkmark-circle-outline'}
                      size={14}
                      color={q.is_answered ? '#FFFFFF' : t.text}
                    />
                    <Text style={{ color: q.is_answered ? '#FFFFFF' : t.text, fontSize: font.caption, fontWeight: '700' }}>
                      {q.is_answered ? 'Répondue' : 'À répondre'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeFaq(q)}
                    style={[styles.miniBtn, { backgroundColor: t.surfaceAlt, borderColor: t.danger }]}
                  >
                    <Ionicons name="trash-outline" size={14} color={t.danger} />
                    <Text style={{ color: t.danger, fontSize: font.caption, fontWeight: '700' }}>Suppr.</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}
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
  flex: { flex: 1 },
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
  tabBarScroll: { flexGrow: 0, flexShrink: 0 },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  adminTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
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
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  statBox: {
    minWidth: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  badgeStat: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  adminDayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 100,
    gap: 2,
  },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  editor: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
});
