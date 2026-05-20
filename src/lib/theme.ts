import { useColorScheme } from 'react-native';

export const palette = {
  // Tons chauds + accent violet profond
  gold: '#C9A961',
  goldSoft: '#E0C892',
  beige: '#F4ECDD',
  ivory: '#FBF7EE',
  plum: '#3A1E5C',
  plumDeep: '#1A1230',
  ink: '#15121E',
  charcoal: '#262335',
  slate: '#5B5470',
  whisper: '#9B93AC',
  white: '#FFFFFF',
  danger: '#C24A4A',
  success: '#5E9B6C',
} as const;

export const lettreColors: Record<'C' | 'H' | 'O' | 'I' | 'X', string> = {
  C: '#E0A458', // ambre clarté
  H: '#7A9E7E', // vert honnêteté
  O: '#5E81A8', // bleu orientation
  I: '#B05D8E', // rose impartialité
  X: '#8A5BD6', // violet x factor
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
  bg: palette.ivory,
  surface: palette.white,
  surfaceAlt: palette.beige,
  text: palette.ink,
  textMuted: palette.slate,
  border: '#E5DCC9',
  primary: palette.plum,
  primarySoft: '#EFE7F7',
  accent: palette.gold,
  danger: palette.danger,
  success: palette.success,
};

const dark: Theme = {
  isDark: true,
  bg: palette.plumDeep,
  surface: palette.charcoal,
  surfaceAlt: '#1F1A2D',
  text: palette.ivory,
  textMuted: palette.whisper,
  border: '#322A47',
  primary: palette.gold,
  primarySoft: '#2A2240',
  accent: palette.goldSoft,
  danger: '#E27676',
  success: '#7BBA8C',
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
