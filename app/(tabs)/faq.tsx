import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useOpenSermons, useFaqQuestions, useSendFaqQuestion, useToggleFaqLike } from '@/hooks/useSermons';
import { useFaqBadge } from '@/hooks/useFaqBadge';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { useSessionStore } from '@/store/session';
import type { Sermon } from '@/types/database';

export default function FaqScreen() {
  const t = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const params = useLocalSearchParams<{ sermon_id?: string }>();
  const userId = useSessionStore((s) => s.user?.id);
  const { data: open, isLoading: loadingSermons } = useOpenSermons();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sermon: Sermon | null = useMemo(() => {
    if (!open?.length) return null;
    return open.find((s) => s.id === selectedId) ?? open[0];
  }, [open, selectedId]);
  const { data: questions, isLoading: loadingQ } = useFaqQuestions(sermon?.id ?? null);
  const sendMutation = useSendFaqQuestion();
  const toggleLike = useToggleFaqLike();
  const { markFaqSeen } = useFaqBadge();
  const [draft, setDraft] = useState('');
  const { refreshing, onRefresh } = useAppRefresh();

  useEffect(() => {
    if (params.sermon_id && open?.some((s) => s.id === params.sermon_id)) {
      setSelectedId(params.sermon_id);
    }
  }, [params.sermon_id, open]);

  // Marque toutes les FAQ ouvertes comme vues (efface le badge)
  useEffect(() => {
    if ((open?.length ?? 0) > 0) {
      markFaqSeen();
    }
  }, [open, markFaqSeen]);

  if (loadingSermons) {
    return (
      <Screen edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  if (!sermon) {
    return (
      <Screen edges={[]} padded>
        <View style={styles.center}>
          <Ionicons name="time-outline" size={48} color={t.textMuted} />
          <Text style={[styles.kicker, { color: t.accent }]}>Aucune Q/R ouverte</Text>
          <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>
            Pas de FAQ active
          </Text>
          <Text style={[styles.body, { color: t.textMuted, textAlign: 'center' }]}>
            L'organisateur n'a pas encore lancé de session de questions. Reviens dès qu'un sermon
            commence.
          </Text>
        </View>
      </Screen>
    );
  }

  const send = async () => {
    const texte = draft.trim();
    if (texte.length < 3) return;
    try {
      await sendMutation.mutateAsync({ sermonId: sermon.id, texte });
      setDraft('');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'envoyer la question.");
    }
  };

  return (
    <Screen padded={false} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight + tabBarHeight}
      >
        {open && open.length > 1 ? (
          <View style={[styles.tabsRow, { borderBottomColor: t.border }]}>
            {open.map((s) => {
              const active = s.id === sermon.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? t.primary : t.surfaceAlt,
                      borderColor: active ? t.primary : t.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? (t.isDark ? t.bg : '#FFFFFF') : t.text,
                      fontWeight: '700',
                      fontSize: font.caption,
                    }}
                  >
                    {s.intervenant}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <FlatList
          data={questions ?? []}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md, gap: 4 }}>
              <Text style={[styles.kicker, { color: t.accent }]}>{sermon.intervenant}</Text>
              <Text style={[styles.title, { color: t.text }]}>{sermon.theme}</Text>
              {sermon.description ? (
                <Text style={{ color: t.textMuted, fontSize: font.body, marginTop: 2 }}>
                  {sermon.description}
                </Text>
              ) : null}
              <Text style={{ color: t.textMuted, fontSize: font.caption, marginTop: spacing.xs }}>
                {new Date(sermon.debut_at).toLocaleString('fr-FR', {
                  weekday: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                → {new Date(sermon.fin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          }
          ListEmptyComponent={
            loadingQ ? (
              <ActivityIndicator color={t.primary} />
            ) : (
              <View style={[styles.empty, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: font.body }}>
                  Sois le premier à poser une question 🙋
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const isMine = item.user_id === userId;
            const hasBadge = item.is_pinned || item.is_answered;
            return (
              <View
                style={[
                  styles.qCard,
                  {
                    backgroundColor: item.is_answered ? t.primarySoft : t.surface,
                    borderColor: item.is_pinned ? t.accent : t.border,
                    borderWidth: item.is_pinned ? 2 : 1,
                  },
                ]}
              >
                {hasBadge ? (
                  <View style={styles.qBadges}>
                    {item.is_pinned ? (
                      <View style={[styles.badge, { backgroundColor: t.accent }]}>
                        <Text style={styles.badgeTxt}>ÉPINGLÉE</Text>
                      </View>
                    ) : item.is_answered ? (
                      <View style={[styles.badge, { backgroundColor: t.success }]}>
                        <Text style={styles.badgeTxt}>RÉPONDUE</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={{ color: t.text, fontSize: font.body }}>{item.texte}</Text>
                <View style={styles.qFooter}>
                  <Pressable
                    onPress={() =>
                      isMine
                        ? null
                        : toggleLike.mutate({ questionId: item.id, liked: item.liked_by_me })
                    }
                    disabled={isMine}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.likeBtn,
                      {
                        backgroundColor: item.liked_by_me ? t.danger : t.surfaceAlt,
                        borderColor: item.liked_by_me ? t.danger : t.border,
                        opacity: isMine ? 0.45 : pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityLabel={item.liked_by_me ? 'Retirer mon like' : 'Liker cette question'}
                  >
                    <Ionicons
                      name={item.liked_by_me ? 'heart' : 'heart-outline'}
                      size={16}
                      color={item.liked_by_me ? '#FFFFFF' : t.text}
                    />
                    <Text
                      style={{
                        color: item.liked_by_me ? '#FFFFFF' : t.text,
                        fontWeight: '800',
                        fontSize: font.caption,
                      }}
                    >
                      {item.likes_count}
                    </Text>
                  </Pressable>
                  {isMine ? (
                    <Text style={{ color: t.textMuted, fontSize: font.micro }}>
                      Ta question — tu ne peux pas la liker.
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View
          style={[
            styles.hintRow,
            { backgroundColor: t.surface, borderTopColor: t.border },
          ]}
        >
          <Ionicons name="eye-off-outline" size={14} color={t.textMuted} />
          <Text style={{ color: t.textMuted, fontSize: font.micro }}>
            Anonyme — ton prénom n'est jamais affiché.
          </Text>
        </View>
        <View style={[styles.inputRow, { backgroundColor: t.surface }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Pose une question à ${sermon.intervenant}…`}
            placeholderTextColor={t.textMuted}
            multiline
            style={[styles.input, { color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border }]}
          />
          <Button
            label="Envoyer"
            onPress={send}
            loading={sendMutation.isPending}
            disabled={draft.trim().length < 3}
            style={{ height: 44, paddingHorizontal: spacing.md }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  kicker: { fontSize: font.caption, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: font.title, fontWeight: '800' },
  body: { fontSize: font.body, lineHeight: 22, maxWidth: 320 },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  tabBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1, maxWidth: 220 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  qCard: { padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs },
  qBadges: { flexDirection: 'row', justifyContent: 'flex-end' },
  qFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  badgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
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
