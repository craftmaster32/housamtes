import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface StampProps {
  children: string;
  color: string;
  style?: StyleProp<ViewStyle>;
  /** Larger stamp, e.g. across a settled bill. */
  big?: boolean;
}

// A tilted rubber stamp ("✓ Settled", "Recurring") instead of a pill badge.
export function Stamp({ children, color, style, big = false }: StampProps): React.JSX.Element {
  return (
    <View style={[styles.stamp, big && styles.big, { borderColor: color }, style]}>
      <Text style={[styles.text, big && styles.bigText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: ms(5),
    paddingHorizontal: ms(6),
    paddingVertical: ms(1),
    transform: [{ rotate: '-4deg' }],
  },
  big: {
    borderWidth: 3,
    borderRadius: ms(8),
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    transform: [{ rotate: '-9deg' }],
    opacity: 0.88,
  },
  text: { fontSize: mf(11), ...font.extrabold, letterSpacing: 0.2 },
  bigText: { fontSize: mf(13), lineHeight: mf(17), textAlign: 'center' },
});
