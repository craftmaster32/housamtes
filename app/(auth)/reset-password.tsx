import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function ResetPasswordScreen(): React.JSX.Element {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('auth.reset_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [password, confirm, t]);

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('auth.password_updated_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.password_updated_body')}</Text>
          <Button
            mode="contained"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={colors.primary}
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
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.reset_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.reset_subtitle')}</Text>
        </View>

        <TextInput
          label={t('auth.new_password')}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
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
          onChangeText={(v) => { setConfirm(v); setError(''); }}
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
          buttonColor={colors.primary}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Update password"
        >
          {t('auth.update_password')}
        </Button>
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
    lineHeight: 22,
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
});
