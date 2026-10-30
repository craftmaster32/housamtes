import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  useConditionStore,
  PRESET_AREAS,
  CONDITION_CONFIG,
  ENTRY_TYPE_CONFIG,
  type ConditionLevel,
  type EntryType,
} from '@stores/conditionStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';
import { formatDateDDMMYYYY } from '@utils/dates';
import { areaLabel, conditionLabel, entryTypeLabel } from '@utils/propertyLabels';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { PhotoPicker } from '@components/shared/PhotoPicker';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { LineField } from '@components/parking/LineField';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { mf, ms } from '@utils/responsive';

const CUSTOM = '__custom__';

interface ConditionSheetProps {
  visible: boolean;
  recordedBy: string;
  houseId: string;
  onClose: () => void;
}

/** Record how a room looks: circle the kind, the room and the condition; add notes and photos. */
export function ConditionSheet({
  visible,
  recordedBy,
  houseId,
  onClose,
}: ConditionSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const add = useConditionStore((s) => s.add);
  const todayStr = new Date().toISOString().split('T')[0];

  const [area, setArea] = useState(PRESET_AREAS[0].label);
  const [customArea, setCustomArea] = useState('');
  const [condition, setCondition] = useState<ConditionLevel>('good');
  const [type, setType] = useState<EntryType>('move_in');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayStr);
  const [showDate, setShowDate] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setArea(PRESET_AREAS[0].label);
    setCustomArea('');
    setCondition('good');
    setType('move_in');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setPhotos([]);
    setIsSaving(false);
    setSaveError('');
  }, [visible]);

  const useCustom = area === CUSTOM;
  const finalArea = useCustom ? customArea.trim() : area;

  const types = useMemo<ChoiceWord<EntryType>[]>(
    () =>
      (Object.keys(ENTRY_TYPE_CONFIG) as EntryType[]).map((k) => ({
        value: k,
        label: entryTypeLabel(t, k),
      })),
    [t]
  );
  const areas = useMemo<ChoiceWord<string>[]>(
    () => [
      ...PRESET_AREAS.map((a) => ({ value: a.label, label: areaLabel(t, a.label) })),
      { value: CUSTOM, label: t('condition.custom') },
    ],
    [t]
  );
  const levels = useMemo<ChoiceWord<ConditionLevel>[]>(
    () =>
      (Object.keys(CONDITION_CONFIG) as ConditionLevel[]).map((k) => ({
        value: k,
        label: conditionLabel(t, k),
      })),
    [t]
  );

  const handleSave = useCallback(async (): Promise<void> => {
    if (!finalArea || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await add(
        {
          area: finalArea,
          condition,
          type,
          description: description.trim(),
          recordedBy,
          date,
          photos,
        },
        houseId
      );
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('condition.failed_save')));
      setIsSaving(false);
    }
  }, [
    finalArea,
    isSaving,
    condition,
    type,
    description,
    recordedBy,
    date,
    photos,
    add,
    onClose,
    houseId,
    t,
  ]);

  const label = (text: string): React.JSX.Element => (
    <Text style={[styles.label, { color: c.textSecondary }]}>{text}</Text>
  );

  return (
    <PageSheet
      visible={visible}
      eyebrow={t('nav.property')}
      title={t('condition.log_condition')}
      onClose={onClose}
    >
      <View>
        {label(t('condition.type'))}
        <ChoiceWords
          options={types}
          selected={type}
          onSelect={setType}
          groupLabel={t('condition.type')}
        />
      </View>
      <View>
        {label(t('condition.room_area'))}
        <ChoiceWords
          options={areas}
          selected={area}
          onSelect={setArea}
          groupLabel={t('condition.room_area')}
        />
        {useCustom && (
          <UnderlineInput
            value={customArea}
            onChangeText={(v) => setCustomArea(v.slice(0, 60))}
            placeholder={t('condition.room_placeholder')}
            accessibilityLabel={t('condition.room_area')}
            accessibilityHint={t('condition.room_placeholder')}
          />
        )}
      </View>
      <View>
        {label(t('condition.condition_label'))}
        <ChoiceWords
          options={levels}
          selected={condition}
          onSelect={setCondition}
          groupLabel={t('condition.condition_label')}
        />
      </View>
      <LineField
        label={t('condition.date')}
        value={formatDateDDMMYYYY(date)}
        icon="calendar-outline"
        onPress={() => setShowDate(true)}
      />
      <UnderlineInput
        label={t('condition.notes')}
        value={description}
        onChangeText={(v) => setDescription(v.slice(0, 1000))}
        placeholder={t('condition.notes_placeholder')}
        multiline
        accessibilityLabel={t('condition.notes')}
        accessibilityHint={t('condition.notes_placeholder')}
      />
      <View>
        {label(t('condition.photos_up_to'))}
        <PhotoPicker photos={photos} onChange={setPhotos} maxPhotos={6} />
      </View>
      {!!saveError && <Text style={[styles.error, { color: c.danger }]}>{saveError}</Text>}
      <SheetButton
        label={isSaving ? t('condition.saving') : t('condition.save_entry')}
        accessibilityLabel={t('condition.save_entry')}
        onPress={handleSave}
        disabled={!finalArea || isSaving}
      />
      <DatePickerModal
        visible={showDate}
        value={date}
        onSelect={(v) => {
          setDate(v);
          setShowDate(false);
        }}
        onClose={() => setShowDate(false)}
      />
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  error: { fontSize: mf(13.5), ...font.regular },
});
