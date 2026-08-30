import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { getErrorMessage } from '@utils/errors';

import { mf, ms } from '@utils/responsive';
export default function ResetPasswordScreen(): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const { width } = useWindowDimensions();
  const isWide = width >= 680;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const toggleShowPassword = useCallback((): void => setShowPassword((v) => !v), []);
  const toggleShowConfirm = useCallback((): void => setShowConfirm((v) => !v), []);

  const handleReset = useCallback(async () => {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      useAuthStore.getState().clearPasswordRecovery();
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.reset_failed')));
    } finally {
      setIsLoading(false);
    }
  }, [password, confirm, t]);

  // Rendered on the leading side of the field in RTL and the trailing side in
  // LTR, matching react-native-paper's left/right prop (which the app's
  // manual web RTL styling does not mirror automatically).
  const passwordVisibilityIcon = (
    <TextInput.Icon
      icon={showPassword ? 'eye-off' : 'eye'}
      onPress={toggleShowPassword}
      forceTextInputFocus={false}
      accessible
      accessibilityRole="button"
      accessibilityState={{ expanded: showPassword }}
      accessibilityLabel={showPassword ? t('auth.hide_password') : t('auth.show_password')}
    />
  );
  const confirmVisibilityIcon = (
    <TextInput.Icon
      icon={showConfirm ? 'eye-off' : 'eye'}
      onPress={toggleShowConfirm}
      forceTextInputFocus={false}
      accessible
      accessibilityRole="button"
      accessibilityState={{ expanded: showConfirm }}
      accessibilityLabel={showConfirm ? t('auth.hide_password') : t('auth.show_password')}
    />
  );

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.content, isWide && styles.contentWide]}>
          <Text style={[styles.title, headingFont]}>{t('auth.password_updated_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.password_updated_body')}</Text>
          <Button
            mode="contained"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={c.primary}
          >
            {t('auth.go_to_sign_in')}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color={c.primary} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, headingFont]}>{t('auth.reset_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.reset_subtitle')}</Text>
        </View>

        <TextInput
          label={t('auth.new_password')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError('');
          }}
          mode="outlined"
          style={styles.input}
          secureTextEntry={!showPassword}
          autoFocus
          returnKeyType="next"
          error={!!error && !confirm}
          accessibilityLabel={t('auth.new_password')}
          accessibilityHint={t('auth.new_password_hint')}
          left={rtl ? passwordVisibilityIcon : undefined}
          right={rtl ? undefined : passwordVisibilityIcon}
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
          secureTextEntry={!showConfirm}
          returnKeyType="done"
          onSubmitEditing={handleReset}
          error={!!error}
          accessibilityLabel={t('auth.confirm_password')}
          accessibilityHint={t('auth.confirm_password_hint')}
          left={rtl ? confirmVisibilityIcon : undefined}
          right={rtl ? undefined : confirmVisibilityIcon}
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
          buttonColor={c.primary}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('auth.update_password')}
          accessibilityState={{ disabled: isLoading }}
        >
          {t('auth.update_password')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.sm,
      gap: sizes.md,
    },
    contentWide: {
      maxWidth: ms(440),
      width: '100%',
      alignSelf: 'center',
    },
    backBtn: {
      width: sizes.touchTarget,
      height: sizes.touchTarget,
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginBottom: sizes.xs,
    },
    header: {
      gap: ms(4),
      marginBottom: sizes.xs,
    },
    title: {
      fontSize: mf(28),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: mf(15),
      ...font.medium,
      color: C.textSecondary,
      lineHeight: mf(22),
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
      borderRadius: ms(14),
      marginTop: sizes.sm,
    },
    buttonContent: {
      height: ms(52),
    },
    buttonLabel: {
      fontSize: mf(16),
      ...font.semibold,
      letterSpacing: 0.2,
    },
  });
