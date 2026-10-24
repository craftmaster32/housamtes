import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import type { ApplianceKind, AppliancePreset } from '@stores/appliancesStore';
import { MACHINE_META, DEFAULT_PRESET_MINUTES, formatDuration } from '@components/machines/meta';

interface StartSheetProps {
  kind: ApplianceKind | null;
  presets: AppliancePreset[];
  busy: boolean;
  onClose: () => void;
  onStart: (params: { durationMinutes: number; label: string }) => void;
  onSavePreset: (params: { name: string; durationMinutes: number }) => Promise<void>;
  onDeletePreset: (id: string) => void;
}

function clampInt(value: string, max: number): number {
  const n = parseInt(value.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function StartSheetComponent({
  kind,
  presets,
  busy,
  onClose,
  onStart,
  onSavePreset,
  onDeletePreset,
}: StartSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const meta = kind ? MACHINE_META[kind] : null;
  // Cap at 24h (1440 min) to match the store/DB limit — 24h + 59m would exceed it.
  const customMinutes = Math.min(1440, clampInt(hours, 24) * 60 + clampInt(minutes, 59));
  // A preset can only be saved once the time is set and it has a name to find it by.
  const canSavePreset = customMinutes > 0 && name.trim().length > 0;

  const reset = useCallback((): void => {
    setHours('1');
    setMinutes('0');
    setName('');
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleStartCustom = useCallback((): void => {
    if (customMinutes <= 0 || !meta) return;
    onStart({ durationMinutes: customMinutes, label: name.trim() });
    reset();
  }, [customMinutes, meta, name, onStart, reset]);

  // Tapping a preset loads its time (and name) into the fields below — it does
  // NOT start the machine. The member reviews it and presses Start themselves.
  const handleUsePreset = useCallback((durationMinutes: number, label: string): void => {
    setHours(String(Math.floor(durationMinutes / 60)));
    setMinutes(String(durationMinutes % 60));
    setName(label);
  }, []);

  const handleSavePreset = useCallback(async (): Promise<void> => {
    if (!canSavePreset || isSaving) return;
    setIsSaving(true);
    try {
      await onSavePreset({ name: name.trim(), durationMinutes: customMinutes });
    } finally {
      setIsSaving(false);
    }
  }, [canSavePreset, isSaving, name, customMinutes, onSavePreset]);

  const handleHoursChange = useCallback((v: string): void => {
    const digits = v.replace(/[^0-9]/g, '').slice(0, 2);
    if (digits === '') {
      setHours('');
      return;
    }
    setHours(Math.min(parseInt(digits, 10), 24).toString());
  }, []);

  const handleMinutesChange = useCallback((v: string): void => {
    const digits = v.replace(/[^0-9]/g, '').slice(0, 2);
    if (digits === '') {
      setMinutes('');
      return;
    }
    setMinutes(Math.min(parseInt(digits, 10), 59).toString());
  }, []);

  const machineName = meta ? t(meta.labelKey) : '';
  const startDisabled = busy || customMinutes <= 0;

  return (
    <Modal
      visible={kind !== null}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={machineName}
            title={t('machines.start_title', { name: machineName })}
            onClose={handleClose}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Presets as paper tags. Tapping one fills in the time below; it
                doesn't start the machine on its own. */}
            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('machines.presets_label')}
              </Text>
              <Text style={[styles.hint, { color: c.textSecondary }]}>
                {t('machines.preset_tap_hint')}
              </Text>
              <View style={styles.tags}>
                {presets.length > 0
                  ? presets.map((p) => (
                      <View
                        key={p.id}
                        style={styles.preset}
                        accessible={false}
                        accessibilityLabel={t('machines.use_preset', {
                          name: p.name,
                          time: formatDuration(p.durationMinutes),
                        })}
                      >
                        <PaperTag
                          label={`${p.name} · ${formatDuration(p.durationMinutes)}`}
                          onPress={() => handleUsePreset(p.durationMinutes, p.name)}
                        />
                        <Pressable
                          style={styles.remove}
                          onPress={() => onDeletePreset(p.id)}
                          accessibilityRole="button"
                          accessibilityLabel={t('machines.delete_preset', { name: p.name })}
                        >
                          <Ionicons name="close" size={16} color={c.textSecondary} />
                        </Pressable>
                      </View>
                    ))
                  : DEFAULT_PRESET_MINUTES.map((min) => (
                      <PaperTag
                        key={min}
                        label={formatDuration(min)}
                        onPress={() => handleUsePreset(min, '')}
                      />
                    ))}
              </View>
            </View>

            {/* How long, as two big numbers written on lines: hours : minutes. */}
            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('machines.custom_time')}
              </Text>
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <TextInput
                    style={[
                      styles.timeInput,
                      heading,
                      { color: c.textPrimary, borderBottomColor: c.border },
                    ]}
                    value={hours}
                    onChangeText={handleHoursChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    accessibilityLabel={t('machines.hours_full')}
                    accessibilityHint={t('machines.hours_hint')}
                  />
                  <Text style={[styles.timeCaption, { color: c.textSecondary }]}>
                    {t('machines.hours_full')}
                  </Text>
                </View>
                <Text style={[styles.colon, heading, { color: c.textSecondary }]}>:</Text>
                <View style={styles.timeField}>
                  <TextInput
                    style={[
                      styles.timeInput,
                      heading,
                      { color: c.textPrimary, borderBottomColor: c.border },
                    ]}
                    value={minutes}
                    onChangeText={handleMinutesChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    accessibilityLabel={t('machines.minutes_full')}
                    accessibilityHint={t('machines.minutes_hint')}
                  />
                  <Text style={[styles.timeCaption, { color: c.textSecondary }]}>
                    {t('machines.minutes_full')}
                  </Text>
                </View>
              </View>
            </View>

            <View>
              <UnderlineInput
                value={name}
                onChangeText={setName}
                placeholder={t('machines.name_placeholder')}
                accessibilityLabel={t('machines.name_placeholder')}
                accessibilityHint={t('machines.name_hint')}
              />
              {/* Saving is separate from starting: the preset shows up as a tag above. */}
              <Pressable
                style={({ pressed }) => [
                  styles.saveLink,
                  (!canSavePreset || isSaving || pressed) && styles.dim,
                ]}
                onPress={handleSavePreset}
                disabled={!canSavePreset || isSaving}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSavePreset || isSaving }}
                accessibilityLabel={t('machines.save_as_preset')}
              >
                <Text style={[styles.saveText, hand, { color: c.primary }]}>
                  {t('machines.save_as_preset')}
                </Text>
              </Pressable>
              {customMinutes > 0 && !name.trim() && (
                <Text style={[styles.hint, { color: c.textSecondary }]}>
                  {t('machines.save_needs_name')}
                </Text>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: c.primary },
                (startDisabled || pressed) && styles.dim,
              ]}
              onPress={handleStartCustom}
              disabled={startDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: startDisabled }}
              accessibilityLabel={t('machines.start')}
            >
              <Text style={styles.submitText} numberOfLines={1}>
                {customMinutes > 0
                  ? t('machines.start_for', { time: formatDuration(customMinutes) })
                  : t('machines.start')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const StartSheet = React.memo(StartSheetComponent);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(36), gap: ms(22) },
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  hint: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(10), marginTop: ms(10) },
  preset: { flexDirection: 'row', alignItems: 'center' },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(14), marginTop: ms(4) },
  timeField: { flex: 1, alignItems: 'center' },
  timeInput: {
    alignSelf: 'stretch',
    fontSize: mf(44),
    lineHeight: mf(54),
    textAlign: 'center',
    borderBottomWidth: 2,
    paddingVertical: ms(2),
  },
  timeCaption: { fontSize: mf(12.5), ...font.semibold, marginTop: ms(6) },
  colon: { fontSize: mf(40), lineHeight: mf(54), paddingTop: ms(2) },
  saveLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  saveText: { fontSize: mf(21) },
  submit: {
    minHeight: 52,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  submitText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
