import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

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

  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      setError(t('auth.email'));
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (err) throw err;
      setStep('code');
    } catch {
      setError(t('auth.could_not_send_code'));
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleReset = useCallback(async () => {
    if (!code.trim()) {
      setError(t('auth.enter_code_error'));
      return;
    }
    if (!password) {
      setError(t('auth.enter_password_error'));
      return;
    }
    if (password.length < 6) {
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
      // Verify the OTP code — this creates a session
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'magiclink',
      });
      if (otpErr) throw otpErr;

      // Update password while session is active
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // Sign out so user logs in fresh with new password
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('otp')) {
        setError(t('auth.invalid_expired_code'));
      } else {
        setError(t('auth.something_went_wrong'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [code, email, password, confirm]);

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.title}>{t('auth.password_updated_title')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.password_updated_body')}
            </Text>
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
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (step === 'code') {
              setStep('email');
              setError('');
              setCode('');
            } else {
              router.back();
            }
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>

        {step === 'email' ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.forgot_title')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.forgot_subtitle')}
              </Text>
            </View>

            <TextInput
              label={t('auth.email')}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              autoFocus
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="send"
              onSubmitEditing={handleSendCode}
              error={!!error}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button
              mode="contained"
              onPress={handleSendCode}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={colors.primary}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Send code"
            >
              {t('auth.send_code')}
            </Button>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.enter_code_title')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.enter_code_subtitle')}
              </Text>
            </View>

            <TextInput
              label={t('auth.code_from_email')}
              value={code}
              onChangeText={(v) => { setCode(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              autoFocus
              keyboardType="number-pad"
              returnKeyType="next"
              maxLength={8}
              error={!!error}
            />

            <TextInput
              label={t('auth.new_password')}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              secureTextEntry
              returnKeyType="next"
              error={!!error}
            />

            <TextInput
              label={t('auth.confirm_password')}
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleReset}
              error={!!error}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button
              mode="contained"
              onPress={handleReset}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={colors.primary}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Update password"
            >
              {t('auth.update_password')}
            </Button>

            <Button
              mode="text"
              onPress={handleSendCode}
              disabled={isLoading}
              labelStyle={{ color: colors.primary }}
            >
              {t('auth.resend_code')}
            </Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.sm, gap: sizes.md },
  backBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: sizes.xs,
  },
  backBtnText: { fontSize: 24, ...font.regular, color: colors.textPrimary },
  header: { gap: 4, marginBottom: sizes.xs },
  title: { fontSize: 28, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, ...font.medium, color: colors.textSecondary, lineHeight: 22 },
  input: { backgroundColor: colors.white },
  error: { ...font.regular, color: colors.danger, fontSize: sizes.fontSm },
  button: { borderRadius: 14, marginTop: sizes.sm },
  buttonContent: { height: 52 },
  buttonLabel: { fontSize: 16, ...font.semibold, letterSpacing: 0.2 },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sizes.md },
  successIcon: { fontSize: 52 },
});
