/**
 * Filtrage de contenu répréhensible côté client.
 * Doublon volontaire du filtre SQL (`public.contains_objectionable`) : on bloque
 * l'envoi avant le réseau pour un retour immédiat, mais la base reste l'autorité.
 * Conformité App Store Guideline 1.2 (modération du contenu utilisateur).
 */

const PATTERNS: RegExp[] = [
  /connard/i,
  /encul[ée]/i,
  /salope/i,
  /putain/i,
  /\bpute\b/i,
  /\bpd\b/i,
  /sale pd/i,
  /tapette/i,
  /n[eé]gre/i,
  /bougnoule/i,
  /youpin/i,
  /sale (arabe|juif|noir)/i,
  /\bfdp\b/i,
  /\bntm\b/i,
  /nique (ta|sa)/i,
  /b[âa]tard/i,
  /\bfuck/i,
  /\bshit\b/i,
  /\bbitch\b/i,
  /nigger/i,
  /faggot/i,
  /\bcunt\b/i,
  /asshole/i,
  /p[eé]dophile/i,
  /suicide-toi/i,
];

/** true si le texte contient un terme manifestement abusif/haineux. */
export function containsObjectionable(text: string | null | undefined): boolean {
  if (!text) return false;
  return PATTERNS.some((re) => re.test(text));
}

export const OBJECTIONABLE_MESSAGE =
  'Ton message contient des termes inappropriés. IAssou3 applique une tolérance zéro envers les contenus offensants.';

/** Motifs de signalement proposés à l'utilisateur. */
export const REPORT_REASONS = [
  'Contenu offensant ou haineux',
  'Harcèlement',
  'Contenu sexuel ou inapproprié',
  'Spam',
  'Autre',
] as const;
