import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors } from '@constants/colors';
import { mf, ms } from '@utils/responsive';

/** A little blue sticky note for the per-person result, e.g. "₪95.47 per person". */
export function SplitNote({ children }: { children: string }): React.JSX.Element {
  const c = useThemedColors();
  const handFont = useHandFont();
  return (
    <View style={[styles.note, { backgroundColor: c.note }]}>
      <Text style={[styles.text, handFont, { color: c.noteInk }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    alignSelf: 'flex-start',
    marginTop: ms(10),
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
    borderRadius: ms(3),
    transform: [{ rotate: '-1.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(5) },
    shadowOpacity: 0.12,
    shadowRadius: ms(8),
    elevation: 3,
  },
  text: { fontSize: mf(22), lineHeight: mf(27) },
});
