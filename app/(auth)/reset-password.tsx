import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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

export default function ResetPasswordScreen(): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
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
          secureTextEntry
          autoFocus
          returnKeyType="next"
          error={!!error && !confirm}
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
      backgroundColor: C.white,
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
      lineHeight: 22,
    },
    input: {
      backgroundColor: C.white,
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
  });
