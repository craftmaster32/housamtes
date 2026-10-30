import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { changePasswordSchema } from '@utils/validation';
import { getErrorMessage } from '@utils/errors';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { mf } from '@utils/responsive';

interface PasswordSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Change your password: the current one, the new one twice. */
export function PasswordSheet({ visible, onClose }: PasswordSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const changePassword = useAuthStore((ss) => ss.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  }, [visible]);

  const handleSave = useCallback(async (): Promise<void> => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('profile.check_details'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, t('profile.could_not_update')));
    } finally {
      setSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, changePassword, t]);

  const edit =
    (set: (v: string) => void) =>
    (v: string): void => {
      set(v);
      setError('');
    };

  return (
    <PageSheet
      visible={visible}
      eyebrow={t('profile.profile_label')}
      title={t('profile.change_password')}
      onClose={onClose}
    >
      {success ? (
        <>
          <Text style={[styles.success, hand, { color: c.positive }]}>
            {t('profile.password_success')}
          </Text>
          <SheetButton label={t('common.done')} onPress={onClose} />
        </>
      ) : (
        <>
          <UnderlineInput
            label={t('profile.current_password')}
            value={currentPassword}
            onChangeText={edit(setCurrentPassword)}
            placeholder={t('profile.current_password_placeholder')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="off"
            accessibilityLabel={t('profile.current_password')}
          />
          <UnderlineInput
            label={t('profile.new_password')}
            value={newPassword}
            onChangeText={edit(setNewPassword)}
            placeholder={t('profile.new_password_placeholder')}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel={t('profile.new_password')}
          />
          <UnderlineInput
            label={t('profile.confirm_new_password')}
            value={confirmPassword}
            onChangeText={edit(setConfirmPassword)}
            placeholder={t('profile.confirm_password_placeholder')}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel={t('profile.confirm_new_password')}
          />
          {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
          <SheetButton
            label={saving ? t('profile.saving') : t('profile.update_password')}
            onPress={handleSave}
            disabled={saving}
          />
          <Pressable
            onPress={() => {
              onClose();
              router.push('/(auth)/forgot-password');
            }}
            accessibilityRole="button"
            style={styles.link}
          >
            <Text style={[styles.linkText, { color: c.primary }]}>
              {t('profile.forgot_your_password')}
            </Text>
          </Pressable>
        </>
      )}
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  success: { fontSize: mf(21), lineHeight: mf(26) },
  error: { fontSize: mf(13), lineHeight: mf(18), ...font.regular },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  linkText: { fontSize: mf(14.5), ...font.semibold },
});
