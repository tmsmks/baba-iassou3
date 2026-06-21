import { useEffect, useState } from 'react';
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
  openAppSettings,
  type PhotoPickerSource,
  type PhotoWithLikes,
} from '@/hooks/usePhotos';
import { useSessionStore } from '@/store/session';
import { useReportContent, useBlockAuthor } from '@/hooks/useModeration';
import { usePhotosBadge } from '@/hooks/usePhotosBadge';
import { containsObjectionable, OBJECTIONABLE_MESSAGE } from '@/lib/moderation';
import { downloadPhotoToDevice, openAppSettings as openDeviceSettings } from '@/lib/downloadPhoto';

const SCREEN_W = Dimensions.get('window').width;
const GAP = 4;
const COLS = 2;
const TILE = Math.floor((SCREEN_W - GAP * (COLS + 1)) / COLS);

function UploadPanel({
  caption,
  onCaptionChange,
  onPick,
  loading,
}: {
  caption: string;
  onCaptionChange: (v: string) => void;
  onPick: (source: PhotoPickerSource) => void;
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
            Prends une photo sur le vif ou choisis-en une dans ta galerie.
          </Text>
        </View>
      </View>
      <View style={styles.uploadBtnRow}>
        <Button
          label="Caméra"
          icon={<Ionicons name="camera-outline" size={20} color={t.isDark ? t.bg : '#FFFFFF'} />}
          onPress={() => onPick('camera')}
          loading={loading}
          style={styles.uploadBtn}
        />
        <Button
          label="Galerie"
          icon={<Ionicons name="images-outline" size={20} color={t.text} />}
          onPress={() => onPick('gallery')}
          loading={loading}
          variant="secondary"
          style={styles.uploadBtn}
        />
      </View>
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
  const report = useReportContent();
  const block = useBlockAuthor();
  const { markPhotosSeen } = usePhotosBadge();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [downloading, setDownloading] = useState(false);
  const { refreshing, onRefresh } = useAppRefresh();

  useEffect(() => {
    markPhotosSeen();
  }, [markPhotosSeen]);

  const preview = data?.find((p) => p.id === previewId) ?? null;

  // Signalement / blocage (Guideline 1.2)
  const onModerate = (photo: PhotoWithLikes) => {
    Alert.alert('Modération', 'Que souhaites-tu faire ?', [
      {
        text: 'Signaler cette photo',
        onPress: () =>
          Alert.alert(
            'Signaler cette photo ?',
            'Notre équipe de modération la vérifiera sous 24 h et retirera tout contenu inapproprié.',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Signaler',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await report.mutateAsync({
                      type: 'photo',
                      contentId: photo.id,
                      reason: 'Signalé depuis le mur de photos',
                    });
                    Alert.alert('Merci', 'Ton signalement a bien été transmis.');
                  } catch (e: any) {
                    Alert.alert('Erreur', e?.message ?? 'Échec du signalement.');
                  }
                },
              },
            ],
          ),
      },
      {
        text: "Bloquer l'auteur",
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            "Bloquer cet utilisateur ?",
            "Tu ne verras plus aucun de ses contenus, et notre équipe de modération sera notifiée.",
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Bloquer',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await block.mutateAsync({ type: 'photo', contentId: photo.id });
                    setPreviewId(null);
                    Alert.alert('Utilisateur bloqué', "Son contenu n'apparaîtra plus dans ton fil.");
                  } catch (e: any) {
                    Alert.alert('Erreur', e?.message ?? 'Échec du blocage.');
                  }
                },
              },
            ],
          ),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const onUpload = async (source: PhotoPickerSource) => {
    if (upload.isPending) return;
    if (containsObjectionable(caption)) {
      Alert.alert('Contenu inapproprié', OBJECTIONABLE_MESSAGE);
      return;
    }
    try {
      const result = await upload.mutateAsync({ caption: caption.trim() || undefined, source });
      if (result === 'cancelled') return;
      setCaption('');
      Alert.alert('Photo publiée', 'Ta photo est visible sur le mur.');
    } catch (e: any) {
      if (e?.message === 'GALLERY_PERMISSION_DENIED') {
        Alert.alert(
          'Accès à la galerie',
          "Autorise l'accès à tes photos dans les réglages pour en publier une sur le mur.",
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => openAppSettings() },
          ],
        );
      } else if (e?.message === 'CAMERA_PERMISSION_DENIED') {
        Alert.alert(
          'Accès à la caméra',
          "Autorise l'accès à la caméra dans les réglages pour prendre une photo.",
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => openAppSettings() },
          ],
        );
      } else {
        Alert.alert('Erreur', e?.message ?? "Échec de l'envoi.");
      }
    }
  };

  const showAddMenu = () => {
    if (upload.isPending) return;
    Alert.alert('Ajouter une photo', 'Choisis une source', [
      { text: 'Prendre une photo', onPress: () => onUpload('camera') },
      { text: 'Choisir dans la galerie', onPress: () => onUpload('gallery') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const onDownload = async (photo: PhotoWithLikes) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const result = await downloadPhotoToDevice(photo.url);
      Alert.alert(
        result === 'saved' ? 'Photo enregistrée' : 'Photo partagée',
        result === 'saved'
          ? 'La photo a été ajoutée à ta galerie.'
          : "Utilise « Enregistrer l'image » pour la garder sur ton téléphone.",
      );
    } catch (e: any) {
      if (e?.message === 'SAVE_PERMISSION_DENIED') {
        Alert.alert(
          'Permission requise',
          "Autorise l'accès à la galerie dans les réglages pour enregistrer la photo.",
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => openDeviceSettings() },
          ],
        );
      } else {
        Alert.alert('Erreur', e?.message ?? 'Impossible de télécharger la photo.');
      }
    } finally {
      setDownloading(false);
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
      onPick={onUpload}
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
          onPress={showAddMenu}
          disabled={upload.isPending}
          style={[styles.headerPublishBtn, { backgroundColor: t.primary }]}
          accessibilityLabel="Ajouter une photo"
        >
          {upload.isPending ? (
            <ActivityIndicator color={t.isDark ? t.bg : '#FFFFFF'} size="small" />
          ) : (
            <>
              <Ionicons name="add" size={22} color={t.isDark ? t.bg : '#FFFFFF'} />
              <Text style={[styles.headerPublishTxt, { color: t.isDark ? t.bg : '#FFFFFF' }]}>
                Ajouter
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
                {isAdmin ? (
                  <Pressable
                    onPress={() => onDownload(preview)}
                    hitSlop={8}
                    style={{ padding: 8 }}
                    disabled={downloading}
                    accessibilityLabel="Télécharger la photo"
                  >
                    {downloading ? (
                      <ActivityIndicator color={t.accent} size="small" />
                    ) : (
                      <Ionicons name="download-outline" size={22} color={t.accent} />
                    )}
                  </Pressable>
                ) : null}
                {preview.user_id === userId || isAdmin ? (
                  <Pressable onPress={() => onDelete(preview)} hitSlop={8} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={22} color={t.danger} />
                  </Pressable>
                ) : null}
                {preview.user_id !== userId ? (
                  <Pressable
                    onPress={() => onModerate(preview)}
                    hitSlop={8}
                    style={{ padding: 8 }}
                    accessibilityLabel="Signaler ou bloquer"
                  >
                    <Ionicons name="ellipsis-horizontal" size={22} color={t.textMuted} />
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
  uploadBtnRow: { flexDirection: 'row', gap: spacing.sm },
  uploadBtn: { flex: 1 },
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
