// constants/typography.ts
// Type system — Inter font + a semantic ladder so screens read consistently
// without sprinkling fontSize/fontWeight literals everywhere.
//
// Backwards compatible: the legacy `font` export keeps working unchanged.

import { TextStyle } from 'react-native';

// Legacy — keep so existing screens compile
export const font = {
  regular:   { fontFamily: 'Inter_400Regular' },
  medium:    { fontFamily: 'Inter_500Medium' },
  semibold:  { fontFamily: 'Inter_600SemiBold' },
  bold:      { fontFamily: 'Inter_700Bold' },
  extrabold: { fontFamily: 'Inter_800ExtraBold' },
} as const;

// New — semantic ladder. Each preset is a complete TextStyle so callers can
// spread it directly: `<Text style={[type.title, { color: C.textPrimary }]}>`
export const type = {
  // Display — for hero numbers (balances, totals). Always tabular.
  displayXl: { fontFamily: 'Inter_800ExtraBold', fontSize: 44, lineHeight: 48, letterSpacing: -1.2, fontVariant: ['tabular-nums'] } as TextStyle,
  displayLg: { fontFamily: 'Inter_800ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontVariant: ['tabular-nums'] } as TextStyle,
  displayMd: { fontFamily: 'Inter_700Bold',      fontSize: 26, lineHeight: 32, letterSpacing: -0.6, fontVariant: ['tabular-nums'] } as TextStyle,

  // Titles — screen + section headings
  title:     { fontFamily: 'Inter_700Bold',      fontSize: 20, lineHeight: 26, letterSpacing: -0.2 } as TextStyle,
  subtitle:  { fontFamily: 'Inter_600SemiBold',  fontSize: 17, lineHeight: 22 } as TextStyle,

  // Body — list rows, paragraphs
  bodyLg:    { fontFamily: 'Inter_400Regular',   fontSize: 16, lineHeight: 22 } as TextStyle,
  bodyMd:    { fontFamily: 'Inter_400Regular',   fontSize: 14, lineHeight: 20 } as TextStyle,
  bodyMdMed: { fontFamily: 'Inter_500Medium',    fontSize: 14, lineHeight: 20 } as TextStyle,
  bodySm:    { fontFamily: 'Inter_400Regular',   fontSize: 13, lineHeight: 18 } as TextStyle,

  // Labels — buttons, pills, chips
  label:     { fontFamily: 'Inter_600SemiBold',  fontSize: 14, lineHeight: 18 } as TextStyle,
  labelSm:   { fontFamily: 'Inter_600SemiBold',  fontSize: 13, lineHeight: 16 } as TextStyle,

  // Eyebrows — uppercase section markers
  eyebrow:   { fontFamily: 'Inter_700Bold',      fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' } as TextStyle,

  // Caption — meta, timestamps, helper text
  caption:   { fontFamily: 'Inter_400Regular',   fontSize: 12, lineHeight: 16 } as TextStyle,
  captionMed:{ fontFamily: 'Inter_500Medium',    fontSize: 12, lineHeight: 16 } as TextStyle,

  // Numeric — for amounts inline in lists (always tabular)
  amount:    { fontFamily: 'Inter_700Bold',      fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] } as TextStyle,
  amountLg:  { fontFamily: 'Inter_700Bold',      fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] } as TextStyle,
} as const;
