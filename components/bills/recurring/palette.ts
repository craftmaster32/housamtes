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

const light: RecurringPalette = {
  card: '#FFFFFF',
  text: '#17213A',
  muted: '#5E6676',
  border: 'rgba(23,33,58,0.10)',
  primary: '#2F62B8',
  onPrimary: '#FFFFFF',
  secondaryBg: '#E6EEFA',
  secondaryText: '#234E99',
  neutralPillBg: '#EEEDE8',
  neutralPillText: '#4A5161',
  overdueBg: '#FCE9DB',
  overdueText: '#9A3F0C',
  overlay: 'rgba(15,20,35,0.45)',
  shadow: 'rgba(23,33,58,0.06)',
};

function darkPalette(c: ColorPalette): RecurringPalette {
  return {
    card: c.surface,
    text: c.textPrimary,
    muted: '#A3ADBF',
    border: c.border,
    primary: c.primary,
    onPrimary: '#FFFFFF',
    secondaryBg: c.secondary,
    secondaryText: c.secondaryForeground,
    neutralPillBg: c.surfaceSecondary,
    neutralPillText: '#C3CAD6',
    overdueBg: 'rgba(240,138,75,0.18)',
    overdueText: '#F5A774',
    overlay: 'rgba(0,0,0,0.6)',
    shadow: 'rgba(0,0,0,0.3)',
  };
}

export function useRecurringPalette(): RecurringPalette {
  const c = useThemedColors();
  return useMemo(() => (c === darkColors ? darkPalette(c) : light), [c]);
}
