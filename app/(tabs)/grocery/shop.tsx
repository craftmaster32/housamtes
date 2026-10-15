import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  SectionList,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { goBack } from '@stores/navigationStore';
import * as Haptics from 'expo-haptics';
import { Alert } from '@lib/alert';
import { useGroceryStore, type GroceryItem } from '@stores/groceryStore';
import { useAuthStore } from '@stores/authStore';
import { ShoppingCheckout } from '@components/grocery/ShoppingCheckout';
import { EmptyState } from '@components/ui';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { getErrorMessage } from '@utils/errors';
import { detectCategory } from '@utils/groceryCategory';
import { localizeQuantityForDisplay } from '@utils/groceryUnits';
import { formatItemAge } from '@utils/groceryAge';
import { useLanguageStore } from '@stores/languageStore';
import { useMemberName } from '@hooks/useMemberName';
import { useNow } from '@hooks/useNow';
import { elapsedLabel } from '@components/grocery/ShoppingRunCard';
import type { IoniconName } from '@/types/icons';
import { mf, ms } from '@utils/responsive';

interface ShopSection {
  title: string;
  icon: IoniconName;
  data: GroceryItem[];
  /** Already-bought group renders quieter. */
  muted?: boolean;
}

interface ShopItemRowProps {
  item: GroceryItem;
  onToggle: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onSetCount: (id: string, count: number) => void;
}

