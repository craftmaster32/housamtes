import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { PenCross } from '@components/shared/PenCross';
import { lightColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { UserAvatar } from '@components/shared/UserAvatar';
import { TallyMarks } from '@components/voting/TallyMarks';
import { mf, ms } from '@utils/responsive';

// The ballot is paper: it keeps the light inks in both themes.
const P = lightColors;
const FACE = ms(22);

interface BallotChoiceProps {
  label: string;
  /** The side's colour for its tally: green for yes, red for no. */
  color: string;
  voterIds: string[];
  /** Read out with the count, e.g. "Maya, Noam". */
  voterNames: string[];
  mine: boolean;
  /** A decided ballot: no box to tick, the side is greyed back. */
  closed: boolean;
  onPress: () => void;
}

/**
 * One side of the ballot, Yes or No, as a box on the paper: the word in the
 * serif, a square you cross in blue pen, the tally so far and the faces of
 * who chose it. The side you chose is outlined in blue.
 */
export function BallotChoice({
  label,
  color,
  voterIds,
  voterNames,
  mine,
  closed,
  onPress,
}: BallotChoiceProps): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  const count = voterIds.length;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.choice,
        mine && !closed && styles.mine,
        closed && styles.closed,
        pressed && !closed && styles.pressed,
      ]}
      onPress={closed ? undefined : onPress}
      disabled={closed}
      accessibilityRole="radio"
      accessibilityState={{ selected: mine, disabled: closed }}
      accessibilityLabel={
        voterNames.length > 0
          ? `${label}, ${count}: ${voterNames.join(', ')}`
          : `${label}, ${count}`
      }
    >
      <Text style={[styles.label, heading]}>{label}</Text>
      {!closed && (
        <View style={styles.box}>
          <PenCross checked={mine} size={ms(34)} color={P.primary} style={styles.cross} />
        </View>
      )}
      <View style={styles.tally}>
        <TallyMarks count={count} color={color} />
      </View>
      {count > 0 && !closed && (
        <View style={styles.faces}>
          {voterIds.slice(0, 5).map((id, i) => (
            <View key={id} style={[styles.face, i > 0 && styles.faceOverlap]}>
              <UserAvatar userId={id} size={FACE} />
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    flex: 1,
    minHeight: ms(118),
    alignItems: 'center',
    gap: ms(6),
    paddingTop: ms(10),
    paddingBottom: ms(10),
    paddingHorizontal: ms(8),
    borderWidth: 2,
    borderColor: 'rgba(34,32,29,0.55)',
    borderRadius: ms(6),
  },
  mine: { borderColor: P.primary, backgroundColor: 'rgba(59,111,191,0.06)' },
  closed: { minHeight: 0, opacity: 0.55, borderColor: 'rgba(34,32,29,0.3)' },
  pressed: { opacity: 0.7 },
  label: { fontSize: mf(19), lineHeight: mf(24), color: P.paperInk },
  box: {
    width: ms(30),
    height: ms(30),
    borderWidth: 2.2,
    borderColor: P.paperMuted,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  cross: { position: 'absolute', left: -ms(4), top: -ms(5) },
  tally: { minHeight: ms(22), justifyContent: 'center' },
  faces: { flexDirection: 'row' },
  face: { borderRadius: FACE, borderWidth: 2, borderColor: P.receipt },
  faceOverlap: { marginStart: -ms(7) },
});
