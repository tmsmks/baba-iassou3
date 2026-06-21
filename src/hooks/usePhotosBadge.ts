import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePhotos } from '@/hooks/usePhotos';
import { useSessionStore } from '@/store/session';

const KEY = 'photos-last-seen-at-v1';

export function usePhotosBadge() {
  const userId = useSessionStore((s) => s.user?.id);
  const { data: photos } = usePhotos();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      setLastSeenAt(raw);
      setLoaded(true);
    });
  }, []);

  // Première visite : on part de maintenant pour ne pas badger les photos déjà présentes.
  useEffect(() => {
    if (!loaded || lastSeenAt !== null || photos === undefined) return;
    const baseline = new Date().toISOString();
    setLastSeenAt(baseline);
    AsyncStorage.setItem(KEY, baseline).catch(() => {});
  }, [loaded, lastSeenAt, photos]);

  const unseenCount =
    loaded && lastSeenAt
      ? (photos ?? []).filter((p) => p.user_id !== userId && p.created_at > lastSeenAt).length
      : 0;

  const markPhotosSeen = useCallback(async () => {
    const ts =
      photos && photos.length > 0
        ? photos.reduce((max, p) => (p.created_at > max ? p.created_at : max), photos[0].created_at)
        : new Date().toISOString();
    setLastSeenAt(ts);
    try {
      await AsyncStorage.setItem(KEY, ts);
    } catch {
      // best-effort
    }
  }, [photos]);

  return { unseenCount, hasNewPhotos: unseenCount > 0, markPhotosSeen };
}
