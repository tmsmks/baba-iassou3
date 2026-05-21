import { useColorScheme } from 'react-native';

// Palette officielle « Suis-moi »
export const palette = {
  orPrincipal: '#C9973A', // logos, titres, accents
  orClair: '#E4B95A',     // fonds dorés, brillances
  orProfond: '#A07828',   // sous-titres, ombres
  vertSauge: '#5C7A6B',   // couleur secondaire
  bordeaux: '#8B1A1A',    // titres affiches
  creme: '#F5F0E8',       // fond principal
  encre: '#1A1208',       // texte, fonds sombres
  blanc: '#FFFFFF',       // logos sur fond sombre

  // dérivés utilitaires (variations contrôlées de la charte)
  cremeOmbree: '#EDE5D4',      // beige légèrement plus dense pour surfaces alt
  cremeBordure: '#D8CDB5',     // bordures sur fond crème
  encreSurface: '#241A0F',     // surface dans dark mode (un cran au-dessus d'ENCRE)
  encreAlt: '#2E2316',         // surface alt dark
  encreBordure: '#3A2E1D',     // bordures dans dark
  cremeMuet: '#7A6B5A',        // texte secondaire en light mode
  blancMuet: '#C9BFAF',        // texte secondaire en dark mode
  orPrincipalSoft: '#F3E6CC',  // halo doré sur fond clair (chip sélectionné)
  orProfondSoft: '#3A2D14',    // halo doré sur fond sombre
} as const;

// Couleurs par lettre du thème C-H-O-I-X, tirées de la charte
export const lettreColors: Record<'C' | 'H' | 'O' | 'I' | 'X', string> = {
  C: palette.orClair,     // Clarté — lumière qui s'allume
  H: palette.orProfond,   // Honnêteté — densité, profondeur
  O: palette.vertSauge,   // Orientation — boussole, sérénité
  I: palette.bordeaux,    // Impartialité — alarme, red flag
  X: palette.orPrincipal, // X factor — divine, mystère doré
};

export interface Theme {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  accent: string;
  danger: string;
  success: string;
}

const light: Theme = {
  isDark: false,
  bg: palette.creme,
  surface: palette.blanc,
  surfaceAlt: palette.cremeOmbree,
  text: palette.encre,
  textMuted: palette.cremeMuet,
  border: palette.cremeBordure,
  primary: palette.orPrincipal,
  primarySoft: palette.orPrincipalSoft,
  accent: palette.orProfond,
  danger: palette.bordeaux,
  success: palette.vertSauge,
};

const dark: Theme = {
  isDark: true,
  bg: palette.encre,
  surface: palette.encreSurface,
  surfaceAlt: palette.encreAlt,
  text: palette.creme,
  textMuted: palette.blancMuet,
  border: palette.encreBordure,
  primary: palette.orClair,
  primarySoft: palette.orProfondSoft,
  accent: palette.orPrincipal,
  danger: '#C24343', // bordeaux éclairci pour lisibilité sur fond sombre
  success: '#88A799', // sauge éclairci
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const font = {
  display: 28,
  title: 22,
  subtitle: 17,
  body: 15,
  caption: 13,
  micro: 11,
};
