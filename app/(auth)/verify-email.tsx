import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { font } from '@constants/typography';
import { AuthScreen } from '@components/auth/AuthScreen';
import { AuthField } from '@components/auth/AuthField';
import { StepTrail } from '@components/auth/StepTrail';
import { TextLink } from '@components/auth/TextLink';
import { EnvelopeArt } from '@components/auth/art/EnvelopeArt';
import { SheetButton } from '@components/shared/SheetButton';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

export default function VerifyEmailScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const correctPendingEmail = useAuthStore((s) => s.correctPendingEmail);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resent, setResent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isCorrectingEmail, setIsCorrectingEmail] = useState(false);

  const C = useThemedColors();
  const hand = useHandFont();

  const steps = useMemo(
    () => [t('auth.step_account'), t('auth.step_verify'), t('auth.step_house')],
    [t]
  );

  const handleCodeChange = useCallback((text: string): void => {
    setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
  }, []);

  const handleVerify = useCallback(async (): Promise<void> => {
    if (!pendingEmail) return;
    if (code.trim().length < 6) {
      setError(t('auth.enter_code_error'));
      return;
    }
    try {
      setIsVerifying(true);
      setError('');
      await verifyEmailOtp(pendingEmail, code);
      // On success the auth state becomes signed-in and the root layout
      // routes the new user onward to house setup — no navigation needed here.
    } catch (err) {
      const msg = getErrorMessage(err, '').toLowerCase();
      if (/token|otp|code|invalid|expired/.test(msg)) {
        setError(t('auth.invalid_expired_code'));
      } else {
        setError(t('auth.something_went_wrong'));
      }
    } finally {
      setIsVerifying(false);
    }
  }, [pendingEmail, code, verifyEmailOtp, t]);

  const handleResend = useCallback(async (): Promise<void> => {
    if (!pendingEmail) return;
    try {
      setIsResending(true);
      setResent(false);
      setError('');
      await resendVerification(pendingEmail);
      setResent(true);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.could_not_resend')));
    } finally {
      setIsResending(false);
    }
  }, [pendingEmail, resendVerification, t]);

  const handleGoBack = useCallback((): void => {
    router.replace('/(auth)/signup');
  }, []);

  const handleStartEditEmail = useCallback((): void => {
    setNewEmail(pendingEmail ?? '');
    setError('');
    setIsEditingEmail(true);
  }, [pendingEmail]);

  const handleCancelEditEmail = useCallback((): void => {
    setIsEditingEmail(false);
    setNewEmail('');
    setError('');
  }, []);

  const handleCorrectEmail = useCallback(async (): Promise<void> => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    try {
      setIsCorrectingEmail(true);
      setError('');
      await correctPendingEmail(trimmed);
      setIsEditingEmail(false);
      setNewEmail('');
      setCode('');
      setResent(true);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.something_went_wrong')));
    } finally {
      setIsCorrectingEmail(false);
    }
  }, [newEmail, correctPendingEmail, t]);

  const busy = isVerifying || isResending;
  const verifyDisabled = busy || !pendingEmail || code.trim().length < 6;

  return (
    <AuthScreen
      title={t('auth.check_inbox_title')}
      top={<StepTrail steps={steps} current={1} />}
      art={<EnvelopeArt width={ms(70)} ink={C.textPrimary} />}
    >
      <View style={styles.textBlock}>
        {!!pendingEmail && (
          <Text style={[styles.body, { color: C.textSecondary }]}>
            {t('auth.check_inbox_body_code', { email: pendingEmail })}
          </Text>
        )}
        {!pendingEmail && (
          <Text style={[styles.error, { color: C.danger }]}>{t('auth.no_pending_email')}</Text>
        )}
        {!!pendingEmail && (
          <Text style={[styles.hint, { color: C.textTertiary }]}>
            {t('auth.check_inbox_gate_note')}
          </Text>
        )}
      </View>

      {!isEditingEmail && (
        <>
          <AuthField
            code
            label={t('auth.code_from_email')}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            autoComplete="one-time-code"
            placeholder="••••••"
            editable={!!pendingEmail && !busy}
            returnKeyType="go"
            onSubmitEditing={handleVerify}
            accessibilityLabel={t('auth.verification_code_label')}
            accessibilityHint={t('auth.verification_code_hint')}
            error={!!error}
          />

          {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

          {resent && (
            <View style={[styles.note, { backgroundColor: C.note }]}>
              <Text style={[styles.noteText, hand, { color: C.noteInk }]}>
                ✓ {t('auth.email_sent')}
              </Text>
            </View>
          )}

          <SheetButton
            label={isVerifying ? t('auth.verifying') : t('auth.verify_button')}
            accessibilityLabel={t('auth.verify_button')}
            onPress={handleVerify}
            loading={isVerifying}
            disabled={verifyDisabled}
          />

          <View style={styles.links}>
            <TextLink
              label={isResending ? t('auth.sending') : t('auth.resend_email_short')}
              accessibilityLabel={t('auth.resend_email_short')}
              onPress={handleResend}
              disabled={busy || !pendingEmail}
            />
            <TextLink
              label={t('auth.wrong_email_correct')}
              onPress={handleStartEditEmail}
              disabled={!pendingEmail}
            />
            <TextLink muted label={t('auth.wrong_email_go_back')} onPress={handleGoBack} />
          </View>
        </>
      )}

      {isEditingEmail && (
        <>
          <AuthField
            label={t('auth.email')}
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
            editable={!isCorrectingEmail}
            returnKeyType="go"
            onSubmitEditing={handleCorrectEmail}
            accessibilityLabel={t('auth.email')}
            accessibilityHint={t('auth.email_hint')}
            error={!!error}
          />

          {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

          <SheetButton
            label={t('auth.correct_email_button')}
            onPress={handleCorrectEmail}
            loading={isCorrectingEmail}
            disabled={isCorrectingEmail || !newEmail.trim()}
          />
          <TextLink
            label={t('common.cancel')}
            onPress={handleCancelEditEmail}
            disabled={isCorrectingEmail}
          />
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  textBlock: { gap: ms(8), marginTop: ms(-8) },
  body: { fontSize: mf(15.5), ...font.regular, lineHeight: mf(23) },
  hint: { fontSize: mf(13.5), ...font.regular, lineHeight: mf(19) },
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
  note: {
    alignSelf: 'flex-start',
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderRadius: ms(4),
    transform: [{ rotate: '-1.5deg' }],
  },
  noteText: { fontSize: mf(20) },
  links: { gap: ms(2) },
});
