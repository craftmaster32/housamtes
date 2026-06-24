import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { signInSchema, mapZodError } from '@utils/validation';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const passwordRef = useRef<RNTextInput>(null);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fadeAnim]);

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

  const handleLogin = useCallback(async () => {
    if (lockoutRemaining > 0) return;
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
        setError(t('auth.lockout_error', { seconds: LOCKOUT_SECONDS }));
      } else {
        setError(err instanceof Error ? err.message : t('auth.sign_in_failed'));
      }
    }
  }, [email, password, signIn, failedAttempts, lockoutRemaining, startLockout, t]);

  const isLocked = lockoutRemaining > 0;

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Blue header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoChip}>
            <Ionicons name="home" size={22} color={C.primary} />
          </View>
          <Text style={styles.appName}>HouseMates</Text>
        </View>
        <Text style={styles.tagline}>Your house, together.</Text>
      </SafeAreaView>

      {/* White card */}
      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('auth.sign_in')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                contentStyle={styles.inputText}
                outlineStyle={styles.inputOutline}
                autoFocus
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={!!error}
                placeholder="you@example.com"
                placeholderTextColor={C.textTertiary}
                accessibilityLabel="Email address"
                accessibilityHint="Enter your account email address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                contentStyle={styles.inputText}
                outlineStyle={styles.inputOutline}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                error={!!error}
                accessibilityLabel="Password"
                accessibilityHint="Enter your account password"
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    color={C.textTertiary}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={
                      showPassword ? t('common.hide_password') : t('common.show_password')
                    }
                  />
                }
              />
              <Pressable
                style={styles.forgotRow}
                onPress={() => router.push('/(auth)/forgot-password')}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('auth.forgot_password')}
              >
                <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
              </Pressable>
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading || isLocked}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={C.primary}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                isLocked ? t('auth.lockout_wait', { seconds: lockoutRemaining }) : t('auth.log_in')
              }
            >
              {isLocked ? t('auth.lockout_wait', { seconds: lockoutRemaining }) : t('auth.log_in')}
            </Button>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('common.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.signupRow}
              onPress={() => router.replace('/(auth)/signup')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('auth.no_account_prompt') + ' ' + t('auth.sign_up')}
            >
              <Text style={styles.signupText}>
                {t('auth.no_account_prompt') + ' '}
                <Text style={styles.signupLink}>{t('auth.sign_up')}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
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
      paddingBottom: sizes.lg,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: sizes.md,
      marginBottom: 6,
    },
    logoChip: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    appName: {
      fontSize: sizes.fontXxl,
      ...font.extrabold,
      color: '#fff',
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 15,
      ...font.regular,
      color: 'rgba(255,255,255,0.6)',
    },
    cardWrapper: {
      flex: 1,
      backgroundColor: C.primary,
    },
    scrollContent: {
      flexGrow: 1,
    },
    card: {
      flex: 1,
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: sizes.lg,
      paddingTop: 28,
      paddingBottom: 40,
      gap: 20,
      minHeight: 480,
    },
    cardTitle: {
      fontSize: 20,
      ...font.bold,
      color: C.textPrimary,
      letterSpacing: -0.2,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      fontSize: sizes.fontSm,
      ...font.semibold,
      color: C.textPrimary,
    },
    input: {
      backgroundColor: C.surface,
      height: 52,
    },
    inputText: {
      color: C.textPrimary,
    },
    inputOutline: {
      borderRadius: 12,
      borderColor: C.border,
    },
    forgotRow: {
      alignSelf: 'flex-end',
      paddingTop: 5,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    forgotText: {
      fontSize: 13,
      ...font.medium,
      color: C.primary,
    },
    errorText: {
      fontSize: sizes.fontXs,
      ...font.regular,
      color: C.danger,
      marginTop: -8,
    },
    button: {
      borderRadius: 14,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonContent: {
      height: 52,
    },
    buttonLabel: {
      fontSize: sizes.fontMd,
      ...font.semibold,
      letterSpacing: 0.1,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: C.border,
    },
    dividerText: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
    },
    signupRow: {
      alignItems: 'center',
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    signupText: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
    },
    signupLink: {
      ...font.semibold,
      color: C.primary,
    },
  });
}
