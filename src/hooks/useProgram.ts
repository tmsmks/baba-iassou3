import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { ProgramItem } from '@/types/database';

export interface ProgramItemWithFav extends ProgramItem {
  isFavorite: boolean;
}

export function useProgram() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery<ProgramItemWithFav[]>({
    queryKey: ['program', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: items, error: e1 }, { data: favs, error: e2 }] = await Promise.all([
        supabase.from('program').select('*').order('heure_debut', { ascending: true }),
        supabase.from('program_favorites').select('program_id').eq('user_id', userId!),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const favSet = new Set((favs ?? []).map((f) => f.program_id));
      return (items ?? []).map((it) => ({ ...it, isFavorite: favSet.has(it.id) }));
    },
  });
}

export function useToggleFavorite() {
  const userId = useSessionStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ programId, isFav }: { programId: string; isFav: boolean }) => {
      if (!userId) throw new Error('Non authentifié');
      if (isFav) {
        await supabase
          .from('program_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('program_id', programId);
      } else {
        await supabase.from('program_favorites').insert({ user_id: userId, program_id: programId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['program', userId] }),
  });
}
