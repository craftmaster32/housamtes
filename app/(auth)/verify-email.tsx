import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function VerifyEmailScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const [resent, setResent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const handleResend = useCallback(async () => {
    if (!pendingEmail) return;
    try {
      setIsResending(true);
      setError('');
      await resendVerification(pendingEmail);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.could_not_resend'));
    } finally {
      setIsResending(false);
    }
  }, [pendingEmail, resendVerification, t]);

  return (
    <View style={styles.root}>
      {/* Blue inner header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace('/(auth)/login')}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('auth.go_to_sign_in')}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('auth.check_email_title')}</Text>
        <Text style={styles.headerSubtitle}>{t('auth.check_email_body')}</Text>
      </SafeAreaView>

      {/* White card */}
      <View style={styles.cardWrapper}>
        <View style={styles.card}>
          {/* Envelope illustration */}
          <View style={styles.envelopeWrap}>
            <Ionicons name="mail" size={44} color={C.primary} />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.bodyText}>{t('auth.check_email_sent_to')}</Text>
            {!!pendingEmail && (
              <Text style={styles.emailText} selectable>
                {pendingEmail}
              </Text>
            )}
            {!pendingEmail && <Text style={styles.errorText}>{t('auth.no_pending_email')}</Text>}
            <Text style={styles.hintText}>{t('auth.spam_hint')}</Text>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {resent && (
            <View style={styles.resentBanner}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={styles.resentText}>{t('auth.email_sent')}</Text>
            </View>
          )}

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
            accessibilityLabel={t('auth.resend_email')}
          >
            {isResending ? t('auth.sending') : t('auth.resend_email')}
          </Button>

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.go_to_sign_in')}
            style={styles.backToLogin}
          >
            <Text style={styles.backToLoginText}>{t('auth.go_to_sign_in')}</Text>
          </Pressable>
        </View>
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
    header: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.lg,
      paddingBottom: 28,
      gap: 8,
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
    headerTitle: {
      fontSize: 22,
      ...font.extrabold,
      color: '#fff',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
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
      paddingHorizontal: sizes.lg,
      paddingTop: 36,
      paddingBottom: 40,
      alignItems: 'center',
      gap: 20,
    },
    envelopeWrap: {
      width: 88,
      height: 88,
      borderRadius: 26,
      backgroundColor: '#EAF3FF',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.xs,
    },
    textBlock: {
      alignItems: 'center',
      gap: 8,
    },
    bodyText: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    emailText: {
      fontSize: 15,
      ...font.semibold,
      color: C.primary,
      textAlign: 'center',
    },
    hintText: {
      fontSize: 13,
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
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
      backgroundColor: '#EBF7EF',
      paddingVertical: sizes.xs,
      paddingHorizontal: sizes.md,
      borderRadius: 10,
    },
    resentText: {
      color: C.success,
      ...font.semibold,
      fontSize: 14,
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
    backToLogin: {
      paddingVertical: sizes.sm,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    backToLoginText: {
      fontSize: sizes.fontSm,
      ...font.medium,
      color: C.primary,
      textAlign: 'center',
    },
  });
}
