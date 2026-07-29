import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useCountUp } from '@hooks/useCountUp';

interface CountUpTextProps {
  /** The final value to count up to. */
  value: number;
  /** Formats the (animating) number into the string to display. */
  format: (n: number) => string;
  duration?: number;
  animate?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * A <Text> whose numeric content counts up from 0 to `value` when it appears —
 * used for headline totals (balance, spending) so the figures "run up" instead
 * of popping in. Formatting stays with the caller so currency/abbreviation is
 * identical to the static version.
 */
export function CountUpText({
  value,
  format,
  duration = 900,
  animate = true,
  style,
  numberOfLines,
}: CountUpTextProps): React.JSX.Element {
  const display = useCountUp(value, animate, duration);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {format(display)}
    </Text>
  );
}
