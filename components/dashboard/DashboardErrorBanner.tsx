import { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore } from '@stores/billsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

// Surfaces load failures from the stores the dashboard widgets read; the
// widgets themselves only render data and have nowhere to show an error.
export const DashboardErrorBanner: React.FC = () => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const houseId = useAuthStore((s) => s.houseId);
  const billsError = useBillsStore((s) => s.error);
  const parkingError = useParkingStore((s) => s.error);
  const groceryError = useGroceryStore((s) => s.error);
  const choresError = useChoresStore((s) => s.error);
  const housematesError = useHousematesStore((s) => s.error);

  const hasError = Boolean(
    billsError ?? parkingError ?? groceryError ?? choresError ?? housematesError
  );

  const handleRetry = useCallback(() => {
    if (!houseId) return;
    if (useBillsStore.getState().error) useBillsStore.getState().load(houseId);
    if (useParkingStore.getState().error) useParkingStore.getState().load(houseId);
    if (useGroceryStore.getState().error) useGroceryStore.getState().load(houseId);
    if (useChoresStore.getState().error) useChoresStore.getState().load(houseId);
    if (useHousematesStore.getState().error) useHousematesStore.getState().load(houseId);
  }, [houseId]);

  if (!hasError) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t('dashboard.load_error')}</Text>
      <Pressable
        onPress={handleRetry}
        style={styles.retryBtn}
        hitSlop={8}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
      >
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
};

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      backgroundColor: C.danger + '15',
      borderWidth: 1,
      borderColor: C.danger + '40',
      borderRadius: 12,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      marginBottom: sizes.sm,
    },
    text: { flex: 1, fontSize: sizes.fontSm, ...font.regular, color: C.danger },
    retryBtn: {
      paddingHorizontal: sizes.sm,
      paddingVertical: 6,
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: C.danger + '20',
    },
    retryText: { fontSize: sizes.fontSm, ...font.semibold, color: C.danger },
  });
}
