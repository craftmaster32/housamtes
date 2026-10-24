import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

// The pink of the paper tags (same as the Bills "Log" tag when urgent).
const TAG = '#F6D8D2';
const TAG_INK = '#8E2F28';

interface ReminderClipProps {
  count: number;
  onPress: () => void;
}

/** A bulldog clip on the bag's corner holding a pink tag: a bell and how many reminders. */
export function ReminderClip({ count, onPress }: ReminderClipProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      hitSlop={ms(6)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `${t('grocery.reminders')}, ${count}` : t('grocery.remind_me')
      }
    >
      <Svg width={ms(26)} height={ms(20)} viewBox="0 0 26 20">
        <Path d="M7 8 V4 a6 6 0 0 1 12 0 V8" fill="none" stroke="#8A8F97" strokeWidth={2} />
        <Rect x={1} y={7} width={24} height={12} rx={3} fill="#4F535A" />
        <Rect x={3} y={9} width={20} height={2} rx={1} fill="#6C7179" />
      </Svg>
      <View style={styles.tag}>
        <Svg width={ms(18)} height={ms(18)} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0 M4 6 l2 1.5 M20 6 l-2 1.5"
            stroke={TAG_INK}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        {count > 0 && <Text style={[styles.count, hand]}>{count > 9 ? '9+' : count}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -ms(14), end: ms(12), alignItems: 'center', zIndex: 3 },
  tag: {
    marginTop: -ms(4),
    minWidth: ms(44),
    minHeight: ms(44),
    paddingTop: ms(8),
    paddingBottom: ms(10),
    paddingHorizontal: ms(8),
    alignItems: 'center',
    backgroundColor: TAG,
    borderBottomLeftRadius: ms(3),
    borderBottomRightRadius: ms(3),
    transform: [{ rotate: '4deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  count: { fontSize: mf(19), lineHeight: mf(20), color: TAG_INK },
  pressed: { opacity: 0.75 },
});
