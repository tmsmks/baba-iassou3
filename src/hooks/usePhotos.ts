import { InteractionManager, Linking, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { Photo } from '@/types/database';

function canUseGallery(permission: ImagePicker.MediaLibraryPermissionResponse): boolean {
  if (permission.granted) return true;
  const priv = permission.accessPrivileges;
  return priv === 'all' || priv === 'limited';
}

async function waitBeforePicker() {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, Platform.OS === 'ios' ? 400 : 100);
    });
  });
}

async function pickFromGallery() {
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!canUseGallery(permission)) {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  if (!canUseGallery(permission)) {
    throw new Error('GALLERY_PERMISSION_DENIED');
  }

  await waitBeforePicker();

  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
    selectionLimit: 1,
  });
}

async function pickFromCamera() {
  let permission = await ImagePicker.getCameraPermissionsAsync();
  if (!permission.granted) {
    permission = await ImagePicker.requestCameraPermissionsAsync();
  }
  if (!permission.granted) {
    throw new Error('CAMERA_PERMISSION_DENIED');
  }

  await waitBeforePicker();

  return ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });
}

export type PhotoPickerSource = 'gallery' | 'camera';

async function pickImage(source: PhotoPickerSource) {
  return source === 'gallery' ? pickFromGallery() : pickFromCamera();
}

export async function openAppSettings() {
  await Linking.openSettings().catch(() => {});
}

export interface PhotoWithLikes extends Photo {
  likes_count: number;
  liked_by_me: boolean;
  uploader_prenom: string | null;
}

export function usePhotos() {
  const userId = useSessionStore((s) => s.user?.id);

  const query = useQuery<PhotoWithLikes[]>({
    queryKey: ['photos', userId],
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async () => {
      const [{ data: ps, error: e1 }, { data: ls, error: e2 }] = await Promise.all([
        supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('photo_likes').select('photo_id, user_id'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const photos = (ps ?? []) as Photo[];
      const countByP = new Map<string, number>();
      const likedByMe = new Set<string>();
      for (const l of (ls ?? []) as { photo_id: string; user_id: string }[]) {
        countByP.set(l.photo_id, (countByP.get(l.photo_id) ?? 0) + 1);
        if (l.user_id === userId) likedByMe.add(l.photo_id);
      }

      // Récupère les prénoms des uploaders en une requête
      const uploaderIds = [...new Set(photos.map((p) => p.user_id))];
      const prenomById = new Map<string, string>();
      if (uploaderIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, prenom')
          .in('id', uploaderIds);
        for (const p of (profs ?? []) as { id: string; prenom: string }[]) {
          prenomById.set(p.id, p.prenom);
        }
      }

      return photos.map((p) => ({
        ...p,
        uploader_prenom: prenomById.get(p.user_id) ?? null,
        likes_count: countByP.get(p.id) ?? 0,
        liked_by_me: likedByMe.has(p.id),
      }));
    },
  });

  return query;
}

export function useTogglePhotoLike() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ photoId, liked }: { photoId: string; liked: boolean }) => {
      if (!userId) throw new Error('Non authentifié');
      if (liked) {
        const { error } = await supabase
          .from('photo_likes')
          .delete()
          .eq('photo_id', photoId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('photo_likes') as any).insert({
          photo_id: photoId,
          user_id: userId,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ photoId, liked }) => {
      await qc.cancelQueries({ queryKey: ['photos'] });
      const prev = qc.getQueryData<PhotoWithLikes[]>(['photos', userId]);
      if (prev) {
        qc.setQueryData<PhotoWithLikes[]>(['photos', userId], (old) =>
          (old ?? []).map((p) =>
            p.id === photoId
              ? {
                  ...p,
                  liked_by_me: !liked,
                  likes_count: Math.max(0, p.likes_count + (liked ? -1 : 1)),
                }
              : p,
          ),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['photos', userId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['photos', userId] }),
  });
}

export type UploadPhotoResult = 'uploaded' | 'cancelled';

export function useUploadPhoto() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      caption,
      source,
    }: {
      caption?: string;
      source: PhotoPickerSource;
    }): Promise<UploadPhotoResult> => {
      if (!userId) throw new Error('Non authentifié');

      const res = await pickImage(source);
      if (res.canceled || !res.assets?.length) return 'cancelled';
      const asset = res.assets[0];

      // Compression / resize avant upload (max 1600px côté long)
      const max = 1600;
      const w = asset.width ?? max;
      const h = asset.height ?? max;
      const scale = Math.min(1, max / Math.max(w, h));
      const targetW = Math.round(w * scale);
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        scale < 1 ? [{ resize: { width: targetW } }] : [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const filename = `${userId}/${Date.now()}.jpg`;
      const response = await fetch(manipulated.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(filename, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(filename);

      const { error: insErr } = await (supabase.from('photos') as any).insert({
        user_id: userId,
        url: pub.publicUrl,
        storage_path: filename,
        caption: caption ?? null,
        width: manipulated.width ?? null,
        height: manipulated.height ?? null,
      });
      if (insErr) throw insErr;
      return 'uploaded';
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos', userId] }),
  });
}

export function useDeletePhoto() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: Photo) => {
      if (photo.storage_path) {
        await supabase.storage.from('photos').remove([photo.storage_path]).catch(() => {});
      }
      const { error } = await supabase.from('photos').delete().eq('id', photo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos', userId] }),
  });
}
