import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { signInSchema } from '@utils/validation';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const passwordRef = useRef<RNTextInput>(null);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { t } = useTranslation();
  const C = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const styles = useMemo(() => makeStyles(C), [C]);

  const fadeHeader = useRef(new Animated.Value(0)).current;
  const slideCard = useRef(new Animated.Value(30)).current;
  const fadeCard = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeHeader, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(slideCard, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(fadeCard, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeHeader, slideCard, fadeCard]);

  useEffect(() => {
    return (): void => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, []);

  const startLockout = useCallback(() => {
    setLockoutRemaining(LOCKOUT_SECONDS);
    lockoutTimer.current = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          if (lockoutTimer.current) clearInterval(lockoutTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleLogin = useCallback(async (): Promise<void> => {
    if (isLoading || lockoutRemaining > 0) return;

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    try {
      setError('');
      await signIn(result.data.email, result.data.password);
      setFailedAttempts(0);
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setFailedAttempts(0);
        startLockout();
        setError(t('auth.too_many_attempts', { n: LOCKOUT_SECONDS }));
      } else {
        setError(err instanceof Error ? err.message : t('auth.sign_in_failed'));
      }
    }
  }, [email, password, signIn, isLoading, failedAttempts, lockoutRemaining, startLockout, t]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.header, { opacity: fadeHeader }]}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons
              name={rtl ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color="rgba(255,255,255,0.85)"
            />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          <View style={styles.brandRow}>
            <View style={styles.logoChip}>
              <Ionicons name="home" size={20} color={C.primary} />
            </View>
            <Text style={styles.brandName}>HouseMates</Text>
          </View>
          <Text style={styles.headerTagline}>{t('welcome.tagline')}</Text>
        </SafeAreaView>
      </Animated.View>

      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: fadeCard,
            transform: [{ translateY: slideCard }],
          },
        ]}
      >
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            label={t('auth.email')}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError('');
            }}
            mode="outlined"
            style={styles.input}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel={t('auth.email')}
            accessibilityHint={t('auth.email_hint')}
            error={!!error}
          />

          <TextInput
            ref={passwordRef}
            label={t('auth.password')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError('');
            }}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showPassword}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            accessibilityLabel={t('auth.password')}
            accessibilityHint={t('auth.password_hint')}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={
                  showPassword ? t('auth.hide_password') : t('auth.show_password')
                }
              />
            }
            error={!!error}
          />

          <Pressable
            style={styles.forgotBtn}
            onPress={() => router.push('/(auth)/forgot-password')}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.forgot_password')}
          >
            <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
          </Pressable>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading || lockoutRemaining > 0}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={C.primary}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              lockoutRemaining > 0
                ? t('auth.locked_out', { n: lockoutRemaining })
                : t('auth.sign_in')
            }
          >
            {lockoutRemaining > 0
              ? t('auth.try_again_in', { n: lockoutRemaining })
              : isLoading
                ? t('auth.signing_in')
                : t('auth.sign_in')}
          </Button>

          <Pressable
            style={styles.signupLink}
            onPress={() => router.push('/(auth)/signup')}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.no_account_signup')}
          >
            <Text style={styles.signupText}>
              {t('auth.no_account')} <Text style={styles.signupTextBold}>{t('auth.sign_up')}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.primary,
    },
    header: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.lg,
      paddingBottom: 28,
    },
    headerInner: {
      gap: 6,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.xs,
      minHeight: sizes.touchTarget,
      marginTop: sizes.xs,
      marginBottom: 4,
    },
    backText: {
      fontSize: 15.5,
      ...font.medium,
      color: 'rgba(255,255,255,0.85)',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoChip: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      fontSize: 20,
      ...font.bold,
      color: '#fff',
      letterSpacing: -0.3,
    },
    headerTagline: {
      fontSize: 15,
      ...font.regular,
      color: 'rgba(255,255,255,0.65)',
      lineHeight: 22,
    },
    cardWrapper: {
      flex: 1,
      backgroundColor: C.primary,
    },
    card: {
      flex: 1,
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    cardContent: {
      paddingHorizontal: sizes.lg,
      paddingTop: 32,
      paddingBottom: 40,
      gap: sizes.md,
    },
    input: {
      backgroundColor: C.surface,
    },
    forgotBtn: {
      alignSelf: 'flex-end',
      paddingVertical: sizes.xs,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    forgotText: {
      fontSize: 14,
      ...font.medium,
      color: C.primary,
    },
    error: {
      ...font.regular,
      color: C.danger,
      fontSize: sizes.fontSm,
    },
    button: {
      borderRadius: 14,
      marginTop: sizes.xs,
    },
    buttonContent: {
      height: 52,
    },
    buttonLabel: {
      fontSize: 16,
      ...font.semibold,
      letterSpacing: 0.2,
    },
    signupLink: {
      alignSelf: 'center',
      paddingVertical: sizes.sm,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    signupText: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    signupTextBold: {
      ...font.semibold,
      color: C.primary,
    },
  });
}
