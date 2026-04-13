import { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { signInSchema } from '@utils/validation';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const passwordRef = useRef<RNTextInput>(null);

  const handleLogin = useCallback(async () => {
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    try {
      setError('');
      await signIn(result.data.email, result.data.password);
      // Auth state listener in authStore will update houseId;
      // root layout will redirect based on auth + houseId state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  }, [email, password, signIn]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Back button */}
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to HouseMates</Text>
        </View>

        <TextInput
          label="Email"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(''); }}
          mode="outlined"
          style={styles.input}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={!!error}
        />

        <TextInput
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
          mode="outlined"
          style={styles.input}
          secureTextEntry={!showPassword}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword((v) => !v)}
            />
          }
          error={!!error}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={isLoading}
          disabled={isLoading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          buttonColor={colors.primary}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          Sign in
        </Button>

        <Pressable
          style={styles.forgotBtn}
          onPress={() => router.push('/(auth)/forgot-password')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: sizes.lg,
    paddingTop: sizes.sm,
    gap: sizes.md,
  },
  backBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: sizes.xs,
  },
  backBtnText: {
    fontSize: 24,
    ...font.regular,
    color: colors.textPrimary,
  },
  header: {
    gap: 4,
    marginBottom: sizes.xs,
  },
  title: {
    fontSize: 28,
    ...font.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    ...font.medium,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.white,
  },
  error: {
    ...font.regular,
    color: colors.danger,
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
  forgotBtn: {
    alignSelf: 'center',
    paddingVertical: sizes.sm,
    paddingHorizontal: sizes.md,
  },
  forgotText: {
    fontSize: 15,
    ...font.medium,
    color: colors.primary,
  },
});
