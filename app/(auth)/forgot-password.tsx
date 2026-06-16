import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showSentSheet, setShowSentSheet] = useState(false);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

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
      setShowSentSheet(true);
    } catch {
      setError(t('auth.could_not_send_code'));
    } finally {
      setIsLoading(false);
    }
  }, [email, t]);

  const handleConfirmSent = useCallback(() => {
    setShowSentSheet(false);
    setStep('code');
  }, []);

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
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'magiclink',
      });
      if (otpErr) throw otpErr;

      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

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
  }, [code, email, password, confirm, t]);

  const headerTitle = step === 'email' ? t('auth.forgot_title') : t('auth.enter_code_title');
  const headerSubtitle =
    step === 'email' ? t('auth.forgot_subtitle') : t('auth.enter_code_subtitle');

  return (
    <View style={styles.root}>
      {/* Blue inner header */}
      <SafeAreaView edges={['top']} style={styles.header}>
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
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
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
          {done ? (
            <View style={[styles.card, styles.cardCentered]}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={52} color={C.success} />
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
              >
                {t('auth.go_to_sign_in')}
              </Button>
            </View>
          ) : step === 'email' ? (
            <View style={styles.card}>
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
                  outlineStyle={styles.inputOutline}
                  autoFocus
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="send"
                  onSubmitEditing={handleSendCode}
                  error={!!error}
                  placeholder="you@example.com"
                  placeholderTextColor={C.textTertiary}
                />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

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
                accessibilityLabel="Send reset code"
              >
                {t('auth.send_code')}
              </Button>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('auth.code_from_email')}</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    setCode(v);
                    setError('');
                  }}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  autoFocus
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={8}
                  error={!!error}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('auth.new_password')}</Text>
                <TextInput
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError('');
                  }}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  error={!!error}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      color={C.textTertiary}
                      onPress={() => setShowPassword((v) => !v)}
                    />
                  }
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('auth.confirm_password')}</Text>
                <TextInput
                  value={confirm}
                  onChangeText={(v) => {
                    setConfirm(v);
                    setError('');
                  }}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                  error={!!error}
                />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

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
                accessibilityLabel="Update password"
              >
                {t('auth.update_password')}
              </Button>

              <Button
                mode="text"
                onPress={handleSendCode}
                disabled={isLoading}
                labelStyle={{ color: C.primary }}
              >
                {t('auth.resend_code')}
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* "Code sent" bottom sheet */}
      <Modal
        visible={showSentSheet}
        transparent
        animationType="slide"
        onRequestClose={handleConfirmSent}
      >
        <Pressable style={styles.backdrop} onPress={handleConfirmSent}>
          <Pressable
            style={styles.sheet}
            onPress={() => {
              /* swallow tap */
            }}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetIconWrap}>
              <Ionicons name="checkmark" size={28} color={C.success} />
            </View>
            <Text style={styles.sheetTitle}>Check your inbox</Text>
            <Text style={styles.sheetBody}>
              {'Reset code sent to '}
              <Text style={{ color: C.textPrimary, ...font.semibold }}>{email.trim()}</Text>
            </Text>
            <Button
              mode="contained"
              onPress={handleConfirmSent}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={C.primary}
            >
              Enter the code
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
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
      paddingVertical: 4,
      marginTop: sizes.sm,
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
      minHeight: 400,
    },
    cardCentered: {
      alignItems: 'center',
      justifyContent: 'center',
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
    buttonContent: { height: 52 },
    buttonLabel: {
      fontSize: sizes.fontMd,
      ...font.semibold,
      letterSpacing: 0.1,
    },
    successIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#EBF7EF',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.sm,
    },
    successTitle: {
      fontSize: 20,
      ...font.bold,
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
    // Bottom sheet
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(12,20,35,0.52)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.md,
      paddingBottom: 40,
      gap: 16,
      alignItems: 'center',
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: sizes.sm,
    },
    sheetIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#EBF7EF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetTitle: {
      fontSize: 18,
      ...font.bold,
      color: C.textPrimary,
    },
    sheetBody: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
  });
}
