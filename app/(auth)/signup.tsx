import { useState, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Entrance } from '@components/shared/Entrance';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { signUpSchema, mapZodError } from '@utils/validation';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { StepProgress } from '@components/shared/StepProgress';
import { getErrorMessage } from '@utils/errors';
import { markTourPending } from '@utils/tour';

import { mf, ms } from '@utils/responsive';
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

type PasswordStrength = 'weak' | 'fair' | 'strong';

function getPasswordStrength(pw: string): { level: PasswordStrength; color: string } {
  const hasMinLength = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = [hasMinLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (!hasMinLength || score <= 1) return { level: 'weak', color: '#D9534F' };
  if (score <= 3) return { level: 'fair', color: '#E0B24D' };
  return { level: 'strong', color: '#4FB071' };
}

export default function SignupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [error, setError] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const C = useThemedColors();
  const headingFont = useHeadingFont();
  const styles = useMemo(() => makeStyles(C), [C]);

  const steps = useMemo(
    () => [
      { label: t('auth.step_account') },
      { label: t('auth.step_verify') },
      { label: t('auth.step_house') },
    ],
    [t]
  );

  const strength = password.length > 0 ? getPasswordStrength(password) : null;
  const passwordError =
    passwordTouched && password.length > 0 && password.length < 8
      ? t('auth.password_min_length')
      : null;

  const handleSignup = useCallback(async (): Promise<void> => {
    if (isLoading) return;
    if (password !== confirmPw) {
      setError(t('auth.passwords_no_match'));
      return;
    }
    const result = signUpSchema.safeParse({ name, email, password });
    if (!result.success) {
      setError(mapZodError(result.error.errors[0].message, t));
      return;
    }
    try {
      setError('');
      const { needsVerification } = await signUp(
        result.data.email,
        result.data.password,
        result.data.name,
        selectedColor
      );
      // Brand-new account — queue the one-time welcome tour for the dashboard.
      await markTourPending();
      if (needsVerification) {
        router.replace('/(auth)/verify-email');
      }
    } catch (err) {
      setError(getErrorMessage(err, t('auth.something_went_wrong')));
    }
  }, [name, email, password, confirmPw, selectedColor, isLoading, signUp, t]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <StepProgress steps={steps} currentStep={0} />
        </SafeAreaView>
      </View>

      <View style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
        >
          <Entrance style={styles.brandRow}>
            <View style={styles.logoChip}>
              <Ionicons name="home" size={18} color={C.primary} />
            </View>
            <Text style={styles.brandName}>HouseMates</Text>
          </Entrance>

          <Entrance style={styles.headerBlock} delay={70}>
            <Text style={[styles.title, headingFont]}>{t('auth.create_account')}</Text>
            <Text style={styles.subtitle}>{t('auth.free_to_use')}</Text>
          </Entrance>

          <TextInput
            label={t('auth.your_name')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError('');
            }}
            mode="outlined"
            style={styles.input}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            accessibilityLabel={t('auth.your_name')}
            accessibilityHint={t('auth.name_hint')}
          />

          <TextInput
            ref={emailRef}
            label={t('auth.email')}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError('');
            }}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel={t('auth.email')}
            accessibilityHint={t('auth.email_hint')}
          />

          <View style={styles.passwordBlock}>
            <TextInput
              ref={passwordRef}
              label={t('auth.password')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError('');
              }}
              onBlur={() => setPasswordTouched(true)}
              mode="outlined"
              style={styles.input}
              secureTextEntry={!showPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
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
              error={!!passwordError}
            />
            {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            {strength && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBarBg}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        backgroundColor: strength.color,
                        width:
                          strength.level === 'weak'
                            ? '33%'
                            : strength.level === 'fair'
                              ? '66%'
                              : '100%',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {t(`auth.strength_${strength.level}`)}
                </Text>
              </View>
            )}
          </View>

          <TextInput
            ref={confirmRef}
            label={t('auth.confirm_password')}
            value={confirmPw}
            onChangeText={(v) => {
              setConfirmPw(v);
              setError('');
            }}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showConfirm}
            returnKeyType="go"
            onSubmitEditing={handleSignup}
            accessibilityLabel={t('auth.confirm_password')}
            accessibilityHint={t('auth.confirm_password_hint')}
            right={
              <TextInput.Icon
                icon={showConfirm ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirm((v) => !v)}
                accessibilityLabel={showConfirm ? t('auth.hide_password') : t('auth.show_password')}
              />
            }
            error={!!error && error === t('auth.passwords_no_match')}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Entrance style={styles.ctaGroup} delay={140}>
            <Button
              mode="contained"
              onPress={handleSignup}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={C.primary}
              textColor="#fff"
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('auth.create_account')}
            >
              {t('auth.create_account')}
            </Button>

            <Pressable
              style={styles.loginLink}
              onPress={() => router.push('/(auth)/login')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('auth.has_account_login')}
            >
              <Text style={styles.loginText}>
                {t('auth.has_account')} <Text style={styles.loginTextBold}>{t('auth.log_in')}</Text>
              </Text>
            </Pressable>
          </Entrance>
        </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.surface,
    },
    header: {
      backgroundColor: C.surface,
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.sm,
      paddingBottom: sizes.sm,
    },
    headerInner: {
      paddingTop: sizes.xs,
    },
    cardWrapper: {
      flex: 1,
    },
    card: {
      flex: 1,
      backgroundColor: C.surface,
    },
    cardContent: {
      flexGrow: 1,
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.sm,
      paddingBottom: sizes.xl,
      gap: sizes.md,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
    },
    logoChip: {
      width: ms(30),
      height: ms(30),
      borderRadius: ms(8),
      backgroundColor: C.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      fontSize: mf(16),
      ...font.bold,
      color: C.textPrimary,
      letterSpacing: -0.2,
    },
    headerBlock: {
      gap: ms(4),
    },
    title: {
      fontSize: mf(28),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: mf(15),
      ...font.regular,
      color: C.textSecondary,
    },
    input: {
      backgroundColor: C.surface,
    },
    passwordBlock: {
      gap: ms(6),
    },
    fieldError: {
      fontSize: mf(12),
      ...font.regular,
      color: C.danger,
      marginStart: ms(4),
    },
    strengthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
    },
    strengthBarBg: {
      flex: 1,
      height: ms(4),
      borderRadius: ms(2),
      backgroundColor: C.border,
      overflow: 'hidden',
    },
    strengthBarFill: {
      height: ms(4),
      borderRadius: ms(2),
    },
    strengthLabel: {
      fontSize: mf(12),
      ...font.semibold,
    },
    error: {
      ...font.regular,
      color: C.danger,
      fontSize: sizes.fontSm,
    },
    ctaGroup: { gap: sizes.md },
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
    loginLink: {
      alignSelf: 'center',
      paddingVertical: sizes.sm,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    loginText: {
      fontSize: mf(15),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    loginTextBold: {
      ...font.semibold,
      color: C.primary,
    },
  });
}
