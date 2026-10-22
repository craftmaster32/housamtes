import { useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { Stamp } from '@components/shared/Stamp';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import { useParkingStore } from '@stores/parkingStore';
import { resolveName } from '@utils/housemates';
import { byStartTime, parseDateParts, timeRange } from '@utils/parkingDates';
import { mf, ms } from '@utils/responsive';
import { reservationStatus } from './reservationStatus';

interface DayScheduleSheetProps {
  date: string | null;
  onClose: () => void;
  currentUserId: string;
  now: Date;
}

/** One day's reservations, listed on a receipt slip with a stamp each. */
export function DayScheduleSheet({
  date,
  onClose,
  currentUserId,
  now,
}: DayScheduleSheetProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const allReservations = useParkingStore((s) => s.reservations);

  const dayReservations = useMemo(
    () => (date ? allReservations.filter((r) => r.date === date).sort(byStartTime) : []),
    [allReservations, date]
  );

  if (!date) return null;
  const { dayNum, monthShort, weekdayFull } = parseDateParts(date, language);
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('parking.reservations')}
            title={`${weekdayFull}, ${dayNum} ${monthShort}`}
            onClose={onClose}
          />
          <ScrollView contentContainerStyle={styles.body}>
            {dayReservations.length === 0 ? (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                {t('parking.no_reservations_day')}
              </Text>
            ) : (
              <View style={[styles.slip, { backgroundColor: c.receipt }]}>
                {dayReservations.map((r, i) => {
                  const status = reservationStatus(r, now, t);
                  const who =
                    r.requestedBy === currentUserId
                      ? t('parking.you')
                      : resolveName(r.requestedBy, housemates);
                  return (
                    <View key={r.id}>
                      {i > 0 && <DashedRule color={c.receiptRule} />}
                      <View style={styles.row}>
                        <View style={styles.rowInfo}>
                          <Text style={[styles.time, { color: c.receiptInk }]}>
                            {timeRange(r) ?? t('parking.all_day')}
                          </Text>
                          <Text style={[styles.name, { color: c.receiptMuted }]}>
                            {who}
                            {r.note ? ` · ${r.note}` : ''}
                          </Text>
                        </View>
                        <Stamp color={status.ink}>{status.label}</Stamp>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: c.primary },
                pressed && styles.pressed,
              ]}
              onPress={onClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// iOS can't dash a single border side, so the tear line is drawn as dashes.
function DashedRule({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={styles.dashes} pointerEvents="none">
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingBottom: ms(32), gap: ms(18) },
  empty: { fontSize: mf(15), ...font.medium, textAlign: 'center', paddingVertical: ms(16) },
  slip: { borderRadius: ms(4), paddingHorizontal: ms(14), paddingVertical: ms(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: ms(12) },
  rowInfo: { flex: 1, minWidth: 0 },
  time: { fontSize: mf(15), ...font.extrabold },
  name: { fontSize: mf(14), ...font.medium, marginTop: ms(1) },
  dashes: { flexDirection: 'row', overflow: 'hidden', gap: ms(4), height: 1.5 },
  dash: { width: ms(5), height: 1.5 },
  closeBtn: {
    minHeight: ms(56),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: mf(17), ...font.bold },
  pressed: { opacity: 0.75 },
});
