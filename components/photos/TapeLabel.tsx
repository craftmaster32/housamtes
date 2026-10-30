import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useHandFont } from '@hooks/useHandFont';
import { lightColors } from '@constants/colors';
import { mf, ms } from '@utils/responsive';

interface TapeLabelProps {
  label: string;
}

/** A month written on a strip of masking tape stuck across the album page. */
export function TapeLabel({ label }: TapeLabelProps): React.JSX.Element {
  const hand = useHandFont();
  return (
    <View style={styles.tape} accessibilityRole="header">
      <Text style={[styles.text, hand]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236,222,170,0.92)',
    paddingHorizontal: ms(14),
    paddingVertical: ms(2),
    transform: [{ rotate: '-1.5deg' }],
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  text: { fontSize: mf(21), lineHeight: mf(27), color: lightColors.paperInk },
});
