import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { mf, ms } from '@utils/responsive';
import type { ApplianceKind, AppliancePreset } from '@stores/appliancesStore';
import { MACHINE_META, DEFAULT_PRESET_MINUTES, formatDuration } from './meta';

interface StartSheetProps {
  kind: ApplianceKind | null;
  presets: AppliancePreset[];
  busy: boolean;
  onClose: () => void;
  onStart: (params: { durationMinutes: number; label: string }) => void;
  onSavePreset: (params: { name: string; durationMinutes: number }) => void;
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
  const styles = useMemo(() => makeStyles(c), [c]);

  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [name, setName] = useState('');
  const [saveAsPreset, setSaveAsPreset] = useState(false);

  const meta = kind ? MACHINE_META[kind] : null;
  const customMinutes = clampInt(hours, 24) * 60 + clampInt(minutes, 59);

  const reset = useCallback((): void => {
    setHours('1');
    setMinutes('0');
    setName('');
    setSaveAsPreset(false);
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleStartCustom = useCallback((): void => {
    if (customMinutes <= 0 || !meta) return;
    if (saveAsPreset && name.trim()) {
      onSavePreset({ name: name.trim(), durationMinutes: customMinutes });
    }
    onStart({ durationMinutes: customMinutes, label: name.trim() });
    reset();
  }, [customMinutes, meta, saveAsPreset, name, onSavePreset, onStart, reset]);

  const handleQuick = useCallback(
    (durationMinutes: number, label: string): void => {
      onStart({ durationMinutes, label });
      reset();
    },
    [onStart, reset]
  );

  return (
    <Modal visible={kind !== null} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          {meta && (
            <View style={styles.titleRow}>
              <View style={[styles.titleChip, { backgroundColor: meta.color + '1F' }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <Text style={styles.title}>
                {t('machines.start_title', { name: t(meta.labelKey) })}
              </Text>
            </View>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Saved / default presets — tap to start straight away */}
            <Text style={styles.sectionLabel}>{t('machines.quick_start')}</Text>
            <View style={styles.chips}>
              {presets.length > 0
                ? presets.map((p) => (
                    <View key={p.id} style={styles.presetWrap}>
                      <Pressable
                        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                        onPress={() => handleQuick(p.durationMinutes, p.name)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel={t('machines.start_preset', {
                          name: p.name,
                          time: formatDuration(p.durationMinutes),
                        })}
                      >
                        <Text style={styles.chipName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.chipTime}>{formatDuration(p.durationMinutes)}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.presetDelete}
                        onPress={() => onDeletePreset(p.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('machines.delete_preset', { name: p.name })}
                      >
                        <Ionicons name="close-circle" size={18} color={c.textTertiary} />
                      </Pressable>
                    </View>
                  ))
                : DEFAULT_PRESET_MINUTES.map((min) => (
                    <Pressable
                      key={min}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => handleQuick(min, '')}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={t('machines.start_for', { time: formatDuration(min) })}
                    >
                      <Text style={styles.chipTime}>{formatDuration(min)}</Text>
                    </Pressable>
                  ))}
            </View>

            {/* Custom duration */}
            <Text style={styles.sectionLabel}>{t('machines.custom_time')}</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <TextInput
                  style={styles.timeInput}
                  value={hours}
                  onChangeText={(v) => setHours(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel={t('machines.hours')}
                />
                <Text style={styles.timeUnit}>{t('machines.hours')}</Text>
              </View>
              <View style={styles.timeField}>
                <TextInput
                  style={styles.timeInput}
                  value={minutes}
                  onChangeText={(v) => setMinutes(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel={t('machines.minutes')}
                />
                <Text style={styles.timeUnit}>{t('machines.minutes')}</Text>
              </View>
            </View>

            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder={t('machines.name_placeholder')}
              placeholderTextColor={c.textTertiary}
              maxLength={40}
              accessibilityLabel={t('machines.name_placeholder')}
            />

            <Pressable
              style={styles.saveRow}
              onPress={() => setSaveAsPreset((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: saveAsPreset }}
              accessibilityLabel={t('machines.save_as_preset')}
            >
              <View
                style={[
                  styles.checkbox,
                  saveAsPreset
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { borderColor: c.border },
                ]}
              >
                {saveAsPreset && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={styles.saveText}>{t('machines.save_as_preset')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.startBtn,
                { backgroundColor: meta?.color ?? c.primary },
                (busy || customMinutes <= 0 || (saveAsPreset && !name.trim())) && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={handleStartCustom}
              disabled={busy || customMinutes <= 0 || (saveAsPreset && !name.trim())}
              accessibilityRole="button"
              accessibilityLabel={t('machines.start')}
            >
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.startText}>
                {customMinutes > 0
                  ? t('machines.start_for', { time: formatDuration(customMinutes) })
                  : t('machines.start')}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const StartSheet = React.memo(StartSheetComponent);

const makeStyles = (c: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: ms(22),
      borderTopRightRadius: ms(22),
      padding: sizes.lg,
      paddingBottom: sizes.xxl,
      maxHeight: '86%',
    },
    handle: {
      width: ms(38),
      height: ms(4),
      borderRadius: ms(2),
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: ms(14),
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), marginBottom: ms(14) },
    titleChip: {
      width: ms(34),
      height: ms(34),
      borderRadius: ms(11),
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, fontSize: mf(18), ...font.bold, color: c.textPrimary },
    sectionLabel: {
      fontSize: mf(11),
      ...font.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textSecondary,
      marginBottom: ms(9),
      marginTop: ms(6),
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(9) },
    presetWrap: { position: 'relative' },
    chip: {
      minWidth: ms(74),
      paddingHorizontal: ms(14),
      paddingVertical: ms(10),
      borderRadius: ms(13),
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      gap: ms(1),
    },
    chipName: { fontSize: mf(13.5), ...font.semibold, color: c.textPrimary, maxWidth: ms(120) },
    chipTime: { fontSize: mf(12.5), ...font.bold, color: c.textSecondary },
    presetDelete: {
      position: 'absolute',
      top: ms(-6),
      right: ms(-6),
      backgroundColor: c.background,
      borderRadius: ms(9),
    },
    timeRow: { flexDirection: 'row', gap: ms(12) },
    timeField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      backgroundColor: c.surface,
      borderRadius: ms(13),
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: ms(12),
    },
    timeInput: {
      flex: 1,
      paddingVertical: ms(12),
      fontSize: mf(20),
      ...font.bold,
      color: c.textPrimary,
      textAlign: 'center',
    },
    timeUnit: { fontSize: mf(13), ...font.medium, color: c.textSecondary },
    nameInput: {
      marginTop: ms(12),
      backgroundColor: c.surface,
      borderRadius: ms(13),
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      fontSize: mf(15),
      ...font.regular,
      color: c.textPrimary,
    },
    saveRow: { flexDirection: 'row', alignItems: 'center', gap: ms(9), marginTop: ms(14) },
    checkbox: {
      width: ms(20),
      height: ms(20),
      borderRadius: ms(6),
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { fontSize: mf(14), ...font.medium, color: c.textPrimary },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      paddingVertical: ms(14),
      borderRadius: ms(14),
      marginTop: ms(18),
    },
    startText: { fontSize: mf(15), ...font.bold, color: '#fff' },
    pressed: { opacity: 0.9 },
    disabled: { opacity: 0.5 },
  });
