import { useState, useCallback, useRef } from 'react';
import {
  View,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

interface StagedItem {
  key: string;
  name: string;
}

interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
  onShareItems: (items: Array<{ name: string; quantity: string }>) => Promise<void>;
}

export function QuickAddSheet({ visible, onClose, onShareItems }: QuickAddSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = makeStyles(C);
  const inputRef = useRef<TextInput>(null);

  const [inputText, setInputText]     = useState('');
  const [staged, setStaged]           = useState<StagedItem[]>([]);
  const [isSharing, setIsSharing]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const handleAdd = useCallback((): void => {
    const name = inputText.trim();
    if (!name) return;
    Haptics.selectionAsync().catch(() => {});
    setStaged((prev) => [...prev, { key: Date.now().toString(), name }]);
    setInputText('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputText]);

  const handleRemove = useCallback((key: string): void => {
    setStaged((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const handleShareAll = useCallback(async (): Promise<void> => {
    if (staged.length === 0 || isSharing) return;
    setIsSharing(true);
    setError(null);
    try {
      await onShareItems(staged.map((i) => ({ name: i.name, quantity: '' })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStaged([]);
      setInputText('');
      onClose();
    } catch {
      setError(t('grocery.could_not_share_items'));
    } finally {
      setIsSharing(false);
    }
  }, [staged, isSharing, onShareItems, onClose, t]);

  const handleClose = useCallback((): void => {
    setStaged([]);
    setInputText('');
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('grocery.quick_share')} ⚡</Text>
              <Text style={styles.subtitle}>{t('grocery.quick_share_hint')}</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </Pressable>
          </View>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={(v) => { setInputText(v); setError(null); }}
              placeholder={t('grocery.add_item_dot_dot_dot')}
              placeholderTextColor={C.textSecondary}
              style={styles.input}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={handleAdd}
              autoFocus
              accessible
              accessibilityLabel={t('grocery.item_name')}
              accessibilityHint={t('grocery.item_name_hint')}
            />
            <Pressable
              style={[styles.addBtn, !inputText.trim() && styles.addBtnOff]}
              onPress={handleAdd}
              disabled={!inputText.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.add_item_to_list')}
            >
              <Text style={styles.addBtnText}>+</Text>
            </Pressable>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* Staged items */}
          {staged.length > 0 && (
            <FlatList
              data={staged}
              keyExtractor={(i) => i.key}
              style={styles.stagedList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.stagedItem}>
                  <Ionicons name="cart-outline" size={16} color={C.textSecondary} />
                  <Text style={styles.stagedName}>{item.name}</Text>
                  <Pressable
                    onPress={() => handleRemove(item.key)}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.remove_item', { name: item.name })}
                  >
                    <Ionicons name="close-circle" size={18} color={C.textDisabled} />
                  </Pressable>
                </View>
              )}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.shareBtn, (staged.length === 0 || isSharing) && styles.shareBtnOff]}
              onPress={handleShareAll}
              disabled={staged.length === 0 || isSharing}
              accessibilityRole="button"
              accessibilityLabel={
                staged.length === 0
                  ? t('grocery.add_items_first')
                  : t('grocery.share_items_count', { count: staged.length })
              }
              accessibilityState={{ disabled: staged.length === 0 || isSharing }}
            >
              {isSharing
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Ionicons name="share-social-outline" size={18} color="#fff" />
                    <Text style={styles.shareBtnText}>
                      {staged.length === 0 ? t('grocery.add_items_first') : t('grocery.share_items_count', { count: staged.length })}
                    </Text>
                  </>
                )
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      gap: 16,
      maxHeight: '85%',
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    title: { fontSize: 20, ...font.bold, color: C.textPrimary, letterSpacing: -0.4 },
    subtitle: { fontSize: 13, ...font.regular, color: C.textSecondary, marginTop: 2 },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceSecondary, paddingEnd: 6, paddingStart: 4, height: 50,
    },
    input: {
      flex: 1, height: '100%', paddingHorizontal: 10,
      fontSize: 15, ...font.regular, color: C.textPrimary,
    },
    addBtn: {
      width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
      backgroundColor: C.primary,
    },
    addBtnOff: { backgroundColor: C.textDisabled },
    addBtnText: { fontSize: 22, ...font.bold, color: '#fff', lineHeight: 26 },
    errorText: { fontSize: 13, color: '#D94F4F' },
    stagedList: { maxHeight: 200 },
    stagedItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: C.surfaceSecondary, borderRadius: 10,
      marginBottom: 6,
    },
    stagedName: { flex: 1, fontSize: 14, ...font.semibold, color: C.textPrimary },
    removeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    footer: {},
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      minHeight: 50, borderRadius: 12, backgroundColor: C.primary,
    },
    shareBtnOff: { backgroundColor: C.textDisabled },
    shareBtnText: { fontSize: 16, ...font.semibold, color: '#fff' },
  });
}
