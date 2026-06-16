import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { signUpSchema } from '@utils/validation';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const AVATAR_COLORS = ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'];

function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length === 0) return 0;
  if (pw.length < 8) return 1;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  if (hasUpper && hasNum && hasSpecial) return 4;
  if (hasUpper || hasNum || hasSpecial) return 3;
  return 2;
}

const STRENGTH_COLORS = ['', '#D9534F', '#E0B24D', '#4FB071', '#3B6FBF'];

export default function SignupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState('');
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const strengthLabels = useMemo(
    () => [
      '',
      t('auth.strength_weak'),
      t('auth.strength_fair'),
      t('auth.strength_good'),
      t('auth.strength_strong'),
    ],
    [t]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const strength = getPasswordStrength(password);
  const passwordError =
    passwordTouched && password.length > 0 && password.length < 8
      ? t('auth.password_min_length')
      : null;
  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? t('auth.passwords_no_match')
      : null;

  const canSubmit =
    !isLoading &&
    confirmedAge &&
    agreedToTerms &&
    !passwordError &&
    !confirmError &&
    password.length >= 8 &&
    confirmPassword === password;

  const handleSignup = useCallback(async () => {
    if (!confirmedAge) {
      setError(t('auth.age_confirm_error'));
      return;
    }
    if (!agreedToTerms) {
      setError(t('auth.terms_agree_error'));
      return;
    }
    const result = signUpSchema.safeParse({ name, email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    try {
      setError('');
      const { needsVerification } = await signUp(
        result.data.email,
        result.data.password,
        result.data.name,
        selectedColor
      );
      if (needsVerification) {
        router.replace('/(auth)/verify-email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.something_went_wrong'));
    }
  }, [name, email, password, selectedColor, confirmedAge, agreedToTerms, signUp, t]);

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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('auth.create_account_title')}</Text>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.your_name')}</Text>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                placeholder={t('auth.name_placeholder')}
                placeholderTextColor={C.textTertiary}
                accessibilityLabel="Name input"
                accessibilityHint="Enter your full name"
              />
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError('');
                }}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="you@example.com"
                placeholderTextColor={C.textTertiary}
                accessibilityLabel="Email address input"
                accessibilityHint="Enter your email address"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError('');
                }}
                onBlur={() => setPasswordTouched(true)}
                mode="outlined"
                style={[styles.input, !!passwordError && styles.inputError]}
                outlineStyle={[styles.inputOutline, !!passwordError && styles.inputOutlineError]}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    color={C.textTertiary}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
                error={!!passwordError}
                accessibilityLabel="Password input"
                accessibilityHint="Enter a password with at least 8 characters"
              />
              {/* Strength bar */}
              {password.length > 0 && (
                <View style={styles.strengthWrap}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthSegment,
                          { backgroundColor: i <= strength ? STRENGTH_COLORS[strength] : C.border },
                        ]}
                      />
                    ))}
                  </View>
                  {strength > 0 && (
                    <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>
                      {strengthLabels[strength]}
                    </Text>
                  )}
                </View>
              )}
              {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            </View>

            {/* Confirm password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.confirm_password')}</Text>
              <TextInput
                ref={confirmRef}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setError('');
                }}
                mode="outlined"
                style={[styles.input, !!confirmError && styles.inputError]}
                outlineStyle={[styles.inputOutline, !!confirmError && styles.inputOutlineError]}
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                right={
                  <TextInput.Icon
                    icon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    color={C.textTertiary}
                    onPress={() => setShowConfirm((v) => !v)}
                  />
                }
                error={!!confirmError}
                accessibilityLabel="Confirm password input"
                accessibilityHint="Re-enter your password to confirm it matches"
              />
              {!!confirmError && <Text style={styles.fieldError}>{confirmError}</Text>}
            </View>

            {/* Avatar colour */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.pick_colour')}</Text>
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
                      {selectedColor === c && <Ionicons name="checkmark" size={18} color="#fff" />}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Age confirmation */}
            <Pressable
              style={styles.checkRow}
              onPress={() => {
                setConfirmedAge((v) => !v);
                setError('');
              }}
              accessible
              accessibilityRole="checkbox"
              accessibilityLabel="I confirm I am 18 or older"
              accessibilityState={{ checked: confirmedAge }}
            >
              <View style={[styles.checkbox, confirmedAge && styles.checkboxChecked]}>
                {confirmedAge && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={styles.checkText}>{t('auth.confirm_age')}</Text>
            </Pressable>

            {/* Terms — checkbox and links are separate to avoid conflicting tap targets */}
            <View style={styles.checkRow}>
              <Pressable
                onPress={() => {
                  setAgreedToTerms((v) => !v);
                  setError('');
                }}
                accessible
                accessibilityRole="checkbox"
                accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                accessibilityState={{ checked: agreedToTerms }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
              </Pressable>
              <Text style={styles.checkText}>
                {t('auth.terms_prefix')}
                <Text
                  style={styles.checkLink}
                  onPress={() => router.push('/(auth)/terms')}
                  accessibilityRole="link"
                >
                  {t('auth.terms_of_service')}
                </Text>
                {t('auth.terms_and')}
                <Text
                  style={styles.checkLink}
                  onPress={() => router.push('/(auth)/privacy-policy')}
                  accessibilityRole="link"
                >
                  {t('auth.privacy_policy')}
                </Text>
              </Text>
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Button
              mode="contained"
              onPress={handleSignup}
              loading={isLoading}
              disabled={!canSubmit}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={canSubmit ? C.primary : undefined}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              {t('auth.create_account')}
            </Button>

            <Pressable
              style={styles.loginRow}
              onPress={() => router.replace('/(auth)/login')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('auth.have_account_prompt') + ' ' + t('auth.log_in')}
            >
              <Text style={styles.loginText}>
                {t('auth.have_account_prompt') + ' '}
                <Text style={styles.loginLink}>{t('auth.log_in')}</Text>
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
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: sizes.lg,
      paddingTop: 28,
      paddingBottom: 48,
      gap: 20,
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
    inputOutline: {
      borderRadius: 12,
      borderColor: C.border,
    },
    inputError: {
      backgroundColor: '#FFF8F8',
    },
    inputOutlineError: {
      borderColor: C.danger,
    },
    strengthWrap: {
      gap: 4,
      marginTop: 6,
    },
    strengthBar: {
      flexDirection: 'row',
      gap: 4,
    },
    strengthSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    strengthLabel: {
      fontSize: 11,
      ...font.medium,
    },
    fieldError: {
      fontSize: sizes.fontXs,
      ...font.regular,
      color: C.danger,
    },
    colorRow: {
      flexDirection: 'row',
      gap: sizes.sm,
    },
    colorDot: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorDotSelected: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sizes.sm,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    checkboxChecked: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    checkText: {
      flex: 1,
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
    },
    checkLink: {
      color: C.primary,
      ...font.semibold,
    },
    errorText: {
      fontSize: sizes.fontXs,
      ...font.regular,
      color: C.danger,
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
    loginRow: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    loginText: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
    },
    loginLink: {
      ...font.semibold,
      color: C.primary,
    },
  });
}
