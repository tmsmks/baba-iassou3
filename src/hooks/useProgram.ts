import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { ProgramItem } from '@/types/database';

export function useProgram() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery<ProgramItem[]>({
    queryKey: ['program', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from('program')
        .select('*')
        .order('heure_debut', { ascending: true });
      if (error) throw error;
      return items ?? [];
    },
  });
}
