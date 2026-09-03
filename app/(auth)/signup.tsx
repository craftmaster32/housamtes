import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Entrance } from '@components/shared/Entrance';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation, Trans } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { signUpSchema, mapZodError } from '@utils/validation';
import { suggestEmailCorrection } from '@utils/emailSuggest';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { StepProgress } from '@components/shared/StepProgress';
import { getErrorMessage } from '@utils/errors';
import { markTourPending } from '@utils/tour';
import { PasswordInput } from '@components/shared/PasswordInput';

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
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  // Restores an in-progress signup (e.g. the user went back from the verify-email
  // screen to fix a typo'd address) so they don't have to retype everything —
  // these are only ever set while a verification is pending, never on a fresh visit.
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const pendingSignupName = useAuthStore((s) => s.pendingSignupName);
  const pendingSignupPassword = useAuthStore((s) => s.pendingSignupPassword);
  const pendingSignupAvatarColor = useAuthStore((s) => s.pendingSignupAvatarColor);

  const [name, setName] = useState(pendingSignupName ?? '');
  const [email, setEmail] = useState(pendingEmail ?? '');
  const [password, setPassword] = useState(pendingSignupPassword ?? '');
  const [confirmPw, setConfirmPw] = useState(pendingSignupPassword ?? '');
  const [selectedColor] = useState(
    pendingSignupAvatarColor ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  );
  const [error, setError] = useState('');
  // Which field the current error belongs to, so that field gets the red
  // outline and the keyboard jumps straight to it instead of leaving the
  // user to hunt for what's wrong.
  const [fieldError, setFieldError] = useState<'name' | 'email' | 'password' | 'confirm' | null>(
    null
  );
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  // Single clickwrap gate: confirms 18+ AND agreement to Terms + Privacy. Already
  // ticked once when resuming a pending signup — they agreed moments ago.
  const [agreed, setAgreed] = useState(!!pendingSignupName);
  const nameRef = useRef<RNTextInput>(null);
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
  const emailSuggestion = useMemo(() => suggestEmailCorrection(email), [email]);

  const focusField = useCallback((field: 'name' | 'email' | 'password' | 'confirm'): void => {
    setFieldError(field);
    const ref = { name: nameRef, email: emailRef, password: passwordRef, confirm: confirmRef }[
      field
    ];
    ref.current?.focus();
  }, []);

  const handleSignup = useCallback(async (): Promise<void> => {
    if (isLoading) return;
    if (!agreed) {
      setError(t('auth.signup_agree_required'));
      return;
    }
    if (password !== confirmPw) {
      setError(t('auth.passwords_no_match'));
      focusField('confirm');
      return;
    }
    const result = signUpSchema.safeParse({ name, email, password });
    if (!result.success) {
      const issue = result.error.errors[0];
      setError(mapZodError(issue.message, t));
      const field = issue.path[0];
      if (field === 'name' || field === 'email' || field === 'password') {
        focusField(field);
      }
      return;
    }
    try {
      setError('');
      setFieldError(null);
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
      const message = getErrorMessage(err, t('auth.something_went_wrong'));
      setError(message);
      // Map the sanitized error text back to the field it's actually about
      // (e.g. "An account with this email already exists") so the user's
      // attention goes straight there instead of a generic banner.
      const lower = message.toLowerCase();
      if (lower.includes('email')) {
        focusField('email');
      } else if (lower.includes('password')) {
        focusField('password');
      } else {
        setFieldError(null);
      }
    }
  }, [name, email, password, confirmPw, selectedColor, agreed, isLoading, signUp, t, focusField]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <StepProgress steps={steps} currentStep={0} />
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            ref={nameRef}
            label={t('auth.your_name')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError('');
              setFieldError(null);
            }}
            mode="outlined"
            style={styles.input}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            accessibilityLabel={t('auth.your_name')}
            accessibilityHint={t('auth.name_hint')}
            error={fieldError === 'name'}
          />

          <TextInput
            ref={emailRef}
            label={t('auth.email')}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError('');
              setFieldError(null);
            }}
            onBlur={() => setEmailTouched(true)}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel={t('auth.email')}
            accessibilityHint={t('auth.email_hint')}
            error={fieldError === 'email'}
          />
          {emailTouched && !!emailSuggestion && (
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionText}>
                {t('auth.did_you_mean', { email: emailSuggestion })}
              </Text>
              <Pressable
                onPress={() => setEmail(emailSuggestion)}
                hitSlop={8}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${t('auth.did_you_mean', { email: emailSuggestion })} ${t('auth.use_it')}`}
              >
                <Text style={styles.suggestionLink}>{t('auth.use_it')}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.passwordBlock}>
            <PasswordInput
              ref={passwordRef}
              label={t('auth.password')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError('');
                setFieldError(null);
              }}
              onBlur={() => setPasswordTouched(true)}
              mode="outlined"
              style={styles.input}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel={t('auth.password')}
              accessibilityHint={t('auth.password_hint')}
              error={!!passwordError || fieldError === 'password'}
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

          <PasswordInput
            ref={confirmRef}
            label={t('auth.confirm_password')}
            value={confirmPw}
            onChangeText={(v) => {
              setConfirmPw(v);
              setError('');
              setFieldError(null);
            }}
            mode="outlined"
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={handleSignup}
            accessibilityLabel={t('auth.confirm_password')}
            accessibilityHint={t('auth.confirm_password_hint')}
            error={fieldError === 'confirm'}
          />

          <View style={styles.agreeRow}>
            <Pressable
              onPress={() => {
                setAgreed((v) => !v);
                setError('');
              }}
              hitSlop={11}
              accessible
              accessibilityRole="checkbox"
              accessibilityLabel={t('auth.signup_agree_label')}
              accessibilityState={{ checked: agreed }}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color={'#fff'} />}
              </View>
            </Pressable>
            <Text style={styles.agreeText}>
              <Trans
                i18nKey="auth.signup_agree_full"
                components={{
                  tos: (
                    <Text
                      style={styles.agreeLink}
                      onPress={() => router.push('/(auth)/terms')}
                      accessibilityRole="link"
                    >
                      {''}
                    </Text>
                  ),
                  privacy: (
                    <Text
                      style={styles.agreeLink}
                      onPress={() => router.push('/(auth)/privacy-policy')}
                      accessibilityRole="link"
                    >
                      {''}
                    </Text>
                  ),
                }}
              />
            </Text>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Entrance style={styles.ctaGroup} delay={140}>
            <Button
              testID="signup-submit"
              mode="contained"
              onPress={handleSignup}
              loading={isLoading}
              disabled={isLoading || !agreed}
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
      </KeyboardAvoidingView>
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
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: ms(6),
      marginTop: -sizes.sm,
      marginStart: ms(4),
    },
    suggestionText: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textSecondary,
    },
    suggestionLink: {
      fontSize: mf(13),
      ...font.semibold,
      color: C.primary,
      textDecorationLine: 'underline',
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
    agreeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sizes.sm,
      marginTop: sizes.xs,
    },
    checkbox: {
      width: ms(22),
      height: ms(22),
      borderRadius: ms(6),
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      marginTop: ms(1),
    },
    checkboxChecked: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    agreeText: {
      flex: 1,
      fontSize: mf(14),
      ...font.medium,
      color: C.textSecondary,
      lineHeight: mf(20),
    },
    agreeLink: {
      ...font.semibold,
      color: C.primary,
      textDecorationLine: 'underline',
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
