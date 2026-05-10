import { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

export default function WelcomeScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleCreateHouse = async (): Promise<void> => {
    await AsyncStorage.removeItem(ONBOARDING_INTENT_KEY);
    router.push('/(auth)/signup');
  };

  const handleJoinHouse = async (): Promise<void> => {
    await AsyncStorage.setItem(ONBOARDING_INTENT_KEY, 'join');
    router.push('/(auth)/signup');
  };

  return (
    <View style={styles.root}>
      {/* TOP SECTION */}
      <SafeAreaView style={styles.top} edges={['top']}>
        <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
          <View style={styles.topContent}>

            {/* Logo */}
            <View style={styles.logoWrap}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>H</Text>
              </View>
            </View>

            <Text style={styles.appName}>HouseMates</Text>
            <Text style={styles.tagline}>{t('welcome.tagline')}</Text>

            {/* Feature pills */}
            <View style={styles.pillsRow}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('welcome.feature_bills')}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('welcome.feature_chores')}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('welcome.feature_chat')}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* BOTTOM SECTION */}
      <View style={styles.bottom}>
        <Button
          mode="contained"
          onPress={handleCreateHouse}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
          buttonColor={C.primary}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Create a new house"
        >
          Create a House
        </Button>

        <Button
          mode="outlined"
          onPress={handleJoinHouse}
          style={styles.outlinedButton}
          contentStyle={styles.primaryButtonContent}
          labelStyle={[styles.primaryButtonLabel, { color: C.primary }]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Join an existing house"
        >
          Join a House
        </Button>

        <Button
          mode="text"
          onPress={() => router.push('/(auth)/login')}
          style={styles.textButton}
          labelStyle={styles.textButtonLabel}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Log in to existing account"
        >
          Already have an account? Sign in
        </Button>

        <Text style={styles.termsText}>
          {t('auth.by_continuing')}
        </Text>
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
    flex: { flex: 1 },
    top: {
      flex: 1.4,
      backgroundColor: C.primary,
    },
    topContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sizes.xl,
      gap: sizes.md,
    },
    logoWrap: {
      marginBottom: sizes.xs,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    logo: {
      width: 100,
      height: 100,
      borderRadius: 24,
      borderCurve: 'continuous',
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    } as never,
    logoText: {
      fontSize: 52,
      ...font.extrabold,
      color: C.primary,
      letterSpacing: -2,
    },
    appName: {
      fontSize: 36,
      ...font.extrabold,
      color: '#fff',
      letterSpacing: -1,
      marginTop: sizes.xs,
    },
    tagline: {
      fontSize: 16,
      ...font.medium,
      color: '#fff',
      opacity: 0.75,
      textAlign: 'center',
    },
    pillsRow: {
      flexDirection: 'column',
      gap: sizes.xs,
      marginTop: sizes.sm,
      alignItems: 'center',
    },
    pill: {
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.md,
      paddingVertical: 8,
    },
    pillText: {
      fontSize: 14,
      ...font.medium,
      color: '#fff',
      opacity: 0.92,
    },
    bottom: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 32,
      paddingBottom: 40,
      gap: 4,
    },
    primaryButton: {
      borderRadius: 14,
      marginBottom: 4,
    },
    outlinedButton: {
      borderRadius: 14,
      borderColor: C.primary,
      marginBottom: 4,
    },
    primaryButtonContent: {
      height: 52,
    },
    primaryButtonLabel: {
      fontSize: 16,
      ...font.semibold,
      letterSpacing: 0.2,
    },
    textButton: {
      borderRadius: 14,
    },
    textButtonLabel: {
      fontSize: 16,
      ...font.medium,
      color: C.primary,
    },
    termsText: {
      fontSize: 11,
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: sizes.sm,
    },
  });
}
