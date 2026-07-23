import { useRef, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated, Switch } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useEntitlementsStore, PREMIUM_FEATURES } from '@stores/entitlementsStore';
import { PREMIUM_ENABLED } from '@constants/featureFlags';

// Paywall / upgrade screen. Purely structural for now: no payment SDK is
// wired up, so the upgrade button explains that purchases aren't live yet.
// MONETIZATION: connect the buttons to the real IAP flow (RevenueCat /
// StoreKit) once products exist — see MONETIZATION.md for the full setup list.
export default function PremiumScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isPremium = useEntitlementsStore((s) => s.isPremium);
  const setPremium = useEntitlementsStore((s) => s.setPremium);
  // Entitlements are still rehydrating from AsyncStorage — don't render the
  // paywall/free-state content yet, or a premium user could briefly see the
  // locked/upsell UI before isPremium is confirmed.
  const entitlementsLoading = useEntitlementsStore((s) => s.isLoading);
  const entitlementsError = useEntitlementsStore((s) => s.error);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Route-level kill switch. Hiding the Settings row removes the only link in,
  // but the screen would still render if opened directly (deep link / back
  // stack). While premium is parked, bounce straight back. See
  // constants/featureFlags.ts and PREMIUM_BACKDOOR.md.
  useEffect(() => {
    if (!PREMIUM_ENABLED) router.replace('/(tabs)/settings');
  }, []);

  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  const handleUpgrade = useCallback((): void => {
    Alert.alert(t('premium.coming_soon_title'), t('premium.coming_soon_body'));
  }, [t]);

  const handleDevToggle = useCallback(
    (value: boolean): void => {
      setPremium(value);
    },
    [setPremium]
  );

  // Parked — the effect above is redirecting away; render nothing meanwhile.
  if (!PREMIUM_ENABLED) return <View style={styles.root} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <View style={styles.backRow}>
              <Ionicons
                name={rtl ? 'chevron-forward' : 'chevron-back'}
                size={18}
                color={C.primary}
              />
              <Text style={styles.backText}>{t('common.back')}</Text>
            </View>
          </Pressable>
        </View>

        {entitlementsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : entitlementsError ? (
          <View style={styles.centered}>
            <Text style={styles.heroSubtitle}>{t('premium.load_error')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* ── Hero ── */}
            <View style={styles.hero}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="sparkles" size={32} color={C.primary} />
              </View>
              <Text style={[styles.heroTitle, headingFont]}>{t('premium.title')}</Text>
              <Text style={styles.heroSubtitle}>
                {isPremium ? t('premium.active_subtitle') : t('premium.subtitle')}
              </Text>
            </View>

            {/* ── What you unlock ── */}
            <Text style={styles.sectionLabel}>{t('premium.unlocks_section')}</Text>
            <View style={styles.card}>
              {PREMIUM_FEATURES.map((feature, index) => (
                <View
                  key={feature.key}
                  style={[styles.row, index < PREMIUM_FEATURES.length - 1 && styles.rowBorder]}
                >
                  <View style={styles.featIcon}>
                    <Ionicons name={feature.icon} size={22} color={C.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.label}>{t(feature.titleKey)}</Text>
                    <Text style={styles.description}>{t(feature.descriptionKey)}</Text>
                  </View>
                  <Ionicons
                    name={isPremium ? 'checkmark-circle' : 'lock-closed-outline'}
                    size={20}
                    color={isPremium ? C.positive : C.textSecondary}
                  />
                </View>
              ))}
            </View>

            {/* ── Upgrade ── */}
            {!isPremium && (
              <>
                <Pressable
                  style={({ pressed }) => [styles.upgradeBtn, pressed && styles.upgradeBtnPressed]}
                  onPress={handleUpgrade}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('premium.upgrade_button')}
                >
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.upgradeBtnText}>{t('premium.upgrade_button')}</Text>
                </Pressable>
                <Text style={styles.priceNote}>{t('premium.price_placeholder')}</Text>
                <Pressable
                  style={styles.restoreBtn}
                  onPress={handleUpgrade}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('premium.restore_button')}
                >
                  <Text style={styles.restoreBtnText}>{t('premium.restore_button')}</Text>
                </Pressable>
              </>
            )}

            {/* ── Dev-only entitlement toggle (never shipped in release builds) ── */}
            {__DEV__ && (
              <View style={[styles.card, styles.devCard]}>
                <View style={styles.row}>
                  <Ionicons
                    name="construct-outline"
                    size={22}
                    color={C.textSecondary}
                    style={styles.icon}
                  />
                  <View style={styles.info}>
                    <Text style={styles.label}>{t('premium.dev_toggle')}</Text>
                    <Text style={styles.description}>{t('premium.dev_toggle_sub')}</Text>
                  </View>
                  <Switch
                    value={isPremium}
                    onValueChange={handleDevToggle}
                    trackColor={{ false: C.border, true: C.primary + '66' }}
                    thumbColor={isPremium ? C.primary : C.textSecondary}
                    accessible
                    accessibilityRole="switch"
                    accessibilityLabel={t('premium.dev_toggle')}
                    accessibilityHint={t('premium.dev_toggle_sub')}
                    accessibilityState={{ checked: isPremium }}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: sizes.lg, paddingTop: sizes.sm },
    backBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    backText: { fontSize: 15, ...font.semibold, color: C.primary },
    content: { padding: sizes.lg, gap: sizes.sm, paddingBottom: sizes.xl },

    hero: { alignItems: 'center', gap: sizes.xs, marginBottom: sizes.sm },
    heroIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sizes.xs,
    },
    heroTitle: { fontSize: 24, ...font.extrabold, color: C.textPrimary, textAlign: 'center' },
    heroSubtitle: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    sectionLabel: {
      fontSize: 12,
      color: C.textSecondary,
      ...font.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: sizes.sm,
      marginBottom: sizes.xs,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.md,
      gap: sizes.md,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    icon: { fontSize: 24, width: 32, textAlign: 'center' },
    featIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    label: { fontSize: 16, color: C.textPrimary, ...font.semibold },
    description: { fontSize: 13, color: C.textSecondary, ...font.regular, marginTop: 2 },

    upgradeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      minHeight: 52,
      marginTop: sizes.md,
    },
    upgradeBtnPressed: { opacity: 0.85 },
    upgradeBtnText: { fontSize: 16, ...font.bold, color: '#fff' },
    priceNote: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: sizes.xs,
    },
    restoreBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    restoreBtnText: { fontSize: 14, ...font.semibold, color: C.primary },

    devCard: { marginTop: sizes.lg, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  });
}
