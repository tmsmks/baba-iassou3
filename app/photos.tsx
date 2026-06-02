import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { font, radius, spacing, useTheme } from '@/lib/theme';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import {
  usePhotos,
  useTogglePhotoLike,
  useUploadPhoto,
  useDeletePhoto,
  type PhotoWithLikes,
} from '@/hooks/usePhotos';
import { useSessionStore } from '@/store/session';

const SCREEN_W = Dimensions.get('window').width;
const GAP = 4;
const COLS = 2;
const TILE = Math.floor((SCREEN_W - GAP * (COLS + 1)) / COLS);

function UploadPanel({
  caption,
  onCaptionChange,
  onUpload,
  loading,
}: {
  caption: string;
  onCaptionChange: (v: string) => void;
  onUpload: () => void;
  loading: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.uploadCard, { backgroundColor: t.primarySoft, borderColor: t.primary }]}>
      <View style={styles.uploadCardHeader}>
        <View style={[styles.uploadIconCircle, { backgroundColor: t.primary }]}>
          <Ionicons name="camera" size={28} color={t.isDark ? t.bg : '#FFFFFF'} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.uploadTitle, { color: t.text }]}>Publier une photo</Text>
          <Text style={[styles.uploadHint, { color: t.textMuted }]}>
            Choisis une image dans ta galerie pour la partager sur le mur.
          </Text>
        </View>
      </View>
      <Button
        label="Choisir une photo"
        icon={<Ionicons name="images" size={20} color={t.isDark ? t.bg : '#FFFFFF'} />}
        onPress={onUpload}
        loading={loading}
        style={styles.uploadMainBtn}
      />
      <TextInput
        value={caption}
        onChangeText={onCaptionChange}
        placeholder="Ajouter une légende (optionnel)"
        placeholderTextColor={t.textMuted}
        style={[
          styles.captionInput,
          { color: t.text, backgroundColor: t.surface, borderColor: t.border },
        ]}
        maxLength={240}
      />
    </View>
  );
}

