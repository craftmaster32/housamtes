import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, TextInput as RNTextInput } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { z } from 'zod';
import { Alert } from '@lib/alert';
import { useBillsStore } from '@stores/billsStore';
import { usePhotoStore } from '@stores/photoStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { UserAvatar } from '@components/shared/UserAvatar';
import { Button } from '@components/ui';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull, splitMoney } from '@constants/currencies';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { parseAmount, parseAndValidateAddBill, type AddBillPayload } from '@utils/validation';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

type SplitType = 'equal' | 'custom' | 'percentage';

/** An on-list item the shopper can mark as bought so it leaves the list on save. */
export interface CheckoutItem {
  id: string;
  name: string;
  quantity: string;
}

interface ShoppingCheckoutProps {
  houseId: string;
  myId: string;
  myName: string;
  defaultTitle: string;
  /** Small note shown above the form (e.g. "3 items in your cart"). */
  headerNote?: string;
  /**
   * List items the shopper can tick as "bought right now". Ticked ids are
   * passed to onSaved so the caller can remove them from the list. Used by
   * Quick Buy so a one-off purchase still clears the shared list.
   */
  selectableItems?: CheckoutItem[];
  /** Called after the expense is saved. Receives the ids ticked as bought. */
  onSaved: (boughtItemIds: string[]) => void;
}

