import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';
import { TimeWheel, WHEEL_ITEM_H } from './TimeWheel';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function parse(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? Math.round(m / 5) % 12 : 0 };
}

export interface TimePickerModalProps {
  visible: boolean;
  title: string;
  /** 'HH:MM' to start from (the field's value, or a sensible default). */
  value: string;
  onSelect: (time: string) => void;
  /** Back to no time at all. */
  onClear: () => void;
  onClose: () => void;
}

/**
 * Centred time pop-up, styled like the date pop-up: a serif title, two quiet
 * wheels (hours : minutes in 5-minute steps) between thin lines, and Clear /
 * Cancel / Confirm.
 */
export function TimePickerModal({
  visible,
  title,
  value,
  onSelect,
  onClear,
  onClose,
}: TimePickerModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const [hour, setHour] = useState(() => parse(value).h);
  const [minute, setMinute] = useState(() => parse(value).m);
  // The wheels mount only once the start value is set, so they open on it.
  const [ready, setReady] = useState(false);

  // Start from the field's value each time the pop-up opens.
  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    const p = parse(value);
    setHour(p.h);
    setMinute(p.m);
    setReady(true);
  }, [visible, value]);

  const confirm = useCallback((): void => {
    onSelect(`${HOURS[hour]}:${MINUTES[minute]}`);
  }, [hour, minute, onSelect]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: c.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[styles.title, headingFont, { color: c.textPrimary }]}
            accessibilityRole="header"
          >
            {title}
          </Text>

          {ready && (
            <View style={styles.wheels}>
              <View
                style={[styles.hair, styles.hairTop, { backgroundColor: c.border }]}
                pointerEvents="none"
              />
              <View
                style={[styles.hair, styles.hairBottom, { backgroundColor: c.border }]}
                pointerEvents="none"
              />
              <TimeWheel
                items={HOURS}
                selectedIndex={hour}
                onSelect={setHour}
                label={t('machines.hours_full')}
              />
              <Text style={[styles.colon, headingFont, { color: c.textPrimary }]}>:</Text>
              <TimeWheel
                items={MINUTES}
                selectedIndex={minute}
                onSelect={setMinute}
                label={t('machines.minutes_full')}
              />
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.textBtn, styles.clearBtn]}
              onPress={onClear}
              accessible
              accessibilityRole="button"
            >
              <Text style={[styles.textBtnLabel, { color: c.textSecondary }]}>
                {t('common.clear')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.textBtn}
              onPress={onClose}
              accessible
              accessibilityRole="button"
            >
              <Text style={[styles.textBtnLabel, { color: c.primary }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: c.primary }]}
              onPress={confirm}
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{t('common.confirm')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Thin lines above and below the middle (chosen) row.
const HAIR_TOP = WHEEL_ITEM_H * 2;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  card: {
    width: '100%',
    maxWidth: ms(340),
    borderRadius: ms(26),
    padding: ms(20),
    gap: ms(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(12) },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  title: { fontSize: mf(22), letterSpacing: -0.4, textAlign: 'center' },
  wheels: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  hair: { position: 'absolute', left: ms(24), right: ms(24), height: 1.5 },
  hairTop: { top: HAIR_TOP },
  hairBottom: { top: HAIR_TOP + WHEEL_ITEM_H },
  colon: { fontSize: mf(30), marginHorizontal: ms(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: ms(6), marginTop: ms(4) },
  textBtn: { minHeight: 44, paddingHorizontal: ms(10), justifyContent: 'center' },
  clearBtn: { marginEnd: 'auto' },
  textBtnLabel: { fontSize: mf(15.5), ...font.bold },
  confirmBtn: {
    minHeight: ms(50),
    paddingHorizontal: ms(24),
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#FFFFFF', fontSize: mf(16), ...font.bold },
});
