// Typography — Inter font system
// Use these instead of raw fontWeight strings everywhere

import { TextStyle } from 'react-native';
import { mf } from '@utils/responsive';

// Legacy — kept so all existing screens compile unchanged
export const font = {
  regular: { fontFamily: 'Inter_400Regular' },
  medium: { fontFamily: 'Inter_500Medium' },
  semibold: { fontFamily: 'Inter_600SemiBold' },
  bold: { fontFamily: 'Inter_700Bold' },
  extrabold: { fontFamily: 'Inter_800ExtraBold' },
} as const;

// Display serif (Fraunces) for screen titles / big headings. Latin-only, so
// Hebrew must fall back to Heebo — use the `useHeadingFont` hook for that.
// These constants assume a Latin script (fine as a static default).
export const heading = {
  semibold: { fontFamily: 'Fraunces_600SemiBold' },
  bold: { fontFamily: 'Fraunces_700Bold' },
} as const;

// Design-system v2 — semantic ladder
// Usage: <Text style={[type.title, { color: C.textPrimary }]}>
export const type = {
  displayXl: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: mf(44),
    lineHeight: mf(48),
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  displayLg: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: mf(34),
    lineHeight: mf(40),
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  displayMd: {
    fontFamily: 'Inter_700Bold',
    fontSize: mf(26),
    lineHeight: mf(32),
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: mf(20),
    lineHeight: mf(26),
    letterSpacing: -0.2,
  } as TextStyle,
  subtitle: { fontFamily: 'Inter_600SemiBold', fontSize: mf(17), lineHeight: mf(22) } as TextStyle,

  bodyLg: { fontFamily: 'Inter_400Regular', fontSize: mf(16), lineHeight: mf(22) } as TextStyle,
  bodyMd: { fontFamily: 'Inter_400Regular', fontSize: mf(14), lineHeight: mf(20) } as TextStyle,
  bodyMdMed: { fontFamily: 'Inter_500Medium', fontSize: mf(14), lineHeight: mf(20) } as TextStyle,
  bodySm: { fontFamily: 'Inter_400Regular', fontSize: mf(13), lineHeight: mf(18) } as TextStyle,

  label: { fontFamily: 'Inter_600SemiBold', fontSize: mf(14), lineHeight: mf(18) } as TextStyle,
  labelSm: { fontFamily: 'Inter_600SemiBold', fontSize: mf(13), lineHeight: mf(16) } as TextStyle,

  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: mf(11),
    lineHeight: mf(14),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  } as TextStyle,

  caption: { fontFamily: 'Inter_400Regular', fontSize: mf(12), lineHeight: mf(16) } as TextStyle,
  captionMed: { fontFamily: 'Inter_500Medium', fontSize: mf(12), lineHeight: mf(16) } as TextStyle,

  amount: {
    fontFamily: 'Inter_700Bold',
    fontSize: mf(14),
    lineHeight: mf(20),
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  amountLg: {
    fontFamily: 'Inter_700Bold',
    fontSize: mf(17),
    lineHeight: mf(22),
    fontVariant: ['tabular-nums'],
  } as TextStyle,
} as const;
