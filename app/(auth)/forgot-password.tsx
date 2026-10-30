import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { AuthScreen } from '@components/auth/AuthScreen';
import { AuthField } from '@components/auth/AuthField';
import { TextLink } from '@components/auth/TextLink';
import { PasswordDone } from '@components/auth/PasswordDone';
import { KeyArt } from '@components/auth/art/KeyArt';
import { SheetButton } from '@components/shared/SheetButton';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

type Step = 'email' | 'code';

export default function ForgotPasswordScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const signOut = useAuthStore((s) => s.signOut);
  const clearPasswordRecovery = useAuthStore((s) => s.clearPasswordRecovery);
  const C = useThemedColors();

  const handleSendCode = useCallback(async (): Promise<void> => {
    if (!email.trim()) {
      setError(t('auth.email_required'));
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (err) throw err;
      setStep('code');
    } catch {
      setError(t('auth.could_not_send_code'));
    } finally {
      setIsLoading(false);
    }
  }, [email, t]);

  // Return to the email step so the user can fix a mistyped address. The email
  // is kept so they can edit it instead of retyping; the code is cleared since a
  // code sent to the old address is no longer valid. Clear any active recovery
  // session first so the navigation guard cannot redirect to reset-password.
  const handleChangeEmail = useCallback(async (): Promise<void> => {
    clearPasswordRecovery();
    try {
      await signOut();
      setStep('email');
      setCode('');
      setError('');
    } catch {
      setError(t('auth.something_went_wrong'));
    }
  }, [clearPasswordRecovery, signOut, t]);

  const handleReset = useCallback(async (): Promise<void> => {
    if (!code.trim()) {
      setError(t('auth.enter_code_error'));
      return;
    }
    if (!password) {
      setError(t('auth.enter_password_error'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.password_min_length'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwords_no_match'));
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      });
      if (otpErr) throw otpErr;

      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // verifyOtp with type 'recovery' fires Supabase's PASSWORD_RECOVERY event,
      // which flips isPasswordRecovery on. This screen resets the password on its
      // own, so clear that flag — otherwise the navigation guard would redirect
      // the user to the deep-link reset-password screen and trap them there.
      clearPasswordRecovery();
      await signOut();
      setDone(true);
    } catch (err) {
      const msg = getErrorMessage(err, '');
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('otp')) {
        setError(t('auth.invalid_expired_code'));
      } else {
        setError(t('auth.something_went_wrong'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [code, email, password, confirm, signOut, clearPasswordRecovery, t]);

  const handleBack = useCallback((): void => {
    if (step === 'code') {
      setStep('email');
      setError('');
      setCode('');
    } else {
      router.back();
    }
  }, [step]);

  if (done) return <PasswordDone />;

  return (
    <AuthScreen
      title={step === 'email' ? t('auth.forgot_title') : t('auth.enter_code_title')}
      subtitle={
        step === 'email'
          ? t('auth.forgot_subtitle')
          : t('auth.reset_code_sent_to', { email: email.trim() })
      }
      onBack={handleBack}
      backLabel={t('common.back')}
      art={<KeyArt width={ms(64)} ink={C.textPrimary} />}
    >
      {step === 'email' ? (
        <>
          <AuthField
            label={t('auth.email')}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError('');
            }}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
            accessibilityLabel={t('auth.email')}
            accessibilityHint={t('auth.email_reset_hint')}
            error={!!error}
          />

          {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

          <SheetButton
            label={t('auth.send_code')}
            onPress={handleSendCode}
            loading={isLoading}
            disabled={isLoading}
          />
        </>
      ) : (
        <>
          <AuthField
            code
            label={t('auth.verification_code_label')}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError('');
            }}
            autoFocus
            keyboardType="number-pad"
            autoComplete="one-time-code"
            returnKeyType="next"
            maxLength={6}
            accessibilityLabel={t('auth.verification_code_label')}
            accessibilityHint={t('auth.verification_code_hint')}
            error={!!error}
          />

          <AuthField
            password
            label={t('auth.new_password')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError('');
            }}
            autoComplete="new-password"
            returnKeyType="next"
            accessibilityLabel={t('auth.new_password')}
            accessibilityHint={t('auth.new_password_hint')}
            error={!!error}
          />

          <AuthField
            password
            label={t('auth.confirm_password')}
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              setError('');
            }}
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleReset}
            accessibilityLabel={t('auth.confirm_password')}
            accessibilityHint={t('auth.confirm_password_hint')}
            error={!!error}
          />

          {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

          <SheetButton
            label={t('auth.update_password')}
            onPress={handleReset}
            loading={isLoading}
            disabled={isLoading}
          />

          <View style={styles.links}>
            <TextLink label={t('auth.resend_code')} onPress={handleSendCode} disabled={isLoading} />
            <TextLink
              muted
              label={t('auth.change_email')}
              onPress={handleChangeEmail}
              disabled={isLoading}
            />
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
  links: { gap: ms(2) },
});
