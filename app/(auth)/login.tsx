import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { signInSchema, mapZodError } from '@utils/validation';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Entrance } from '@components/shared/Entrance';
import { getErrorMessage } from '@utils/errors';

import { mf, ms } from '@utils/responsive';
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
  const headingFont = useHeadingFont();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

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
      setError(mapZodError(result.error.errors[0].message, t));
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
        setError(getErrorMessage(err, t('auth.sign_in_failed')));
      }
    }
  }, [email, password, signIn, isLoading, failedAttempts, lockoutRemaining, startLockout, t]);

  const toggleShowPassword = useCallback((): void => setShowPassword((v) => !v), []);

  // Rendered on the leading side of the field in RTL and the trailing side in
  // LTR, matching react-native-paper's left/right prop (which the app's
  // manual web RTL styling does not mirror automatically).
  const passwordVisibilityIcon = (
    <TextInput.Icon
      icon={showPassword ? 'eye-off' : 'eye'}
      onPress={toggleShowPassword}
      accessible
      accessibilityRole="button"
      accessibilityState={{ expanded: showPassword }}
      accessibilityLabel={showPassword ? t('auth.hide_password') : t('auth.show_password')}
    />
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView
          edges={['top']}
          style={[styles.headerInner, isWide && styles.headerInnerWide]}
        >
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
            <Text style={[styles.brandName, headingFont]}>HouseMates</Text>
          </View>
          <Text style={styles.headerTagline}>{t('welcome.tagline')}</Text>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.card, isWide && styles.cardWide]}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
        >
          <Entrance style={styles.cardInner}>
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
              left={rtl ? passwordVisibilityIcon : undefined}
              right={rtl ? undefined : passwordVisibilityIcon}
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
              textColor="#fff"
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
                {t('auth.no_account')}{' '}
                <Text style={styles.signupTextBold}>{t('auth.sign_up')}</Text>
              </Text>
            </Pressable>
          </Entrance>
        </ScrollView>
      </KeyboardAvoidingView>
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
      paddingBottom: ms(28),
    },
    headerInner: {
      gap: ms(6),
    },
    headerInnerWide: {
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(2),
      alignSelf: 'flex-start',
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.xs,
      minHeight: sizes.touchTarget,
      marginTop: sizes.xs,
      marginBottom: ms(4),
    },
    backText: {
      fontSize: mf(15.5),
      ...font.medium,
      color: 'rgba(255,255,255,0.85)',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(10),
    },
    logoChip: {
      width: ms(36),
      height: ms(36),
      borderRadius: ms(10),
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      fontSize: mf(20),
      ...font.bold,
      color: '#fff',
      letterSpacing: -0.3,
    },
    headerTagline: {
      fontSize: mf(15),
      ...font.regular,
      color: 'rgba(255,255,255,0.65)',
      lineHeight: mf(22),
    },
    cardWrapper: {
      flex: 1,
      backgroundColor: C.primary,
    },
    card: {
      flex: 1,
      backgroundColor: C.surface,
      borderTopLeftRadius: ms(28),
      borderTopRightRadius: ms(28),
    },
    cardWide: {
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },
    cardContent: {
      flexGrow: 1,
      paddingHorizontal: sizes.lg,
      paddingTop: ms(32),
      paddingBottom: ms(24),
    },
    cardInner: { gap: sizes.md },
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
      fontSize: mf(14),
      ...font.medium,
      color: C.primary,
    },
    error: {
      ...font.regular,
      color: C.danger,
      fontSize: sizes.fontSm,
    },
    button: {
      borderRadius: ms(14),
      marginTop: sizes.xs,
    },
    buttonContent: {
      height: ms(52),
    },
    buttonLabel: {
      fontSize: mf(16),
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
      fontSize: mf(15),
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
