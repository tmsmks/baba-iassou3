/**
 * Contrat de Licence Utilisateur Final (CLUF / EULA).
 * Exigé par l'App Store Guideline 1.2 : doit affirmer une tolérance zéro envers
 * les contenus répréhensibles et les utilisateurs abusifs.
 */
export const EULA_VERSION = '2026-06-18';

export interface EulaSection {
  title: string;
  body: string;
}

export const EULA_SECTIONS: EulaSection[] = [
  {
    title: '1. Acceptation',
    body: "En créant un compte ou en te connectant à IAssou3, tu acceptes le présent contrat. Si tu n'es pas d'accord, n'utilise pas l'application.",
  },
  {
    title: '2. Tolérance zéro envers les contenus répréhensibles',
    body: "IAssou3 applique une politique de TOLÉRANCE ZÉRO envers tout contenu offensant, haineux, harcelant, violent, sexuel, diffamatoire ou illégal, ainsi qu'envers tout comportement abusif. Ce type de contenu est strictement interdit sur le mur de photos comme dans les messages.",
  },
  {
    title: '3. Tes responsabilités',
    body: "Tu es seul responsable du contenu que tu publies (photos, légendes, messages). Tu t'engages à ne rien publier qui enfreigne le point 2, et à respecter les autres participants.",
  },
  {
    title: '4. Modération et signalement',
    body: "Tu peux signaler tout contenu inapproprié et bloquer un utilisateur abusif depuis l'application. Les contenus bloqués disparaissent immédiatement de ton fil. Notre équipe traite les signalements sous 24 heures : le contenu répréhensible est retiré et l'auteur peut être exclu de l'application.",
  },
  {
    title: '5. Sanctions',
    body: "Tout manquement peut entraîner la suppression du contenu et la suspension définitive de ton compte, sans préavis.",
  },
  {
    title: '6. Données',
    body: "L'utilisation de tes données est décrite dans notre politique de confidentialité, accessible depuis l'application.",
  },
];
