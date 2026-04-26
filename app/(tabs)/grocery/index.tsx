import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useGroceryStore, type GroceryItem } from '@stores/groceryStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

// ── Banani design tokens ────────────────────────────────────────────────────────
const SURFACE_BG   = 'rgba(251,248,245,0.96)';
const SHOP_CARD_BG = 'rgba(239,246,255,0.9)';
const SHOP_BORDER  = 'rgba(191,219,254,0.7)';
const SHOP_ACTIVE_BG  = 'rgba(235,255,240,0.95)';
const SHOP_ACTIVE_BORDER = 'rgba(140,210,160,0.7)';

const QUICK_ADDS = ['Milk', 'Bread', 'Trash Bags', 'Coffee', 'Butter', 'Olive Oil'];
const QTY_PRESETS = ['1', '2', '3'];

// ── Category detection ─────────────────────────────────────────────────────────
interface Category { label: string; icon: string; order: number }

const RULES: Array<{ re: RegExp; cat: Category }> = [
  { re: /banana|apple|avocado|tomato|carrot|onion|lettuce|orange|strawberry|grape|cucumber|pepper|lime|lemon|herb|spinach|broccoli|salad/i,
    cat: { label: 'Produce', icon: '🍎', order: 0 } },
  { re: /milk|oat milk|almond milk|egg|cheese|butter|yogurt|cream|dairy/i,
    cat: { label: 'Dairy & Fridge', icon: '🥛', order: 1 } },
  { re: /toilet|soap|trash|bin bag|sponge|paper towel|dish|laundry|detergent|bleach|towel|cleaning/i,
    cat: { label: 'Household', icon: '🧺', order: 2 } },
  { re: /chicken|beef|fish|salmon|tuna|pork|lamb|shrimp|sausage|meat|mince/i,
    cat: { label: 'Meat & Fish', icon: '🥩', order: 3 } },
  { re: /pasta|rice|bread|flour|sugar|salt|olive oil|oil|cereal|oats|coffee|tea|sauce|can|tin/i,
    cat: { label: 'Pantry', icon: '🥫', order: 4 } },
];
const OTHER_CAT: Category = { label: 'Other', icon: '📦', order: 99 };

function detectCategory(name: string): Category {
  return RULES.find((r) => r.re.test(name))?.cat ?? OTHER_CAT;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors.avatar[Math.abs(h) % colors.avatar.length];
}

