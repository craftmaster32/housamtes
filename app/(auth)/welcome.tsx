import { useMemo, useEffect, useRef, useCallback } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

export default function WelcomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleCreateHouse = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_INTENT_KEY);
    } catch {
      // best-effort cleanup
    }
    router.push('/(auth)/signup');
  }, []);

  return (
    <View style={styles.root}>
      {/* Blue top section */}
      <Animated.View style={[styles.top, { opacity: fadeAnim }]}>
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
          <Text style={styles.tagline}>{t('welcome.app_tagline')}</Text>

          <View style={styles.features}>
            <View style={styles.featureRow}>
              <Ionicons name="receipt-outline" size={18} color="rgba(255,255,255,0.85)" />
              <Text style={styles.featureText}>{t('welcome.feature_split_bills')}</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color="rgba(255,255,255,0.85)" />
              <Text style={styles.featureText}>{t('welcome.feature_track_chores')}</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="chatbubbles-outline" size={18} color="rgba(255,255,255,0.85)" />
              <Text style={styles.featureText}>{t('welcome.feature_group_chat')}</Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* White bottom card */}
      <View style={styles.card}>
        <Button
          mode="contained"
          buttonColor={C.primary}
          onPress={handleCreateHouse}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('welcome.get_started')}
        >
          {t('welcome.get_started')}
        </Button>

        <Button
          mode="text"
          onPress={() => router.push('/(auth)/login')}
          style={styles.textButton}
          labelStyle={styles.textButtonLabel}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('welcome.sign_in_prompt')}
        >
          {t('welcome.sign_in_prompt')}
        </Button>

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
    },
    topInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sizes.xl,
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
    features: {
      marginTop: sizes.lg,
      gap: 12,
      width: '100%',
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: sizes.md,
      paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderRadius: 14,
    },
    featureText: {
      fontSize: 14,
      ...font.medium,
      color: 'rgba(255,255,255,0.85)',
    },
    card: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: sizes.xl,
      paddingBottom: 40,
      gap: 12,
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
    },
    primaryButtonLabel: {
      fontSize: 16,
      ...font.semibold,
    },
    textButton: {
      borderRadius: 14,
    },
    textButtonLabel: {
      fontSize: 15,
      ...font.medium,
      color: C.primary,
    },
    terms: {
      fontSize: 11,
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: sizes.sm,
    },
  });
}
