import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useRecurringPalette } from '@components/bills/recurring/palette';
import {
  useSettleUpToDate,
  previousDay,
  recentMonthEnds,
  type PlannedTransfer,
} from '@hooks/useSettleUpToDate';
import { CategoryWords } from '@components/bills/CategoryWords';
import { useMemberName } from '@hooks/useMemberName';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { formatFull } from '@constants/currencies';
import { formatDateDDMMYYYY, toAppLocale } from '@utils/dates';
import { SheetButton } from '@components/shared/SheetButton';
import { SettleSheet } from './SettleSheet';
import { settleStyles as styles } from './settleStyles';

interface SettleUpToDateSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Settle up to a date": everything up to a day was paid outside the app.
 * Kept short: pick the date, see what's left to settle, confirm.
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

  const first = useCallback(
    (id: string): string => (id === myId ? t('bills.you_label') : memberName(id).split(' ')[0]),
    [myId, memberName, t]
  );
  const date = formatDateDDMMYYYY(s.upTo);

  const renderItem = useCallback(
    ({ item }: { item: PlannedTransfer }): React.JSX.Element => (
      <View style={[styles.row, styles.listItem, { borderBottomColor: p.border }]}>
        <View style={styles.rowText}>
          <Text
            style={[styles.rowTitle, { color: item.canRecord ? p.text : p.muted }]}
            numberOfLines={1}
          >
            {t('bills.settle_pays', { from: first(item.from), to: first(item.to) })}
          </Text>
          {!item.canRecord && (
            <Text style={[styles.rowSub, { color: p.muted }]} numberOfLines={1}>
              {t('bills.settle_upto_theirs')}
            </Text>
          )}
        </View>
        <Text style={[styles.rowAmount, { color: item.canRecord ? p.text : p.muted }]}>
          {formatFull(item.amount, currencyCode)}
        </Text>
      </View>
    ),
    [p, t, first, currencyCode]
  );

  const header = (
    <View style={styles.body}>
      {/* Hand-circled words, like the category filters (DESIGN.md). */}
      <View>
        <Text style={[styles.label, { color: p.muted }]}>{t('bills.settle_upto_paid_label')}</Text>
        <CategoryWords
          items={monthEnds.map((m) => ({ key: m.id, label: m.name }))}
          selected={s.upTo}
          onSelect={setUpTo}
        />
      </View>
      <Pressable
        style={({ pressed }) => [styles.linkBtn, styles.inlineRow, pressed && styles.dimmed]}
        onPress={openDate}
        accessibilityRole="button"
        accessibilityLabel={`${t('bills.settle_upto_other_date')}: ${date}`}
        accessibilityHint={t('bills.settle_upto_date_hint')}
      >
        <Ionicons name="calendar-outline" size={18} color={p.primary} />
        <Text style={[styles.linkText, { color: p.primary }]}>
          {t('bills.settle_upto_other_date')} · {date}
        </Text>
      </Pressable>

      {/* "Until 1 October" usually means "before October": catch the 1st. */}
      {s.upTo.endsWith('-01') && (
        <Pressable
          style={({ pressed }) => [styles.linkBtn, pressed && styles.dimmed]}
          onPress={pickDayBefore}
          accessibilityRole="button"
        >
          <Text style={[styles.error, { color: p.overdueText }]}>
            {t('bills.settle_upto_first_short', {
              date,
              before: formatDateDDMMYYYY(previousDay(s.upTo)),
            })}
          </Text>
        </Pressable>
      )}

      {s.plan.length === 0 ? (
        <View style={[styles.inlineRow, styles.nothing]}>
          <Ionicons name="checkmark-circle" size={22} color={p.primary} />
          <Text style={[styles.rowTitle, { color: p.text }]}>
            {t('bills.settle_upto_nothing_simple', { date })}
          </Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: p.muted }]}>
          {t('bills.settle_upto_left_label', { date })}
        </Text>
      )}
    </View>
  );

  const message = s.error
    ? s.error
    : s.isFuture
      ? t('bills.settle_future_date')
      : s.othersFirst
        ? t('bills.settle_upto_others_first')
        : '';
  const hasFooter = !!message || s.recordable.length > 0;

  return (
    <>
      <SettleSheet
        visible={visible}
        eyebrow={t('bills.settle_up')}
        title={t('bills.settle_upto_title')}
        onClose={close}
      >
        <FlatList
          style={styles.listShrink}
          data={s.plan}
          keyExtractor={(x) => `${x.from}-${x.to}`}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListFooterComponent={<View style={styles.listEnd} />}
        />
        {/* Always on screen, so Confirm is never hidden below the list. */}
        {hasFooter && (
          <View
            style={[styles.stickyFooter, { borderTopColor: p.border, backgroundColor: p.sheet }]}
          >
            {!!message && (
              <Text style={[styles.error, { color: p.overdueText }]} accessibilityRole="alert">
                {message}
              </Text>
            )}
            {s.recordable.length > 0 && (
              <SheetButton
                label={
                  s.saving ? t('bills.household_saving') : t('bills.settle_upto_confirm', { date })
                }
                onPress={s.confirm}
                disabled={s.saving}
                loading={s.saving}
              />
            )}
          </View>
        )}
      </SettleSheet>
      <DatePickerModal visible={showDate} value={s.upTo} onSelect={pickDate} onClose={closeDate} />
    </>
  );
}
