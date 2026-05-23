import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';

/**
 * Hook réutilisable pour le pull-to-refresh :
 * - Invalide les query keys passées (rechargement des données Supabase)
 * - Vérifie en parallèle si un update OTA est disponible ; si oui, propose le redémarrage.
 *
 * Renvoie `{ refreshing, onRefresh }` à brancher sur un `RefreshControl`.
 */
export function useAppRefresh(queryKeys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(queryKeys.map((key) => qc.invalidateQueries({ queryKey: key })));
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Mise à jour disponible',
            "Une nouvelle version de l'app vient d'être téléchargée. Redémarrer maintenant ?",
            [
              { text: 'Plus tard', style: 'cancel' },
              { text: 'Redémarrer', onPress: () => Updates.reloadAsync() },
            ],
          );
        }
      } catch {
        // expo-updates indisponible (dev / Expo Go) — silencieux
      }
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, JSON.stringify(queryKeys)]);

  return { refreshing, onRefresh };
}
