import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { StepProgress } from '@components/shared/StepProgress';
import { getErrorMessage } from '@utils/errors';

export default function VerifyEmailScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resent, setResent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideIcon = useRef(new Animated.Value(20)).current;
  const scaleIcon = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(slideIcon, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleIcon, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideIcon, scaleIcon]);

  const steps = useMemo(
    () => [
      { label: t('auth.step_account') },
      { label: t('auth.step_verify') },
      { label: t('auth.step_house') },
    ],
    [t]
  );

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
      const msg = getErrorMessage(err, '');
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('otp')) {
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

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <StepProgress steps={steps} currentStep={1} />
        </SafeAreaView>
      </Animated.View>

      <Animated.View style={[styles.cardWrapper, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.envelopeWrap,
              {
                transform: [{ translateY: slideIcon }, { scale: scaleIcon }],
              },
            ]}
          >
            <Ionicons name="mail" size={44} color={C.primary} />
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark-circle" size={20} color={C.success} />
            </View>
          </Animated.View>

          <View style={styles.textBlock}>
            <Text style={styles.heading}>{t('auth.check_inbox_title')}</Text>
            {!!pendingEmail && (
              <Text style={styles.bodyText}>
                {t('auth.check_inbox_body_code', { email: pendingEmail })}
              </Text>
            )}
            {!pendingEmail && <Text style={styles.errorText}>{t('auth.no_pending_email')}</Text>}
          </View>

          <TextInput
            mode="outlined"
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            style={styles.codeInput}
            label={t('auth.code_from_email')}
            disabled={!pendingEmail || isVerifying}
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
            disabled={isVerifying || !pendingEmail || code.trim().length < 6}
            style={styles.verifyButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.verify_button')}
          >
            {isVerifying ? t('auth.verifying') : t('auth.verify_button')}
          </Button>

          <Button
            mode="outlined"
            onPress={handleResend}
            loading={isResending}
            disabled={isResending || !pendingEmail}
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

          <Pressable
            onPress={handleGoBack}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.wrong_email_go_back')}
            style={styles.goBackLink}
          >
            <Text style={styles.goBackText}>{t('auth.wrong_email_go_back')}</Text>
          </Pressable>
        </View>
      </Animated.View>
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
      paddingTop: 24,
      paddingBottom: 40,
      alignItems: 'center',
      gap: 20,
    },
    envelopeWrap: {
      width: 88,
      height: 88,
      borderRadius: 26,
      backgroundColor: C.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.xs,
    },
    checkBadge: {
      position: 'absolute',
      bottom: -4,
      end: -4,
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 2,
    },
    textBlock: {
      alignItems: 'center',
      gap: 8,
    },
    heading: {
      fontSize: 24,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    bodyText: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    hintText: {
      fontSize: 13,
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: 4,
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
      borderRadius: 10,
    },
    resentText: {
      color: C.success,
      ...font.semibold,
      fontSize: 14,
    },
    codeInput: {
      width: '100%',
      backgroundColor: C.surface,
      letterSpacing: 4,
    },
    verifyButton: {
      borderRadius: 14,
      width: '100%',
    },
    ghostButton: {
      borderRadius: 14,
      width: '100%',
      borderColor: C.border,
      borderWidth: 1.5,
    },
    buttonContent: { height: 52 },
    buttonLabel: {
      fontSize: sizes.fontMd,
      ...font.semibold,
      letterSpacing: 0.1,
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
  });
}
