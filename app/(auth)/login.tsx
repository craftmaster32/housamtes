import { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, type TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { signInSchema, mapZodError } from '@utils/validation';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { font } from '@constants/typography';
import { AuthScreen } from '@components/auth/AuthScreen';
import { AuthField } from '@components/auth/AuthField';
import { TextLink } from '@components/auth/TextLink';
import { KeyArt } from '@components/auth/art/KeyArt';
import { SheetButton } from '@components/shared/SheetButton';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const passwordRef = useRef<RNTextInput>(null);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { t } = useTranslation();
  const C = useThemedColors();
  const hand = useHandFont();

  useEffect(() => {
    return (): void => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, []);

  const startLockout = useCallback(() => {
    setLockoutRemaining(LOCKOUT_SECONDS);
    lockoutTimer.current = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          if (lockoutTimer.current) clearInterval(lockoutTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleLogin = useCallback(async (): Promise<void> => {
    if (isLoading || lockoutRemaining > 0) return;

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setError(mapZodError(result.error.errors[0].message, t));
      return;
    }
    try {
      setError('');
      await signIn(result.data.email, result.data.password);
      setFailedAttempts(0);
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setFailedAttempts(0);
        startLockout();
        setError(t('auth.too_many_attempts', { n: LOCKOUT_SECONDS }));
      } else {
        setError(getErrorMessage(err, t('auth.sign_in_failed')));
      }
    }
  }, [email, password, signIn, isLoading, failedAttempts, lockoutRemaining, startLockout, t]);

  return (
    <AuthScreen
      title={t('auth.sign_in')}
      subtitle={t('welcome.tagline')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      art={<KeyArt width={ms(64)} ink={C.textPrimary} />}
    >
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
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        accessibilityLabel={t('auth.email')}
        accessibilityHint={t('auth.email_hint')}
        error={!!error}
      />

      <View>
        <AuthField
          ref={passwordRef}
          password
          label={t('auth.password')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError('');
          }}
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          accessibilityLabel={t('auth.password')}
          accessibilityHint={t('auth.password_hint')}
          error={!!error}
        />
        <Pressable
          style={styles.forgotBtn}
          onPress={() => router.push('/(auth)/forgot-password')}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('auth.forgot_password')}
        >
          <Text style={[styles.forgotText, hand, { color: C.primary }]}>
            {t('auth.forgot_password')}
          </Text>
        </Pressable>
      </View>

      {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

      <SheetButton
        onPress={handleLogin}
        loading={isLoading}
        disabled={isLoading || lockoutRemaining > 0}
        accessibilityLabel={
          lockoutRemaining > 0 ? t('auth.locked_out', { n: lockoutRemaining }) : t('auth.sign_in')
        }
        label={
          lockoutRemaining > 0
            ? t('auth.try_again_in', { n: lockoutRemaining })
            : isLoading
              ? t('auth.signing_in')
              : t('auth.sign_in')
        }
      />

      <TextLink
        lead={t('auth.no_account')}
        label={t('auth.sign_up')}
        onPress={() => router.push('/(auth)/signup')}
        accessibilityLabel={t('auth.no_account_signup')}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgotBtn: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingStart: ms(8),
    paddingEnd: ms(4),
  },
  forgotText: { fontSize: mf(19) },
  error: { ...font.medium, fontSize: mf(14), lineHeight: mf(20) },
});
