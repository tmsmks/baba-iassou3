import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { font, spacing, useTheme } from '@/lib/theme';
import { useChatThread, useSendChatResponse } from '@/hooks/useChat';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

type Bubble =
  | { id: string; from: 'ai'; text: string; lettre?: 'C' | 'H' | 'O' | 'I' | 'X' }
  | { id: string; from: 'user'; text: string; score?: number | null };

export default function ChatScreen() {
  const t = useTheme();
  const { delivery_id } = useLocalSearchParams<{ delivery_id?: string }>();
  const profile = useSessionStore((s) => s.profile);
  const userId = useSessionStore((s) => s.user?.id);
  const { data: thread, isLoading } = useChatThread();
  const sendMutation = useSendChatResponse();
  const listRef = useRef<FlatList>(null);
  const [error, setError] = useState<string | null>(null);

  const bubbles = useMemo<Bubble[]>(() => {
    if (!thread) return [];
    const greeting: Bubble = {
      id: 'greet',
      from: 'ai',
      text: profile?.prenom
        ? `Bonjour ${profile.prenom}. Quand je t'enverrai une question, tu pourras me répondre ici. Pas de bonne ou de mauvaise réponse — sois honnête avec toi-même.`
        : `Bonjour. Quand je t'enverrai une question, tu pourras me répondre ici.`,
    };
    const items: Bubble[] = [greeting];
    for (const d of thread) {
      items.push({ id: `q-${d.delivery_id}`, from: 'ai', text: d.question_texte, lettre: d.lettre });
      if (d.user_contenu) {
        items.push({ id: `u-${d.delivery_id}`, from: 'user', text: d.user_contenu });
      }
      if (d.ai_feedback) {
        items.push({ id: `f-${d.delivery_id}`, from: 'ai', text: d.ai_feedback, lettre: d.lettre });
      }
    }
    return items;
  }, [thread, profile?.prenom]);

  const pending = useMemo(
    () => thread?.filter((d) => !d.user_contenu).slice(-1)[0] ?? null,
    [thread],
  );

  useEffect(() => {
    if (!delivery_id || !userId) return;
    supabase
      .from('question_deliveries')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', delivery_id)
      .eq('user_id', userId)
      .then(() => {});
  }, [delivery_id, userId]);

  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(id);
  }, [bubbles.length]);

  const handleSend = async (text: string) => {
    if (!pending) {
      setError("Aucune question en attente. baba IAssou3 t'enverra bientôt la prochaine.");
      return;
    }
    setError(null);
    try {
      await sendMutation.mutateAsync({ deliveryId: pending.delivery_id, contenu: text });
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de l\'envoi');
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            item.from === 'ai' ? (
              <ChatBubble from="ai" text={item.text} lettre={'lettre' in item ? item.lettre : undefined} />
            ) : (
              <ChatBubble from="user" text={item.text} score={'score' in item ? item.score : undefined} />
            )
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {error ? (
          <View style={[styles.error, { backgroundColor: t.surfaceAlt }]}>
            <Text style={{ color: t.danger, fontSize: font.caption }}>{error}</Text>
          </View>
        ) : null}

        {pending ? (
          <ChatInput
            sending={sendMutation.isPending}
            onSend={handleSend}
            placeholder={`Réponds à baba IAssou3…`}
          />
        ) : (
          <View style={[styles.idle, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: font.caption }}>
              Tu es à jour. baba IAssou3 te recontactera très bientôt.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  idle: { padding: spacing.lg, borderTopWidth: 1 },
  error: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
