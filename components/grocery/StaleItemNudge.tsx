import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

// A yellow sticky strip; real paper, so the same colours in both themes.
const NOTE = '#FCE9A8';
const NOTE_INK = '#3A3221';
const KEEP = '#3B6FBF';
const REMOVE = '#B84540';

export interface StaleItemNudgeProps {
  itemName: string;
  /** Whole days the item has been waiting. */
  days: number;
  onKeep: () => void;
  onRemove: () => void;
}

/**
 * "Coriander has been here 48 days. Still need it?" on a yellow sticky strip
 * stuck under that item, with Keep it / Take it off.
 */
export function StaleItemNudge({
  itemName,
  days,
  onKeep,
  onRemove,
}: StaleItemNudgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.pointer} />
      <View style={styles.note}>
        <Text style={[styles.text, hand]}>
          {itemName} {t('grocery.stale_nudge_body', { count: days })}
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            onPress={onKeep}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.stale_keep_a11y', { name: itemName })}
          >
            <Text style={[styles.btnText, styles.keep]}>{t('grocery.stale_keep')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.stale_remove_a11y', { name: itemName })}
          >
            <Text style={[styles.btnText, styles.remove]}>{t('grocery.stale_remove')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginStart: ms(30), marginTop: -ms(2), marginBottom: ms(10) },
  // A little triangle pointing up at the item.
  pointer: {
    width: 0,
    height: 0,
    marginStart: ms(18),
    borderLeftWidth: ms(7),
    borderRightWidth: ms(7),
    borderBottomWidth: ms(7),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: NOTE,
  },
  note: {
    backgroundColor: NOTE,
    paddingTop: ms(8),
    paddingHorizontal: ms(12),
    transform: [{ rotate: '-0.6deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  text: { fontSize: mf(18), lineHeight: mf(22), color: NOTE_INK },
  actions: { flexDirection: 'row', gap: ms(18) },
  btn: { minHeight: 44, justifyContent: 'center' },
  btnText: { fontSize: mf(14.5), ...font.semibold },
  keep: { color: KEEP },
  remove: { color: REMOVE },
  pressed: { opacity: 0.6 },
});
