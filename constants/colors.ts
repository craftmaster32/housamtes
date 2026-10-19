// Design tokens — light + dark palettes (v2 "HouseMates" design system)
// `colors` is kept as an alias for lightColors so existing screens don't break.
//
// Light  = warm stone canvas (F2F1EE), white cards.
// Dark   = neutral graphite canvas (1E2024), lighter graphite cards — a grey
//          that lifts toward you as surfaces stack, never brown or pure black.
// Both share the blue brand accent. The home screen adds two "paper" surfaces:
// a notebook page for the money card and a blue sticky note for house notes.
// Bills adds a receipt slip; drawings sit on a light sticker in dark mode.

export type Gradient = readonly [string, string];

export interface ColorPalette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryTint: string;
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;
  info: string;
  white: string;
  black: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  positive: string;
  negative: string;
  // v2 gradient tokens
  owedGradient: Gradient;
  owedFg: string;
  owedShadow: string;
  spendGradient: Gradient;
  spendShadow: string;
  successGradient: Gradient;
  dangerGradient: Gradient;
  avatar: string[];
  // Paper surfaces (home screen): notebook page + sticky note
  paper: string;
  paperInk: string;
  paperMuted: string;
  paperRule: string;
  paperMargin: string;
  note: string;
  noteInk: string;
  // Receipt paper (bills): stays light in dark mode, like a real slip
  receipt: string;
  receiptInk: string;
  receiptMuted: string;
  receiptRule: string;
  // Light backing behind hand-drawn pictures in dark mode (a sticker)
  sticker: string;
}

export const lightColors: ColorPalette = {
  // Brand
  primary: '#3B6FBF',
  primaryLight: '#4A84D0',
  primaryDark: '#2952A0',
  primaryTint: 'rgba(59,111,191,0.10)',

  // Semantic
  success: '#2F8550',
  successTint: 'rgba(47,133,80,0.12)',
  warning: '#B68528',
  warningTint: 'rgba(182,133,40,0.14)',
  danger: '#B84540',
  dangerTint: 'rgba(184,69,64,0.10)',
  info: '#3B6FBF',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  background: '#F2F1EE',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFEDE9',
  border: 'rgba(34,32,29,0.08)',
  borderLight: 'rgba(34,32,29,0.05)',
  textPrimary: '#22201D',
  textSecondary: '#6F6A63',
  textTertiary: '#A19B93',
  textDisabled: '#C9C5BF',

  // Secondary palette
  secondary: '#E5EEFB',
  secondaryForeground: '#23426F',
  accent: '#D6E9FF',
  accentForeground: '#12324A',

  // Aliases
  positive: '#2F8550',
  negative: '#B84540',

  // Gradients (blue hero works on the cream canvas)
  owedGradient: ['#4A84D0', '#274F99'],
  owedFg: '#1F3D78',
  owedShadow: 'rgba(41,82,160,0.34)',
  spendGradient: ['#4E7CC4', '#3A62A6'],
  spendShadow: 'rgba(40,70,130,0.28)',
  successGradient: ['#3AA968', '#248049'],
  dangerGradient: ['#CE6660', '#A5403B'],

  // Avatar palette
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],

  // Paper
  paper: '#FBF3D3',
  paperInk: '#22201D',
  paperMuted: '#6B6250',
  paperRule: 'rgba(59,111,191,0.10)',
  paperMargin: 'rgba(214,88,74,0.32)',
  note: '#D6E4F7',
  noteInk: '#14243D',
  receipt: '#FFFDF8',
  receiptInk: '#22201D',
  receiptMuted: '#7A746B',
  receiptRule: 'rgba(34,32,29,0.2)',
  sticker: 'transparent',
};

export const darkColors: ColorPalette = {
  // Brand — brighter to pop on the graphite canvas
  primary: '#4E82D4',
  primaryLight: '#5B90E0',
  primaryDark: '#3A61A0',
  primaryTint: 'rgba(78,130,212,0.16)',

  // Semantic
  success: '#4FB071',
  successTint: 'rgba(79,176,113,0.16)',
  warning: '#E0B24D',
  warningTint: 'rgba(224,178,77,0.16)',
  danger: '#E5645F',
  dangerTint: 'rgba(229,100,95,0.15)',
  info: '#4E82D4',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  background: '#1E2024',
  surface: '#2A2D32',
  surfaceSecondary: '#353940',
  border: 'rgba(235,238,243,0.09)',
  borderLight: 'rgba(235,238,243,0.05)',
  textPrimary: '#EEF0F3',
  textSecondary: '#A3A8B0',
  textTertiary: '#6E737B',
  textDisabled: '#4A4E55',

  // Secondary palette
  secondary: '#1A2A48',
  secondaryForeground: '#8AABDE',
  accent: '#1A3570',
  accentForeground: '#90B8E8',

  // Aliases
  positive: '#4FB071',
  negative: '#E5645F',

  // Gradients (deep navy hero, on-white text)
  owedGradient: ['#264C8C', '#182F5A'],
  owedFg: '#1C356A',
  owedShadow: 'rgba(20,44,90,0.55)',
  spendGradient: ['#4E7CC4', '#3A62A6'],
  spendShadow: 'rgba(40,70,130,0.32)',
  successGradient: ['#2F9160', '#1C6E45'],
  dangerGradient: ['#C85752', '#8E3B37'],

  // Avatar palette (same — these are identity colors)
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],

  // Paper — stays light in dark mode, like a real page on a dark table
  paper: '#F3EBCB',
  paperInk: '#22201D',
  paperMuted: '#6B6250',
  paperRule: 'rgba(59,111,191,0.10)',
  paperMargin: 'rgba(214,88,74,0.35)',
  note: '#CADBF2',
  noteInk: '#14243D',
  receipt: '#F4F1EA',
  receiptInk: '#22201D',
  receiptMuted: '#7A746B',
  receiptRule: 'rgba(34,32,29,0.2)',
  sticker: '#F3EEE3',
};

// Backward-compat alias — existing screens that import `colors` get light theme.
// Screens being converted to dark should import `useThemedColors()`.
export const colors = lightColors;

// ── Design-system v2 additions ──────────────────────────────────────────────
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@stores/settingsStore';

export type ColorTokens = ColorPalette;
export type ThemeMode = 'light' | 'dark' | 'system';

/** Pure helper — resolve ThemeMode + OS scheme into a concrete palette. */
export function resolvePalette(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark' | null
): ColorPalette {
  const effective = mode === 'system' ? (systemScheme ?? 'light') : mode;
  return effective === 'dark' ? darkColors : lightColors;
}

/**
 * Hook — returns the active palette based on the user's saved themeMode and
 * the OS colour scheme. Use this in any screen opting into dark-mode support.
 * Falls back to 'system' when themeMode hasn't been written to the store yet.
 */
export function useThemedColors(): ColorPalette {
  const system = useColorScheme();
  const mode = useSettingsStore((s) => (s as { themeMode?: ThemeMode }).themeMode ?? 'system');
  return resolvePalette(mode, system ?? null);
}
