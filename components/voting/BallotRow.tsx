import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { lightColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { TallyMarks } from '@components/voting/TallyMarks';
import { mf, ms } from '@utils/responsive';

const INK = lightColors.paperInk;
const MUTED = lightColors.paperMuted;

interface BallotRowProps {
  label: string;
  /** The side's colour: green for yes, red for no. */
  color: string;
  count: number;
  voters: string[];
  mine: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** One choice on the ballot: a box you cross in pen, then the tally so far. */
export function BallotRow({
  label,
  color,
  count,
  voters,
  mine,
  disabled,
  onPress,
}: BallotRowProps): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: mine, disabled }}
      accessibilityLabel={`${label}, ${count}`}
    >
      <View style={[styles.box, { borderColor: MUTED }]}>
        {mine && (
          <Svg width={ms(26)} height={ms(26)} viewBox="0 0 26 26" style={styles.cross}>
            <Path
              d="M4 5 L21 22 M21 4 L5 21"
              stroke={lightColors.primary}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        )}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, heading]}>{label}</Text>
        {voters.length > 0 && (
          <Text style={[styles.voters, hand]} numberOfLines={1}>
            {voters.join(', ')}
          </Text>
        )}
      </View>
      <TallyMarks count={count} color={color} />
      <Text style={[styles.count, heading, { color }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(12), minHeight: 52 },
  pressed: { opacity: 0.7 },
  box: {
    width: ms(24),
    height: ms(24),
    borderWidth: 2.2,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  cross: { position: 'absolute', left: -ms(3), top: -ms(4) },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: mf(20), lineHeight: mf(26), color: INK },
  voters: { fontSize: mf(17), lineHeight: mf(19), color: MUTED },
  count: { fontSize: mf(20), lineHeight: mf(26), minWidth: ms(18), textAlign: 'center' },
});
