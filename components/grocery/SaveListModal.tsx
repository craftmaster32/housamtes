import { useState, useCallback } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  Switch,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

export type SaveListMode = 'new' | 'update';

interface SaveListModalProps {
  visible: boolean;
  mode: SaveListMode;
  existingListName?: string;
  onSaveNew: (name: string, isPrivate: boolean) => Promise<void>;
  onUpdate: () => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
}

export function SaveListModal({
  visible,
  mode,
  existingListName,
  onSaveNew,
  onUpdate,
  onSkip,
  onClose,
}: SaveListModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = makeStyles(C);

  const [listName, setListName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveNew = useCallback(async (): Promise<void> => {
    const name = listName.trim();
    if (!name || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSaveNew(name, isPrivate);
      setListName('');
      setIsPrivate(false);
      onClose();
    } catch {
      setError(t('grocery.could_not_save_list'));
    } finally {
      setIsSaving(false);
    }
  }, [listName, isPrivate, isSaving, onSaveNew, onClose, t]);

  const handleUpdate = useCallback(async (): Promise<void> => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onUpdate();
      onClose();
    } catch {
      setError(t('grocery.could_not_update_list'));
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onUpdate, onClose, t]);

  const handleSkip = useCallback((): void => {
    if (isSaving) return;
    setListName('');
    setIsPrivate(false);
    setError(null);
    onSkip();
  }, [isSaving, onSkip]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <Pressable style={styles.backdrop} onPress={handleSkip} disabled={isSaving}>
        <Pressable style={styles.box} onPress={() => {}}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>{mode === 'update' ? '🔄' : '📋'}</Text>
          </View>

          {mode === 'update' ? (
            /* ── Update mode ──────────────────────────────────────────────── */
            <>
              <Text style={styles.title}>{t('grocery.update_saved_list')}</Text>
              <Text style={styles.body}>
                {t('grocery.update_saved_list_body', { name: existingListName })}
              </Text>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                style={[styles.primaryBtn, isSaving && styles.btnOff]}
                onPress={handleUpdate}
                disabled={isSaving}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('grocery.yes_update_list')}</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.skipBtn}
                onPress={handleSkip}
                disabled={isSaving}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
              >
                <Text style={styles.skipBtnText}>{t('grocery.no_just_this_time')}</Text>
              </Pressable>
            </>
          ) : (
            /* ── Save new mode ────────────────────────────────────────────── */
            <>
              <Text style={styles.title}>{t('grocery.save_this_list')}</Text>
              <Text style={styles.body}>{t('grocery.save_this_list_body')}</Text>

              <TextInput
                value={listName}
                onChangeText={(v) => {
                  setListName(v);
                  setError(null);
                }}
                placeholder={t('grocery.list_name_placeholder')}
                placeholderTextColor={C.textSecondary}
                style={styles.nameInput}
                maxLength={60}
                returnKeyType="done"
                autoFocus
                accessible
                accessibilityRole="text"
                accessibilityLabel={t('grocery.list_name')}
                accessibilityHint={t('grocery.list_name_hint')}
                accessibilityState={{ disabled: false }}
              />

              <View style={styles.privateRow}>
                <View>
                  <Text style={styles.privateLabel}>{t('grocery.keep_private')}</Text>
                  <Text style={styles.privateSub}>{t('grocery.keep_private_hint')}</Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                  activeThumbColor="#fff"
                  style={styles.switchLtr}
                  accessibilityRole="switch"
                  accessibilityLabel={t('grocery.private_list')}
                />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={[styles.primaryBtn, (!listName.trim() || isSaving) && styles.btnOff]}
                onPress={handleSaveNew}
                disabled={!listName.trim() || isSaving}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: !listName.trim() || isSaving }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="bookmark" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>{t('grocery.save_list')}</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.skipBtn}
                onPress={handleSkip}
                disabled={isSaving}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
              >
                <Text style={styles.skipBtnText}>{t('grocery.one_time_dont_save')}</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,
    box: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 10,
    },
    iconWrap: { alignItems: 'center' },
    iconText: { fontSize: 40 },
    title: {
      fontSize: 20,
      ...font.bold,
      color: C.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    body: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    bodyBold: { ...font.semibold, color: C.textPrimary },
    nameInput: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: 14,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
    },
    privateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.surfaceSecondary,
      borderRadius: 12,
      padding: 14,
    },
    privateLabel: { fontSize: 14, ...font.semibold, color: C.textPrimary },
    privateSub: { fontSize: 12, ...font.regular, color: C.textSecondary, marginTop: 2 },
    errorText: { fontSize: 13, color: '#D94F4F', textAlign: 'center' },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 50,
      borderRadius: 12,
      backgroundColor: C.primary,
    },
    btnOff: { backgroundColor: C.textDisabled },
    primaryBtnText: { fontSize: 15, ...font.semibold, color: '#fff' },
    skipBtn: { alignItems: 'center', paddingVertical: 10, minHeight: 44 },
    skipBtnText: { fontSize: 14, ...font.regular, color: C.textSecondary },
  });
}
