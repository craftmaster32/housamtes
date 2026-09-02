import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { StepProgress } from '@components/shared/StepProgress';
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <StepProgress steps={steps} currentStep={1} />
        </SafeAreaView>
      </View>

      <View style={styles.cardWrapper}>
        <View style={styles.card}>
          <View style={styles.envelopeWrap}>
            <Ionicons name="mail" size={44} color={C.primary} />
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark-circle" size={20} color={C.success} />
            </View>
          </View>

          <View style={styles.textBlock}>
            <Text style={[styles.heading, headingFont]}>{t('auth.check_inbox_title')}</Text>
            {!!pendingEmail && (
              <Text style={styles.bodyText}>
                {t('auth.check_inbox_body_code', { email: pendingEmail })}
              </Text>
            )}
            {!pendingEmail && <Text style={styles.errorText}>{t('auth.no_pending_email')}</Text>}
            {!!pendingEmail && (
              <Text style={styles.hintText}>{t('auth.check_inbox_gate_note')}</Text>
            )}
          </View>

          {!isEditingEmail && (
            <>
              <TextInput
                mode="outlined"
                value={code}
                onChangeText={handleCodeChange}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.codeInput}
                label={t('auth.code_from_email')}
                disabled={!pendingEmail || isVerifying || isResending}
                accessibilityLabel={t('auth.verification_code_label')}
                accessibilityHint={t('auth.verification_code_hint')}
              />

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              {resent && (
                <View style={styles.resentBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                  <Text style={styles.resentText}>{t('auth.email_sent')}</Text>
                </View>
              )}

              <Button
                mode="contained"
                onPress={handleVerify}
                loading={isVerifying}
                disabled={isVerifying || isResending || !pendingEmail || code.trim().length < 6}
                style={styles.verifyButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('auth.verify_button')}
                accessibilityState={{
                  disabled: isVerifying || isResending || !pendingEmail || code.trim().length < 6,
                  busy: isVerifying,
                }}
              >
                {isVerifying ? t('auth.verifying') : t('auth.verify_button')}
              </Button>

              <Button
                mode="outlined"
                onPress={handleResend}
                loading={isResending}
                disabled={isResending || isVerifying || !pendingEmail}
                style={styles.ghostButton}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { color: C.textPrimary }]}
                textColor={C.textPrimary}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('auth.resend_email_short')}
              >
                {isResending ? t('auth.sending') : t('auth.resend_email_short')}
              </Button>

              <View style={styles.linksRow}>
                <Pressable
                  onPress={handleStartEditEmail}
                  disabled={!pendingEmail}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.wrong_email_correct')}
                  style={styles.goBackLink}
                >
                  <Text style={styles.goBackText}>{t('auth.wrong_email_correct')}</Text>
                </Pressable>

                <Pressable
                  onPress={handleGoBack}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.wrong_email_go_back')}
                  style={styles.goBackLink}
                >
                  <Text style={styles.goBackTextMuted}>{t('auth.wrong_email_go_back')}</Text>
                </Pressable>
              </View>
            </>
          )}

          {isEditingEmail && (
            <View style={styles.editEmailBlock}>
              <TextInput
                mode="outlined"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                style={styles.codeInput}
                label={t('auth.email')}
                disabled={isCorrectingEmail}
                accessibilityLabel={t('auth.email')}
              />

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.editEmailButtons}>
                <Button
                  mode="outlined"
                  onPress={handleCancelEditEmail}
                  disabled={isCorrectingEmail}
                  style={[styles.ghostButton, styles.editEmailCancel]}
                  contentStyle={styles.buttonContent}
                  labelStyle={[styles.buttonLabel, { color: C.textPrimary }]}
                  textColor={C.textPrimary}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleCorrectEmail}
                  loading={isCorrectingEmail}
                  disabled={isCorrectingEmail || !newEmail.trim()}
                  style={[styles.verifyButton, styles.editEmailSave]}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.correct_email_button')}
                >
                  {t('auth.correct_email_button')}
                </Button>
              </View>
            </View>
          )}
        </View>
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
      paddingHorizontal: sizes.lg,
      paddingTop: ms(24),
      paddingBottom: ms(40),
      alignItems: 'center',
      gap: ms(20),
    },
    envelopeWrap: {
      width: ms(88),
      height: ms(88),
      borderRadius: ms(26),
      backgroundColor: C.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.xs,
    },
    checkBadge: {
      position: 'absolute',
      bottom: ms(-4),
      end: ms(-4),
      backgroundColor: C.surface,
      borderRadius: ms(12),
      padding: ms(2),
    },
    textBlock: {
      alignItems: 'center',
      gap: ms(8),
    },
    heading: {
      fontSize: mf(24),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    bodyText: {
      fontSize: mf(15),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: mf(22),
    },
    hintText: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: ms(4),
    },
    errorText: {
      fontSize: sizes.fontXs,
      ...font.regular,
      color: C.danger,
      textAlign: 'center',
    },
    resentBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.xs,
      backgroundColor: 'rgba(79,176,113,0.1)',
      paddingVertical: sizes.xs,
      paddingHorizontal: sizes.md,
      borderRadius: ms(10),
    },
    resentText: {
      color: C.success,
      ...font.semibold,
      fontSize: mf(14),
    },
    codeInput: {
      width: '100%',
      backgroundColor: C.surface,
      letterSpacing: 4,
    },
    verifyButton: {
      borderRadius: ms(14),
      width: '100%',
    },
    ghostButton: {
      borderRadius: ms(14),
      width: '100%',
      borderColor: C.border,
      borderWidth: 1.5,
    },
    buttonContent: { height: ms(52) },
    buttonLabel: {
      fontSize: sizes.fontMd,
      ...font.semibold,
      letterSpacing: 0.1,
    },
    linksRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: sizes.md,
    },
    goBackLink: {
      paddingVertical: sizes.sm,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    goBackText: {
      fontSize: sizes.fontSm,
      ...font.medium,
      color: C.primary,
      textAlign: 'center',
    },
    goBackTextMuted: {
      fontSize: sizes.fontSm,
      ...font.medium,
      color: C.textSecondary,
      textAlign: 'center',
    },
    editEmailBlock: {
      width: '100%',
      gap: ms(12),
    },
    editEmailButtons: {
      flexDirection: 'row',
      gap: sizes.sm,
    },
    editEmailCancel: {
      flex: 1,
    },
    editEmailSave: {
      flex: 1,
    },
  });
}
