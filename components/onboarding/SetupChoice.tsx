import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { PenCircle } from '@components/shared/PenCircle';
import { mf, ms } from '@utils/responsive';

interface SetupChoiceProps {
  kind: 'create' | 'join';
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * One of the two ways in: a cream key tag for a new house, or a blue ticket
 * stub for an invite code (the same objects Settings uses for the house and
 * its code). The chosen one has its name circled in blue pen; the other fades.
 */
export function SetupChoice({
  kind,
  title,
  subtitle,
  selected,
  onPress,
}: SetupChoiceProps): React.JSX.Element {
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const isTicket = kind === 'join';
  const ink = isTicket ? c.noteInk : c.paperInk;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: isTicket ? c.note : c.paper },
        isTicket ? styles.tiltRight : styles.tiltLeft,
        pressed && styles.pressed,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
    >
      {/* Key-tag hole, or the ticket's punched edge */}
      {isTicket ? (
        <View style={styles.perforation}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[styles.perfHole, { backgroundColor: c.background }]} />
          ))}
        </View>
      ) : (
        <View style={[styles.hole, { backgroundColor: c.background, borderColor: '#A39D92' }]} />
      )}
      {/* The paper stays bright; only the writing fades on the one not chosen. */}
      <View style={[styles.inner, !selected && styles.faded]}>
        <Ionicons name={isTicket ? 'key-outline' : 'home-outline'} size={22} color={ink} />
        <View style={styles.titleWrap}>
          {selected && <PenCircle color={c.primary} style={styles.circle} />}
          <Text style={[styles.title, heading, { color: ink }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Text style={[styles.sub, { color: ink }]}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: ms(150),
    borderRadius: ms(14),
    padding: ms(16),
    paddingTop: ms(34),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(6) },
    shadowOpacity: 0.12,
    shadowRadius: ms(10),
    elevation: 3,
  },
  tiltLeft: { transform: [{ rotate: '-1.5deg' }] },
  tiltRight: { transform: [{ rotate: '1.5deg' }] },
  inner: { gap: ms(6) },
  faded: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  hole: {
    position: 'absolute',
    top: ms(12),
    alignSelf: 'center',
    width: ms(14),
    height: ms(14),
    borderRadius: ms(7),
    borderWidth: 2.5,
  },
  perforation: {
    position: 'absolute',
    top: ms(-5),
    left: ms(12),
    right: ms(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perfHole: { width: ms(10), height: ms(10), borderRadius: ms(5) },
  titleWrap: { alignSelf: 'flex-start', paddingHorizontal: ms(6), marginStart: ms(-6) },
  circle: {
    position: 'absolute',
    top: ms(-4),
    bottom: ms(-4),
    left: ms(-4),
    right: ms(-4),
    transform: [{ rotate: '-3deg' }],
  },
  title: { fontSize: mf(18), lineHeight: mf(24) },
  sub: { fontSize: mf(13), ...font.regular, lineHeight: mf(18), opacity: 0.8 },
});
