import { useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated as RNAnimated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@lib/alert';
import { navigateToBase } from '@stores/navigationStore';
import { useBillsStore } from '@stores/billsStore';
import { resolveBillIcon } from '@stores/recurringBillsStore';
import { CATEGORY_META } from '@stores/spendingStore';
import { useCategoryLook } from '@hooks/useCategoryLook';
import { CategoryDoodle } from '@components/bills/art/CategoryDoodle';
import { doodleKind, type DoodleKind } from '@components/bills/art/doodleKind';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { localizeCategoryName } from '@utils/categoryName';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { font } from '@constants/typography';
import { DotLeader } from '@components/shared/DotLeader';
import { Stamp } from '@components/shared/Stamp';
import type { BillRow, RecurringPaymentRow } from '@hooks/useOneOffBillHistory';
import { mf, ms } from '@utils/responsive';

// Width of the swipe-to-delete panel, kept in sync between the reveal animation
// and its style so the red panel slides in flush with the line's edge.
const SWIPE_DELETE_WIDTH = ms(84);
const DASHES = Array.from({ length: 30 });

/** A day heading on the receipt: "– – – Today – – –". */
export function DayHeader({ title }: { title: string }): React.JSX.Element {
  const c = useThemedColors();
  const dashes = (
    <View style={styles.dashRow} accessibilityElementsHidden>
      {DASHES.map((_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: c.receiptRule }]} />
      ))}
    </View>
  );
  return (
    <View style={styles.day} accessibilityRole="header">
      {dashes}
      <Text style={[styles.dayText, { color: c.receiptMuted }]}>{title}</Text>
      {dashes}
    </View>
  );
}

interface LineProps {
  kind: DoodleKind;
  title: string;
  meta: string;
  amount: string;
  struck?: boolean;
  stamp?: React.ReactNode;
  /** The category's colour; the drawing is coloured in with it. */
  tint?: string | null;
}

// One printed line: a small drawing of the category in its colour, the name,
// a dotted leader and the price.
function ReceiptLine({
  kind,
  title,
  meta,
  amount,
  struck,
  stamp,
  tint,
}: LineProps): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const ink = struck ? c.receiptMuted : c.receiptInk;
  return (
    <View style={styles.line}>
      <View style={[styles.lineIcon, struck && styles.iconStruck]}>
        <CategoryDoodle kind={kind} color={tint ?? null} size={ms(32)} />
      </View>
      <View style={styles.lineBody}>
        <View style={styles.lineTop}>
          <Text
            style={[
              styles.title,
              { color: ink },
              struck && { textDecorationLine: 'line-through', textDecorationColor: c.danger },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <DotLeader color={c.receiptRule} />
          <Text style={[styles.amount, headingFont, { color: ink }]}>{amount}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: c.receiptMuted }]} numberOfLines={1}>
            {meta}
          </Text>
          {stamp}
        </View>
      </View>
    </View>
  );
}

