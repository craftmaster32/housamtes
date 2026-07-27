import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { splitMoney, type CurrencyCode } from '@constants/currencies';

interface MoneyProps {
  amount: number;
  currencyCode: CurrencyCode | string;
  /** Size of the main (whole-number) figure. Symbol and fraction scale from it. */
  size?: number;
  color?: string;
  /** Colour for the currency mark + fraction; defaults to `color` at reduced opacity. */
  mutedColor?: string;
  weight?: 'bold' | 'extrabold';
  style?: TextStyle;
}

/**
 * Renders money the polished way: a weight-matched currency mark, a large
 * tabular whole number, and smaller/lighter decimals — "₪746.46". Keeps every
 * screen's money typography identical instead of each hand-rolling spans.
 */
export const Money: React.FC<MoneyProps> = ({
  amount,
  currencyCode,
  size = 44,
  color = '#fff',
  mutedColor,
  weight = 'extrabold',
  style,
}) => {
  const { symbol, whole, fraction } = useMemo(
    () => splitMoney(amount, currencyCode),
    [amount, currencyCode]
  );
  const muted = mutedColor ?? color;
  const family = weight === 'extrabold' ? 'Inter_800ExtraBold' : 'Inter_700Bold';

  const symbolStyle: TextStyle = {
    fontFamily: 'Inter_600SemiBold',
    fontSize: size * 0.5,
    color: muted,
    opacity: mutedColor ? 1 : 0.78,
  };
  const wholeStyle: TextStyle = {
    fontFamily: family,
    fontSize: size,
    color,
    letterSpacing: -size * 0.038,
  };
  const fractionStyle: TextStyle = {
    fontFamily: 'Inter_700Bold',
    fontSize: size * 0.58,
    color: muted,
    opacity: mutedColor ? 1 : 0.72,
  };

  // Give the line box explicit headroom for the largest glyph (the whole
  // number). Without it, react-native-web computes the line height from a
  // small inherited font size, so the big number overflows and gets its top
  // clipped by any parent with `overflow: hidden` (e.g. the gradient balance
  // card). `adjustsFontSizeToFit` is a native-only no-op on web, so it can't
  // rescue this — the explicit lineHeight is what keeps the digits intact.
  const rowStyle: TextStyle = { lineHeight: Math.ceil(size * 1.18) };

  return (
    <Text
      style={[styles.row, rowStyle, style]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
    >
      <Text style={symbolStyle}>{symbol}</Text>
      <Text style={wholeStyle}>{whole}</Text>
      {fraction ? <Text style={fractionStyle}>{fraction}</Text> : null}
    </Text>
  );
};

const styles = StyleSheet.create({
  row: { fontVariant: ['tabular-nums'], includeFontPadding: false },
});
