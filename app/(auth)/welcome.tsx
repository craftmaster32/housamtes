import { useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { HouseSkyline } from '@components/shared/HouseSkyline';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';
const ONBOARDING_INTENT_KEY = 'onboarding_intent';
const SKYLINE_HEIGHT = ms(90);

export default function WelcomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const currentLanguage = useLanguageStore((s) => s.language);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont();

  const handleGetStarted = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_INTENT_KEY);
    } catch {
      // best-effort cleanup
    }
    router.push('/(auth)/signup');
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View
          style={styles.moon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.moonShadow} />
        </View>
        <SafeAreaView edges={['top']} style={styles.topInner}>
          <View
            style={styles.iconChip}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('welcome.logo_label')}
          >
            <Ionicons name="home" size={32} color={C.primary} />
          </View>

          <Text style={[styles.appName, headingFont]}>HouseMates</Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
        </SafeAreaView>

        <View
          style={styles.skylineWrap}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <HouseSkyline />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardHeading, headingFont]}>{t('welcome.card_heading')}</Text>
        <Text style={styles.cardBody}>{t('welcome.card_body')}</Text>

        <Button
          mode="contained"
          buttonColor={C.primary}
          textColor="#fff"
          onPress={handleGetStarted}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
          icon={({ color }) => (
            <Ionicons
              name={isRTL(currentLanguage) ? 'arrow-back' : 'arrow-forward'}
              size={18}
              color={color}
            />
          )}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('welcome.get_started')}
        >
          {t('welcome.get_started')}
        </Button>

        <Link href="/(auth)/login" asChild>
          <Pressable
            style={styles.loginLink}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('welcome.log_in')}
          >
            <Text style={styles.loginLinkText}>{t('welcome.log_in')}</Text>
          </Pressable>
        </Link>

        <Text style={styles.terms}>{t('auth.by_continuing')}</Text>
      </View>
    </View>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.primary,
    },
    top: {
      flex: 1.4,
      backgroundColor: C.primary,
      overflow: 'hidden',
    },
    topInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sizes.xl,
      paddingBottom: SKYLINE_HEIGHT,
    },
    moon: {
      position: 'absolute',
      top: ms(54),
      right: ms(40),
      width: ms(26),
      height: ms(26),
      borderRadius: ms(13),
      backgroundColor: 'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },
    moonShadow: {
      position: 'absolute',
      top: ms(-6),
      left: ms(-10),
      width: ms(26),
      height: ms(26),
      borderRadius: ms(13),
      backgroundColor: C.primary,
    },
    skylineWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: SKYLINE_HEIGHT,
      paddingHorizontal: sizes.md,
    },
    iconChip: {
      width: ms(72),
      height: ms(72),
      borderRadius: ms(20),
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    appName: {
      fontSize: mf(34),
      ...font.extrabold,
      color: '#fff',
      letterSpacing: -1,
      marginTop: sizes.md,
      textAlign: 'center',
    },
    tagline: {
      fontSize: mf(16),
      ...font.regular,
      color: 'rgba(255,255,255,0.72)',
      textAlign: 'center',
      marginTop: sizes.sm,
    },
    card: {
      backgroundColor: C.surface,
      borderTopLeftRadius: ms(28),
      borderTopRightRadius: ms(28),
      padding: sizes.xl,
      paddingBottom: ms(40),
      gap: ms(16),
    },
    cardHeading: {
      fontSize: mf(26),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
    },
    cardBody: {
      fontSize: mf(15),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(22),
      marginBottom: sizes.sm,
    },
    primaryButton: {
      borderRadius: ms(14),
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: ms(4) },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryButtonContent: {
      height: ms(52),
      flexDirection: 'row-reverse',
    },
    primaryButtonLabel: {
      fontSize: mf(16),
      ...font.semibold,
    },
    loginLink: {
      alignSelf: 'center',
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.lg,
      minHeight: sizes.touchTarget,
      minWidth: sizes.touchTarget,
      justifyContent: 'center',
    },
    loginLinkText: {
      fontSize: mf(16),
      ...font.semibold,
      color: C.textPrimary,
      textAlign: 'center',
    },
    terms: {
      fontSize: mf(11),
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: sizes.xs,
    },
  });
}
