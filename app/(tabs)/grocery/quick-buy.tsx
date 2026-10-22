import { useCallback, useMemo } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useGroceryStore } from '@stores/groceryStore';
import { ShoppingCheckout, type CheckoutItem } from '@components/grocery/ShoppingCheckout';
import { EmptyState } from '@components/ui';
import { BackLink } from '@components/shared/BackLink';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

function QuickBuyScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');

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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackLink label={t('common.back')} />
          <Text style={[styles.title, headingFont]} accessibilityRole="header">
            {t('grocery.shop.quick_buy')}
          </Text>
          <Text style={styles.sub}>{t('grocery.shop.quick_buy_hint')}</Text>
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

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    title: {
      fontSize: mf(36),
      // Tall enough for the descenders, so no letter is clipped.
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    sub: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(20),
      marginBottom: ms(18),
    },
    content: { paddingHorizontal: ms(20), paddingTop: ms(4), paddingBottom: ms(40) },
  });

export default withFeatureGuard('grocery', QuickBuyScreen);
