import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Screen } from '@/components/Screen';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { font, spacing, useTheme } from '@/lib/theme';
import { useChatThread, useSendChatResponse } from '@/hooks/useChat';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { assets } from '@/lib/assets';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

type Lettre = 'C' | 'H' | 'O' | 'I' | 'X';

type Bubble =
  | { id: string; from: 'ai'; text: string; lettre?: Lettre; thinking?: boolean }
  | { id: string; from: 'user'; text: string; score?: number | null };

export default function ChatScreen() {
  const t = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { delivery_id } = useLocalSearchParams<{ delivery_id?: string }>();
  const profile = useSessionStore((s) => s.profile);
  const userId = useSessionStore((s) => s.user?.id);
  const { data: thread, isLoading } = useChatThread();
  const sendMutation = useSendChatResponse();
  const listRef = useRef<FlatList>(null);
  const [error, setError] = useState<string | null>(null);
  const { refreshing, onRefresh } = useAppRefresh();

  // IDs des bulles déjà animées en typewriter (pour ne pas re-animer)
  const animatedIdsRef = useRef<Set<string>>(new Set());
  // ID de la bulle AI qu'on est en train d'animer maintenant
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const realBubbles = useMemo<Bubble[]>(() => {
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
      // Chaque échange (réponse user + retour IA) devient deux bulles. On peut en avoir plusieurs par question.
      for (const r of d.responses) {
        items.push({ id: `u-${r.id}`, from: 'user', text: r.contenu, score: r.score });
        if (r.ai_feedback) {
          items.push({ id: `f-${r.id}`, from: 'ai', text: r.ai_feedback, lettre: d.lettre });
        }
      }
    }
    return items;
  }, [thread, profile?.prenom]);

  // À la 1ère fournée (juste après mount), on marque toutes les bulles existantes
  // comme « déjà vues » pour qu'elles ne s'animent PAS en typewriter.
  const firstLoadDone = useRef(false);
  useEffect(() => {
    if (!firstLoadDone.current && realBubbles.length > 0) {
      realBubbles.forEach((b) => animatedIdsRef.current.add(b.id));
      firstLoadDone.current = true;
    }
  }, [realBubbles]);

  // Détecte les nouvelles bulles AI fraîchement arrivées → lance le typewriter
  useEffect(() => {
    if (!firstLoadDone.current) return;
    const lastAi = [...realBubbles].reverse().find((b) => b.from === 'ai');
    if (lastAi && !animatedIdsRef.current.has(lastAi.id)) {
      animatedIdsRef.current.add(lastAi.id);
      setAnimatingId(lastAi.id);
    }
  }, [realBubbles]);

  // On ajoute la bulle « thinking » à la fin pendant que l'IA répond
  const bubbles = useMemo<Bubble[]>(() => {
    if (!sendMutation.isPending) return realBubbles;
    return [
      ...realBubbles,
      { id: 'thinking', from: 'ai', text: '', thinking: true } as Bubble,
    ];
  }, [realBubbles, sendMutation.isPending]);

  // Une seule réponse par question. Dès que l'utilisateur a répondu,
  // l'input se ferme jusqu'à la prochaine question envoyée par l'admin.
  const pending = useMemo(
    () => thread?.filter((d) => d.responses.length === 0).slice(-1)[0] ?? null,
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

  const scrollToEnd = (animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  };

  useEffect(() => {
    const id = setTimeout(() => scrollToEnd(true), 100);
    return () => clearTimeout(id);
  }, [bubbles.length]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setTimeout(() => scrollToEnd(true), 50),
    );
    return () => show.remove();
  }, []);

  const handleSend = async (text: string) => {
    if (!pending) {
      setError("Aucune question en attente. baba IAssou3 t'enverra bientôt la prochaine.");
      return;
    }
    setError(null);
    try {
      await sendMutation.mutateAsync({ deliveryId: pending.delivery_id, contenu: text });
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi");
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
    <Screen padded={false} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight + tabBarHeight}
      >
        <Image
          source={assets.mascot}
          style={styles.bgMascot}
          resizeMode="contain"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(b) => b.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
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
          renderItem={({ item, index }) => {
            // Avatar de la mascotte seulement sur la 1ère bulle AI d'une rafale
            const prev = bubbles[index - 1];
            const showAvatar = item.from === 'ai' && (!prev || prev.from !== 'ai');
            if (item.from === 'ai') {
              const isThinking = 'thinking' in item && !!item.thinking;
              return (
                <ChatBubble
                  from="ai"
                  text={item.text}
                  lettre={'lettre' in item ? item.lettre : undefined}
                  showAvatar={showAvatar}
                  thinking={isThinking}
                  typewriter={!isThinking && item.id === animatingId}
                  onTypewriterDone={() => {
                    if (item.id === animatingId) setAnimatingId(null);
                  }}
                />
              );
            }
            return <ChatBubble from="user" text={item.text} score={'score' in item ? item.score : undefined} />;
          }}
          onContentSizeChange={() => scrollToEnd(false)}
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
            placeholder="Réponds à baba IAssou3…"
          />
        ) : (
          <View style={styles.idleWrap}>
            <View style={[styles.idleChip, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: font.caption }}>
                Tu es à jour. baba IAssou3 te recontactera très bientôt.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  bgMascot: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    width: '70%',
    height: '60%',
    opacity: 0.18,
  },
  idle: { padding: spacing.lg, borderTopWidth: 1 },
  idleWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  idleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  error: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
