import { useState, useCallback } from 'react';
import { View, Modal, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';
import { PenTick } from '@components/shared/PenTick';
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
  const headingFont = useHeadingFont('semibold');

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
          {mode === 'update' ? (
            /* ── Update mode ──────────────────────────────────────────────── */
            <>
              <Text style={[styles.title, headingFont]}>{t('grocery.update_saved_list')}</Text>
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
              <Text style={[styles.title, headingFont]}>{t('grocery.save_this_list')}</Text>
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

              {/* Keep private, as a box ticked in pen. */}
              <Pressable
                style={styles.privateRow}
                onPress={() => setIsPrivate((v) => !v)}
                accessible
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isPrivate }}
                accessibilityLabel={t('grocery.private_list')}
                accessibilityHint={t('grocery.keep_private_hint')}
              >
                <View style={styles.tickBox}>
                  <PenTick
                    checked={isPrivate}
                    size={ms(24)}
                    color={C.primary}
                    style={styles.tick}
                  />
                </View>
                <View style={styles.privateText}>
                  <Text style={styles.privateLabel}>{t('grocery.keep_private')}</Text>
                  <Text style={styles.privateSub}>{t('grocery.keep_private_hint')}</Text>
                </View>
              </Pressable>

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
      backgroundColor: 'rgba(34,32,29,0.42)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ms(24),
    },
    box: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: C.background,
      borderRadius: ms(26),
      padding: ms(24),
      gap: ms(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(8) },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 10,
    },
    title: { fontSize: mf(26), lineHeight: mf(33), color: C.textPrimary, letterSpacing: -0.4 },
    body: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(20),
    },
    bodyBold: { ...font.semibold, color: C.textPrimary },
    // Written on a line, like the other forms.
    nameInput: {
      height: ms(48),
      borderBottomWidth: 2,
      borderBottomColor: C.border,
      paddingHorizontal: ms(2),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
    },
    privateRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), minHeight: 48 },
    privateText: { flex: 1 },
    tickBox: {
      width: ms(22),
      height: ms(22),
      borderWidth: 2.2,
      borderColor: C.textSecondary,
      borderRadius: ms(4),
      transform: [{ rotate: '-2deg' }],
    },
    tick: { position: 'absolute', left: 0, top: -ms(9) },
    privateLabel: { fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    privateSub: { fontSize: mf(12), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
    errorText: { fontSize: mf(13), color: C.danger },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      minHeight: ms(50),
      borderRadius: ms(17),
      backgroundColor: C.primary,
    },
    btnOff: { backgroundColor: C.textDisabled },
    primaryBtnText: { fontSize: mf(15), ...font.semibold, color: '#fff' },
    skipBtn: { alignItems: 'center', paddingVertical: ms(10), minHeight: ms(44) },
    skipBtnText: { fontSize: mf(15), ...font.semibold, color: C.primary },
  });
}
