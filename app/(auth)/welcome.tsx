import { useMemo, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Animated, Pressable } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
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

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

export default function WelcomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const currentLanguage = useLanguageStore((s) => s.language);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const fadeTop = useRef(new Animated.Value(0)).current;
  const slideCard = useRef(new Animated.Value(40)).current;
  const fadeCard = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeTop, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(slideCard, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(fadeCard, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeTop, slideCard, fadeCard]);

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
      <Animated.View style={[styles.top, { opacity: fadeTop }]}>
        <View style={styles.moon}>
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

          <Text style={styles.appName}>HouseMates</Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
        </SafeAreaView>

        <View style={styles.skylineWrap}>
          <HouseSkyline />
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeCard,
            transform: [{ translateY: slideCard }],
          },
        ]}
      >
        <Text style={styles.cardHeading}>{t('welcome.card_heading')}</Text>
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

        <Pressable
          style={styles.loginLink}
          onPress={() => router.push('/(auth)/login')}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('welcome.log_in')}
        >
          <Text style={styles.loginLinkText}>{t('welcome.log_in')}</Text>
        </Pressable>

        <Text style={styles.terms}>{t('auth.by_continuing')}</Text>
      </Animated.View>
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
    },
    moon: {
      position: 'absolute',
      top: 54,
      right: 40,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },
    moonShadow: {
      position: 'absolute',
      top: -6,
      left: -10,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.primary,
    },
    skylineWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 90,
      paddingHorizontal: sizes.md,
    },
    iconChip: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    appName: {
      fontSize: 34,
      ...font.extrabold,
      color: '#fff',
      letterSpacing: -1,
      marginTop: sizes.md,
      textAlign: 'center',
    },
    tagline: {
      fontSize: 16,
      ...font.regular,
      color: 'rgba(255,255,255,0.72)',
      textAlign: 'center',
      marginTop: sizes.sm,
    },
    card: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: sizes.xl,
      paddingBottom: 40,
      gap: 16,
    },
    cardHeading: {
      fontSize: 26,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
    },
    cardBody: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 22,
      marginBottom: sizes.sm,
    },
    primaryButton: {
      borderRadius: 14,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryButtonContent: {
      height: 52,
      flexDirection: 'row-reverse',
    },
    primaryButtonLabel: {
      fontSize: 16,
      ...font.semibold,
    },
    loginLink: {
      alignSelf: 'center',
      paddingVertical: sizes.sm,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    loginLinkText: {
      fontSize: 16,
      ...font.semibold,
      color: C.textPrimary,
      textAlign: 'center',
    },
    terms: {
      fontSize: 11,
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: sizes.xs,
    },
  });
}
