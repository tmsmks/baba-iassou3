import { useEffect } from 'react';
// expo-file-system v19 a déplacé l'API « classique » dans /legacy
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { Chant } from '@/types/database';

const CACHE_DIR = `${FileSystem.cacheDirectory ?? ''}chants/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function fileNameFor(chant: Chant): string {
  // Nom dérivé de l'URL pour rester stable et unique
  const safe = chant.url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  return `${chant.id}-${safe}`;
}

/**
 * Retourne le chemin local du PDF du chant si déjà téléchargé, sinon l'URL distante.
 * Pratique pour le visualiseur de PDF qui accepte file:// ou https://.
 */
export async function localChantUriOrFallback(chant: Chant): Promise<string> {
  try {
    await ensureDir();
    const path = `${CACHE_DIR}${fileNameFor(chant)}`;
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? path : chant.url;
  } catch {
    return chant.url;
  }
}

/**
 * Pré-cache en arrière-plan tous les PDFs des chants (téléchargements parallèles plafonnés).
 * Idempotent : ne re-télécharge pas si déjà présent.
 */
async function prefetchChants(chants: Chant[]): Promise<void> {
  await ensureDir();
  const POOL = 3;
  let i = 0;
  const workers = Array.from({ length: POOL }).map(async () => {
    while (i < chants.length) {
      const idx = i++;
      const c = chants[idx];
      const path = `${CACHE_DIR}${fileNameFor(c)}`;
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) continue;
        await FileSystem.downloadAsync(c.url, path);
      } catch (e) {
        // Best-effort : on continue avec les autres chants
        console.warn('Prefetch chant échoué', c.titre, e);
      }
    }
  });
  await Promise.all(workers);
}

/**
 * Hook autonome — précharge les PDFs des chants en local au login.
 * Sans réseau plus tard, les chants restent ouvrables.
 */
export function useChantsPrefetch(): void {
  const userId = useSessionStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('chants')
        .select('*')
        .order('ordre', { ascending: true });
      if (error || !data || cancelled) return;
      await prefetchChants(data as Chant[]).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
