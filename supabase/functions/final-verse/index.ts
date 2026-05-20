// POST /functions/v1/final-verse
// Auth: Bearer <user JWT>
// Idempotent : si déjà généré, renvoie l'existant.
import { preflight, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { userClient, serviceClient } from '../_shared/supabase.ts';
import { callAI, ensureTrailingChoice } from '../_shared/ai.ts';
import { SYSTEM_PROMPT_VERSE, type Lettre } from '../_shared/prompts.ts';

interface AIVerse {
  verset_ref: string;
  verset_texte: string;
  conseil: string;
  explication: string;
}

const responseSchema = {
  type: 'object',
  properties: {
    verset_ref: { type: 'string' },
    verset_texte: { type: 'string' },
    conseil: { type: 'string' },
    explication: { type: 'string' },
  },
  required: ['verset_ref', 'verset_texte', 'conseil', 'explication'],
};

const LETTRES: Lettre[] = ['C', 'H', 'O', 'I', 'X'];

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  const sb = userClient(req);
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return errorResponse(401, 'Non authentifié');
  const userId = u.user.id;

  const admin = serviceClient();

  // Idempotence : déjà existant ?
  const { data: existing } = await admin
    .from('final_verse')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return jsonResponse(existing);

  // Vérifie que la conférence est terminée
  const { data: conf } = await admin.from('conference_state').select('is_finished').eq('id', true).single();
  if (!conf?.is_finished) return errorResponse(409, 'La conférence n\'est pas terminée');

  const { data: profile } = await admin
    .from('profiles')
    .select('prenom')
    .eq('id', userId)
    .single();
  if (!profile) return errorResponse(404, 'Profil introuvable');

  const { data: gauges } = await admin
    .from('gauges')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!gauges) return errorResponse(404, 'Aucune jauge — réponds d\'abord à des questions');

  const scores: Record<Lettre, number> = {
    C: Number(gauges.c_score), H: Number(gauges.h_score), O: Number(gauges.o_score),
    I: Number(gauges.i_score), X: Number(gauges.x_score),
  };
  const counts: Record<Lettre, number> = {
    C: gauges.c_count, H: gauges.h_count, O: gauges.o_count, I: gauges.i_count, X: gauges.x_count,
  };

  // Lacune = score le plus faible parmi ceux qui ont au moins 1 réponse.
  const candidates = LETTRES.filter((l) => counts[l] > 0);
  if (candidates.length === 0) return errorResponse(409, 'Pas assez de réponses pour générer un verset');
  const lettreFaible = candidates.reduce((acc, l) => (scores[l] < scores[acc] ? l : acc), candidates[0]);

  const { data: sample } = await admin
    .from('responses')
    .select('contenu')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  const echantillon = (sample ?? []).map((r) => r.contenu);

  const systemPrompt = SYSTEM_PROMPT_VERSE({
    prenom: profile.prenom,
    lettreFaible,
    scoresParLettre: scores,
    echantillonReponses: echantillon,
  });

  let verse: AIVerse;
  try {
    const r = await callAI<AIVerse>(systemPrompt, 'Génère le verset final.', responseSchema);
    verse = r.data;
  } catch (err) {
    console.error('AI verse error', err);
    return errorResponse(502, 'Le service IA est momentanément indisponible');
  }

  const row = {
    user_id: userId,
    lettre_faible: lettreFaible,
    verset_ref: verse.verset_ref.trim(),
    verset_texte: verse.verset_texte.trim(),
    conseil: verse.conseil.trim(),
    explication: ensureTrailingChoice(verse.explication),
  };
  const { data: saved, error: sErr } = await admin
    .from('final_verse')
    .insert(row)
    .select('*')
    .single();
  if (sErr) {
    console.error('Save verse error', sErr);
    return errorResponse(500, 'Sauvegarde du verset échouée');
  }
  return jsonResponse(saved);
});
