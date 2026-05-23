import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushSendResult {
  pushed: number;
  failed: number;
  invalidTokens: string[];
}

type ExpoTicket =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

/** Envoie des messages Expo Push par lots de 100 et interprète les tickets. */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
  admin?: SupabaseClient,
): Promise<ExpoPushSendResult> {
  if (messages.length === 0) {
    return { pushed: 0, failed: 0, invalidTokens: [] };
  }

  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let pushed = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });

      const raw = await res.json().catch(() => ({}));
      const tickets: ExpoTicket[] = Array.isArray(raw?.data) ? raw.data : [];

      if (!res.ok) {
        failed += chunk.length;
        console.error('Expo push HTTP error', res.status, raw);
        continue;
      }

      tickets.forEach((ticket, i) => {
        const token = chunk[i]?.to;
        if (ticket.status === 'ok') {
          pushed += 1;
          return;
        }
        failed += 1;
        const errCode = ticket.details?.error;
        if (token && (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials')) {
          invalidTokens.push(token);
        }
        console.error('Expo push ticket error', token, ticket.message, errCode);
      });

      // Réponse incomplète : tickets manquants
      if (tickets.length < chunk.length) {
        failed += chunk.length - tickets.length;
      }
    } catch (e) {
      failed += chunk.length;
      console.error('Expo push exception', e);
    }
  }

  if (admin && invalidTokens.length > 0) {
    const unique = [...new Set(invalidTokens)];
    await admin.from('push_tokens').delete().in('expo_token', unique);
  }

  return { pushed, failed, invalidTokens };
}
