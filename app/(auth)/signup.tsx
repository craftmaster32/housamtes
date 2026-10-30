import { useState, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, Pressable, type TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { signUpSchema, mapZodError } from '@utils/validation';
import { suggestEmailCorrection } from '@utils/emailSuggest';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { font } from '@constants/typography';
import { AuthScreen } from '@components/auth/AuthScreen';
import { AuthField } from '@components/auth/AuthField';
import { StepTrail } from '@components/auth/StepTrail';
import { PasswordStrength } from '@components/auth/PasswordStrength';
import { TextLink } from '@components/auth/TextLink';
import { InkTickBox } from '@components/shared/InkTickBox';
import { SheetButton } from '@components/shared/SheetButton';
import { getErrorMessage } from '@utils/errors';
import { markTourPending } from '@utils/tour';
import { mf, ms } from '@utils/responsive';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

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
  const hand = useHandFont();

  const steps = useMemo(
    () => [t('auth.step_account'), t('auth.step_verify'), t('auth.step_house')],
    [t]
  );

  const passwordError =
    passwordTouched && password.length > 0 && password.length < 8
      ? t('auth.password_min_length')
      : null;
  const emailSuggestion = useMemo(() => suggestEmailCorrection(email), [email]);

  const handleEmailChange = useCallback((v: string): void => {
    setEmail(v);
    setError('');
    setFieldError(null);
  }, []);

  const handleApplySuggestion = useCallback((): void => {
    if (!emailSuggestion) return;
    setEmail(emailSuggestion);
    setError('');
    setFieldError(null);
  }, [emailSuggestion]);

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
    <AuthScreen
      title={t('auth.create_account')}
      subtitle={t('auth.free_to_use')}
      top={<StepTrail steps={steps} current={0} />}
    >
      <AuthField
        ref={nameRef}
        label={t('auth.your_name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError('');
          setFieldError(null);
        }}
        autoFocus
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        accessibilityLabel={t('auth.your_name')}
        accessibilityHint={t('auth.name_hint')}
        error={fieldError === 'name'}
      />

      <View>
        <AuthField
          ref={emailRef}
          label={t('auth.email')}
          value={email}
          onChangeText={handleEmailChange}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel={t('auth.email')}
          accessibilityHint={t('auth.email_hint')}
          error={fieldError === 'email'}
        />
        {emailTouched && !!emailSuggestion && (
          <View style={styles.suggestionRow}>
            <Text style={[styles.suggestionText, { color: C.textSecondary }]}>
              {t('auth.did_you_mean', { email: emailSuggestion })}
            </Text>
            <Pressable
              onPress={handleApplySuggestion}
              hitSlop={8}
              style={styles.suggestionAction}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${t('auth.did_you_mean', { email: emailSuggestion })} ${t('auth.use_it')}`}
            >
              <Text style={[styles.suggestionLink, hand, { color: C.primary }]}>
                {t('auth.use_it')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View>
        <AuthField
          ref={passwordRef}
          password
          label={t('auth.password')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError('');
            setFieldError(null);
          }}
          onBlur={() => setPasswordTouched(true)}
          autoComplete="new-password"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          accessibilityLabel={t('auth.password')}
          accessibilityHint={t('auth.password_hint')}
          error={!!passwordError || fieldError === 'password'}
        />
        {!!passwordError && (
          <Text style={[styles.fieldError, { color: C.danger }]}>{passwordError}</Text>
        )}
        <PasswordStrength password={password} />
      </View>

      <AuthField
        ref={confirmRef}
        password
        label={t('auth.confirm_password')}
        value={confirmPw}
        onChangeText={(v) => {
          setConfirmPw(v);
          setError('');
          setFieldError(null);
        }}
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleSignup}
        accessibilityLabel={t('auth.confirm_password')}
        accessibilityHint={t('auth.confirm_password_hint')}
        error={fieldError === 'confirm'}
      />

      <View style={styles.agreeRow}>
        <InkTickBox
          checked={agreed}
          onChange={(v) => {
            setAgreed(v);
            setError('');
          }}
          accessibilityLabel={t('auth.signup_agree_label')}
        />
        <Text style={[styles.agreeText, { color: C.textSecondary }]}>
          <Trans
            i18nKey="auth.signup_agree_full"
            components={{
              tos: (
                <Text
                  style={[styles.agreeLink, { color: C.primary }]}
                  onPress={() => router.push('/(auth)/terms')}
                  accessibilityRole="link"
                >
                  {''}
                </Text>
              ),
              privacy: (
                <Text
                  style={[styles.agreeLink, { color: C.primary }]}
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

      {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

      <View style={styles.cta}>
        <SheetButton
          testID="signup-submit"
          label={t('auth.create_account')}
          onPress={handleSignup}
          loading={isLoading}
          disabled={isLoading || !agreed}
        />
        <TextLink
          lead={t('auth.has_account')}
          label={t('auth.log_in')}
          onPress={() => router.push('/(auth)/login')}
          accessibilityLabel={t('auth.has_account_login')}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(8),
    marginTop: ms(6),
  },
  suggestionText: { fontSize: mf(14), ...font.regular },
  suggestionAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: ms(4) },
  suggestionLink: { fontSize: mf(19) },
  fieldError: { fontSize: mf(13.5), ...font.medium, marginTop: ms(6) },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10) },
  agreeText: { flex: 1, fontSize: mf(14), ...font.regular, lineHeight: mf(21), paddingTop: ms(10) },
  agreeLink: { ...font.semibold, textDecorationLine: 'underline' },
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
  cta: { gap: ms(6), marginTop: ms(4) },
});
