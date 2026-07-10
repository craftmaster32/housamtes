import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useMaintenanceStore, MAINTENANCE_CATEGORIES } from '@stores/maintenanceStore';
import { CategoryPicker } from '@components/maintenance/CategoryPicker';
import { maintenanceRequestSchema } from '@utils/validation';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';

interface AddRequestFormProps {
  onClose: () => void;
  reportedBy: string;
  houseId: string;
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    form: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: sizes.md,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    formTitle: { fontSize: 17, ...font.bold, color: C.textPrimary, marginBottom: sizes.xs },
    fieldLabel: {
      fontSize: 12,
      ...font.semibold,
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: C.background,
      borderRadius: sizes.borderRadiusSm,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: sizes.sm,
      paddingVertical: sizes.sm,
      fontSize: sizes.fontMd,
      color: C.textPrimary,
      ...font.regular,
    },
    inputMultiline: { height: 80, textAlignVertical: 'top' },
    formActions: {
      flexDirection: 'row',
      gap: sizes.sm,
      justifyContent: 'flex-end',
      marginTop: sizes.xs,
    },
    cancelBtn: {
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    cancelBtnText: { color: C.textSecondary, ...font.medium },
    saveBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
    },
    saveBtnDisabled: { backgroundColor: C.textDisabled },
    saveBtnText: { color: '#fff', ...font.semibold },
    saveError: { color: C.danger, fontSize: 13, ...font.regular },
  });

export const AddRequestForm: React.FC<AddRequestFormProps> = ({ onClose, reportedBy, houseId }) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const add = useMaintenanceStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(MAINTENANCE_CATEGORIES[0].label);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = useCallback(async () => {
    if (!title.trim() || isSaving) return;
    const parsed = maintenanceRequestSchema.safeParse({
      title,
      description,
      category,
      reportedBy,
      houseId,
    });
    if (!parsed.success) {
      setSaveError(t('maintenance.failed_save'));
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      await add(
        {
          title: parsed.data.title,
          description: parsed.data.description,
          category: parsed.data.category,
          status: 'open',
          reportedBy: parsed.data.reportedBy,
        },
        parsed.data.houseId
      );
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('maintenance.failed_save')));
      setIsSaving(false);
    }
  }, [title, description, category, reportedBy, houseId, add, onClose, isSaving, t]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('maintenance.new_request')}</Text>

      <Text style={styles.fieldLabel}>{t('maintenance.category')}</Text>
      <CategoryPicker value={category} onChange={setCategory} />

      <Text style={styles.fieldLabel}>{t('maintenance.issue_label')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('maintenance.issue_placeholder')}
        placeholderTextColor={C.textDisabled}
        maxLength={100}
        accessibilityLabel={t('maintenance.issue_label')}
        accessibilityHint={t('maintenance.issue_placeholder')}
      />

      <Text style={styles.fieldLabel}>{t('maintenance.details_label')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('maintenance.details_placeholder')}
        placeholderTextColor={C.textDisabled}
        multiline
        numberOfLines={3}
        maxLength={1000}
        accessibilityLabel={t('maintenance.details_label')}
        accessibilityHint={t('maintenance.details_placeholder')}
      />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityState={{ disabled: isSaving }}
        >
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!title.trim() || isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('maintenance.log_issue')}
          accessibilityState={{ disabled: !title.trim() || isSaving }}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? t('common.loading') : t('maintenance.log_issue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
