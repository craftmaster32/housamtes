// Design tokens — light + dark palettes (v2 "Nestiq" design system)
// `colors` is kept as an alias for lightColors so existing screens don't break.
//
// Light  = the warm cream mockup (F6F2EA canvas, white cards).
// Dark   = the deep navy mockup   (0A0F1B canvas, slate cards).
// Both share the blue brand accent and the same gradient recipes for the
// "You're owed" hero and the "Spending" card.

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
  avatar: string[];
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
  background: '#F6F2EA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1ECE3',
  border: 'rgba(20,24,32,0.08)',
  borderLight: 'rgba(20,24,32,0.05)',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textDisabled: '#C7C7CC',

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

  // Avatar palette
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],
};

export const darkColors: ColorPalette = {
  // Brand — brighter to pop on the dark navy canvas
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
  background: '#0A0F1B',
  surface: '#151D2E',
  surfaceSecondary: '#1F2940',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',
  textPrimary: '#EEF2F8',
  textSecondary: '#8A95AA',
  textTertiary: '#586279',
  textDisabled: '#3A4A65',

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

  // Avatar palette (same — these are identity colors)
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],
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
