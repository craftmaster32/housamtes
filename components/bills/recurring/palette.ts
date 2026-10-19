import { useMemo } from 'react';
import { useThemedColors, darkColors, type ColorPalette } from '@constants/colors';

/** Colours for the recurring-bill cards and payment sheet. */
export interface RecurringPalette {
  card: string;
  text: string;
  muted: string; // ≥4.5:1 on `card`
  border: string;
  primary: string;
  onPrimary: string;
  secondaryBg: string; // light-blue tile / secondary button
  secondaryText: string;
  neutralPillBg: string;
  neutralPillText: string;
  overdueBg: string;
  overdueText: string;
  overlay: string;
  shadow: string;
}

/**
 * Built from the app's own tokens so recurring bills, the payment sheet and the
 * menus share the stone/graphite surfaces and the single blue accent.
 */
function fromTheme(c: ColorPalette, dark: boolean): RecurringPalette {
  return {
    card: c.surface,
    text: c.textPrimary,
    muted: c.textSecondary,
    border: c.border,
    primary: c.primary,
    onPrimary: '#FFFFFF',
    secondaryBg: c.primaryTint,
    secondaryText: c.primary,
    neutralPillBg: c.surfaceSecondary,
    neutralPillText: c.textSecondary,
    overdueBg: c.dangerTint,
    overdueText: c.danger,
    overlay: dark ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)',
    shadow: dark ? 'rgba(0,0,0,0.3)' : 'rgba(34,32,29,0.06)',
  };
}

/** The recurring-bill palette for the active light/dark theme. */
export function useRecurringPalette(): RecurringPalette {
  const c = useThemedColors();
  return useMemo(() => fromTheme(c, c === darkColors), [c]);
}
