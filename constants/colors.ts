// Design tokens — light + dark palettes
// `colors` is kept as an alias for lightColors so existing screens don't break.

export interface ColorPalette {
  primary: string; primaryLight: string; primaryDark: string;
  success: string; warning: string; danger: string; info: string;
  white: string; black: string;
  background: string; surface: string; surfaceSecondary: string;
  border: string; borderLight: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textDisabled: string;
  secondary: string; secondaryForeground: string;
  accent: string; accentForeground: string;
  positive: string; negative: string;
  avatar: string[];
}

export const lightColors: ColorPalette = {
  // Brand
  primary:       '#3B6FBF',
  primaryLight:  '#5B8FD6',
  primaryDark:   '#2B5A99',

  // Semantic
  success:  '#4FB071',
  warning:  '#E0B24D',
  danger:   '#D9534F',
  info:     '#3B6FBF',

  // Neutrals
  white:            '#FFFFFF',
  black:            '#000000',
  background:       '#F6F2EA',
  surface:          '#FFFFFF',
  surfaceSecondary: '#F3ECE5',
  border:           'rgba(0,0,0,0.08)',
  borderLight:      'rgba(0,0,0,0.05)',
  textPrimary:      '#23323E',
  textSecondary:    '#8D8F8F',
  textTertiary:     '#AEAEB2',
  textDisabled:     '#C7C7CC',

  // Secondary palette
  secondary:           '#EAF3FF',
  secondaryForeground: '#274056',
  accent:              '#D6E9FF',
  accentForeground:    '#12324A',

  // Aliases
  positive: '#4FB071',
  negative: '#D9534F',

  // Avatar palette
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],
};

export const darkColors: ColorPalette = {
  // Brand — slightly brighter to pop on dark backgrounds
  primary:       '#4F78B6',
  primaryLight:  '#6B92CC',
  primaryDark:   '#3A61A0',

  // Semantic
  success:  '#4FB071',
  warning:  '#E0B24D',
  danger:   '#D9534F',
  info:     '#4F78B6',

  // Neutrals
  white:            '#FFFFFF',
  black:            '#000000',
  background:       '#0D1421',
  surface:          '#182035',
  surfaceSecondary: '#0F1829',
  border:           'rgba(255,255,255,0.08)',
  borderLight:      'rgba(255,255,255,0.05)',
  textPrimary:      '#FFFFFF',
  textSecondary:    '#7B8DB0',
  textTertiary:     '#4D5F80',
  textDisabled:     '#3A4A65',

  // Secondary palette
  secondary:           '#1A2A48',
  secondaryForeground: '#8AABDE',
  accent:              '#1A3570',
  accentForeground:    '#90B8E8',

  // Aliases
  positive: '#4FB071',
  negative: '#D9534F',

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
  const mode = useSettingsStore(
    (s) => (s as { themeMode?: ThemeMode }).themeMode ?? 'system'
  );
  return resolvePalette(mode, system ?? null);
}
