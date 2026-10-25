import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import {
  Animated,
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
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { BackLink } from '@components/shared/BackLink';
import { Mate } from '@components/shared/Mate';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { BagSlice } from '@components/grocery/BagSlice';
import { AisleSign } from '@components/grocery/AisleSign';
import { ShopItemRow } from '@components/grocery/ShopItemRow';
import { Fold } from '@components/shared/Fold';
import { useBasketMoves } from '@hooks/useBasketMoves';
import { useEasedValue } from '@hooks/useEasedValue';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { getErrorMessage } from '@utils/errors';
import { formatItemAge } from '@utils/groceryAge';
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
  /** Every row is moving out, so the sign folds away with them. */
  leaving?: boolean;
  /** Every row has just moved in, so the sign unfolds with them. */
  arriving?: boolean;
}

function ShopScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();

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
  const runBroadcastVisible = useGroceryStore((s) => s.runBroadcastVisible);
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
  // The trip's bar slides along as things go in the basket.
  const progress = useEasedValue(totalCount > 0 ? boughtCount / totalCount : 0);

  const isDone = useCallback((i: GroceryItem): boolean => {
    const q = i.quantity.trim();
    const n = /^\d+$/.test(q) ? parseInt(q, 10) : NaN;
    return n > 1 ? (i.boughtCount ?? 0) >= n : i.isChecked;
  }, []);

  // A ticked item waits a beat, then moves to the basket with a fold, so the
  // list doesn't jump under your finger on every tap.
  const { isShownInBasket, leavingIds, arrivingIds } = useBasketMoves(shoppingItems, isDone);

  const sections = useMemo((): ShopSection[] => {
    const toGrab = shoppingItems.filter((i) => !isShownInBasket(i));
    const inBasket = shoppingItems.filter((i) => isShownInBasket(i));
    const moving = (data: GroceryItem[]): Pick<ShopSection, 'leaving' | 'arriving'> => ({
      leaving: data.every((i) => leavingIds.has(i.id)),
      arriving: data.every((i) => arrivingIds.has(i.id)),
    });
    const result: ShopSection[] = [];
    if (toGrab.length > 0)
      result.push({
        title: t('grocery.shop.still_to_grab'),
        icon: 'cart-outline',
        data: toGrab,
        ...moving(toGrab),
      });
    if (inBasket.length > 0)
      result.push({
        title: t('grocery.shop.in_basket'),
        icon: 'bag-check-outline',
        data: inBasket,
        muted: true,
        ...moving(inBasket),
      });
    return result;
  }, [shoppingItems, isShownInBasket, leavingIds, arrivingIds, t]);

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
    ({ item, index }: { item: GroceryItem; index: number }): React.JSX.Element => (
      <Fold open={!leavingIds.has(item.id)} appear={arrivingIds.has(item.id)}>
        <BagSlice dashedTop={index > 0}>
          <ShopItemRow
            item={item}
            onToggle={onToggle}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            onSetCount={onSetCount}
          />
        </BagSlice>
      </Fold>
    ),
    [onToggle, onIncrement, onDecrement, onSetCount, leavingIds, arrivingIds]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ShopSection }): React.JSX.Element => (
      <Fold open={!section.leaving} appear={section.arriving}>
        <BagSlice isTop={sections.indexOf(section) === 0}>
          <AisleSign
            title={section.title}
            icon={section.icon}
            tone={section.muted ? 'blue' : 'green'}
            leanRight={!!section.muted}
          />
        </BagSlice>
      </Fold>
    ),
    [sections]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.topRow}>
                <BackLink label={t('common.back')} />
                {!!activeRun && (
                  <Text style={[styles.elapsed, hand]}>{elapsedLabel(activeRun.startedAt, t)}</Text>
                )}
              </View>
              <Text style={[styles.title, headingFont]} accessibilityRole="header">
                {t('grocery.shop.title')}
              </Text>
              {runBroadcastVisible && (
                <View style={styles.live}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{t('grocery.housemates_can_see')}</Text>
                </View>
              )}
              <Text style={[styles.progress, headingFont]}>
                {t('grocery.shop.progress', { bought: boughtCount, total: totalCount })}
              </Text>
              <View style={styles.track}>
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              {justAdded && (
                // A housemate's last-minute add, on a yellow sticky note.
                <View style={styles.justAdded} accessibilityLiveRegion="polite">
                  <Text style={[styles.justAddedText, hand]}>
                    {t('grocery.shop.just_added', {
                      name: memberName(justAdded.addedBy),
                      item: justAdded.name,
                    })}
                  </Text>
                  <Text style={styles.justAddedTime}>
                    {formatItemAge(justAdded.createdAt, t, now)}
                  </Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <BagSlice isTop isBottom>
              <View style={styles.empty}>
                {isLoading ? (
                  <LoadingSpinner size={64} />
                ) : (
                  <>
                    <Mate size={ms(70)} />
                    <Text style={styles.emptyText}>{t('grocery.shop.empty')}</Text>
                  </>
                )}
              </View>
            </BagSlice>
          }
          ListFooterComponent={
            <View>
              {sections.length > 0 && <BagSlice isBottom />}
              <View style={styles.addRow}>
                <TextInput
                  value={newItem}
                  onChangeText={setNewItem}
                  placeholder={t('grocery.shop.add_placeholder')}
                  placeholderTextColor={C.textTertiary}
                  style={[styles.addInput, { borderBottomColor: C.border, color: C.textPrimary }]}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleAddItem()}
                  accessibilityLabel={t('grocery.shop.add_placeholder')}
                  accessibilityHint={t('grocery.shop.add_hint')}
                />
                <Pressable
                  onPress={() => void handleAddItem()}
                  style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.add')}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </Pressable>
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}
            </View>
          }
        />

        {/* Bottom actions: finish, or leave without an expense (red text). */}
        <View style={[styles.bottomBar, { borderTopColor: C.border }]}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => setShowCheckout(true)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.finish')}
          >
            <Text style={styles.primaryBtnText}>{t('grocery.shop.finish')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.endBtn, pressed && styles.pressed]}
            onPress={handleEndNoExpense}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.leave_no_expense')}
          >
            <Text style={styles.endText}>{t('grocery.shop.leave_no_expense')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Add expense: a bottom sheet on the page colour, in the Bills style. */}
      <Modal
        visible={showCheckout}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCheckout(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView
            style={[styles.modalSheet, { backgroundColor: C.background }]}
            edges={['bottom']}
          >
            <SheetHeader
              eyebrow={t('grocery.shop.title')}
              title={t('grocery.shop.checkout')}
              onClose={() => setShowCheckout(false)}
            />
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

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    listContent: { paddingHorizontal: ms(20), paddingBottom: ms(20) },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    elapsed: { fontSize: mf(19), color: C.textSecondary },
    title: {
      fontSize: mf(36),
      // Tall enough for the descenders, so no letter is clipped.
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    live: { flexDirection: 'row', alignItems: 'center', gap: ms(7), marginTop: ms(2) },
    liveDot: { width: ms(8), height: ms(8), borderRadius: ms(4), backgroundColor: C.positive },
    liveText: { fontSize: mf(13), ...font.medium, color: C.textSecondary },
    progress: { fontSize: mf(24), lineHeight: mf(31), color: C.textPrimary, marginTop: ms(12) },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: C.border,
      overflow: 'hidden',
      marginTop: ms(8),
      marginBottom: ms(6),
    },
    fill: { height: '100%', borderRadius: 3, backgroundColor: C.primary },
    justAdded: {
      marginTop: ms(14),
      backgroundColor: '#FCE9A8',
      paddingHorizontal: ms(14),
      paddingVertical: ms(10),
      transform: [{ rotate: '-0.6deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(3) },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 2,
    },
    justAddedText: { fontSize: mf(19), lineHeight: mf(23), color: '#3A3221' },
    justAddedTime: { fontSize: mf(12), ...font.regular, color: '#6B5D3E', marginTop: ms(2) },
    empty: { alignItems: 'center', gap: ms(10), paddingVertical: ms(24) },
    emptyText: {
      fontSize: mf(14.5),
      ...font.regular,
      color: C.kraftMuted,
      textAlign: 'center',
      lineHeight: mf(20),
      paddingHorizontal: ms(10),
    },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), marginTop: ms(20) },
    addInput: {
      flex: 1,
      minWidth: 0,
      fontSize: mf(16),
      ...font.medium,
      paddingVertical: ms(10),
      borderBottomWidth: 2,
    },
    addBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: { color: C.danger, fontSize: mf(13), ...font.regular, marginTop: ms(6) },
    bottomBar: {
      gap: ms(2),
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
      paddingBottom: ms(14),
      borderTopWidth: 1,
      backgroundColor: C.background,
    },
    endBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    endText: { fontSize: mf(15), ...font.semibold, color: C.negative },
    primaryBtn: {
      minHeight: 52,
      borderRadius: ms(17),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: mf(16), ...font.semibold },
    pressed: { opacity: 0.7 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(34,32,29,0.42)', justifyContent: 'flex-end' },
    modalSheet: {
      maxHeight: '92%',
      borderTopLeftRadius: ms(26),
      borderTopRightRadius: ms(26),
      overflow: 'hidden',
    },
    modalContent: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(40) },
  });

export default withFeatureGuard('grocery', ShopScreen);