const ShopItemRow = memo(function ShopItemRow({
  item,
  onToggle,
  onIncrement,
  onDecrement,
  onSetCount,
}: ShopItemRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Items with a plain count > 1 (e.g. "3") get a +/- stepper so you can buy
  // part of them and leave the rest on the list. Everything else is a simple
  // bought / not-bought tick.
  const isPlainInt = /^\d+$/.test(item.quantity.trim());
  const qtyNum = isPlainInt ? parseInt(item.quantity, 10) : NaN;
  const hasCount = isPlainInt && qtyNum > 1;
  const bought = item.boughtCount ?? 0;
  const done = hasCount ? bought >= qtyNum : item.isChecked;
  const isHebrew = useLanguageStore((st) => st.language) === 'he';
  // "Dairy · 2L · the barista one" — aisle first so you can shop in order.
  const subLine = [
    item.isPersonal ? t('grocery.my_items') : t(detectCategory(item.name).labelKey),
    !hasCount && item.quantity && item.quantity !== '1'
      ? localizeQuantityForDisplay(item.quantity, isHebrew)
      : null,
    item.comment ? `“${item.comment}”` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const checkCircle = (
    <View style={[styles.check, done && styles.checkOn]}>
      {done && <Ionicons name="checkmark" size={20} color="#fff" />}
    </View>
  );

  return (
    <Pressable
      style={[styles.row, done && styles.rowBought]}
      onPress={hasCount ? undefined : (): void => onToggle(item.id)}
      // For counted rows the row itself isn't tappable (the circle and stepper
      // are), so don't expose it as an actionable checkbox to assistive tech.
      accessible={!hasCount}
      accessibilityRole={hasCount ? undefined : 'checkbox'}
      accessibilityState={hasCount ? undefined : { checked: done }}
      accessibilityLabel={hasCount ? undefined : [item.name, subLine].filter(Boolean).join(', ')}
    >
      {hasCount ? (
        // Tapping the circle jumps the whole quantity to bought (or clears it),
        // so you don't have to tap + for every unit.
        <Pressable
          onPress={(): void => onSetCount(item.id, done ? 0 : qtyNum)}
          hitSlop={8}
          accessible
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={t('grocery.shop.mark_all_bought', { name: item.name })}
        >
          {checkCircle}
        </Pressable>
      ) : (
        checkCircle
      )}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowName, done && styles.rowNameBought]} numberOfLines={2}>
          {item.name}
        </Text>
        {!done && !!subLine && (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subLine}
          </Text>
        )}
      </View>
      {hasCount ? (
        <View style={styles.counter}>
          <Pressable
            onPress={() => onDecrement(item.id)}
            hitSlop={8}
            style={[styles.ctrBtn, bought === 0 && styles.ctrBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.decrease_item', { name: item.name })}
            accessibilityState={{ disabled: bought === 0 }}
          >
            <Text style={styles.ctrBtnText}>−</Text>
          </Pressable>
          <Text style={styles.ctrText}>
            {bought}/{qtyNum}
          </Text>
          <Pressable
            onPress={() => onIncrement(item.id)}
            hitSlop={8}
            style={[styles.ctrBtn, bought >= qtyNum && styles.ctrBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.increase_item', { name: item.name })}
            accessibilityState={{ disabled: bought >= qtyNum }}
          >
            <Text style={styles.ctrBtnText}>+</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
});

function ShopScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const items = useGroceryStore((s) => s.items);
  const isLoading = useGroceryStore((s) => s.isLoading);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const incrementBought = useGroceryStore((s) => s.incrementBought);
  const decrementBought = useGroceryStore((s) => s.decrementBought);
  const setBoughtCount = useGroceryStore((s) => s.setBoughtCount);
  const clearChecked = useGroceryStore((s) => s.clearChecked);
  const addItem = useGroceryStore((s) => s.addItem);
  const startRun = useGroceryStore((s) => s.startRun);
  const endRun = useGroceryStore((s) => s.endRun);
  const activeRun = useGroceryStore((s) => s.activeRun);
  const memberName = useMemberName();
  const now = useNow();

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';

  const [showCheckout, setShowCheckout] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Opening the shopping screen means you're at the store — make sure a run is
  // active (and owned by you) so housemates see it live. Wait for the store to
  // finish loading first: starting before hydration could spawn a second run on
  // top of one that load() is about to restore. Guarded by a ref so it fires
  // exactly once, and reads activeRun fresh to avoid a stale closure.
  const startAttemptedRef = useRef(false);
  useEffect((): void => {
    if (isLoading || startAttemptedRef.current || !myId || !myName) return;
    startAttemptedRef.current = true;
    if (!useGroceryStore.getState().activeRun) {
      startRun(myId, myName).catch(() => {});
    }
  }, [isLoading, myId, myName, startRun]);

  const shoppingItems = useMemo(
    () => items.filter((i) => !i.isPersonal || i.addedBy === myId),
    [items, myId]
  );
  const boughtIds = useMemo(
    () => shoppingItems.filter((i) => i.isChecked).map((i) => i.id),
    [shoppingItems]
  );
  const boughtCount = boughtIds.length;
  const totalCount = shoppingItems.length;
  const progressPct = totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0;

  const isDone = useCallback((i: GroceryItem): boolean => {
    const q = i.quantity.trim();
    const n = /^\d+$/.test(q) ? parseInt(q, 10) : NaN;
    return n > 1 ? (i.boughtCount ?? 0) >= n : i.isChecked;
  }, []);

  const sections = useMemo((): ShopSection[] => {
    const toGrab = shoppingItems.filter((i) => !isDone(i));
    const inBasket = shoppingItems.filter((i) => isDone(i));
    const result: ShopSection[] = [];
    if (toGrab.length > 0)
      result.push({ title: t('grocery.shop.still_to_grab'), icon: 'cart-outline', data: toGrab });
    if (inBasket.length > 0)
      result.push({
        title: t('grocery.shop.in_basket'),
        icon: 'bag-check-outline',
        data: inBasket,
        muted: true,
      });
    return result;
  }, [shoppingItems, isDone, t]);

  // The newest thing a housemate added since you got to the shop.
  const justAdded = useMemo((): GroceryItem | null => {
    if (!activeRun) return null;
    const since = new Date(activeRun.startedAt).getTime();
    const fresh = items
      .filter(
        (i) =>
          !i.isPersonal &&
          !i.isChecked &&
          i.addedBy !== myId &&
          new Date(i.createdAt).getTime() > since
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return fresh[0] ?? null;
  }, [items, activeRun, myId]);

  const onToggle = useCallback(
    (id: string): void => {
      Haptics.selectionAsync().catch(() => {});
      toggleItem(id);
    },
    [toggleItem]
  );
  const onIncrement = useCallback(
    (id: string): void => {
      Haptics.selectionAsync().catch(() => {});
      incrementBought(id);
    },
    [incrementBought]
  );
  const onDecrement = useCallback(
    (id: string): void => {
      Haptics.selectionAsync().catch(() => {});
      decrementBought(id);
    },
    [decrementBought]
  );
  const onSetCount = useCallback(
    (id: string, count: number): void => {
      Haptics.selectionAsync().catch(() => {});
      setBoughtCount(id, count);
    },
    [setBoughtCount]
  );

  const handleAddItem = useCallback(async (): Promise<void> => {
    const name = newItem.trim();
    if (!name || !houseId) return;
    setNewItem('');
    setError(null);
    try {
      await addItem(name, '1', myId, houseId, 'shared');
      Haptics.selectionAsync().catch(() => {});
    } catch (err) {
      setError(getErrorMessage(err, t('grocery.shop.could_not_add')));
    }
  }, [newItem, houseId, addItem, myId, t]);

  const handleLeave = useCallback((): void => {
    goBack();
  }, []);

  const handleEndNoExpense = useCallback((): void => {
    Alert.alert(t('grocery.shop.leave_no_expense'), t('grocery.shop.leave_no_expense_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('grocery.shop.end_run'),
        style: 'destructive',
        onPress: (): void => {
          // Close the run before leaving so the "at the store" status can't
          // linger; navigate regardless of the broadcast's outcome.
          void endRun().finally(() => router.replace('/(tabs)/grocery'));
        },
      },
    ]);
  }, [endRun, t]);

  const handleSaved = useCallback(async (): Promise<void> => {
    setShowCheckout(false);
    // The expense is already saved. Finish cleanup — remove the bought items
    // and close the run — BEFORE navigating away, so we never leave the list or
    // the run in a half-updated state. Surface a plain error if cleanup fails.
    try {
      if (houseId) await clearChecked(houseId);
      await endRun();
      router.replace('/(tabs)/grocery');
    } catch {
      setError(t('grocery.shop.cleanup_failed'));
    }
  }, [houseId, clearChecked, endRun, t]);

  const renderItem = useCallback(
    ({ item }: { item: GroceryItem }): React.JSX.Element => (
      <ShopItemRow
        item={item}
        onToggle={onToggle}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        onSetCount={onSetCount}
      />
    ),
    [onToggle, onIncrement, onDecrement, onSetCount]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ShopSection }): React.JSX.Element => (
      <View style={styles.sectionHeader}>
        <Text
          style={[styles.sectionHeaderText, headingFont, section.muted && styles.sectionMuted]}
          accessibilityRole="header"
        >
          {section.title}
        </Text>
      </View>
    ),
    [styles, headingFont]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Hero: where you are + how full the basket is */}
        <View style={styles.hero}>
          <View style={styles.header}>
            <Pressable
              onPress={handleLeave}
              style={styles.iconBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              accessibilityState={{ disabled: false }}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>{t('grocery.housemates_can_see')}</Text>
            </View>
            {!!activeRun && (
              <Text style={styles.elapsed}>{elapsedLabel(activeRun.startedAt, t)}</Text>
            )}
          </View>
          <Text style={[styles.headerTitle, headingFont]}>{t('grocery.shop.title')}</Text>
          <View style={styles.progressLabels}>
            <Text style={styles.headerSub}>
              {t('grocery.shop.progress', { bought: boughtCount, total: totalCount })}
            </Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            justAdded ? (
              <View style={styles.justAdded} accessibilityLiveRegion="polite">
                <Ionicons name="add-circle-outline" size={20} color={C.primary} />
                <Text style={styles.justAddedText}>
                  {t('grocery.shop.just_added', {
                    name: memberName(justAdded.addedBy),
                    item: justAdded.name,
                  })}
                </Text>
                <Text style={styles.justAddedTime}>
                  {formatItemAge(justAdded.createdAt, t, now)}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                mode={isLoading ? 'loading' : 'empty'}
                icon="cart-outline"
                title={isLoading ? t('common.loading') : t('grocery.shop.empty')}
              />
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.addRow}>
                <TextInput
                  value={newItem}
                  onChangeText={setNewItem}
                  placeholder={t('grocery.shop.add_placeholder')}
                  placeholderTextColor={C.textTertiary}
                  style={styles.addInput}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleAddItem()}
                  accessibilityLabel={t('grocery.shop.add_placeholder')}
                  accessibilityHint={t('grocery.shop.add_hint')}
                />
                <Pressable
                  onPress={() => void handleAddItem()}
                  style={styles.addBtn}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.add')}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}
            </View>
          }
        />

        {/* Bottom actions */}
        <View style={styles.bottomBar}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setShowCheckout(true)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.finish')}
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="receipt-outline" size={18} color={C.surface} />
            <Text style={styles.primaryBtnText}>{t('grocery.shop.finish')}</Text>
          </Pressable>
          <Pressable
            style={styles.ghostBtn}
            onPress={handleEndNoExpense}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.leave_no_expense')}
            accessibilityState={{ disabled: false }}
          >
            <Text style={styles.ghostBtnText}>{t('grocery.shop.leave_no_expense')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Checkout modal */}
      <Modal
        visible={showCheckout}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCheckout(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, headingFont]}>{t('grocery.shop.checkout')}</Text>
              <Pressable
                onPress={() => setShowCheckout(false)}
                style={styles.iconBtn}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.flex}
            >
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {houseId && (
                  <ShoppingCheckout
                    houseId={houseId}
                    myId={myId}
                    myName={myName}
                    defaultTitle={t('grocery.shop.default_title')}
                    headerNote={
                      boughtCount > 0
                        ? t('grocery.shop.cart_note', { count: boughtCount })
                        : undefined
                    }
                    onSaved={handleSaved}
                  />
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.primary },
    body: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    hero: {
      backgroundColor: C.primary,
      borderBottomLeftRadius: ms(32),
      borderBottomRightRadius: ms(32),
      paddingHorizontal: ms(20),
      paddingTop: ms(4),
      paddingBottom: ms(24),
      gap: ms(12),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      marginStart: ms(-10),
    },
    elapsed: {
      marginStart: 'auto',
      fontSize: mf(13),
      ...font.medium,
      color: 'rgba(255,255,255,0.9)',
    },
    iconBtn: {
      minWidth: ms(44),
      minHeight: ms(44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: ms(12),
      paddingVertical: ms(6),
      borderRadius: ms(14),
      flexShrink: 1,
    },
    liveDot: { width: ms(8), height: ms(8), borderRadius: ms(4), backgroundColor: '#A7F3C0' },
    livePillText: { fontSize: mf(12), ...font.semibold, color: '#FFFFFF', flexShrink: 1 },
    headerTitle: { fontSize: mf(30), color: '#FFFFFF', letterSpacing: -0.4 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerSub: { fontSize: mf(14), ...font.medium, color: 'rgba(255,255,255,0.92)' },
    progressPct: { fontSize: mf(14), ...font.bold, color: '#FFFFFF' },
    progressTrack: {
      height: ms(10),
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: ms(5),
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#A7F3C0', borderRadius: ms(5) },
    listContent: { padding: sizes.md, gap: ms(6), paddingBottom: ms(20) },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      marginTop: sizes.sm,
      marginBottom: ms(4),
    },
    sectionHeaderText: { fontSize: mf(18), color: C.textPrimary, letterSpacing: -0.2 },
    sectionMuted: { color: C.textSecondary },
    justAdded: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(10),
      backgroundColor: C.surface,
      borderRadius: ms(18),
      borderWidth: 2,
      borderColor: C.primaryTint,
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      marginBottom: ms(4),
    },
    justAddedText: { flex: 1, fontSize: mf(14), ...font.medium, color: C.textPrimary },
    justAddedTime: { fontSize: mf(12), ...font.regular, color: C.textSecondary },
    rowCopy: { flex: 1, gap: ms(2) },
    rowSub: { fontSize: mf(13), ...font.regular, color: C.textSecondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderLight,
      borderRadius: ms(18),
      paddingVertical: ms(12),
      paddingHorizontal: sizes.md,
      minHeight: ms(56),
    },
    rowBought: { backgroundColor: C.surfaceSecondary, borderColor: 'transparent' },
    check: {
      width: ms(40),
      height: ms(40),
      borderRadius: ms(20),
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: C.positive, borderColor: C.positive },
    rowName: { fontSize: mf(17), ...font.semibold, color: C.textPrimary },
    rowNameBought: { textDecorationLine: 'line-through', color: C.textTertiary },
    counter: { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexShrink: 0 },
    ctrBtn: {
      width: ms(30),
      height: ms(30),
      borderRadius: ms(15),
      borderWidth: 1.5,
      borderColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctrBtnOff: { borderColor: C.border, opacity: 0.4 },
    ctrBtnText: { fontSize: mf(18), ...font.bold, color: C.primary, lineHeight: mf(20) },
    ctrText: {
      minWidth: ms(34),
      textAlign: 'center',
      fontSize: mf(14),
      ...font.bold,
      color: C.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    empty: { paddingVertical: ms(40) },
    footer: { marginTop: sizes.md, gap: sizes.xs },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    addInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(24),
      paddingHorizontal: sizes.md,
      paddingVertical: ms(12),
      minHeight: ms(48),
      fontSize: mf(15),
      color: C.textPrimary,
    },
    addBtn: {
      width: ms(48),
      height: ms(48),
      borderRadius: ms(24),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: { color: C.danger, fontSize: mf(13), ...font.regular },
    bottomBar: {
      paddingHorizontal: sizes.md,
      paddingTop: sizes.sm,
      paddingBottom: sizes.sm,
      backgroundColor: C.background,
      gap: ms(6),
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      backgroundColor: C.textPrimary,
      borderRadius: ms(28),
      paddingVertical: ms(15),
      minHeight: ms(52),
    },
    primaryBtnText: { color: C.surface, fontSize: mf(16), ...font.bold },
    ghostBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: ms(10),
      minHeight: ms(44),
    },
    ghostBtnText: { color: C.textSecondary, fontSize: mf(14), ...font.semibold },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: ms(24),
      borderTopRightRadius: ms(24),
      maxHeight: '92%',
    },
    modalHandle: {
      alignSelf: 'center',
      width: ms(40),
      height: ms(4),
      borderRadius: ms(2),
      backgroundColor: C.border,
      marginTop: ms(10),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.sm,
      paddingBottom: sizes.xs,
    },
    modalTitle: { fontSize: mf(20), color: C.textPrimary },
    modalContent: { padding: sizes.lg, paddingBottom: ms(40) },
  });

export default withFeatureGuard('grocery', ShopScreen);
