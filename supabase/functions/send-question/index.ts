// POST /functions/v1/send-question
// Auth: Bearer <admin JWT>
// Body: { question_id: string } OR { lettre: 'C'|..., texte: string }
// Crée 1 delivery par participant (onboarding terminé) et pousse une notif Expo aux tokens enregistrés.
import { preflight, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { userClient, serviceClient } from '../_shared/supabase.ts';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/expo-push.ts';

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
      .insert({
        lettre: body.lettre,
        texte: body.texte,
        is_onboarding: false,
        created_by: u.user.id,
      })
      .select('id')
      .single();
    if (qErr || !q) return errorResponse(500, 'Création question échouée');
    questionId = q.id;
  }

  await admin.from('conference_state').update({
    current_question_id: questionId,
    updated_at: new Date().toISOString(),
  }).eq('id', true);

  const { data: question } = await admin
    .from('questions')
    .select('id, lettre, texte')
    .eq('id', questionId!)
    .single();
  if (!question) return errorResponse(404, 'Question introuvable');

  // Tous les participants ayant terminé l'onboarding reçoivent une delivery (chat in-app).
  const { data: participants, error: partErr } = await admin
    .from('profiles')
    .select('id')
    .not('onboarding_completed_at', 'is', null);
  if (partErr) return errorResponse(500, 'Lecture participants échouée');

  const userIds = (participants ?? []).map((p) => p.id);
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

  // Push Expo : uniquement les appareils avec token enregistré.
  const { data: tokens, error: tokErr } = await admin
    .from('push_tokens')
    .select('user_id, expo_token, profiles!inner(prenom)');
  if (tokErr) return errorResponse(500, 'Lecture tokens échouée');

  const messages: ExpoPushMessage[] = (tokens ?? [])
    .map((t) => {
      const prenom = (t as { profiles?: { prenom?: string } }).profiles?.prenom ?? '';
      const deliveryId = deliveryByUser.get(t.user_id);
      if (!deliveryId) return null;
      return {
        to: t.expo_token,
        title: `baba IAssou3 a un mot pour toi${prenom ? ', ' + prenom : ''}`,
        body: question.texte,
        sound: 'default' as const,
        priority: 'high' as const,
        channelId: 'questions',
        data: {
          type: 'question',
          delivery_id: deliveryId,
          question_id: question.id,
          lettre: question.lettre,
        },
      };
    })
    .filter((m): m is ExpoPushMessage => m !== null);

  const pushResult = await sendExpoPush(messages, admin);

  return jsonResponse({
    question_id: questionId,
    users_targeted: userIds.length,
    devices_pushed: pushResult.pushed,
    devices_failed: pushResult.failed,
    tokens_registered: (tokens ?? []).length,
  });
});
