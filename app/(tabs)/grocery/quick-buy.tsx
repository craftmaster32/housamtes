import { useCallback, useMemo } from 'react';
import { useFeatureGuard } from '@hooks/useFeatureGuard';
import {
  View,
  StyleSheet,
  Pressable,
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
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useGroceryStore } from '@stores/groceryStore';
import { ShoppingCheckout, type CheckoutItem } from '@components/grocery/ShoppingCheckout';
import { EmptyState } from '@components/ui';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

export default function QuickBuyScreen(): React.JSX.Element {
  useFeatureGuard('grocery');
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';

  const items = useGroceryStore((s) => s.items);
  const deleteItem = useGroceryStore((s) => s.deleteItem);

  // Items the shopper could be buying right now: still-unbought shared items
  // plus their own private ones. Ticking one in the checkout removes it so a
  // quick one-off purchase doesn't leave the item on the list for someone else.
  const selectableItems = useMemo<CheckoutItem[]>(
    () =>
      items
        .filter((i) => !i.isChecked && (!i.isPersonal || i.addedBy === myId))
        .map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
    [items, myId]
  );

  const handleBack = useCallback((): void => {
    goBack();
  }, []);

  const handleSaved = useCallback(
    async (boughtItemIds: string[]): Promise<void> => {
      // The expense is already saved. Finish removing the items you ticked as
      // bought before leaving, so navigation can't unmount mid-delete. If any
      // removal fails, tell the shopper the item is still on the list (the
      // expense itself is fine) before returning to the list.
      const results = await Promise.allSettled(boughtItemIds.map((id) => deleteItem(id)));
      if (results.some((r) => r.status === 'rejected')) {
        Alert.alert(t('grocery.shop.default_title'), t('grocery.shop.cleanup_failed'));
      }
      router.replace('/(tabs)/grocery');
    },
    [deleteItem, t]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.iconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="chevron-back" size={22} color={C.primary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, headingFont]}>{t('grocery.shop.quick_buy')}</Text>
            <Text style={styles.headerSub}>{t('grocery.shop.quick_buy_hint')}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {houseId ? (
            <ShoppingCheckout
              houseId={houseId}
              myId={myId}
              myName={myName}
              defaultTitle={t('grocery.shop.default_title')}
              selectableItems={selectableItems}
              onSaved={handleSaved}
            />
          ) : (
            <EmptyState mode="error" icon="alert-circle-outline" title={t('common.error')} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    content: { padding: sizes.lg, paddingBottom: ms(40) },
  });
