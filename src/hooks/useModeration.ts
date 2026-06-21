import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/session';

export type ReportableType = 'photo' | 'secret_message';

/** Signale un contenu (photo ou message d'ami secret) à l'équipe de modération. */
export function useReportContent() {
  return useMutation({
    mutationFn: async ({
      type,
      contentId,
      reason,
    }: {
      type: ReportableType;
      contentId: string;
      reason?: string;
    }) => {
      const { error } = await (supabase.rpc as any)('report_content', {
        p_type: type,
        p_content_id: contentId,
        p_reason: reason ?? null,
      });
      if (error) throw error;
    },
  });
}

/**
 * Bloque l'auteur d'un contenu : son contenu disparaît instantanément des feeds
 * (RLS) et un signalement est créé pour notifier les modérateurs.
 */
export function useBlockAuthor() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async ({ type, contentId }: { type: ReportableType; contentId: string }) => {
      const { error } = await (supabase.rpc as any)('block_author_of', {
        p_type: type,
        p_content_id: contentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos', userId] });
      qc.invalidateQueries({ queryKey: ['secret-inbox', userId] });
    },
  });
}

/** Enregistre l'acceptation du CLUF par l'utilisateur courant. */
export function useAcceptEula() {
  const setProfile = useSessionStore((s) => s.setProfile);
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)('accept_eula');
      if (error) throw error;
    },
    onSuccess: () => {
      const profile = useSessionStore.getState().profile;
      if (profile && !profile.eula_accepted_at) {
        setProfile({ ...profile, eula_accepted_at: new Date().toISOString() });
      }
    },
  });
}
