import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { toneColors, type CategoryTone } from '@utils/groceryCategory';
import type { IoniconName } from '@/types/icons';
import { mf, ms } from '@utils/responsive';

const STRING = 'rgba(46,36,22,0.55)';

interface AisleSignProps {
  title: string;
  icon: IoniconName;
  tone: CategoryTone;
  /** Alternate the tilt so the signs don't all lean the same way. */
  leanRight?: boolean;
  /** Extra controls beside the sign (e.g. the draft's share buttons). */
  children?: React.ReactNode;
}

/**
 * A shop's aisle sign hanging on two strings over its part of the bag. Uses the
 * light category colours in both themes, since it sits on the paper bag.
 */
export function AisleSign({
  title,
  icon,
  tone,
  leanRight = false,
  children,
}: AisleSignProps): React.JSX.Element {
  const colors = toneColors(tone, false);
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.sign,
          { backgroundColor: colors.bg },
          leanRight ? styles.leanRight : styles.leanLeft,
        ]}
        accessibilityRole="header"
      >
        <View style={[styles.string, styles.stringStart]} />
        <View style={[styles.string, styles.stringEnd]} />
        <Ionicons name={icon} size={17} color={colors.fg} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: ms(22),
    paddingBottom: ms(8),
    gap: ms(10),
  },
  sign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(7),
    paddingVertical: ms(6),
    paddingStart: ms(11),
    paddingEnd: ms(14),
    borderRadius: ms(7),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 2,
    maxWidth: '80%',
  },
  leanLeft: { transform: [{ rotate: '-1.5deg' }] },
  leanRight: { transform: [{ rotate: '1.5deg' }] },
  string: {
    position: 'absolute',
    top: -ms(14),
    width: 1.5,
    height: ms(14),
    backgroundColor: STRING,
  },
  stringStart: { start: ms(14) },
  stringEnd: { end: ms(14) },
  title: { fontSize: mf(15), ...font.bold, color: lightColors.textPrimary },
  extra: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
});
