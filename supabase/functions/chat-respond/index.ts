// POST /functions/v1/chat-respond
// Body: { delivery_id: string, contenu: string }
// Auth: Bearer <user JWT>
import { preflight, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { userClient, serviceClient } from '../_shared/supabase.ts';
import { callAI, ensureTrailingChoice } from '../_shared/ai.ts';
import { SYSTEM_PROMPT_CHAT, type Lettre } from '../_shared/prompts.ts';

interface AIChat {
  message: string;
  score_lettre: Lettre;
  score_valeur: number;
}

const responseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    score_lettre: { type: 'string', enum: ['C', 'H', 'O', 'I', 'X'] },
    score_valeur: { type: 'integer', minimum: 0, maximum: 5 },
  },
  required: ['message', 'score_lettre', 'score_valeur'],
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  let payload: { delivery_id?: string; contenu?: string };
  try {
    payload = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON');
  }
  const { delivery_id, contenu } = payload;
  if (!delivery_id || !contenu || contenu.trim().length === 0) {
    return errorResponse(400, 'Missing delivery_id or contenu');
  }
  if (contenu.length > 4000) return errorResponse(400, 'Réponse trop longue (4000 max)');

  const sb = userClient(req);
  const { data: userRes, error: userErr } = await sb.auth.getUser();
  if (userErr || !userRes.user) return errorResponse(401, 'Non authentifié');
  const userId = userRes.user.id;

  // Récupère la delivery + question + prénom
  const { data: delivery, error: delErr } = await sb
    .from('question_deliveries')
    .select('id, user_id, question_id, questions(lettre, texte), profiles!inner(prenom)')
    .eq('id', delivery_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (delErr || !delivery) return errorResponse(404, 'Question introuvable');

  const admin = serviceClient();

  // Idempotence : une seule réponse par question (delivery). Si l'utilisateur a déjà
  // répondu, on renvoie SA réponse existante sans rappeler l'IA. Ça neutralise
  // l'amplification de coût (retries réseau, double-tap, appels scriptés en boucle).
  const { data: existing } = await admin
    .from('responses')
    .select('id, ai_feedback, score, lettre')
    .eq('delivery_id', delivery_id)
    .maybeSingle();
  if (existing) {
    return jsonResponse({
      response_id: existing.id,
      message: existing.ai_feedback ?? '',
      score: existing.score ?? 0,
      lettre: existing.lettre as Lettre,
    });
  }

  const q = (delivery as any).questions;
  const prenom = (delivery as any).profiles.prenom as string;
  const lettre = q.lettre as Lettre;

  // Récupère les 5 scores d'auto-évaluation (onboarding) pour contextualiser la réponse IA
  const { data: onboardingRows } = await admin
    .from('responses')
    .select('lettre, score, questions!inner(is_onboarding)')
    .eq('user_id', userId)
    .eq('questions.is_onboarding', true);
  const autoEvaluation: Partial<Record<Lettre, number>> = {};
  for (const row of (onboardingRows ?? []) as any[]) {
    if (typeof row.score === 'number') autoEvaluation[row.lettre as Lettre] = row.score;
  }

  const systemPrompt = SYSTEM_PROMPT_CHAT({
    prenom,
    lettre,
    questionTexte: q.texte,
    autoEvaluation: Object.keys(autoEvaluation).length > 0 ? autoEvaluation : null,
  });

  let ai: AIChat;
  try {
    const result = await callAI<AIChat>(systemPrompt, contenu, responseSchema);
    ai = result.data;
  } catch (err) {
    console.error('AI error', err);
    return errorResponse(502, 'Le service IA est momentanément indisponible');
  }

  if (ai.score_lettre !== lettre) ai.score_lettre = lettre;
  const score = Math.max(0, Math.min(5, Math.round(ai.score_valeur)));
  const message = ensureTrailingChoice(ai.message);

  // Insertion via service role pour bypass RLS si besoin
  const { data: inserted, error: insErr } = await admin
    .from('responses')
    .insert({
      delivery_id,
      user_id: userId,
      question_id: q.id ?? delivery.question_id,
      lettre,
      contenu,
      score,
      ai_feedback: message,
    })
    .select('id, created_at')
    .single();
  if (insErr) {
    // Course (deux appels quasi simultanés) : la contrainte unique sur delivery_id
    // rejette le doublon (23505) → on renvoie la réponse gagnante plutôt qu'échouer.
    if ((insErr as { code?: string }).code === '23505') {
      const { data: winner } = await admin
        .from('responses')
        .select('id, ai_feedback, score, lettre')
        .eq('delivery_id', delivery_id)
        .maybeSingle();
      if (winner) {
        return jsonResponse({
          response_id: winner.id,
          message: winner.ai_feedback ?? message,
          score: winner.score ?? score,
          lettre: (winner.lettre as Lettre) ?? lettre,
        });
      }
    }
    console.error('Insert response error', insErr);
    return errorResponse(500, 'Impossible d\'enregistrer la réponse');
  }

  await admin
    .from('question_deliveries')
    .update({ answered_at: new Date().toISOString(), opened_at: new Date().toISOString() })
    .eq('id', delivery_id);

  return jsonResponse({
    response_id: inserted.id,
    message,
    score,
    lettre,
  });
});