function todayString(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const ShoppingCheckout: React.FC<ShoppingCheckoutProps> = ({
  houseId,
  myId,
  myName,
  defaultTitle,
  headerNote,
  selectableItems,
  onSaved,
}) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const housemates = useHousematesStore((s) => s.housemates);
  const addBill = useBillsStore((s) => s.addBill);
  const uploadReceipt = usePhotoStore((s) => s.uploadReceipt);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const curSymbol = useMemo(() => splitMoney(0, currencyCode).symbol, [currencyCode]);

  const allIds = useMemo(() => housemates.map((h) => h.id), [housemates]);
  const [title, setTitle] = useState(defaultTitle);
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(myId || allIds[0] || '');
  const [selectedPeople, setSelectedPeople] = useState<string[]>(allIds);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentAmounts, setPercentAmounts] = useState<Record<string, string>>({});
  const [boughtItemIds, setBoughtItemIds] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = parseAmount(amount);

  const equalPerPerson = useMemo((): number => {
    if (selectedPeople.length === 0 || totalAmount <= 0) return 0;
    const totalCents = Math.round(totalAmount * 100);
    const n = selectedPeople.length;
    const baseCents = Math.floor(totalCents / n);
    const remainderCents = totalCents - baseCents * n;
    return (baseCents + (remainderCents > 0 ? 1 : 0)) / 100;
  }, [totalAmount, selectedPeople]);

  const customTotal = useMemo(
    () => selectedPeople.reduce((sum, id) => sum + parseAmount(customAmounts[id] ?? '0'), 0),
    [selectedPeople, customAmounts]
  );
  const percentTotal = useMemo(
    () => selectedPeople.reduce((sum, id) => sum + parseAmount(percentAmounts[id] ?? '0'), 0),
    [selectedPeople, percentAmounts]
  );
  const customRemaining = totalAmount - customTotal;

  const togglePerson = useCallback((id: string): void => {
    setError('');
    setSelectedPeople((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  const setPersonAmount = useCallback((id: string, value: string): void => {
    setCustomAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);
  const setPersonPercent = useCallback((id: string, value: string): void => {
    setPercentAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);

  const fillEquallyCustom = useCallback((): void => {
    const blanks = selectedPeople.filter((id) => !customAmounts[id]);
    if (blanks.length === 0 || customRemaining < 0.01) return;
    setError('');
    let allocated = 0;
    const per = customRemaining / blanks.length;
    setCustomAmounts((prev) => {
      const next = { ...prev };
      blanks.forEach((id, i) => {
        const isLast = i === blanks.length - 1;
        const share = isLast
          ? Math.round((customRemaining - allocated) * 100) / 100
          : Math.round(per * 100) / 100;
        next[id] = share.toFixed(2);
        if (!isLast) allocated += share;
      });
      return next;
    });
  }, [selectedPeople, customAmounts, customRemaining]);

  const toggleBoughtItem = useCallback((id: string): void => {
    Haptics.selectionAsync().catch(() => {});
    setBoughtItemIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  const attachAsset = useCallback((asset: ImagePickerAsset): void => {
    setReceipt(asset);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const takePhoto = useCallback(async (): Promise<void> => {
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        setError(t('grocery.shop.camera_denied'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) attachAsset(result.assets[0]);
    } catch {
      setError(t('grocery.shop.camera_failed'));
    }
  }, [attachAsset, t]);

  const pickFromLibrary = useCallback(async (): Promise<void> => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        setError(t('grocery.shop.library_denied'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) attachAsset(result.assets[0]);
    } catch {
      setError(t('grocery.shop.camera_failed'));
    }
  }, [attachAsset, t]);

  const handleAddReceipt = useCallback((): void => {
    setError('');
    Alert.alert(t('grocery.shop.add_receipt'), t('grocery.shop.add_receipt_hint'), [
      { text: t('grocery.shop.take_photo'), onPress: (): void => void takePhoto() },
      { text: t('grocery.shop.choose_photo'), onPress: (): void => void pickFromLibrary() },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [t, takePhoto, pickFromLibrary]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (isSaving) return;

    // A picked-from-list purchase names itself; otherwise fall back to the
    // typed title (or the default).
    const picked = (selectableItems ?? []).filter((it) => boughtItemIds.includes(it.id));
    const typed = title.trim();
    const finalTitle =
      typed && typed !== defaultTitle
        ? typed
        : picked.map((p) => p.name).join(', ') || defaultTitle;

    let payload: AddBillPayload;
    try {
      payload = parseAndValidateAddBill({
        title: finalTitle,
        amount,
        paidBy,
        selectedPeople,
        splitType,
        customAmounts,
        percentAmounts,
        category: 'Groceries',
        date: todayString(),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.errors[0];
        const params =
          first.code === 'custom'
            ? ((first as z.ZodCustomIssue).params as Record<string, string | number>)
            : undefined;
        setError(t(first.message, params));
      } else {
        setError(t('grocery.shop.save_failed'));
      }
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      let receiptUrl: string | null = null;
      if (receipt) {
        receiptUrl = await uploadReceipt({
          localUri: receipt.uri,
          fileName: receipt.fileName ?? `receipt_${Date.now()}.jpg`,
          mimeType: receipt.mimeType ?? 'image/jpeg',
          caption: finalTitle,
          uploadedBy: myName,
          userId: myId,
          houseId,
        });
      }
      await addBill({ ...payload, receiptUrl }, houseId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved(boughtItemIds);
    } catch (err) {
      setError(getErrorMessage(err, t('grocery.shop.save_failed')));
      setIsSaving(false);
    }
  }, [
    isSaving,
    selectableItems,
    boughtItemIds,
    title,
    defaultTitle,
    amount,
    paidBy,
    selectedPeople,
    splitType,
    customAmounts,
    percentAmounts,
    receipt,
    uploadReceipt,
    myName,
    myId,
    houseId,
    addBill,
    onSaved,
    t,
  ]);

  const nameOf = useCallback(
    (id: string): string =>
      id === myId ? t('common.me') : (housemates.find((h) => h.id === id)?.name ?? ''),
    [housemates, myId, t]
  );

  return (
    <View style={styles.container}>
      {!!headerNote && <Text style={styles.headerNote}>{headerNote}</Text>}

      {/* Amount */}
      <View style={styles.amountHero}>
        <Text style={styles.amountLabel}>{t('grocery.shop.total_spent')}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountCur}>{curSymbol}</Text>
          <RNTextInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              setError('');
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.textTertiary}
            style={styles.amountInput}
            accessibilityLabel={t('grocery.shop.total_spent')}
            accessibilityHint={t('bills.enter_valid_amount')}
          />
        </View>
      </View>

      {/* Title */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('grocery.shop.what_for')}</Text>
        <RNTextInput
          value={title}
          onChangeText={setTitle}
          placeholder={defaultTitle}
          placeholderTextColor={C.textTertiary}
          style={styles.titleInput}
          accessibilityLabel={t('grocery.shop.what_for')}
        />
      </View>

      {/* Optional: clear on-list items you just bought (Quick Buy) */}
      {selectableItems && selectableItems.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>{t('grocery.shop.on_list')}</Text>
          <Text style={styles.subLabel}>{t('grocery.shop.on_list_hint')}</Text>
          <View style={styles.pickWrap}>
            {selectableItems.map((it) => {
              const on = boughtItemIds.includes(it.id);
              return (
                <Pressable
                  key={it.id}
                  style={[styles.pickRow, on && styles.pickRowOn]}
                  onPress={() => toggleBoughtItem(it.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={it.name}
                >
                  <View style={[styles.pickCheck, on && styles.pickCheckOn]}>
                    {on && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={[styles.pickName, on && styles.pickNameOn]} numberOfLines={1}>
                    {it.name}
                  </Text>
                  {!!it.quantity && it.quantity !== '1' && (
                    <Text style={styles.pickQty}>{it.quantity}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Who paid */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('bills.who_paid')}</Text>
        <View style={styles.chipRow}>
          {housemates.map((h) => {
            const selected = paidBy === h.id;
            return (
              <Pressable
                key={h.id}
                style={[styles.chip, selected && styles.chipOn]}
                onPress={() => setPaidBy(h.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <UserAvatar userId={h.id} size={22} />
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>{nameOf(h.id)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Split between */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('bills.split_between')}</Text>
        <View style={styles.chipRow}>
          {housemates.map((h) => {
            const checked = selectedPeople.includes(h.id);
            return (
              <Pressable
                key={h.id}
                style={[styles.chip, checked && styles.chipOn]}
                onPress={() => togglePerson(h.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <UserAvatar userId={h.id} size={22} />
                <Text style={[styles.chipText, checked && styles.chipTextOn]}>{nameOf(h.id)}</Text>
                {checked && <Ionicons name="checkmark" size={14} color={C.primary} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* How to split */}
      {selectedPeople.length > 1 && (
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.how_to_split')}</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {(['equal', 'custom', 'percentage'] as const).map((type) => {
              const on = splitType === type;
              const labelKey =
                type === 'equal'
                  ? 'bills.equal'
                  : type === 'custom'
                    ? 'bills.custom_short'
                    : 'bills.by_percent';
              return (
                <Pressable
                  key={type}
                  style={[styles.segItem, on && styles.segItemOn]}
                  onPress={() => {
                    setSplitType(type);
                    setError('');
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(labelKey)}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {splitType === 'equal' && totalAmount > 0 && (
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>
                {formatFull(equalPerPerson, currencyCode)} {t('bills.per_person')}
              </Text>
            </View>
          )}

          {splitType === 'custom' && (
            <View style={styles.customBox}>
              {selectedPeople.map((id) => (
                <View key={id} style={styles.customRow}>
                  <Text style={styles.customName} numberOfLines={1}>
                    {nameOf(id)}
                  </Text>
                  <RNTextInput
                    value={customAmounts[id] ?? ''}
                    onChangeText={(v) => setPersonAmount(id, v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.textTertiary}
                    style={styles.splitInput}
                    accessibilityLabel={t('bills.amount_for', { name: nameOf(id) })}
                  />
                </View>
              ))}
              {customRemaining > 0.01 && (
                <Pressable
                  onPress={fillEquallyCustom}
                  style={styles.fillBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="git-branch-outline" size={13} color={C.primary} />
                  <Text style={styles.fillBtnText}>{t('bills.fill_remaining_equally')}</Text>
                </Pressable>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('bills.total_entered')}</Text>
                <Text
                  style={[
                    styles.totalValue,
                    { color: Math.abs(customTotal - totalAmount) < 0.01 ? C.positive : C.danger },
                  ]}
                >
                  {formatFull(customTotal, currencyCode)} / {formatFull(totalAmount, currencyCode)}
                </Text>
              </View>
            </View>
          )}

          {splitType === 'percentage' && (
            <View style={styles.customBox}>
              {selectedPeople.map((id) => (
                <View key={id} style={styles.customRow}>
                  <Text style={styles.customName} numberOfLines={1}>
                    {nameOf(id)}
                  </Text>
                  <View style={styles.pctRow}>
                    <RNTextInput
                      value={percentAmounts[id] ?? ''}
                      onChangeText={(v) => setPersonPercent(id, v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={C.textTertiary}
                      style={styles.splitInput}
                      accessibilityLabel={t('bills.pct_for', { name: nameOf(id) })}
                    />
                    <Text style={styles.pctSymbol}>%</Text>
                  </View>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('bills.total_percent')}</Text>
                <Text
                  style={[
                    styles.totalValue,
                    { color: Math.abs(percentTotal - 100) < 0.1 ? C.positive : C.danger },
                  ]}
                >
                  {percentTotal.toFixed(1)}% / 100%
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Receipt */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('grocery.shop.receipt')}</Text>
        {receipt ? (
          <View style={styles.receiptRow}>
            <Image
              source={{ uri: receipt.uri }}
              style={styles.receiptThumb}
              contentFit="cover"
              accessibilityLabel={t('grocery.shop.receipt')}
            />
            <View style={styles.receiptCopy}>
              <Text style={styles.receiptAttached}>{t('grocery.shop.receipt_attached')}</Text>
              <Pressable
                onPress={() => setReceipt(null)}
                accessibilityRole="button"
                accessibilityLabel={t('grocery.shop.remove_receipt')}
                style={styles.receiptRemove}
              >
                <Ionicons name="trash-outline" size={15} color={C.danger} />
                <Text style={styles.receiptRemoveText}>{t('grocery.shop.remove_receipt')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={handleAddReceipt}
            style={styles.receiptAdd}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.add_receipt')}
          >
            <Ionicons name="camera-outline" size={20} color={C.primary} />
            <Text style={styles.receiptAddText}>{t('grocery.shop.add_receipt')}</Text>
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        variant="primary"
        onPress={handleSave}
        loading={isSaving}
        disabled={isSaving || totalAmount <= 0 || selectedPeople.length === 0}
        fullWidth
        size="lg"
        style={styles.saveBtn}
      >
        {t('grocery.shop.save_expense')}
      </Button>
    </View>
  );
};

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    container: { gap: sizes.md },
    headerNote: { color: C.textSecondary, fontSize: mf(14), ...font.medium },
    amountHero: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(18),
      paddingHorizontal: sizes.lg,
      paddingTop: ms(14),
      paddingBottom: ms(12),
    },
    amountLabel: {
      fontSize: mf(12),
      ...font.bold,
      letterSpacing: 0.6,
      color: C.textTertiary,
      textTransform: 'uppercase',
    },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: ms(6), marginTop: ms(6) },
    amountCur: { fontSize: mf(26), color: C.textSecondary, ...font.bold },
    amountInput: {
      flex: 1,
      fontSize: mf(40),
      color: C.textPrimary,
      letterSpacing: -1,
      padding: 0,
      margin: 0,
      ...font.bold,
    },
    field: { gap: sizes.xs },
    label: { color: C.textPrimary, ...font.semibold, fontSize: mf(14) },
    subLabel: { color: C.textSecondary, ...font.regular, fontSize: mf(12), marginTop: -2 },
    titleInput: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(10),
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      minHeight: ms(48),
      fontSize: mf(15),
      color: C.textPrimary,
    },
    // Item picker (Quick Buy)
    pickWrap: { gap: ms(6) },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(10),
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(12),
      paddingVertical: ms(11),
      paddingHorizontal: ms(13),
      minHeight: ms(48),
    },
    pickRowOn: { borderColor: C.primary, backgroundColor: C.primaryTint },
    pickCheck: {
      width: ms(22),
      height: ms(22),
      borderRadius: ms(11),
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickCheckOn: { backgroundColor: C.primary, borderColor: C.primary },
    pickName: { flex: 1, fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    pickNameOn: { color: C.primary },
    pickQty: { fontSize: mf(12), ...font.medium, color: C.textSecondary },
    // Chips
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(7),
      paddingVertical: ms(6),
      paddingStart: ms(6),
      paddingEnd: ms(13),
      minHeight: ms(44),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    chipOn: { borderColor: C.primary, backgroundColor: C.primaryTint },
    chipText: { color: C.textPrimary, fontSize: mf(14), ...font.semibold },
    chipTextOn: { color: C.primary },
    // Split-type segment
    segment: {
      flexDirection: 'row',
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(12),
      padding: ms(4),
      gap: ms(4),
    },
    segItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: ms(9),
      minHeight: ms(44),
      borderRadius: ms(9),
    },
    segItemOn: { backgroundColor: C.primary },
    segText: { fontSize: mf(13), ...font.semibold, color: C.textSecondary },
    segTextOn: { color: '#fff' },
    previewBox: {
      backgroundColor: C.primaryTint,
      borderRadius: ms(13),
      paddingVertical: ms(11),
      alignItems: 'center',
      marginTop: sizes.xs,
    },
    previewText: { color: C.primary, ...font.bold, fontSize: mf(15) },
    customBox: {
      backgroundColor: C.surface,
      borderRadius: ms(12),
      padding: sizes.md,
      gap: sizes.sm,
      borderWidth: 1,
      borderColor: C.border,
      marginTop: sizes.xs,
    },
    customRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    customName: { flex: 1, color: C.textPrimary, fontSize: mf(14), ...font.medium },
    splitInput: {
      width: ms(100),
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(8),
      paddingHorizontal: ms(12),
      paddingVertical: ms(9),
      minHeight: ms(44),
      fontSize: mf(14),
      color: C.textPrimary,
      textAlign: 'right',
    },
    pctRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
    pctSymbol: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    fillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      alignSelf: 'flex-start',
      paddingVertical: ms(8),
      paddingHorizontal: ms(10),
      borderRadius: ms(8),
      borderWidth: 1,
      borderColor: C.primary + '40',
      backgroundColor: C.primary + '08',
      minHeight: ms(44),
    },
    fillBtnText: { color: C.primary, fontSize: mf(13), ...font.semibold },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: sizes.xs,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    totalLabel: { color: C.textSecondary, fontSize: mf(14), ...font.medium },
    totalValue: { fontSize: mf(14), ...font.semibold },
    // Receipt
    receiptAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      paddingVertical: ms(14),
      borderRadius: ms(12),
      borderWidth: 1.5,
      borderStyle: 'dashed' as const,
      borderColor: C.primary + '66',
      backgroundColor: C.primary + '08',
      minHeight: ms(52),
    },
    receiptAddText: { color: C.primary, fontSize: mf(15), ...font.semibold },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.md,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: ms(12),
      padding: ms(10),
    },
    receiptThumb: { width: ms(56), height: ms(56), borderRadius: ms(8), backgroundColor: C.border },
    receiptCopy: { flex: 1, gap: ms(4) },
    receiptAttached: { color: C.textPrimary, fontSize: mf(14), ...font.semibold },
    receiptRemove: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
    receiptRemoveText: { color: C.danger, fontSize: mf(13), ...font.medium },
    error: { color: C.danger, fontSize: mf(14), ...font.regular },
    saveBtn: { marginTop: sizes.xs },
  });