function elapsedLabel(startedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return 'Just started';
  if (mins < 60) return `${mins} min at the store`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m at the store`;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function UserAvatar({ userId, size = 24 }: { userId: string; size?: number }): React.JSX.Element {
  const housemate = useHousematesStore((s) => s.housemates.find((h) => h.id === userId));
  const avatarUrl = housemate?.avatarUrl;
  const displayName = housemate?.name ?? '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarUrl ? 'transparent' : avatarColor(displayName) }]}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} contentFit="cover" />
        : <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.44) }]}>{displayName[0].toUpperCase()}</Text>
      }
    </View>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: GroceryItem;
  myId: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
}

function ItemRow({ item, myId, onToggle, onDelete, onIncrement, onDecrement }: ItemRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const swipeRef   = useRef<Swipeable>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const qtyNum   = parseInt(item.quantity, 10);
  const hasCount = !isNaN(qtyNum) && qtyNum > 1;
  const bought   = item.boughtCount ?? 0;
  const canDelete = item.addedBy === myId;

  const tap = useCallback((): void => {
    if (!hasCount) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onToggle(item.id);
    }
  }, [hasCount, item.id, onToggle]);

  const handleSwipeDelete = useCallback((): void => {
    if (inFlightRef.current.has(item.id)) return;
    inFlightRef.current.add(item.id);
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Promise.resolve(onDelete(item.id)).finally(() => { inFlightRef.current.delete(item.id); });
  }, [item.id, onDelete]);

  const handleSwipeToggle = useCallback((): void => {
    if (inFlightRef.current.has(item.id)) return;
    inFlightRef.current.add(item.id);
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Promise.resolve(onToggle(item.id)).finally(() => { inFlightRef.current.delete(item.id); });
  }, [item.id, onToggle]);

  const handleDecrement = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    onDecrement(item.id);
  }, [item.id, onDecrement]);

  const handleIncrement = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    onIncrement(item.id);
  }, [item.id, onIncrement]);

  const renderDeleteAction = useCallback((): React.JSX.Element => (
    <Pressable
      accessible
      style={styles.swipeDelete}
      onPress={handleSwipeDelete}
      accessibilityRole="button"
      accessibilityLabel={t('grocery.delete_item')}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.swipeActionText}>{t('common.delete')}</Text>
    </Pressable>
  ), [handleSwipeDelete, t]);

  const renderCheckAction = useCallback((): React.JSX.Element => (
    <Pressable
      accessible
      style={[styles.swipeCheck, item.isChecked && styles.swipeUncheck]}
      onPress={handleSwipeToggle}
      accessibilityRole="button"
      accessibilityLabel={item.isChecked ? t('grocery.mark_as_needed') : t('grocery.mark_as_done')}
    >
      <Ionicons name={item.isChecked ? 'arrow-undo-outline' : 'checkmark'} size={20} color="#fff" />
      <Text style={styles.swipeActionText}>{item.isChecked ? t('common.undo') : t('common.done')}</Text>
    </Pressable>
  ), [item.isChecked, handleSwipeToggle, t]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={canDelete ? renderDeleteAction : undefined}
      renderLeftActions={!hasCount ? renderCheckAction : undefined}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
    >
      <Pressable
        style={[styles.groceryItem, item.isChecked && styles.groceryItemDone]}
        onPress={tap}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        {hasCount ? (
          <View style={styles.counter}>
            <Pressable
              accessible
              onPress={handleDecrement}
              style={[styles.ctrBtn, bought === 0 && styles.ctrBtnOff]}
              accessibilityRole="button"
              accessibilityLabel={`${t('common.delete')} ${item.name}`}
              accessibilityState={{ disabled: bought === 0 }}
            >
              <Text style={styles.ctrBtnText}>−</Text>
            </Pressable>
            <Text style={styles.ctrText}>{bought}/{qtyNum}</Text>
            <Pressable
              accessible
              onPress={handleIncrement}
              style={[styles.ctrBtn, bought >= qtyNum && styles.ctrBtnOff]}
              accessibilityRole="button"
              accessibilityLabel={`+ ${item.name}`}
              accessibilityState={{ disabled: bought >= qtyNum }}
            >
              <Text style={styles.ctrBtnText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.checkCircle, item.isChecked && styles.checkCircleDone]}>
            {item.isChecked && <Text style={styles.checkMark}>✓</Text>}
          </View>
        )}
        <View style={styles.itemDetails}>
          <View style={styles.itemNameWrap}>
            <Text style={[styles.itemName, item.isChecked && styles.itemNameDone]} numberOfLines={1}>
              {item.name}
            </Text>
            {!!item.quantity && (
              <View style={styles.itemQty}>
                <Text style={styles.itemQtyText}>{hasCount ? `x${qtyNum}` : item.quantity}</Text>
              </View>
            )}
          </View>
          <View style={styles.itemAddedBy}>
            <UserAvatar userId={item.addedBy} size={24} />
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
interface SectionData { title: string; icon: string; data: GroceryItem[] }

export default function GroceryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const isLoading    = useGroceryStore((s) => s.isLoading);
  const error        = useGroceryStore((s) => s.error);
  const items        = useGroceryStore((s) => s.items);
  const addItem      = useGroceryStore((s) => s.addItem);
  const toggleItem   = useGroceryStore((s) => s.toggleItem);
  const incBought    = useGroceryStore((s) => s.incrementBought);
  const decBought    = useGroceryStore((s) => s.decrementBought);
  const deleteItem   = useGroceryStore((s) => s.deleteItem);
  const clearChecked = useGroceryStore((s) => s.clearChecked);
  const activeRun    = useGroceryStore((s) => s.activeRun);
  const startRun     = useGroceryStore((s) => s.startRun);
  const endRun       = useGroceryStore((s) => s.endRun);
  const profile      = useAuthStore((s) => s.profile);
  const houseId      = useAuthStore((s) => s.houseId);
  const housemates   = useHousematesStore((s) => s.housemates);
  const myId         = profile?.id ?? '';
  const myName       = profile?.name ?? '';

  const [itemName, setItemName]           = useState('');
  const [qty, setQty]                     = useState('1');
  const [showCustomQty, setShowCustomQty] = useState(false);
  const [customQty, setCustomQty]         = useState('');
  const [isAdding, setIsAdding]           = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [iAmShopping, setIAmShopping]     = useState(false);

  const resolvedQty = showCustomQty ? customQty : qty;

  const pending = useMemo(() => items.filter((i) => !i.isChecked), [items]);
  const checked = useMemo(() => items.filter((i) => i.isChecked),  [items]);

  const sections = useMemo((): SectionData[] => {
    const map = new Map<string, SectionData>();
    for (const item of pending) {
      const cat = detectCategory(item.name);
      if (!map.has(cat.label)) map.set(cat.label, { title: cat.label, icon: cat.icon, data: [] });
      map.get(cat.label)!.data.push(item);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        (RULES.find((r) => r.cat.label === a.title)?.cat.order ?? 99) -
        (RULES.find((r) => r.cat.label === b.title)?.cat.order ?? 99)
    );
  }, [pending]);

  const handleAdd = useCallback(async (quick?: string): Promise<void> => {
    const n = quick ?? itemName.trim();
    if (!n || isAdding) return;
    setIsAdding(true);
    try {
      await addItem(n, quick ? '' : resolvedQty, myId, houseId ?? '');
      setItemName('');
      setQty('1');
      setCustomQty('');
      setShowCustomQty(false);
      if (!quick) setShowForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch { /* ignore */ }
    finally { setIsAdding(false); }
  }, [itemName, resolvedQty, myId, houseId, addItem, isAdding]);

  const openForm  = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowForm(true);
  }, []);

  const closeForm = useCallback((): void => {
    setShowForm(false);
    setItemName('');
    setQty('1');
    setCustomQty('');
    setShowCustomQty(false);
  }, []);

  const handleStartRun = useCallback(async (): Promise<void> => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setIAmShopping(true);
    await startRun(myId, myName);
  }, [startRun, myId, myName]);

  const handleEndRun = useCallback(async (): Promise<void> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIAmShopping(false);
    await endRun();
  }, [endRun]);

  const onToggle = useCallback((id: string): void => { toggleItem(id); }, [toggleItem]);
  const onDelete = useCallback((id: string): void => { deleteItem(id); }, [deleteItem]);
  const onInc    = useCallback((id: string): void => { incBought(id); }, [incBought]);
  const onDec    = useCallback((id: string): void => { decBought(id); }, [decBought]);

  const renderItem = useCallback(
    ({ item }: { item: GroceryItem }): React.JSX.Element => (
      <ItemRow item={item} myId={myId} onToggle={onToggle} onDelete={onDelete} onIncrement={onInc} onDecrement={onDec} />
    ),
    [myId, onToggle, onDelete, onInc, onDec]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => (
      <View style={styles.catTitle}>
        <Text style={styles.catTitleIcon}>{section.icon}</Text>
        <Text style={styles.catTitleText}>{section.title}</Text>
      </View>
    ),
    []
  );

  const isMyRun = iAmShopping && !!activeRun;

  // ── Shopping run card ───────────────────────────────────────────────────────
  const ShoppingRunCard = (): React.JSX.Element => {
    if (activeRun && isMyRun) {
      return (
        <View style={[styles.shoppingRunCard, styles.shoppingRunCardActive]}>
          <View style={[styles.shoppingIcon, styles.shoppingIconActive]}>
            <Text style={styles.shoppingIconText}>🛍️</Text>
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={styles.titleLg}>{"You're at the store"}</Text>
            <Text style={styles.textSm}>{elapsedLabel(activeRun.startedAt)} · Housemates can see the list</Text>
          </View>
          <Pressable style={[styles.btnPrimary, styles.btnFull, styles.btnDanger]} onPress={handleEndRun} accessibilityRole="button">
            <Text style={styles.btnPrimaryText}>Done Shopping</Text>
          </Pressable>
        </View>
      );
    }

    if (activeRun && !isMyRun) {
      return (
        <View style={[styles.shoppingRunCard, styles.shoppingRunCardActive]}>
          <View style={[styles.shoppingIcon, styles.shoppingIconActive]}>
            <Text style={styles.shoppingIconText}>🛍️</Text>
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={styles.titleLg}>{activeRun.shopperName} is at the store!</Text>
            <Text style={styles.textSm}>{"Add last-minute items — they'll see the list update live"}</Text>
          </View>
          <View style={styles.shopperBadge}>
            <UserAvatar userId={activeRun.shopperId} size={28} />
            <Text style={styles.shopperBadgeText}>{elapsedLabel(activeRun.startedAt)}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.shoppingRunCard}>
        <View style={styles.shoppingIcon}>
          <Text style={styles.shoppingIconText}>🛍️</Text>
        </View>
        <View style={styles.shoppingCopy}>
          <Text style={styles.titleLg}>Start a Shopping Run</Text>
          <Text style={styles.textSm}>
            {"Let your housemates know you're at the store so they can add last-minute items."}
          </Text>
        </View>
        <Pressable style={[styles.btnPrimary, styles.btnFull]} onPress={handleStartRun} accessibilityRole="button">
          <Text style={styles.btnPrimaryText}>{"I'm going shopping"}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemSep} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSep} />}

          ListHeaderComponent={
            <View>
              {/* ── Hero card ─────────────────────────────────────────────── */}
              <View style={styles.headerCard}>
                <View style={styles.headerCopy}>
                  <Text style={styles.titleHero}>Shared Groceries</Text>
                  <Text style={styles.textBase}>
                    Add things as you run out. Tick them off at the store.
                  </Text>
                </View>

                {showForm ? (
                  <View style={styles.formWrap}>
                    <TextInput
                      value={itemName}
                      onChangeText={setItemName}
                      placeholder={t('grocery.item_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      style={styles.formInput}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleAdd()}
                    />

                    {/* ── Qty selector ───────────────────────────────────── */}
                    <View style={styles.qtyRow}>
                      <Text style={styles.qtyLabel}>Qty</Text>
                      <View style={styles.qtyPresets}>
                        {QTY_PRESETS.map((p) => {
                          const active = !showCustomQty && qty === p;
                          return (
                            <Pressable
                              key={p}
                              style={[styles.qtyBtn, active && styles.qtyBtnOn]}
                              onPress={() => { setShowCustomQty(false); setQty(p); }}
                              hitSlop={4}
                            >
                              <Text style={[styles.qtyBtnText, active && styles.qtyBtnTextOn]}>{p}</Text>
                            </Pressable>
                          );
                        })}
                        <Pressable
                          style={[styles.qtyBtn, showCustomQty && styles.qtyBtnOn]}
                          onPress={() => { setShowCustomQty(true); setQty(''); }}
                          hitSlop={4}
                        >
                          <Text style={[styles.qtyBtnText, showCustomQty && styles.qtyBtnTextOn]}>✏️</Text>
                        </Pressable>
                      </View>
                      {showCustomQty && (
                        <TextInput
                          value={customQty}
                          onChangeText={setCustomQty}
                          placeholder="e.g. 6"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="number-pad"
                          style={styles.formQty}
                          autoFocus
                        />
                      )}
                    </View>

                    <View style={styles.formBtns}>
                      <Pressable
                        style={[styles.btnPrimary, styles.btnFlex, (!itemName.trim() || isAdding) && styles.btnPrimaryOff]}
                        onPress={() => handleAdd()}
                        disabled={!itemName.trim() || isAdding}
                      >
                        <Text style={styles.btnPrimaryText}>{isAdding ? '…' : '+ Add Item'}</Text>
                      </Pressable>
                      <Pressable onPress={closeForm} style={styles.btnCancel}>
                        <Text style={styles.btnCancelText}>{t('common.cancel')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.headerActions}>
                    <Pressable style={styles.btnPrimary} onPress={openForm} accessibilityRole="button">
                      <Text style={styles.btnPrimaryText}>+ Add Item</Text>
                    </Pressable>
                  </View>
                )}

                {/* ── Quick Add — always visible in card ─────────────────── */}
                <View>
                  <Text style={[styles.eyebrow, styles.quickAddLabel]}>Quick Add</Text>
                  <View style={styles.quickAdds}>
                    {QUICK_ADDS.map((qa) => (
                      <Pressable
                        key={qa}
                        style={styles.quickAddBtn}
                        onPress={() => { Haptics.selectionAsync().catch(() => {}); handleAdd(qa); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${qa}`}
                      >
                        <Text style={styles.quickAddText}>+ {qa}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── Load / error states ──────────────────────────────────── */}
              {isLoading && items.length === 0 && (
                <ActivityIndicator size="small" color="#4F78B6" style={styles.loadingIndicator} />
              )}
              {!!error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              )}

              {/* ── TO BUY section header ─────────────────────────────────── */}
              {pending.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.eyebrow}>To Buy</Text>
                  <View style={styles.pillNeutral}>
                    <Text style={styles.pillNeutralText}>{pending.length} Items</Text>
                  </View>
                </View>
              )}
            </View>
          }

          ListEmptyComponent={
            !showForm ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🛒</Text>
                <Text style={styles.emptyTitle}>{t('grocery.empty')}</Text>
                <Text style={styles.emptyText}>{t('grocery.empty_hint')}</Text>
              </View>
            ) : null
          }

          ListFooterComponent={
            <View style={styles.footer}>
              <ShoppingRunCard />

              {/* ── Recently Checked Off ──────────────────────────────────── */}
              {checked.length > 0 && (
                <View>
                  <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                    <Text style={styles.eyebrow}>Recently Checked Off</Text>
                    <Pressable onPress={() => clearChecked(houseId ?? '')} accessibilityRole="button">
                      <Text style={styles.clearText}>{t('grocery.clear_checked')}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.recentList}>
                    {checked.map((item, i) => (
                      <Pressable
                        key={item.id}
                        style={[styles.recentItem, i === checked.length - 1 && styles.recentItemLast]}
                        onPress={() => onToggle(item.id)}
                      >
                        <View style={styles.recentInfo}>
                          <Text style={styles.recentCheck}>✓</Text>
                          <Text style={styles.recentName}>{item.name}</Text>
                        </View>
                        <Text style={styles.textSm}>By {resolveName(item.addedBy, housemates)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.bottomPad} />
            </View>
          }
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:        { flex: 1 },
  container:   { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },

  // ── Hero card
  headerCard: {
    backgroundColor: SURFACE_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
    marginBottom: 24,
    boxShadow: '0 8px 24px rgba(44,51,61,0.05)',
  } as never,
  headerCopy:    { gap: 6 },
  headerActions: { width: '100%' },

  // Typography
  titleHero: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.78, lineHeight: 31 },
  titleLg:   { fontSize: 18, ...font.bold, color: colors.textPrimary, letterSpacing: -0.36, textAlign: 'center' },
  textBase:  { fontSize: 15, ...font.regular, color: colors.textSecondary, lineHeight: 22 },
  textSm:    { fontSize: 13, ...font.regular, color: colors.textSecondary, lineHeight: 18, textAlign: 'center' },
  eyebrow:   { fontSize: 12, ...font.bold, color: colors.textSecondary, letterSpacing: 0.72, textTransform: 'uppercase' },

  // ── Primary button
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: colors.primary,
    boxShadow: '0 8px 16px rgba(79,120,182,0.18)',
  } as never,
  btnPrimaryOff:  { backgroundColor: colors.textDisabled, boxShadow: 'none' } as never,
  btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#FFFFFF' },
  btnFull:        { alignSelf: 'stretch' },
  btnFlex:        { flex: 1 },
  btnDanger:      { backgroundColor: colors.danger, boxShadow: '0 8px 16px rgba(217,83,79,0.22)' } as never,

  // ── Add form
  formWrap:  { gap: 10 },
  formInput: {
    height: 46, backgroundColor: '#FBFAF8', borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13,
    fontSize: 15, ...font.regular, color: colors.textPrimary,
  },

  // ── Qty selector
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  qtyLabel:   { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  qtyPresets: { flexDirection: 'row', gap: 6 },
  qtyBtn: {
    minWidth: 36, height: 36, borderRadius: 9999, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 10, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  qtyBtnOn:     { backgroundColor: colors.primary, borderColor: colors.primary },
  qtyBtnText:   { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  qtyBtnTextOn: { color: '#FFFFFF' },
  formQty: {
    flex: 1, height: 36, backgroundColor: '#FBFAF8', borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10,
    fontSize: 15, ...font.regular, color: colors.textPrimary, textAlign: 'center',
  },

  formBtns:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnCancel:     { paddingHorizontal: 12, minHeight: 48, justifyContent: 'center' },
  btnCancelText: { fontSize: 14, ...font.regular, color: colors.textSecondary },

  // ── Quick add (inside header card)
  quickAddLabel: { marginBottom: 8 },
  quickAdds:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAddBtn: {
    paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 9999, boxShadow: '0 2px 8px rgba(44,51,61,0.02)',
  } as never,
  quickAddText: { fontSize: 13, ...font.semibold, color: colors.textPrimary },

  // ── Section header
  sectionHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },
  sectionHeaderSpaced: { marginTop: 8 },

  pillNeutral:     { minHeight: 28, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center' },
  pillNeutralText: { fontSize: 12, ...font.bold, color: colors.secondaryForeground },

  catTitle:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  catTitleIcon: { fontSize: 15 },
  catTitleText: { fontSize: 14, ...font.bold, color: colors.textPrimary },

  // ── Grocery item
  groceryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(44,51,61,0.02)',
  } as never,
  groceryItemDone: { backgroundColor: 'rgba(251,248,245,0.4)', borderColor: 'transparent', boxShadow: 'none' } as never,
  itemSep:         { height: 8 },
  sectionSep:      { height: 8 },

  checkCircle:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  checkCircleDone: { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceSecondary },
  checkMark:       { fontSize: 11, ...font.bold, color: colors.textSecondary },

  itemDetails:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 0 },
  itemNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  itemName:     { fontSize: 15, ...font.semibold, color: colors.textPrimary, flexShrink: 1 },
  itemNameDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  itemQty:      { backgroundColor: colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  itemQtyText:  { fontSize: 12, ...font.bold, color: colors.textSecondary },
  itemAddedBy:  { flexShrink: 0 },

  counter:    { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  ctrBtn:     { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ctrBtnOff:  { opacity: 0.3 },
  ctrBtnText: { fontSize: 16, ...font.bold, color: colors.primary, lineHeight: 20 },
  ctrText:    { fontSize: 14, ...font.bold, color: colors.textPrimary, minWidth: 32, textAlign: 'center' },

  avatar:     { justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#FFFFFF', ...font.bold },

  loadingIndicator: { marginBottom: 8 },
  errorBanner: {
    backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  errorBannerText: { fontSize: 13, color: '#D94F4F' },

  emptyWrap:  { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon:  { fontSize: 44 },
  emptyTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  emptyText:  { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center' },

  // ── Footer
  footer: { gap: 20 },

  // ── Shopping run card
  shoppingRunCard: {
    paddingVertical: 24, paddingHorizontal: 20, borderRadius: 20,
    backgroundColor: SHOP_CARD_BG, borderWidth: 1, borderColor: SHOP_BORDER,
    alignItems: 'center', gap: 14,
    boxShadow: '0 12px 32px rgba(44,51,61,0.04)',
  } as never,
  shoppingRunCardActive: { backgroundColor: SHOP_ACTIVE_BG, borderColor: SHOP_ACTIVE_BORDER },
  shoppingIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 8px 20px rgba(44,51,61,0.06)',
  } as never,
  shoppingIconActive: { backgroundColor: 'rgba(220,255,230,0.9)' },
  shoppingIconText: { fontSize: 26 },
  shoppingCopy:     { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  shopperBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  shopperBadgeText: { fontSize: 13, ...font.semibold, color: colors.textPrimary },

  // ── Recently checked off
  recentList:     { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 4 },
  recentItem:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  recentItemLast: { borderBottomWidth: 0 },
  recentInfo:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentCheck:    { fontSize: 16, color: colors.textSecondary },
  recentName:     { fontSize: 14, ...font.medium, color: colors.textSecondary, textDecorationLine: 'line-through' },
  clearText:      { fontSize: 13, ...font.semibold, color: colors.negative },

  bottomPad: { height: 40 },

  // ── Swipe actions
  swipeDelete: {
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
    width: 76, borderRadius: 14, marginLeft: 6, gap: 2,
  },
  swipeCheck: {
    backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center',
    width: 76, borderRadius: 14, marginRight: 6, gap: 2,
  },
  swipeUncheck: { backgroundColor: '#94a3b8' },
  swipeActionText: { fontSize: 11, ...font.semibold, color: '#fff' },
});
