import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
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

  const signOut = useAuthStore((s) => s.signOut);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const fadeHeader = useRef(new Animated.Value(0)).current;
  const slideCard = useRef(new Animated.Value(30)).current;
  const fadeCard = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeHeader, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(slideCard, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(fadeCard, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeHeader, slideCard, fadeCard]);

  const handleSendCode = useCallback(async (): Promise<void> => {
    if (!email.trim()) {
      setError(t('auth.email'));
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

      await signOut();
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
  }, [code, email, password, confirm, signOut, t]);

  if (done) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={C.success} />
          </View>
          <Text style={styles.successTitle}>{t('auth.password_updated_title')}</Text>
          <Text style={styles.successBody}>{t('auth.password_updated_body')}</Text>
          <Button
            mode="contained"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={C.primary}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.go_to_sign_in')}
          >
            {t('auth.go_to_sign_in')}
          </Button>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.header, { opacity: fadeHeader }]}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              if (done) {
                router.replace('/(auth)/login');
                return;
              }
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
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {done
              ? t('auth.password_updated_title')
              : step === 'email'
                ? t('auth.forgot_title')
                : t('auth.enter_code_title')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {step === 'email'
              ? t('auth.forgot_subtitle')
              : t('auth.reset_code_sent_to', { email: email.trim() })}
          </Text>
        </SafeAreaView>
      </Animated.View>

      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: fadeCard,
            transform: [{ translateY: slideCard }],
          },
        ]}
      >
        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <TextInput
                label={t('auth.email')}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                autoFocus
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
                accessibilityLabel={t('auth.email')}
                accessibilityHint={t('auth.email_reset_hint')}
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
                buttonColor={C.primary}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('auth.send_reset_link')}
                accessibilityState={{ disabled: isLoading }}
              >
                {t('auth.send_reset_link')}
              </Button>
            </>
          ) : (
            <>
              <TextInput
                label={t('auth.verification_code_label')}
                value={code}
                onChangeText={(v) => {
                  setCode(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                autoFocus
                keyboardType="number-pad"
                returnKeyType="next"
                maxLength={6}
                accessibilityLabel={t('auth.verification_code_label')}
                accessibilityHint={t('auth.verification_code_hint')}
                error={!!error}
              />

              <TextInput
                label={t('auth.new_password')}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                returnKeyType="next"
                accessibilityLabel={t('auth.new_password')}
                accessibilityHint={t('auth.new_password_hint')}
                error={!!error}
              />

              <TextInput
                label={t('auth.confirm_password')}
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleReset}
                accessibilityLabel={t('auth.confirm_password')}
                accessibilityHint={t('auth.confirm_password_hint')}
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
                buttonColor={C.primary}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('auth.update_password')}
                accessibilityState={{ disabled: isLoading }}
              >
                {t('auth.update_password')}
              </Button>

              <Button
                mode="text"
                onPress={handleSendCode}
                disabled={isLoading}
                labelStyle={styles.resendLabel}
                textColor={C.primary}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('auth.resend_code')}
                accessibilityState={{ disabled: isLoading }}
              >
                {t('auth.resend_code')}
              </Button>
            </>
          )}
        </View>
      </Animated.View>
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
    headerInner: {
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
      paddingTop: 32,
      paddingBottom: 40,
      gap: sizes.md,
    },
    input: {
      backgroundColor: C.surface,
    },
    error: {
      ...font.regular,
      color: C.danger,
      fontSize: sizes.fontSm,
    },
    button: {
      borderRadius: 14,
      marginTop: sizes.sm,
    },
    buttonContent: {
      height: 52,
    },
    buttonLabel: {
      fontSize: 16,
      ...font.semibold,
      letterSpacing: 0.2,
    },
    resendLabel: {
      fontSize: 14,
      ...font.medium,
    },
    successContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sizes.xl,
      gap: sizes.md,
      backgroundColor: C.surface,
    },
    successIcon: {
      marginBottom: sizes.sm,
    },
    successTitle: {
      fontSize: 24,
      ...font.extrabold,
      color: C.textPrimary,
      textAlign: 'center',
    },
    successBody: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
