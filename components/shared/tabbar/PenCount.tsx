import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

interface PenCountProps {
  count: number;
}

// A new-things count as a red number circled in pen — the same mark the More
// menu uses — instead of a red pill.
export function PenCount({ count }: PenCountProps): React.JSX.Element | null {
  const c = useThemedColors();
  const hand = useHandFont();
  if (count <= 0) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.ring, { borderColor: c.danger }]} />
      <Text style={[styles.text, hand, { color: c.danger }]}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: ms(-9),
    end: ms(-16),
    minWidth: ms(24),
    height: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(3),
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.8,
    borderRadius: ms(12),
    transform: [{ rotate: '-12deg' }],
  },
  text: { fontSize: mf(17), lineHeight: mf(20) },
});
