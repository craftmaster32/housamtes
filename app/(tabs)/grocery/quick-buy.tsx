import { useCallback, useMemo } from 'react';
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
import { useAuthStore } from '@stores/authStore';
import { ShoppingCheckout } from '@components/grocery/ShoppingCheckout';
import { EmptyState } from '@components/ui';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

export default function QuickBuyScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';

  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  const handleSaved = useCallback((): void => {
    router.replace('/(tabs)/grocery');
  }, []);

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
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
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
