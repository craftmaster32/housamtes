import { useState, useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { profileDetailsSchema } from '@utils/validation';
import { getErrorMessage } from '@utils/errors';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { mf } from '@utils/responsive';

interface DetailsSheetProps {
  visible: boolean;
  currentName: string;
  currentEmail: string;
  onClose: () => void;
}

/** Change your name or email, written on lines. */
export function DetailsSheet({
  visible,
  currentName,
  currentEmail,
  onClose,
}: DetailsSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const updateProfile = useAuthStore((ss) => ss.updateProfile);
  const updateEmail = useAuthStore((ss) => ss.updateEmail);
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(currentName);
    setEmail(currentEmail);
    setError('');
    setSuccess('');
  }, [visible, currentName, currentEmail]);

  const handleSave = useCallback(async (): Promise<void> => {
    const parsed = profileDetailsSchema.safeParse({ name, email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('profile.check_details'));
      return;
    }
    const trimName = parsed.data.name;
    const trimEmail = parsed.data.email;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const nameChanged = trimName !== currentName;
      const emailChanged = trimEmail !== currentEmail.toLowerCase();
      if (nameChanged) await updateProfile(trimName);
      if (emailChanged) await updateEmail(trimEmail);
      if (nameChanged && emailChanged) {
        setSuccess(t('profile.name_and_email_updated'));
      } else if (nameChanged) {
        setSuccess(t('profile.name_updated'));
      } else if (emailChanged) {
        setSuccess(t('profile.email_confirm_sent'));
      } else {
        onClose();
        return;
      }
    } catch (err) {
      setError(getErrorMessage(err, t('profile.could_not_save')));
    } finally {
      setSaving(false);
    }
  }, [name, email, currentName, currentEmail, updateProfile, updateEmail, onClose, t]);

  const edit =
    (set: (v: string) => void) =>
    (v: string): void => {
      set(v);
      setError('');
      setSuccess('');
    };

  return (
    <PageSheet
      visible={visible}
      eyebrow={t('profile.profile_label')}
      title={t('profile.personal_details')}
      onClose={onClose}
    >
      <UnderlineInput
        label={t('profile.display_name')}
        value={name}
        onChangeText={edit(setName)}
        placeholder={t('profile.your_name_placeholder')}
        autoCapitalize="words"
        accessibilityLabel={t('profile.display_name')}
      />
      <UnderlineInput
        label={t('profile.email_address')}
        value={email}
        onChangeText={edit(setEmail)}
        placeholder={t('profile.email_placeholder')}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        accessibilityLabel={t('profile.email_address')}
        accessibilityHint={t('profile.email_change_hint')}
      />
      <Text style={[styles.hint, { color: c.textSecondary }]}>
        {t('profile.email_change_hint')}
      </Text>
      {!!error && <Text style={[styles.hint, { color: c.danger }]}>{error}</Text>}
      {!!success && <Text style={[styles.success, hand, { color: c.positive }]}>{success}</Text>}
      <SheetButton
        label={saving ? t('profile.saving') : t('profile.save_changes')}
        onPress={handleSave}
        disabled={saving}
      />
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: mf(13), lineHeight: mf(18), ...font.regular, marginTop: -8 },
  success: { fontSize: mf(19), lineHeight: mf(23) },
});
