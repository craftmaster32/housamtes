import { useState, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { AuthScreen } from '@components/auth/AuthScreen';
import { AuthField } from '@components/auth/AuthField';
import { PasswordDone } from '@components/auth/PasswordDone';
import { KeyArt } from '@components/auth/art/KeyArt';
import { SheetButton } from '@components/shared/SheetButton';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

export default function ResetPasswordScreen(): React.JSX.Element {
  const c = useThemedColors();
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
      setError(getErrorMessage(err, t('auth.reset_failed')));
    } finally {
      setIsLoading(false);
    }
  }, [password, confirm, t]);

  if (done) return <PasswordDone />;

  return (
    <AuthScreen
      title={t('auth.reset_title')}
      subtitle={t('auth.reset_subtitle')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      art={<KeyArt width={ms(64)} ink={c.textPrimary} />}
    >
      <AuthField
        password
        label={t('auth.new_password')}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError('');
        }}
        autoFocus
        autoComplete="new-password"
        returnKeyType="next"
        error={!!error && !confirm}
        accessibilityLabel={t('auth.new_password')}
        accessibilityHint={t('auth.new_password_hint')}
      />

      <AuthField
        password
        label={t('auth.confirm_password')}
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setError('');
        }}
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={handleReset}
        error={!!error}
        accessibilityLabel={t('auth.confirm_password')}
        accessibilityHint={t('auth.confirm_password_hint')}
      />

      {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

      <SheetButton
        label={t('auth.update_password')}
        onPress={handleReset}
        loading={isLoading}
        disabled={isLoading}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
});
