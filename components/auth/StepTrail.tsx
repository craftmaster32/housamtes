import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { PenCircle } from '@components/shared/PenCircle';
import { mf, ms } from '@utils/responsive';

interface StepTrailProps {
  steps: string[];
  current: number;
}

/**
 * Where you are in signing up, written as words: the current step circled in
 * blue pen, finished steps ticked, later steps in grey, joined by short dashes.
 */
export function StepTrail({ steps, current }: StepTrailProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={steps[current]}
      accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && <View style={[styles.dash, { backgroundColor: c.textTertiary }]} />}
            <View style={styles.word}>
              {on && <PenCircle color={c.primary} style={styles.circle} />}
              {done && <Ionicons name="checkmark" size={15} color={c.primary} />}
              <Text
                style={[
                  styles.label,
                  on && styles.labelOn,
                  { color: on ? c.textPrimary : c.textSecondary },
                ]}
              >
                {label}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: ms(4) },
  word: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(3),
    minHeight: 40,
    paddingHorizontal: ms(10),
  },
  circle: {
    position: 'absolute',
    top: ms(5),
    bottom: ms(5),
    left: 0,
    right: 0,
    transform: [{ rotate: '-3deg' }],
  },
  label: { fontSize: mf(14.5), ...font.medium },
  labelOn: { ...font.semibold },
  dash: { width: ms(14), height: 1.5, borderRadius: 1 },
});
