import { useState, useCallback } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
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
  const C = useThemedColors();
  const styles = makeStyles(C);

  const [listName, setListName]     = useState('');
  const [isPrivate, setIsPrivate]   = useState(false);
  const [isSaving, setIsSaving]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
      setError('Could not save the list. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [listName, isPrivate, isSaving, onSaveNew, onClose]);

  const handleUpdate = useCallback(async (): Promise<void> => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onUpdate();
      onClose();
    } catch {
      setError('Could not update the list. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onUpdate, onClose]);

  const handleSkip = useCallback((): void => {
    setListName('');
    setIsPrivate(false);
    setError(null);
    onSkip();
  }, [onSkip]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <Pressable style={styles.backdrop} onPress={handleSkip}>
        <Pressable style={styles.box} onPress={() => {}}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>{mode === 'update' ? '🔄' : '📋'}</Text>
          </View>

          {mode === 'update' ? (
            /* ── Update mode ──────────────────────────────────────────────── */
            <>
              <Text style={styles.title}>Update saved list?</Text>
              <Text style={styles.body}>
                Save your changes to{' '}
                <Text style={styles.bodyBold}>{existingListName}</Text>
                {' '}so it reflects what you just shared.
              </Text>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                style={[styles.primaryBtn, isSaving && styles.btnOff]}
                onPress={handleUpdate}
                disabled={isSaving}
                accessibilityRole="button"
              >
                {isSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>Yes, update the list</Text>
                }
              </Pressable>
              <Pressable style={styles.skipBtn} onPress={handleSkip} accessibilityRole="button">
                <Text style={styles.skipBtnText}>No, just this time</Text>
              </Pressable>
            </>
          ) : (
            /* ── Save new mode ────────────────────────────────────────────── */
            <>
              <Text style={styles.title}>Save this list?</Text>
              <Text style={styles.body}>Give it a name and reuse it anytime — great for your regular weekly shop.</Text>

              <TextInput
                value={listName}
                onChangeText={(v) => { setListName(v); setError(null); }}
                placeholder="List name, e.g. Weekly Shop"
                placeholderTextColor={C.textSecondary}
                style={styles.nameInput}
                maxLength={60}
                returnKeyType="done"
                autoFocus
                accessible
                accessibilityRole="text"
                accessibilityLabel="List name"
                accessibilityHint="Enter a name for your shopping list"
                accessibilityState={{ disabled: false }}
              />

              <View style={styles.privateRow}>
                <View>
                  <Text style={styles.privateLabel}>Keep private</Text>
                  <Text style={styles.privateSub}>Only you can see and edit this list</Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                  accessibilityRole="switch"
                  accessibilityLabel="Private list"
                />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={[styles.primaryBtn, (!listName.trim() || isSaving) && styles.btnOff]}
                onPress={handleSaveNew}
                disabled={!listName.trim() || isSaving}
                accessibilityRole="button"
              >
                {isSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <Ionicons name="bookmark" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Save list</Text>
                    </>
                  )
                }
              </Pressable>
              <Pressable style={styles.skipBtn} onPress={handleSkip} accessibilityRole="button">
                <Text style={styles.skipBtnText}>{"One-time, don't save"}</Text>
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
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    box: {
      width: '100%', backgroundColor: C.surface, borderRadius: 20,
      padding: 24, gap: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    },
    iconWrap: { alignItems: 'center' },
    iconText: { fontSize: 40 },
    title: { fontSize: 20, ...font.bold, color: C.textPrimary, textAlign: 'center', letterSpacing: -0.4 },
    body: { fontSize: 14, ...font.regular, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
    bodyBold: { ...font.semibold, color: C.textPrimary },
    nameInput: {
      height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceSecondary, paddingHorizontal: 14,
      fontSize: 15, ...font.regular, color: C.textPrimary,
    },
    privateRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.surfaceSecondary, borderRadius: 12, padding: 14,
    },
    privateLabel: { fontSize: 14, ...font.semibold, color: C.textPrimary },
    privateSub: { fontSize: 12, ...font.regular, color: C.textSecondary, marginTop: 2 },
    errorText: { fontSize: 13, color: '#D94F4F', textAlign: 'center' },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      minHeight: 50, borderRadius: 12, backgroundColor: C.primary,
    },
    btnOff: { backgroundColor: C.textDisabled },
    primaryBtnText: { fontSize: 15, ...font.semibold, color: '#fff' },
    skipBtn: { alignItems: 'center', paddingVertical: 10, minHeight: 44 },
    skipBtnText: { fontSize: 14, ...font.regular, color: C.textSecondary },
  });
}