/** A one-off expense line. Owners/admins can swipe an unsettled one to delete. */
export function BillLine({
  bill,
}: {
  bill: Extract<BillRow, { kind: 'bill' }>['bill'];
}): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const role = useAuthStore((s) => s.role);
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const deleteBill = useBillsStore((s) => s.deleteBill);
  // Same rule as the detail screen's delete button: only owners/admins can
  // remove a bill, and settled bills stay locked as permanent history. A valid
  // house context is required too, so deletion never fires without one.
  const canDelete = (role === 'owner' || role === 'admin') && !bill.settled && !!houseId;
  const payer = memberName(bill.paidBy).split(' ')[0];
  const catLabel = bill.category ? localizeCategoryName(bill.category, t) : '';
  const look = useCategoryLook()(bill.category);

  // Single-flight guard: a slow delete must not be submitted twice (which would
  // fire duplicate deletes and notify housemates more than once).
  const deletingRef = useRef(false);
  const handleDelete = useCallback((): void => {
    if (deletingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Deleting a bill can't be undone and shifts everyone's balances, so
    // confirm before removing — unlike the throwaway grocery rows.
    Alert.alert(t('bills.delete_bill_confirm_title'), t('bills.delete_bill_confirm_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          deleteBill(bill.id, houseId)
            .catch(() => {
              Alert.alert(t('bills.failed_delete'));
            })
            .finally(() => {
              deletingRef.current = false;
            });
        },
      },
    ]);
  }, [bill.id, houseId, deleteBill, t]);

  const line = (
    <Pressable
      style={({ pressed }) => [{ backgroundColor: c.receipt }, pressed && styles.pressed]}
      onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}
      accessibilityRole="button"
    >
      <ReceiptLine
        kind={look.kind}
        tint={look.color}
        title={bill.title}
        meta={catLabel ? `${catLabel} · ${payer}` : t('bills.paid_by_name', { name: payer })}
        amount={formatFull(bill.amount, currencyCode)}
        struck={bill.settled}
        stamp={
          bill.settled ? <Stamp color={c.success}>{t('bills.settled_badge')}</Stamp> : undefined
        }
      />
    </Pressable>
  );

  // Swipe left-to-reveal a red Delete, like a native list. Settled bills and
  // non-owner/admins can't delete, so they just render the plain line.
  if (!canDelete) return line;
  return (
    <Swipeable
      renderRightActions={(_progress, dragX): React.JSX.Element => {
        // Slide the panel in 1:1 with the drag so it stays glued to the line's
        // edge instead of sitting revealed as a floating box underneath.
        const translateX = dragX.interpolate({
          inputRange: [-SWIPE_DELETE_WIDTH, 0],
          outputRange: [0, SWIPE_DELETE_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <RNAnimated.View style={[styles.swipeLane, { transform: [{ translateX }] }]}>
            <Pressable
              style={[styles.swipeDelete, { backgroundColor: c.danger }]}
              onPress={handleDelete}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('bills.delete_bill_name', { name: bill.title })}
              accessibilityState={{ disabled: false }}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </RNAnimated.View>
        );
      }}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
    >
      {line}
    </Swipeable>
  );
}

/** A logged recurring payment, printed on the same receipt with a "Recurring" stamp. */
export function RecurringPaymentLine({ row }: { row: RecurringPaymentRow }): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const paidBy = t('bills.paid_by_name', { name: memberName(row.paidBy).split(' ')[0] });
  return (
    <Pressable
      style={({ pressed }) => [{ backgroundColor: c.receipt }, pressed && styles.pressed]}
      onPress={() => navigateToBase('/(tabs)/bills?openRecurring=1')}
      accessibilityRole="button"
      accessibilityLabel={row.title}
    >
      <ReceiptLine
        kind={doodleKind(resolveBillIcon(row.icon), row.title)}
        tint={CATEGORY_META[row.title.trim().toLowerCase()]?.color ?? c.primary}
        title={row.title}
        meta={
          row.coverage
            ? `${paidBy} · ${t('bills.household_for_period', { period: row.coverage })}`
            : paidBy
        }
        amount={formatFull(row.amount, currencyCode)}
        stamp={<Stamp color={c.primary}>{t('bills.recurring_tag')}</Stamp>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    marginTop: ms(14),
    marginBottom: ms(2),
  },
  dayText: { fontSize: mf(13), ...font.extrabold },
  dashRow: { flex: 1, flexDirection: 'row', gap: ms(4), overflow: 'hidden' },
  dash: { width: ms(5), height: 1.5, borderRadius: 1 },
  line: { flexDirection: 'row', gap: ms(12), paddingVertical: ms(11) },
  lineIcon: { marginTop: -ms(4) },
  iconStruck: { opacity: 0.45 },
  lineBody: { flex: 1, minWidth: 0 },
  lineTop: { flexDirection: 'row', alignItems: 'center' },
  title: { flexShrink: 1, fontSize: mf(16), ...font.bold },
  amount: { fontSize: mf(17), letterSpacing: -0.2, writingDirection: 'ltr' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginTop: ms(2) },
  meta: { flexShrink: 1, fontSize: mf(13.5), ...font.medium },
  pressed: { opacity: 0.75 },
  swipeLane: { width: SWIPE_DELETE_WIDTH },
  swipeDelete: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: ms(3) },
  swipeDeleteText: { fontSize: mf(12), ...font.bold, color: '#fff' },
});
