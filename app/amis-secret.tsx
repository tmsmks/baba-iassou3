import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { assets } from '@/lib/assets';
import { useSecretFriend } from '@/hooks/useSecretFriend';
import { useConferenceState } from '@/hooks/useGauges';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import {
  useSecretInbox,
  useSecretOutbox,
  useSendSecretMessage,
  useMarkSecretMessageRead,
  useReactToSecretMessage,
  SECRET_REACTIONS,
} from '@/hooks/useSecretMessages';

type SubTab = 'mission' | 'inbox' | 'outbox';

function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setH(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setH(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return h;
}

export default function AmiSecret() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const { data: friend, isLoading: friendLoading, refetch } = useSecretFriend();
  const { data: conf } = useConferenceState();
  const { data: inbox, isLoading: inboxLoading } = useSecretInbox();
  const { data: outbox, isLoading: outboxLoading } = useSecretOutbox();
  const sendMsg = useSendSecretMessage();
  const markRead = useMarkSecretMessageRead();
  const { refreshing, onRefresh } = useAppRefresh();
  const [tab, setTab] = useState<SubTab>('mission');
  const [draft, setDraft] = useState('');

  const revealed = !!conf?.secret_friends_revealed;
  const unread = useMemo(() => (inbox ?? []).filter((m) => !m.read_at).length, [inbox]);

  const send = async () => {
    const text = draft.trim();
    if (text.length < 1 || !friend) return;
    try {
      await sendMsg.mutateAsync({ receiverId: friend.receiver_id, contenu: text });
      setDraft('');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'envoyer le message.");
    }
  };

  const onOpenInbox = () => {
    setTab('inbox');
    // Marque tout en lu en arrière-plan
    (inbox ?? []).filter((m) => !m.read_at).forEach((m) => markRead.mutate(m.id));
  };

  return (
    <Screen padded={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>Ami secret</Text>
        <Pressable onPress={() => refetch()} hitSlop={10}>
          <Ionicons name="refresh" size={22} color={t.textMuted} />
        </Pressable>
      </View>

      {conf?.secret_reveal_at ? (
        <Pressable
          onPress={() => router.push('/reveal')}
          style={({ pressed }) => [
            styles.revealBanner,
            { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.revealBannerTxt}>La grande révélation est lancée — tap ici !</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {!revealed ? (
        <View style={styles.center}>
          <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          <Text style={[styles.kicker, { color: t.accent }]}>Chuuut</Text>
          <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>
            Pas encore de tirage
          </Text>
          <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
            Les amis secrets seront lancés par l'admin une fois que tous les participants seront inscrits.
            Tu recevras une notification.
          </Text>
        </View>
      ) : friendLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : !friend ? (
        <View style={styles.center}>
          <Image source={assets.mascot} style={styles.mascot} resizeMode="contain" />
          <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>
            Tirage en cours…
          </Text>
          <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
            Si rien ne s'affiche dans quelques secondes, tire vers le bas pour rafraîchir.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingBottom: Math.max(kbHeight, insets.bottom) }}>
          {/* Sous-onglets */}
          <View style={[styles.subTabs, { borderBottomColor: t.border }]}>
            <SubTabBtn
              icon="gift-outline"
              label="Mission"
              active={tab === 'mission'}
              onPress={() => setTab('mission')}
            />
            <SubTabBtn
              icon="mail-unread-outline"
              label={`Boîte${unread > 0 ? ` · ${unread}` : ''}`}
              active={tab === 'inbox'}
              onPress={onOpenInbox}
              accent={unread > 0}
            />
            <SubTabBtn
              icon="send-outline"
              label="Envoyés"
              active={tab === 'outbox'}
              onPress={() => setTab('outbox')}
            />
          </View>

          {tab === 'mission' ? (
            <FlatList
              data={[]}
              keyExtractor={() => 'm'}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
              }
              ListHeaderComponent={
                <View style={{ padding: spacing.lg }}>
                  <View style={[styles.envelope, { backgroundColor: t.surface, borderColor: t.border }]}>
                    <View style={[styles.sealRow, { borderBottomColor: t.border }]}>
                      <Ionicons name="mail-open-outline" size={22} color={t.accent} />
                      <Text style={[styles.sealText, { color: t.accent }]}>Mission secrète</Text>
                    </View>
                    <Text style={[styles.intro, { color: t.textMuted }]}>
                      Pendant toute la conf, tu vas gâter (mots gentils, petits cadeaux, services…) cette personne en secret.
                      Si on te démasque, c'est perdu.
                    </Text>
                    <View style={[styles.nameWrap, { backgroundColor: t.primarySoft }]}>
                      <Text style={[styles.nameKicker, { color: t.accent }]}>Ton ami(e) secret(e)</Text>
                      <Text style={[styles.name, { color: t.text }]}>
                        {friend.prenom}
                        {friend.nom ? ` ${friend.nom}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.warn, { color: t.danger }]}>
                      Ne montre pas cet écran. Surtout pas à {friend.prenom}
                      {friend.nom ? ` ${friend.nom}` : ''} 🤫
                    </Text>
                  </View>
                </View>
              }
              renderItem={() => null}
            />
          ) : tab === 'inbox' ? (
            <InboxList
              loading={inboxLoading}
              messages={inbox ?? []}
              t={t}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          ) : (
            <OutboxList
              loading={outboxLoading}
              messages={outbox ?? []}
              friendName={`${friend.prenom}${friend.nom ? ` ${friend.nom}` : ''}`}
              t={t}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}

          {/* Zone de saisie : visible uniquement dans Mission/Outbox */}
          {tab !== 'inbox' ? (
            <>
              <View
                style={[
                  styles.hintRow,
                  { backgroundColor: t.surface, borderTopColor: t.border },
                ]}
              >
                <Ionicons name="eye-off-outline" size={14} color={t.textMuted} />
                <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                  Message anonyme à {friend.prenom} — elle ne saura pas que c'est toi.
                </Text>
              </View>
              <View style={[styles.inputRow, { backgroundColor: t.surface }]}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Un encouragement, une devinette…"
                  placeholderTextColor={t.textMuted}
                  multiline
                  autoCapitalize="sentences"
                  autoCorrect
                  keyboardType="default"
                  returnKeyType="default"
                  textContentType="none"
                  style={[styles.input, { color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border }]}
                />
                <Button
                  label="Envoyer"
                  onPress={send}
                  loading={sendMsg.isPending}
                  disabled={draft.trim().length < 1}
                  style={{ height: 44, paddingHorizontal: spacing.md }}
                />
              </View>
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function SubTabBtn({
  icon,
  label,
  active,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.subTabBtn, active && { borderBottomColor: t.primary }]}>
      <Ionicons name={icon} size={18} color={active ? t.primary : accent ? t.danger : t.textMuted} />
      <Text
        style={{
          color: active ? t.primary : accent ? t.danger : t.textMuted,
          fontWeight: '700',
          fontSize: font.caption,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InboxList({
  loading,
  messages,
  t,
  refreshing,
  onRefresh,
}: {
  loading: boolean;
  messages: { id: string; contenu: string; read_at: string | null; created_at: string; reaction: string | null }[];
  t: ReturnType<typeof useTheme>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const react = useReactToSecretMessage();
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  return (
    <FlatList
      data={messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={
        messages.length === 0
          ? { flex: 1 }
          : { padding: spacing.lg, gap: spacing.sm }
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="mail-outline" size={42} color={t.textMuted} />
          <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
            Personne ne t'a écrit pour l'instant. Patience — l'attention va arriver 🎁
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.msgCard,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Ionicons name="eye-off-outline" size={14} color={t.textMuted} />
            <Text style={{ color: t.textMuted, fontSize: font.micro, fontWeight: '700' }}>
              D'un(e) ami(e) anonyme
            </Text>
            <Text style={{ color: t.textMuted, fontSize: font.micro, marginLeft: 'auto' }}>
              {new Date(item.created_at).toLocaleString('fr-FR', {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <Text style={{ color: t.text, fontSize: font.body, lineHeight: 22 }}>{item.contenu}</Text>
          <View style={[styles.reactionsRow, { borderTopColor: t.border }]}>
            {SECRET_REACTIONS.map((emoji) => {
              const active = item.reaction === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() =>
                    react.mutate({ messageId: item.id, emoji: active ? null : emoji })
                  }
                  hitSlop={6}
                  style={[
                    styles.reactionPill,
                    active && { backgroundColor: t.primarySoft, borderColor: t.primary },
                    !active && { borderColor: t.border },
                  ]}
                >
                  <Text style={{ fontSize: 18, opacity: active ? 1 : 0.65 }}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}

function OutboxList({
  loading,
  messages,
  friendName,
  t,
  refreshing,
  onRefresh,
}: {
  loading: boolean;
  messages: { id: string; contenu: string; read_at: string | null; created_at: string; reaction: string | null }[];
  friendName: string;
  t: ReturnType<typeof useTheme>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  return (
    <FlatList
      data={messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={
        messages.length === 0
          ? { flex: 1 }
          : { padding: spacing.lg, gap: spacing.sm }
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="send-outline" size={42} color={t.textMuted} />
          <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
            Tu n'as pas encore écrit à {friendName}. Lance-toi avec un petit mot ! 💌
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.msgCard,
            { backgroundColor: t.primarySoft, borderColor: t.primary },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Ionicons name="send" size={14} color={t.accent} />
            <Text style={{ color: t.accent, fontSize: font.micro, fontWeight: '700' }}>
              À {friendName}
            </Text>
            <Text style={{ color: t.textMuted, fontSize: font.micro, marginLeft: 'auto' }}>
              {item.read_at ? 'Lu' : 'Envoyé'} ·{' '}
              {new Date(item.created_at).toLocaleString('fr-FR', {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <Text style={{ color: t.text, fontSize: font.body, lineHeight: 22 }}>{item.contenu}</Text>
          {item.reaction ? (
            <View style={[styles.outboxReaction, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={{ fontSize: 18 }}>{item.reaction}</Text>
              <Text style={{ color: t.textMuted, fontSize: font.micro, fontWeight: '700' }}>
                Réagi par {friendName}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.subtitle, fontWeight: '800' },
  revealBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  revealBannerTxt: { color: '#FFFFFF', fontWeight: '800', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  mascot: { width: 140, height: 140, opacity: 0.7 },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: font.title, fontWeight: '800' },
  body: { fontSize: font.body, lineHeight: 22, maxWidth: 320 },
  envelope: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  sealText: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  intro: { fontSize: font.body, lineHeight: 22 },
  nameWrap: { padding: spacing.lg, borderRadius: radius.lg, alignItems: 'center', gap: 4 },
  nameKicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 36, fontWeight: '900' },
  warn: { fontSize: font.caption, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs },
  subTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  msgCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  reactionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  reactionPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outboxReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 2,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: font.body,
    textAlignVertical: 'top',
  },
});
