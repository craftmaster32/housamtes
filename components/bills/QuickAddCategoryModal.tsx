import { useState, useCallback, useMemo } from 'react';
import { View, Modal, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import {
  useExpenseCategoriesStore,
  PRESET_COLORS,
  CATEGORY_PICKER_ICONS,
  DEFAULT_CATEGORY_ICON,
  DUPLICATE_CATEGORY,
  resolveCategoryIcon,
} from '@stores/expenseCategoriesStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { mf, ms } from '@utils/responsive';

export interface QuickAddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  // Called with the new category's name once it is saved, so the caller can
  // select it straight away in the picker.
  onCreated: (name: string) => void;
}

/**
 * Adds an expense category from inside the bill form, without navigating away —
 * so the half-filled bill is never lost and the new category appears in the
 * picker the moment it is saved (both read the same shared store).
 */
export function QuickAddCategoryModal({
  visible,
  onClose,
  onCreated,
}: QuickAddCategoryModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const houseId = useAuthStore((s) => s.houseId);
  const add = useExpenseCategoriesStore((s) => s.add);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback((): void => {
    setName('');
    setIcon(DEFAULT_CATEGORY_ICON);
    setColor(PRESET_COLORS[0]);
    setShowIconPicker(false);
    setSaving(false);
    setError('');
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    if (!houseId) {
      setError(t('categories.could_not_save'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await add({ name: trimmed, icon: icon || DEFAULT_CATEGORY_ICON, color }, houseId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCreated(trimmed);
      reset();
      onClose();
    } catch (err) {
      const reason = err instanceof Error ? err.message : '';
      if (reason === DUPLICATE_CATEGORY) {
        setError(t('categories.already_exists', { name: trimmed }));
      } else {
        captureError(err, { context: 'quick-add-category', houseId });
        setError(t('categories.could_not_save'));
      }
      setSaving(false);
    }
  }, [name, saving, houseId, add, icon, color, onCreated, reset, onClose, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('categories.new_category')}</Text>

          <View style={styles.formRow}>
            <Pressable
              style={[styles.iconPreviewBtn, showIconPicker && styles.iconPreviewBtnActive]}
              onPress={() => setShowIconPicker((v) => !v)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('categories.choose_icon')}
            >
              <Ionicons name={resolveCategoryIcon(icon)} size={22} color={C.primary} />
            </Pressable>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError('');
              }}
              style={styles.nameInput}
              placeholder={t('categories.category_name')}
              placeholderTextColor={C.textSecondary}
              autoCapitalize="words"
              autoFocus
              maxLength={30}
              onSubmitEditing={handleSave}
              returnKeyType="done"
              accessibilityLabel={t('categories.category_name')}
              accessibilityHint={t('categories.category_name_hint')}
            />
          </View>

          {showIconPicker && (
            <ScrollView style={styles.iconScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.iconPickerWrap} accessibilityRole="radiogroup">
                {CATEGORY_PICKER_ICONS.map((iconName) => (
                  <Pressable
                    key={iconName}
                    style={[
                      styles.iconPickerItem,
                      icon === iconName && styles.iconPickerItemSelected,
                    ]}
                    onPress={() => {
                      setIcon(iconName);
                      setShowIconPicker(false);
                    }}
                    accessible
                    accessibilityRole="radio"
                    accessibilityState={{ selected: icon === iconName }}
                  >
                    <Ionicons
                      name={iconName}
                      size={20}
                      color={icon === iconName ? C.primary : C.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSel]}
                onPress={() => setColor(c)}
                hitSlop={8}
                accessibilityRole="radio"
                accessibilityLabel={c}
                accessibilityState={{ checked: color === c }}
              />
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnOff]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('categories.save')}
              accessibilityState={{ disabled: !name.trim() || saving }}
            >
              <Text style={styles.saveText}>
                {saving ? t('categories.saving') : t('categories.save')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ms(24),
    },
    card: {
      width: '100%',
      maxWidth: ms(360),
      backgroundColor: C.surface,
      borderRadius: ms(24),
      padding: sizes.lg,
      gap: sizes.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(12) },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 10,
    },
    title: { fontSize: mf(18), ...font.bold, color: C.textPrimary },
    formRow: { flexDirection: 'row', gap: ms(8) },
    iconPreviewBtn: {
      width: ms(52),
      height: ms(46),
      borderRadius: ms(10),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconPreviewBtnActive: { borderColor: C.primary, borderWidth: 2 },
    iconScroll: { maxHeight: ms(160) },
    iconPickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(6) },
    iconPickerItem: {
      width: ms(44),
      height: ms(44),
      borderRadius: ms(8),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.surfaceSecondary,
    },
    iconPickerItemSelected: {
      backgroundColor: C.primary + '25',
      borderWidth: 2,
      borderColor: C.primary,
    },
    nameInput: {
      flex: 1,
      minWidth: 0,
      height: ms(46),
      borderRadius: ms(10),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: ms(12),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
    colorDot: { width: ms(28), height: ms(28), borderRadius: ms(14) },
    colorDotSel: { borderWidth: 3, borderColor: C.textPrimary },
    error: { color: C.danger, fontSize: mf(13), ...font.regular },
    actions: { flexDirection: 'row', gap: sizes.sm, marginTop: ms(2) },
    cancelBtn: {
      flex: 1,
      paddingVertical: ms(12),
      minHeight: ms(44),
      borderRadius: ms(12),
      backgroundColor: C.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    saveBtn: {
      flex: 1,
      paddingVertical: ms(12),
      minHeight: ms(44),
      borderRadius: ms(12),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnOff: { opacity: 0.5 },
    saveText: { fontSize: mf(15), ...font.semibold, color: C.white },
  });
