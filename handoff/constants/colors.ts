// constants/colors.ts
// Design tokens — pulled from Banani/Figma export (single source of truth)
//
// Light + dark palettes share the same SHAPE so any screen can swap themes by
// reading from `useThemedColors()` instead of importing `colors` directly.
// Existing screens that import `colors` keep working unchanged (light theme).

import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@stores/settingsStore';

export const colors = {
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
  background:       '#F6F2EA',   // --background
  surface:          '#FFFFFF',   // --card
  surfaceSecondary: '#F3ECE5',   // --muted
  border:           'rgba(0,0,0,0.08)',  // --border (very subtle)
  borderLight:      'rgba(0,0,0,0.05)',
  textPrimary:      '#23323E',   // --foreground
  textSecondary:    '#8D8F8F',   // --muted-foreground
  textTertiary:     '#AEAEB2',
  textDisabled:     '#C7C7CC',

  // Secondary palette (badges, highlights)
  secondary:           '#EAF3FF',  // --secondary
  secondaryForeground: '#274056',  // --secondary-foreground
  accent:              '#D6E9FF',  // --accent
  accentForeground:    '#12324A',  // --accent-foreground

  // Aliases
  positive: '#4FB071',
  negative: '#D9534F',

  // Avatar palette
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],
} as const;

// Dark palette — same shape as `colors`, lifted/desaturated for OLED comfort.
// Brand stays close to the light primary but slightly cooler so blue ink reads
// well against deep navy backgrounds. Avatar palette unchanged so a user's
// colour identity is stable across themes.
export const darkColors: typeof colors = {
  primary:       '#5B8FD6',
  primaryLight:  '#7BA8E2',
  primaryDark:   '#3B6FBF',

  success:  '#6FC68C',
  warning:  '#E8C46A',
  danger:   '#E26864',
  info:     '#5B8FD6',

  white:            '#FFFFFF',
  black:            '#000000',
  background:       '#0F1620',
  surface:          '#1A2330',
  surfaceSecondary: '#222D3D',
  border:           'rgba(255,255,255,0.07)',
  borderLight:      'rgba(255,255,255,0.04)',
  textPrimary:      '#F1F5FB',
  textSecondary:    '#9AA8BC',
  textTertiary:     '#6B788C',
  textDisabled:     '#4A5566',

  secondary:           '#22344B',
  secondaryForeground: '#BED4EC',
  accent:              '#1B2C42',
  accentForeground:    '#A8C8EA',

  positive: '#6FC68C',
  negative: '#E26864',

  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],
};

export type ColorTokens = typeof colors;
export type ThemeMode = 'light' | 'dark' | 'system';

/** Resolve a ThemeMode + system preference into a concrete palette. */
export function resolvePalette(mode: ThemeMode, systemScheme: 'light' | 'dark' | null): ColorTokens {
  const effective = mode === 'system' ? (systemScheme ?? 'light') : mode;
  return effective === 'dark' ? darkColors : colors;
}

/**
 * Hook — returns the active palette based on the user's saved preference and
 * the OS colour scheme. Use this in any component that should respect dark
 * mode. Until a screen opts in, importing `colors` directly keeps it on the
 * light palette as before.
 *
 * Requires `themeMode` to exist on `useSettingsStore`. Falls back to 'system'
 * if absent so this hook is safe to ship before the settings UI is wired up.
 */
export function useThemedColors(): ColorTokens {
  const system = useColorScheme();
  const mode   = useSettingsStore((s) => (s as { themeMode?: ThemeMode }).themeMode ?? 'system');
  return resolvePalette(mode, system ?? null);
}
