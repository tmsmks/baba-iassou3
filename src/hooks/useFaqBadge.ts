import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOpenSermons } from '@/hooks/useSermons';

const KEY = 'faq-seen-sermons-v1';

async function loadSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Indique s'il y a une FAQ ouverte que l'utilisateur n'a pas encore consultée.
 * Le suivi est local (AsyncStorage) — un nouveau sermon ouvert par l'admin déclenche le badge.
 */
export function useFaqBadge() {
  const { data: openSermons } = useOpenSermons();
  const [seen, setSeen] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSeen().then((s) => {
      setSeen(s);
      setLoaded(true);
    });
  }, []);

  const openIds = (openSermons ?? []).map((s) => s.id);
  const unseen = openIds.filter((id) => !seen.includes(id));
  const hasNewFaq = loaded && unseen.length > 0;

  const markFaqSeen = useCallback(async () => {
    if (openIds.length === 0) return;
    const merged = Array.from(new Set([...seen, ...openIds]));
    if (merged.length === seen.length) return; // déjà tous vus
    setSeen(merged);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
    } catch {
      // best-effort
    }
  }, [openIds, seen]);

  return { hasNewFaq, unseenCount: unseen.length, markFaqSeen };
}
