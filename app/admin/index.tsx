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
import type { Chant, ConferenceState, Lettre, ProgramItem, Question } from '@/types/database';

const LETTRES: Lettre[] = ['C', 'H', 'O', 'I', 'X'];

type AdminTab = 'envoi' | 'conference' | 'chants' | 'users';

const TABS: { id: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'envoi', label: 'Envoi', icon: 'send-outline' },
  { id: 'conference', label: 'Conférence', icon: 'calendar-outline' },
  { id: 'chants', label: 'Chants', icon: 'musical-notes-outline' },
  { id: 'users', label: 'Utilisateurs', icon: 'people-outline' },
];

export default function Admin() {
  const t = useTheme();
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);
  const [activeTab, setActiveTab] = useState<AdminTab>('envoi');

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((tab) => {
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
        {activeTab === 'envoi' && (
          <>
            <SendQuestionCard />
            <BroadcastNotificationCard />
          </>
        )}
        {activeTab === 'conference' && (
          <>
            <ConferenceStateCard />
            <ProgramEditorCard />
          </>
        )}
        {activeTab === 'chants' && <ChantsManagerCard />}
        {activeTab === 'users' && <ResetConversationsCard />}
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
  email: string;
}

function useAdminProfiles() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, prenom, email')
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
                    <Text style={{ color: t.text, fontWeight: '700' }}>{p.prenom}</Text>
                    <Text style={{ color: t.textMuted, fontSize: font.caption }}>{p.email}</Text>
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
        // Refetch le profil pour récupérer onboarding_completed_at backfillé par le RPC
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .maybeSingle();
        if (prof) setProfile(prof as any);
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
  editor: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
});
