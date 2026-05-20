// POST /functions/v1/send-question
// Auth: Bearer <admin JWT>
// Body: { question_id: string } OR { lettre: 'C'|..., texte: string }
// Crée 1 delivery par user actif et pousse une notif Expo à tous leurs tokens.
import { preflight, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { userClient, serviceClient } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const LETTRES = ['C', 'H', 'O', 'I', 'X'] as const;
type Lettre = typeof LETTRES[number];

interface Body {
  question_id?: string;
  lettre?: Lettre;
  texte?: string;
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

  const admin = serviceClient();
  let questionId = body.question_id;

  if (!questionId) {
    if (!body.lettre || !LETTRES.includes(body.lettre) || !body.texte) {
      return errorResponse(400, 'Fournir question_id, OU lettre + texte');
    }
    const { data: q, error: qErr } = await admin
      .from('questions')
      .insert({ lettre: body.lettre, texte: body.texte, created_by: u.user.id })
      .select('id')
      .single();
    if (qErr || !q) return errorResponse(500, 'Création question échouée');
    questionId = q.id;
  }

  // Met à jour conference_state.current_question_id
  await admin.from('conference_state').update({
    current_question_id: questionId,
    updated_at: new Date().toISOString(),
  }).eq('id', true);

  // Liste tous les utilisateurs ayant au moins un push token
  const { data: tokens, error: tokErr } = await admin
    .from('push_tokens')
    .select('user_id, expo_token, platform, profiles!inner(prenom)');
  if (tokErr) return errorResponse(500, 'Lecture tokens échouée');

  const { data: question } = await admin
    .from('questions')
    .select('id, lettre, texte')
    .eq('id', questionId!)
    .single();
  if (!question) return errorResponse(404, 'Question introuvable');

  // Crée les deliveries (upsert pour idempotence)
  const userIds = [...new Set((tokens ?? []).map((t) => t.user_id))];
  const deliveryRows = userIds.map((uid) => ({
    user_id: uid,
    question_id: questionId!,
    sent_at: new Date().toISOString(),
  }));

  let deliveryByUser = new Map<string, string>();
  if (deliveryRows.length > 0) {
    const { data: deliveries, error: dErr } = await admin
      .from('question_deliveries')
      .upsert(deliveryRows, { onConflict: 'question_id,user_id' })
      .select('id, user_id');
    if (dErr) return errorResponse(500, 'Création deliveries échouée');
    deliveryByUser = new Map((deliveries ?? []).map((d) => [d.user_id, d.id]));
  }

  // Construit les messages Expo
  const messages = (tokens ?? []).map((t) => {
    const prenom = (t as any).profiles?.prenom ?? '';
    const deliveryId = deliveryByUser.get(t.user_id);
    return {
      to: t.expo_token,
      title: `baba IAssou3 a un mot pour toi${prenom ? ', ' + prenom : ''}`,
      body: question.texte,
      sound: 'default',
      priority: 'high',
      channelId: 'questions',
      data: {
        type: 'question',
        delivery_id: deliveryId,
        question_id: question.id,
        lettre: question.lettre,
      },
    };
  }).filter((m) => m.data.delivery_id);

  // Expo accepte jusqu'à 100 messages par requête
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  let pushed = 0;
  let failed = 0;
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
      if (res.ok) pushed += chunk.length;
      else {
        failed += chunk.length;
        console.error('Expo push error', res.status, await res.text());
      }
    } catch (e) {
      failed += chunk.length;
      console.error('Expo push exception', e);
    }
  }

  return jsonResponse({
    question_id: questionId,
    users_targeted: userIds.length,
    devices_pushed: pushed,
    devices_failed: failed,
  });
});
