import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
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

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function SignupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [error, setError] = useState('');
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleSignup = useCallback(async () => {
    if (!confirmedAge) {
      setError('Please confirm that you are 18 or older to continue.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
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
  }, [name, email, password, selectedColor, confirmedAge, agreedToTerms, signUp, t]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
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

          <Pressable
            style={styles.termsRow}
            onPress={() => { setConfirmedAge((v) => !v); setError(''); }}
            accessible
            accessibilityRole="checkbox"
            accessibilityLabel="I confirm I am 18 or older"
            accessibilityState={{ checked: confirmedAge }}
          >
            <View style={[styles.checkbox, confirmedAge && styles.checkboxChecked]}>
              {confirmedAge && <Ionicons name="checkmark" size={14} color={'#fff'} />}
            </View>
            <Text style={styles.termsText}>I confirm I am 18 years of age or older</Text>
          </Pressable>

          <Pressable
            style={styles.termsRow}
            onPress={() => { setAgreedToTerms((v) => !v); setError(''); }}
            accessible
            accessibilityRole="checkbox"
            accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
            accessibilityState={{ checked: agreedToTerms }}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Ionicons name="checkmark" size={14} color={'#fff'} />}
            </View>
            <Text style={styles.termsText}>
              {'I agree to the '}
              <Text
                style={styles.termsLink}
                onPress={() => router.push('/(auth)/terms')}
                accessibilityRole="link"
              >
                Terms of Service
              </Text>
              {' and '}
              <Text
                style={styles.termsLink}
                onPress={() => router.push('/(auth)/privacy-policy')}
                accessibilityRole="link"
              >
                Privacy Policy
              </Text>
            </Text>
          </Pressable>

          <Button
            mode="contained"
            onPress={handleSignup}
            loading={isLoading}
            disabled={isLoading || !confirmedAge || !agreedToTerms}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={C.primary}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            {t('auth.create_account')}
          </Button>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.surface,
    },
    flex: { flex: 1 },
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
      color: C.textPrimary,
    },
    header: {
      gap: 4,
      marginBottom: sizes.xs,
    },
    title: {
      fontSize: 28,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      ...font.medium,
      color: C.textSecondary,
    },
    input: {
      backgroundColor: C.surface,
    },
    error: {
      ...font.regular,
      color: C.danger,
      fontSize: sizes.fontSm,
    },
    colorLabel: {
      ...font.semibold,
      fontSize: sizes.fontSm,
      color: C.textPrimary,
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    colorCheck: {
      fontSize: 20,
      ...font.bold,
      color: '#fff',
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sizes.sm,
      marginTop: sizes.xs,
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
    termsText: {
      flex: 1,
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
    },
    termsLink: {
      color: C.primary,
      ...font.semibold,
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
}
