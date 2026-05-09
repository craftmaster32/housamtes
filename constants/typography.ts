// Typography — Inter font system
// Use these instead of raw fontWeight strings everywhere

import { TextStyle } from 'react-native';

// Legacy — kept so all existing screens compile unchanged
export const font = {
  regular:   { fontFamily: 'Inter_400Regular' },
  medium:    { fontFamily: 'Inter_500Medium' },
  semibold:  { fontFamily: 'Inter_600SemiBold' },
  bold:      { fontFamily: 'Inter_700Bold' },
  extrabold: { fontFamily: 'Inter_800ExtraBold' },
} as const;

// Design-system v2 — semantic ladder
// Usage: <Text style={[type.title, { color: C.textPrimary }]}>
export const type = {
  displayXl:  { fontFamily: 'Inter_800ExtraBold', fontSize: 44, lineHeight: 48, letterSpacing: -1.2, fontVariant: ['tabular-nums'] } as TextStyle,
  displayLg:  { fontFamily: 'Inter_800ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontVariant: ['tabular-nums'] } as TextStyle,
  displayMd:  { fontFamily: 'Inter_700Bold',      fontSize: 26, lineHeight: 32, letterSpacing: -0.6, fontVariant: ['tabular-nums'] } as TextStyle,

  title:      { fontFamily: 'Inter_700Bold',      fontSize: 20, lineHeight: 26, letterSpacing: -0.2 } as TextStyle,
  subtitle:   { fontFamily: 'Inter_600SemiBold',  fontSize: 17, lineHeight: 22 } as TextStyle,

  bodyLg:     { fontFamily: 'Inter_400Regular',   fontSize: 16, lineHeight: 22 } as TextStyle,
  bodyMd:     { fontFamily: 'Inter_400Regular',   fontSize: 14, lineHeight: 20 } as TextStyle,
  bodyMdMed:  { fontFamily: 'Inter_500Medium',    fontSize: 14, lineHeight: 20 } as TextStyle,
  bodySm:     { fontFamily: 'Inter_400Regular',   fontSize: 13, lineHeight: 18 } as TextStyle,

  label:      { fontFamily: 'Inter_600SemiBold',  fontSize: 14, lineHeight: 18 } as TextStyle,
  labelSm:    { fontFamily: 'Inter_600SemiBold',  fontSize: 13, lineHeight: 16 } as TextStyle,

  eyebrow:    { fontFamily: 'Inter_700Bold',      fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' } as TextStyle,

  caption:    { fontFamily: 'Inter_400Regular',   fontSize: 12, lineHeight: 16 } as TextStyle,
  captionMed: { fontFamily: 'Inter_500Medium',    fontSize: 12, lineHeight: 16 } as TextStyle,

  amount:     { fontFamily: 'Inter_700Bold',      fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] } as TextStyle,
  amountLg:   { fontFamily: 'Inter_700Bold',      fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] } as TextStyle,
} as const;
