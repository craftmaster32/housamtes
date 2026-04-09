import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function VerifyEmailScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const [resent, setResent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');

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
  }, [pendingEmail, resendVerification]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>{t('auth.check_email_title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.check_email_sent_to')}
        </Text>
        {!!pendingEmail && (
          <Text style={styles.email} selectable>{pendingEmail}</Text>
        )}
        <Text style={styles.instructions}>
          {t('auth.check_email_body')}
        </Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {resent && (
          <View style={styles.resentBanner}>
            <Text style={styles.resentText}>{t('auth.email_sent')}</Text>
          </View>
        )}

        <Button
          mode="contained"
          onPress={() => router.replace('/(auth)/login')}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          buttonColor={colors.primary}
        >
          {t('auth.go_to_sign_in')}
        </Button>

        <Pressable
          onPress={handleResend}
          disabled={isResending}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Resend verification email"
          style={styles.resendBtn}
        >
          <Text style={styles.resendText}>
            {isResending ? t('auth.sending') : t('auth.resend_email')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: {
    flex: 1,
    paddingHorizontal: sizes.xl,
    paddingTop: sizes.xxl,
    alignItems: 'center',
    gap: sizes.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight + '33',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sizes.sm,
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: 26,
    ...font.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    ...font.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: -sizes.xs,
  },
  email: {
    fontSize: 15,
    ...font.semibold,
    color: colors.primary,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    ...font.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: sizes.sm,
  },
  error: {
    color: colors.danger,
    fontSize: sizes.fontSm,
    ...font.regular,
    textAlign: 'center',
  },
  resentBanner: {
    backgroundColor: colors.positive + '20',
    paddingVertical: sizes.xs,
    paddingHorizontal: sizes.md,
    borderRadius: 10,
  },
  resentText: { color: colors.positive, ...font.semibold, fontSize: 14 },
  button: { borderRadius: 14, width: '100%' },
  buttonContent: { height: 52 },
  buttonLabel: { fontSize: 16, ...font.semibold, letterSpacing: 0.2 },
  resendBtn: { paddingVertical: sizes.sm },
  resendText: { color: colors.primary, fontSize: 14, ...font.medium },
});
