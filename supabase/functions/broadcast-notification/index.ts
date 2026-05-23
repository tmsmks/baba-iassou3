// POST /functions/v1/broadcast-notification
// Auth: Bearer <admin JWT>
// Body: { title: string, body: string, user_ids?: string[], data?: Record<string, unknown> }
import { preflight, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { userClient, serviceClient } from '../_shared/supabase.ts';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/expo-push.ts';

interface Body {
  title?: string;
  body?: string;
  user_ids?: string[];
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  const sb = userClient(req);
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return errorResponse(401, 'Non authentifié');
  const { data: prof } = await sb.from('profiles').select('is_admin').eq('id', u.user.id).single();
  if (!prof?.is_admin) return errorResponse(403, 'Admin requis');

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON');
  }

  const title = body.title?.trim();
  const text = body.body?.trim();
  if (!title || !text) return errorResponse(400, 'title et body requis');
  if (title.length > 80) return errorResponse(400, 'title trop long (80 max)');
  if (text.length > 300) return errorResponse(400, 'body trop long (300 max)');

  const admin = serviceClient();

  let query = admin.from('push_tokens').select('user_id, expo_token');
  if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
    query = query.in('user_id', body.user_ids);
  }
  const { data: tokens, error: tokErr } = await query;
  if (tokErr) return errorResponse(500, 'Lecture tokens échouée');

  const userIds = [...new Set((tokens ?? []).map((t) => t.user_id))];
  const messages: ExpoPushMessage[] = (tokens ?? []).map((t) => ({
    to: t.expo_token,
    title,
    body: text,
    sound: 'default',
    priority: 'high',
    channelId: 'broadcasts',
    data: {
      type: 'broadcast',
      ...(body.data ?? {}),
    },
  }));

  const pushResult = await sendExpoPush(messages, admin);

  return jsonResponse({
    users_targeted: userIds.length,
    devices_pushed: pushResult.pushed,
    devices_failed: pushResult.failed,
    tokens_registered: (tokens ?? []).length,
  });
});
