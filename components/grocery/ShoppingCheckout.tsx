import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, TextInput as RNTextInput, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
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
import { parseAmount } from '@utils/validation';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

interface ShoppingCheckoutProps {
  houseId: string;
  myId: string;
  myName: string;
  defaultTitle: string;
  /** Small note shown above the form (e.g. "3 items in your cart"). */
  headerNote?: string;
  /** Called after the expense is saved successfully. */
  onSaved: () => void;
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
  const [receipt, setReceipt] = useState<ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = parseAmount(amount);
  const perPerson = useMemo((): number => {
    if (selectedPeople.length === 0 || totalAmount <= 0) return 0;
    const totalCents = Math.round(totalAmount * 100);
    const n = selectedPeople.length;
    const baseCents = Math.floor(totalCents / n);
    const remainderCents = totalCents - baseCents * n;
    return (baseCents + (remainderCents > 0 ? 1 : 0)) / 100;
  }, [totalAmount, selectedPeople]);

  const togglePerson = useCallback((id: string): void => {
    setError('');
    setSelectedPeople((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  const attachAsset = useCallback((asset: ImagePickerAsset): void => {
    setReceipt(asset);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const takePhoto = useCallback(async (): Promise<void> => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      setError(t('grocery.shop.camera_denied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) attachAsset(result.assets[0]);
  }, [attachAsset, t]);

  const pickFromLibrary = useCallback(async (): Promise<void> => {
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
    const trimmedTitle = title.trim() || defaultTitle;
    if (totalAmount <= 0) {
      setError(t('grocery.shop.enter_amount'));
      return;
    }
    if (!paidBy || selectedPeople.length === 0) {
      setError(t('grocery.shop.pick_split'));
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
          caption: trimmedTitle,
          uploadedBy: myName,
          userId: myId,
          houseId,
        });
      }
      await addBill(
        {
          title: trimmedTitle,
          amount: totalAmount,
          paidBy,
          splitBetween: selectedPeople,
          splitAmounts: null,
          category: 'Groceries',
          date: todayString(),
          receiptUrl,
        },
        houseId
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, t('grocery.shop.save_failed')));
      setIsSaving(false);
    }
  }, [
    isSaving,
    title,
    defaultTitle,
    totalAmount,
    paidBy,
    selectedPeople,
    receipt,
    uploadReceipt,
    myName,
    myId,
    houseId,
    addBill,
    onSaved,
    t,
  ]);

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
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {h.id === myId ? t('common.me') : h.name}
                </Text>
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
                <Text style={[styles.chipText, checked && styles.chipTextOn]}>
                  {h.id === myId ? t('common.me') : h.name}
                </Text>
                {checked && <Ionicons name="checkmark" size={14} color={C.primary} />}
              </Pressable>
            );
          })}
        </View>
        {perPerson > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              {formatFull(perPerson, currencyCode)} {t('bills.per_person')}
            </Text>
          </View>
        )}
      </View>

      {/* Receipt */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('grocery.shop.receipt')}</Text>
        {receipt ? (
          <View style={styles.receiptRow}>
            <Image source={{ uri: receipt.uri }} style={styles.receiptThumb} />
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
    previewBox: {
      backgroundColor: C.primaryTint,
      borderRadius: ms(14),
      paddingVertical: ms(12),
      paddingHorizontal: sizes.md,
      alignItems: 'center',
      marginTop: sizes.xs,
    },
    previewText: { color: C.primary, ...font.bold, fontSize: mf(16) },
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
