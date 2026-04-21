import { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { signUpSchema } from '@utils/validation';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function SignupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState('');
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);

  const handleSignup = useCallback(async () => {
    const result = signUpSchema.safeParse({ name, email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    try {
      setError('');
      const { needsVerification } = await signUp(result.data.email, result.data.password, result.data.name, selectedColor);
      if (needsVerification) {
        router.replace('/(auth)/verify-email');
      }
      // If no verification needed, root layout handles navigation
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.something_went_wrong'));
    }
  }, [name, email, password, selectedColor, signUp, t]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <Text style={styles.title}>{t('auth.create_account')}</Text>
          <Text style={styles.subtitle}>{t('auth.create_account_subtitle')}</Text>
        </View>

        <TextInput
          label={t('auth.your_name')}
          value={name}
          onChangeText={(v) => { setName(v); setError(''); }}
          mode="outlined"
          style={styles.input}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={!!error}
        />

        <TextInput
          ref={emailRef}
          label={t('auth.email')}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={!!error}
        />

        <TextInput
          ref={passwordRef}
          label={t('auth.password')}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          mode="outlined"
          style={styles.input}
          secureTextEntry={!showPassword}
          returnKeyType="go"
          onSubmitEditing={handleSignup}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword((v) => !v)}
            />
          }
          error={!!error}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.colorLabel}>{t('auth.pick_colour')}</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setSelectedColor(c)}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ checked: selectedColor === c }}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorDotSelected,
                ]}
              >
                {selectedColor === c && (
                  <Text style={styles.colorCheck}>✓</Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleSignup}
          loading={isLoading}
          disabled={isLoading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          buttonColor={colors.primary}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {t('auth.create_account')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: sizes.lg,
    paddingTop: sizes.sm,
    paddingBottom: sizes.xl,
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
  colorLabel: {
    ...font.semibold,
    fontSize: sizes.fontSm,
    color: colors.textPrimary,
    marginTop: sizes.xs,
  },
  colorRow: {
    flexDirection: 'row',
    gap: sizes.sm,
  },
  colorDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotSelected: {
    boxShadow: '0 0 0 3px rgba(0,0,0,0.15)',
  } as never,
  colorCheck: {
    fontSize: 20,
    ...font.bold,
    color: colors.white,
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
});
