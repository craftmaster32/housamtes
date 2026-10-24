import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput as RNTextInput,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { SplitSummary } from '@components/bills/form/SplitSummary';
import { SplitSheet } from '@components/bills/form/SplitSheet';
import { BillSplitFields } from '@components/bills/BillSplitFields';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors } from '@constants/colors';
import { formatFull, splitMoney } from '@constants/currencies';
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
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();

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

  const setPersonAmount = useCallback((id: string, value: string): void => {
    setCustomAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);
  const setPersonPercent = useCallback((id: string, value: string): void => {
    setPercentAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);

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

  const [showSplit, setShowSplit] = useState(false);
  const openSplit = useCallback((): void => setShowSplit(true), []);
  const closeSplit = useCallback((): void => setShowSplit(false), []);
  const handleSelectedPeople = useCallback((ids: string[]): void => {
    setError('');
    setSelectedPeople(ids);
  }, []);
  const handleSplitType = useCallback((type: SplitType): void => {
    setError('');
    setSplitType(type);
  }, []);
  const payerName =
    paidBy === myId ? t('common.me') : (housemates.find((h) => h.id === paidBy)?.name ?? '');

  // The same money look as a new bill: total on notebook paper, the title on a
  // line, and the Splitwise-style sentence that opens the full split options.
  return (
    <View style={styles.container}>
      {!!headerNote && <Text style={[styles.headerNote, hand]}>{headerNote}</Text>}

      <NotebookPaper>
        <Text style={[styles.amountLabel, { color: C.paperMuted }]}>
          {t('grocery.shop.total_spent')}
        </Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amountCur, headingFont, { color: C.paperMuted }]}>{curSymbol}</Text>
          <RNTextInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              setError('');
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.paperMuted}
            underlineColorAndroid="transparent"
            style={[styles.amountInput, headingFont, { color: C.paperInk }]}
            accessibilityLabel={t('grocery.shop.total_spent')}
            accessibilityHint={t('bills.enter_valid_amount')}
          />
        </View>
      </NotebookPaper>

      <UnderlineInput
        label={t('grocery.shop.what_for')}
        value={title}
        onChangeText={setTitle}
        placeholder={defaultTitle}
        accessibilityLabel={t('grocery.shop.what_for')}
      />

      {/* Optional: clear on-list items you just bought (Quick Buy) */}
      {selectableItems && selectableItems.length > 0 && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: C.textSecondary }]}>
            {t('grocery.shop.on_list')}
          </Text>
          <Text style={[styles.subLabel, { color: C.textSecondary }]}>
            {t('grocery.shop.on_list_hint')}
          </Text>
          {selectableItems.map((it) => {
            const on = boughtItemIds.includes(it.id);
            return (
              <Pressable
                key={it.id}
                style={[styles.pickRow, { borderBottomColor: C.border }]}
                onPress={() => toggleBoughtItem(it.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={it.name}
              >
                <View style={[styles.box, { borderColor: C.textSecondary }]}>
                  {on && (
                    <Svg width={ms(24)} height={ms(24)} viewBox="0 0 26 26" style={styles.tick}>
                      <Path
                        d="M4 13 L10.5 20 L23 3"
                        stroke={C.primary}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  )}
                </View>
                <Text style={[styles.pickName, { color: C.textPrimary }]} numberOfLines={1}>
                  {it.name}
                </Text>
                {!!it.quantity && it.quantity !== '1' && (
                  <Text style={[styles.pickQty, hand, { color: C.primary }]}>{it.quantity}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <SplitSummary
        payerId={paidBy}
        payerName={payerName}
        splitType={splitType}
        peopleCount={selectedPeople.length}
        totalAmount={totalAmount}
        currencyCode={currencyCode}
        onOpen={openSplit}
      />

      {/* Receipt photo */}
      {receipt ? (
        <View style={styles.receiptRow}>
          <Image
            source={{ uri: receipt.uri }}
            style={styles.receiptThumb}
            contentFit="cover"
            accessibilityLabel={t('grocery.shop.receipt')}
          />
          <View style={styles.receiptCopy}>
            <Text style={[styles.receiptAttached, { color: C.textPrimary }]}>
              {t('grocery.shop.receipt_attached')}
            </Text>
            <Pressable
              onPress={() => setReceipt(null)}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.shop.remove_receipt')}
              style={styles.receiptRemove}
            >
              <Text style={[styles.receiptRemoveText, { color: C.negative }]}>
                {t('grocery.shop.remove_receipt')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={handleAddReceipt}
          style={({ pressed }) => [
            styles.receiptAdd,
            { borderColor: C.textTertiary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.shop.add_receipt')}
        >
          <Ionicons name="camera-outline" size={20} color={C.textSecondary} />
          <Text style={[styles.receiptAddText, { color: C.textSecondary }]}>
            {t('grocery.shop.add_receipt')}
          </Text>
        </Pressable>
      )}

      {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

      <Pressable
        onPress={() => void handleSave()}
        disabled={isSaving || totalAmount <= 0 || selectedPeople.length === 0}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: C.primary },
          (pressed || isSaving || totalAmount <= 0 || selectedPeople.length === 0) && styles.dim,
        ]}
        accessible
        accessibilityRole="button"
        accessibilityState={{
          disabled: isSaving || totalAmount <= 0 || selectedPeople.length === 0,
        }}
        accessibilityLabel={t('grocery.shop.save_expense')}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveText}>{t('grocery.shop.save_expense')}</Text>
        )}
      </Pressable>

      <SplitSheet
        visible={showSplit}
        eyebrow={
          totalAmount > 0 ? formatFull(totalAmount, currencyCode) : t('grocery.shop.checkout')
        }
        onClose={closeSplit}
      >
        <BillSplitFields
          housemates={housemates}
          myId={myId}
          currencyCode={currencyCode}
          totalAmount={totalAmount}
          paidBy={paidBy}
          onPaidByChange={setPaidBy}
          selectedPeople={selectedPeople}
          onSelectedPeopleChange={handleSelectedPeople}
          splitType={splitType}
          onSplitTypeChange={handleSplitType}
          customAmounts={customAmounts}
          onCustomAmountChange={setPersonAmount}
          percentAmounts={percentAmounts}
          onPercentAmountChange={setPersonPercent}
        />
      </SplitSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: ms(18) },
  headerNote: { fontSize: mf(20) },
  amountLabel: { fontSize: mf(13.5), ...font.bold },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: ms(6), marginTop: ms(4) },
  amountCur: { fontSize: mf(28) },
  amountInput: { flex: 1, minWidth: 0, fontSize: mf(46), paddingVertical: 0 },
  field: { gap: ms(4) },
  label: { fontSize: mf(13.5), ...font.bold },
  subLabel: { fontSize: mf(13), ...font.regular, marginBottom: ms(4) },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    minHeight: 48,
    borderBottomWidth: 1.5,
  },
  box: {
    width: ms(22),
    height: ms(22),
    borderWidth: 2.2,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: 0, top: -ms(9) },
  pickName: { flex: 1, fontSize: mf(15.5), ...font.semibold },
  pickQty: { fontSize: mf(20), writingDirection: 'ltr' },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  receiptThumb: { width: ms(56), height: ms(56), borderRadius: ms(10) },
  receiptCopy: { flex: 1, gap: ms(2) },
  receiptAttached: { fontSize: mf(14.5), ...font.semibold },
  receiptRemove: { minHeight: 36, justifyContent: 'center' },
  receiptRemoveText: { fontSize: mf(13.5), ...font.semibold },
  receiptAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    minHeight: 56,
    paddingHorizontal: ms(14),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: ms(16),
  },
  receiptAddText: { fontSize: mf(15), ...font.semibold },
  error: { fontSize: mf(13) },
  saveBtn: { minHeight: 52, borderRadius: ms(17), alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
