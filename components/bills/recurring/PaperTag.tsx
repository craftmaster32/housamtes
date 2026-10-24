import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface PaperTagProps {
  label: string;
  urgent?: boolean;
  onPress: () => void;
}

// The "Log" action as a little tilted paper tag with a punched hole — pink when
// the bill is late, cream otherwise. The tag's hole replaces the "+" sign.
export function PaperTag({ label, urgent = false, onPress }: PaperTagProps): React.JSX.Element {
  const c = useThemedColors();
  const text = label.replace(/^\+\s*/, '');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={ms(6)}
      style={({ pressed }) => [
        styles.tag,
        { backgroundColor: urgent ? '#F6D8D2' : c.paper },
        pressed && styles.pressed,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <View style={[styles.hole, { backgroundColor: c.surface }]} />
      <Text style={[styles.text, { color: urgent ? '#8E2F28' : c.paperInk }]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    minHeight: 40,
    paddingStart: ms(11),
    paddingEnd: ms(15),
    borderTopLeftRadius: ms(6),
    borderBottomLeftRadius: ms(6),
    borderTopRightRadius: ms(18),
    borderBottomRightRadius: ms(18),
    transform: [{ rotate: '-1.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    flexShrink: 1,
  },
  hole: {
    width: ms(7),
    height: ms(7),
    borderRadius: ms(4),
    borderWidth: 1.5,
    borderColor: 'rgba(34,32,29,0.35)',
  },
  text: { fontSize: mf(14.5), ...font.extrabold, flexShrink: 1 },
  pressed: { opacity: 0.8 },
});
