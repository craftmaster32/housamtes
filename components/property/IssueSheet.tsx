import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useMaintenanceStore, MAINTENANCE_CATEGORIES } from '@stores/maintenanceStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';
import { categoryLabel } from '@utils/propertyLabels';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { mf, ms } from '@utils/responsive';

interface IssueSheetProps {
  visible: boolean;
  reportedBy: string;
  houseId: string;
  onClose: () => void;
}

/** Log a maintenance issue: circle what kind, then write it on the lines. */
export function IssueSheet({
  visible,
  reportedBy,
  houseId,
  onClose,
}: IssueSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const add = useMaintenanceStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(MAINTENANCE_CATEGORIES[0].label);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setCategory(MAINTENANCE_CATEGORIES[0].label);
    setIsSaving(false);
    setSaveError('');
  }, [visible]);

  const categories = useMemo<ChoiceWord<string>[]>(
    () => MAINTENANCE_CATEGORIES.map((m) => ({ value: m.label, label: categoryLabel(t, m.label) })),
    [t]
  );

  const handleSave = useCallback(async (): Promise<void> => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await add(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          status: 'open',
          reportedBy,
        },
        houseId
      );
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('maintenance.failed_save')));
      setIsSaving(false);
    }
  }, [title, description, category, reportedBy, houseId, add, onClose, isSaving, t]);

  return (
    <PageSheet
      visible={visible}
      eyebrow={t('nav.property')}
      title={t('maintenance.new_request')}
      onClose={onClose}
    >
      <View>
        <Text style={[styles.label, { color: c.textSecondary }]}>{t('maintenance.category')}</Text>
        <ChoiceWords
          options={categories}
          selected={category}
          onSelect={setCategory}
          groupLabel={t('maintenance.category')}
        />
      </View>
      <UnderlineInput
        label={t('maintenance.issue_label')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('maintenance.issue_placeholder')}
        accessibilityLabel={t('maintenance.issue_label')}
        accessibilityHint={t('maintenance.issue_placeholder')}
      />
      <UnderlineInput
        label={t('maintenance.details_label')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('maintenance.details_placeholder')}
        multiline
        accessibilityLabel={t('maintenance.details_label')}
        accessibilityHint={t('maintenance.details_placeholder')}
      />
      {!!saveError && <Text style={[styles.error, { color: c.danger }]}>{saveError}</Text>}
      <SheetButton
        label={isSaving ? t('common.loading') : t('maintenance.log_issue')}
        accessibilityLabel={t('maintenance.log_issue')}
        onPress={handleSave}
        disabled={!title.trim() || isSaving}
      />
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  error: { fontSize: mf(13.5), ...font.regular },
});