export default function PhotosScreen() {
  const t = useTheme();
  const userId = useSessionStore((s) => s.user?.id);
  const isAdmin = useSessionStore((s) => s.profile?.is_admin);
  const { data, isLoading } = usePhotos();
  const upload = useUploadPhoto();
  const toggleLike = useTogglePhotoLike();
  const del = useDeletePhoto();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const { refreshing, onRefresh } = useAppRefresh();

  const preview = data?.find((p) => p.id === previewId) ?? null;

  const onUpload = async () => {
    if (upload.isPending) return;
    try {
      const result = await upload.mutateAsync({ caption: caption.trim() || undefined });
      if (result === 'cancelled') return;
      setCaption('');
      Alert.alert('Photo publiée', 'Ta photo est visible sur le mur.');
    } catch (e: any) {
      if (e?.message?.includes('refusé')) {
        Alert.alert('Permission requise', "Autorise l'accès aux photos dans les réglages.");
      } else {
        Alert.alert('Erreur', e?.message ?? "Échec de l'envoi.");
      }
    }
  };

  const onDelete = (p: PhotoWithLikes) => {
    Alert.alert('Supprimer cette photo ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(p);
            setPreviewId(null);
          } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Échec');
          }
        },
      },
    ]);
  };

  const uploadPanel = (
    <UploadPanel
      caption={caption}
      onCaptionChange={setCaption}
      onUpload={onUpload}
      loading={upload.isPending}
    />
  );

  return (
    <Screen padded={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>Mur photos</Text>
        <Pressable
          onPress={onUpload}
          disabled={upload.isPending}
          style={[styles.headerPublishBtn, { backgroundColor: t.primary }]}
          accessibilityLabel="Publier une photo"
        >
          {upload.isPending ? (
            <ActivityIndicator color={t.isDark ? t.bg : '#FFFFFF'} size="small" />
          ) : (
            <>
              <Ionicons name="add" size={20} color={t.isDark ? t.bg : '#FFFFFF'} />
              <Text style={[styles.headerPublishTxt, { color: t.isDark ? t.bg : '#FFFFFF' }]}>
                Publier
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={data ?? []}
          keyExtractor={(p) => p.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: GAP }}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: GAP }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
          }
          ListHeaderComponent={
            <View style={{ paddingHorizontal: GAP, marginBottom: spacing.sm }}>{uploadPanel}</View>
          }
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={56} color={t.primary} />
                <Text style={[styles.emptyTitle, { color: t.text }]}>Aucune photo pour l'instant</Text>
                <Text style={{ color: t.textMuted, textAlign: 'center', maxWidth: 300 }}>
                  Sois le premier à immortaliser un moment de la conférence !
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => setPreviewId(item.id)} style={styles.tileWrap}>
              <Image source={{ uri: item.url }} style={styles.tile} />
              <View style={styles.tileBadge}>
                <Ionicons name={item.liked_by_me ? 'heart' : 'heart-outline'} size={12} color="#FFFFFF" />
                <Text style={styles.tileBadgeTxt}>{item.likes_count}</Text>
              </View>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreviewId(null)}>
        {preview ? (
          <View style={styles.previewBg}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewId(null)} />
            <View style={[styles.previewCard, { backgroundColor: t.bg }]}>
              <Image source={{ uri: preview.url }} style={styles.previewImg} resizeMode="contain" />
              {preview.caption ? (
                <Text
                  style={{
                    color: t.text,
                    fontSize: font.body,
                    paddingHorizontal: spacing.lg,
                    marginTop: spacing.sm,
                  }}
                >
                  {preview.caption}
                </Text>
              ) : null}
              <View style={styles.previewFooter}>
                <Text style={{ color: t.textMuted, fontSize: font.caption, flex: 1 }}>
                  {preview.uploader_prenom ?? 'Anonyme'} ·{' '}
                  {new Date(preview.created_at).toLocaleString('fr-FR', {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Pressable
                  onPress={() => toggleLike.mutate({ photoId: preview.id, liked: preview.liked_by_me })}
                  style={[
                    styles.likePill,
                    {
                      backgroundColor: preview.liked_by_me ? t.danger : t.surfaceAlt,
                      borderColor: preview.liked_by_me ? t.danger : t.border,
                    },
                  ]}
                  hitSlop={8}
                >
                  <Ionicons
                    name={preview.liked_by_me ? 'heart' : 'heart-outline'}
                    size={16}
                    color={preview.liked_by_me ? '#FFFFFF' : t.text}
                  />
                  <Text
                    style={{
                      color: preview.liked_by_me ? '#FFFFFF' : t.text,
                      fontWeight: '800',
                      fontSize: font.caption,
                    }}
                  >
                    {preview.likes_count}
                  </Text>
                </Pressable>
                {preview.user_id === userId || isAdmin ? (
                  <Pressable onPress={() => onDelete(preview)} hitSlop={8} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={22} color={t.danger} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setPreviewId(null)} hitSlop={8} style={{ padding: 8 }}>
                  <Ionicons name="close" size={22} color={t.text} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { fontSize: font.subtitle, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerPublishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 96,
    justifyContent: 'center',
  },
  headerPublishTxt: { fontSize: font.caption, fontWeight: '800' },
  uploadCard: {
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  uploadCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  uploadIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: font.subtitle, fontWeight: '800' },
  uploadHint: { fontSize: font.caption, lineHeight: 18 },
  uploadMainBtn: { width: '100%' },
  captionInput: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: font.body,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { fontSize: font.subtitle, fontWeight: '800' },
  tileWrap: { width: TILE, height: TILE, position: 'relative' },
  tile: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#0001' },
  tileBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tileBadgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  previewBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  previewCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
  },
  previewImg: { width: '100%', height: 420 },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  likePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
});
