import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { BucketArt } from '@components/dashboard/art/BucketArt';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface TasksGlanceProps {
  done: number;
  total: number;
  /** Shown to admins when a repeating task is ticked. */
  onResetRepeating?: () => void;
}

/**
 * The glance tile at the top of Tasks, like the Home widgets: one big answer
 * ("3 of 7 done"), the subtitle, a thin progress line and the bucket drawing.
 */
export function TasksGlance({
  done,
  total,
  onResetRepeating,
}: TasksGlanceProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const share = total > 0 ? done / total : 0;

  return (
    <View style={[styles.tile, { backgroundColor: c.surface }]}>
      <View style={styles.top}>
        <View style={styles.copy}>
          {total > 0 && (
            <Text style={[styles.answer, headingFont, { color: c.textPrimary }]}>
              {t('tasks.progress', { done, total })}
            </Text>
          )}
          <Text style={[styles.meta, { color: c.textSecondary }]}>{t('tasks.subtitle')}</Text>
        </View>
        <View pointerEvents="none">
          <BucketArt width={ms(52)} />
        </View>
      </View>

      {total > 0 && (
        <View
          style={[styles.track, { backgroundColor: c.border }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: done }}
        >
          <View
            style={[
              styles.fill,
              { backgroundColor: c.success, width: `${share * 100}%` as `${number}%` },
            ]}
          />
        </View>
      )}

      {!!onResetRepeating && (
        <Pressable
          onPress={onResetRepeating}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('tasks.reset_repeating')}
        >
          <Text style={[styles.resetText, { color: c.danger }]}>{t('tasks.reset_repeating')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: ms(22),
    paddingHorizontal: ms(18),
    paddingTop: ms(16),
    paddingBottom: ms(16),
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(12) },
  copy: { flex: 1, minWidth: 0 },
  answer: { fontSize: mf(30), lineHeight: mf(36), letterSpacing: -0.5, marginBottom: ms(4) },
  meta: { fontSize: mf(14), ...font.medium, lineHeight: mf(19) },
  track: { height: 3, borderRadius: 2, marginTop: ms(14), overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  reset: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: -ms(8) },
  resetText: { fontSize: mf(14), ...font.bold },
  pressed: { opacity: 0.7 },
});
