import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';
import type { Chant } from '@/types/database';

export function useChants() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery<Chant[]>({
    queryKey: ['chants'],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chants')
        .select('*')
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chant[];
    },
  });
}
