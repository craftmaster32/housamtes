import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
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
import type { IoniconName } from '@/types/icons';
import { mf, ms } from '@utils/responsive';

interface ShopSection {
  title: string;
  icon: IoniconName;
  data: GroceryItem[];
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

  const checkCircle = (
    <View style={[styles.check, done && styles.checkOn]}>
      {done && <Ionicons name="checkmark" size={16} color="#fff" />}
    </View>
  );

  return (
    <Pressable
      style={[styles.row, done && styles.rowBought]}
      onPress={hasCount ? undefined : (): void => onToggle(item.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={item.name}
    >
      {hasCount ? (
        // Tapping the circle jumps the whole quantity to bought (or clears it),
        // so you don't have to tap + for every unit.
        <Pressable
          onPress={(): void => onSetCount(item.id, done ? 0 : qtyNum)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={t('grocery.shop.mark_all_bought', { name: item.name })}
        >
          {checkCircle}
        </Pressable>
      ) : (
        checkCircle
      )}
      <Text style={[styles.rowName, done && styles.rowNameBought]} numberOfLines={2}>
        {item.name}
      </Text>
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
      ) : (
        !!item.quantity &&
        item.quantity !== '1' && <Text style={styles.rowQty}>{item.quantity}</Text>
      )}
    </Pressable>
  );
});

export default function ShopScreen(): React.JSX.Element {
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

  const sections = useMemo((): ShopSection[] => {
    const shared = shoppingItems.filter((i) => !i.isPersonal);
    const mine = shoppingItems.filter((i) => i.isPersonal && i.addedBy === myId);
    const result: ShopSection[] = [];
    if (shared.length > 0)
      result.push({ title: t('grocery.shared_groceries'), icon: 'cart-outline', data: shared });
    if (mine.length > 0)
      result.push({ title: t('grocery.my_items'), icon: 'lock-closed-outline', data: mine });
    return result;
  }, [shoppingItems, myId, t]);

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
    router.back();
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
        <Ionicons name={section.icon} size={15} color={C.textSecondary} />
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [styles, C]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleLeave}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={22} color={C.primary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, headingFont]}>{t('grocery.shop.title')}</Text>
            <Text style={styles.headerSub}>
              {t('grocery.shop.progress', { bought: boughtCount, total: totalCount })}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${totalCount > 0 ? (boughtCount / totalCount) * 100 : 0}%` },
            ]}
          />
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
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
                />
                <Pressable
                  onPress={() => void handleAddItem()}
                  style={styles.addBtn}
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
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.finish')}
          >
            <Ionicons name="receipt-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('grocery.shop.finish')}</Text>
          </Pressable>
          <Pressable
            style={styles.ghostBtn}
            onPress={handleEndNoExpense}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.leave_no_expense')}
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
    container: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      paddingHorizontal: sizes.md,
      paddingTop: sizes.xs,
      paddingBottom: sizes.xs,
    },
    iconBtn: {
      minWidth: ms(44),
      minHeight: ms(44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCopy: { flex: 1 },
    headerTitle: { fontSize: mf(22), color: C.textPrimary, letterSpacing: -0.4 },
    headerSub: { fontSize: mf(13), ...font.medium, color: C.textSecondary, marginTop: ms(1) },
    progressTrack: {
      height: ms(6),
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(3),
      marginHorizontal: sizes.md,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: C.positive, borderRadius: ms(3) },
    listContent: { padding: sizes.md, gap: ms(6), paddingBottom: ms(20) },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      marginTop: sizes.sm,
      marginBottom: ms(4),
    },
    sectionHeaderText: {
      fontSize: mf(12),
      ...font.bold,
      letterSpacing: 0.5,
      color: C.textSecondary,
      textTransform: 'uppercase',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(12),
      paddingVertical: ms(12),
      paddingHorizontal: sizes.md,
      minHeight: ms(52),
    },
    rowBought: { backgroundColor: C.surfaceSecondary, borderColor: 'transparent' },
    check: {
      width: ms(26),
      height: ms(26),
      borderRadius: ms(13),
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: C.positive, borderColor: C.positive },
    rowName: { flex: 1, fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    rowNameBought: { textDecorationLine: 'line-through', color: C.textTertiary },
    rowQty: { fontSize: mf(13), ...font.medium, color: C.textSecondary },
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
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(12),
      paddingHorizontal: sizes.md,
      paddingVertical: ms(12),
      minHeight: ms(48),
      fontSize: mf(15),
      color: C.textPrimary,
    },
    addBtn: {
      width: ms(48),
      height: ms(48),
      borderRadius: ms(12),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: { color: C.danger, fontSize: mf(13), ...font.regular },
    bottomBar: {
      paddingHorizontal: sizes.md,
      paddingTop: sizes.sm,
      paddingBottom: sizes.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.surface,
      gap: ms(6),
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      backgroundColor: C.primary,
      borderRadius: ms(14),
      paddingVertical: ms(15),
      minHeight: ms(52),
    },
    primaryBtnText: { color: '#fff', fontSize: mf(16), ...font.bold },
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
