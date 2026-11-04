import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useRecurringPalette } from '@components/bills/recurring/palette';
import {
  useSettleUpToDate,
  nextDay,
  previousDay,
  recentMonthEnds,
  type PlannedTransfer,
} from '@hooks/useSettleUpToDate';
import { ChoiceChips } from '@components/bills/recurring/ChoiceChips';
import { useMemberName } from '@hooks/useMemberName';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { formatFull } from '@constants/currencies';
import { formatDateDDMMYYYY, toAppLocale } from '@utils/dates';
import { SettleSheet } from './SettleSheet';
import { settleStyles as styles } from './settleStyles';

interface SettleUpToDateSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Settle up to a date": everything owed for expenses up to the chosen day was
 * paid outside the app. Shows exactly which payments will be recorded first.
 */
export function SettleUpToDateSheet({
  visible,
  onClose,
}: SettleUpToDateSheetProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const s = useSettleUpToDate(visible, onClose);
  const [showDate, setShowDate] = useState(false);

  const close = useCallback((): void => {
    if (!s.saving) onClose();
  }, [s.saving, onClose]);
  const openDate = useCallback((): void => setShowDate(true), []);
  const closeDate = useCallback((): void => setShowDate(false), []);
  const { setUpTo } = s;
  const pickDate = useCallback(
    (v: string): void => {
      setUpTo(v);
      setShowDate(false);
    },
    [setUpTo]
  );

  const pickDayBefore = useCallback((): void => setUpTo(previousDay(s.upTo)), [setUpTo, s.upTo]);
  const monthEnds = useMemo(
    () =>
      recentMonthEnds(3).map((end) => ({
        id: end,
        name: t('bills.settle_upto_end_of', {
          month: new Date(`${end}T12:00:00`).toLocaleDateString(toAppLocale(i18n.language), {
            month: 'long',
          }),
        }),
      })),
    [t, i18n.language]
  );

  const name = useCallback(
    (id: string): string => (id === myId ? t('bills.you_label') : memberName(id)),
    [myId, memberName, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: PlannedTransfer }): React.JSX.Element => (
      <View style={[styles.row, styles.listItem, { borderBottomColor: p.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
            {t('bills.settle_pays', { from: name(item.from), to: name(item.to) })}
          </Text>
          {!item.canRecord && (
            <Text style={[styles.rowSub, { color: p.muted }]}>
              {t('bills.settle_they_record', { from: name(item.from), to: name(item.to) })}
            </Text>
          )}
        </View>
        <Text style={[styles.rowAmount, { color: p.text }]}>
          {formatFull(item.amount, currencyCode)}
        </Text>
      </View>
    ),
    [p, t, name, currencyCode]
  );

  const header = (
    <View style={styles.body}>
      <Text style={[styles.help, { color: p.muted }]}>{t('bills.settle_upto_help')}</Text>
      <View>
        <Text style={[styles.label, { color: p.muted }]}>{t('bills.settle_upto_date')}</Text>
        <Pressable
          style={[styles.input, styles.dateBtn, { borderColor: p.border }]}
          onPress={openDate}
          accessibilityRole="button"
          accessibilityLabel={`${t('bills.settle_upto_date')}: ${formatDateDDMMYYYY(s.upTo)}`}
          accessibilityHint={t('bills.settle_upto_date_hint')}
        >
          <Text style={[styles.dateText, { color: p.text }]}>{formatDateDDMMYYYY(s.upTo)}</Text>
          <Ionicons name="calendar-outline" size={18} color={p.muted} />
        </Pressable>
      </View>
      {/* One tap for the usual case: "everything up to the end of a month". */}
      <ChoiceChips
        label={t('bills.settle_upto_quick')}
        options={monthEnds}
        selected={[s.upTo]}
        mode="single"
        onToggle={setUpTo}
      />
      {/* Say in words exactly what this date means: paid vs still open. */}
      <Text style={[styles.help, { color: p.text }]}>
        {t('bills.settle_upto_explain', {
          date: formatDateDDMMYYYY(s.upTo),
          next: formatDateDDMMYYYY(nextDay(s.upTo)),
        })}
      </Text>
      {/* "Until 1 October" usually means "before October": catch the 1st. */}
      {s.upTo.endsWith('-01') && (
        <View style={styles.tooMuch}>
          <Text style={[styles.error, { color: p.overdueText }]}>
            {t('bills.settle_upto_first_of_month', {
              date: formatDateDDMMYYYY(s.upTo),
              before: formatDateDDMMYYYY(previousDay(s.upTo)),
            })}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.linkBtn, pressed && styles.dimmed]}
            onPress={pickDayBefore}
            accessibilityRole="button"
          >
            <Text style={[styles.linkText, { color: p.primary }]}>
              {t('bills.settle_upto_use_day_before', {
                before: formatDateDDMMYYYY(previousDay(s.upTo)),
              })}
            </Text>
          </Pressable>
        </View>
      )}
      <Text style={[styles.label, { color: p.muted }]}>
        {s.plan.length > 0 ? t('bills.settle_upto_will_record') : t('bills.settle_upto_nothing')}
      </Text>
    </View>
  );

  const footer = (
    <View style={styles.body}>
      {!!s.error && (
        <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
          {s.error}
        </Text>
      )}
      {s.isFuture && (
        <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
          {t('bills.settle_future_date')}
        </Text>
      )}
      {!s.isFuture && s.plan.length > 0 && s.recordable.length === 0 && (
        <Text style={[styles.help, { color: p.muted }]}>{t('bills.settle_upto_none_mine')}</Text>
      )}
      {s.recordable.length > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: p.primary },
            (s.saving || pressed) && styles.dimmed,
          ]}
          onPress={s.confirm}
          disabled={s.saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: s.saving, busy: s.saving }}
        >
          <Text style={[styles.primaryText, { color: p.onPrimary }]}>
            {s.saving
              ? t('bills.household_saving')
              : t('bills.settle_upto_confirm', { date: formatDateDDMMYYYY(s.upTo) })}
          </Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <>
      <SettleSheet
        visible={visible}
        eyebrow={t('bills.settle_up')}
        title={t('bills.settle_upto_title')}
        onClose={close}
      >
        <FlatList
          data={s.plan}
          keyExtractor={(x) => `${x.from}-${x.to}`}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
        />
      </SettleSheet>
      <DatePickerModal visible={showDate} value={s.upTo} onSelect={pickDate} onClose={closeDate} />
    </>
  );
}
