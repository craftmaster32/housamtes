import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Announcement } from '@stores/announcementsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';

interface NoteCardProps {
  note: Announcement;
  myId: string;
  canDelete: boolean;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export function NoteCard({
  note,
  myId,
  canDelete,
  onEdit,
  onDelete,
}: NoteCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const authorName =
    note.author === myId ? t('notes.author_you') : resolveName(note.author, housemates);
  const author = housemates.find((h) => h.id === note.author);
  const authorColor = author?.color ?? C.primary;
  const authorInitial = (authorName || '?').trim().charAt(0).toUpperCase();
  const postedDate = new Date(note.createdAt).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
  });
  const wasEdited = note.updatedAt !== note.createdAt;

  const startEdit = useCallback((): void => {
    setDraft(note.text);
    setEditError('');
    setIsEditing(true);
  }, [note.text]);

  const cancelEdit = useCallback((): void => {
    setIsEditing(false);
    setEditError('');
  }, []);

  const saveEdit = useCallback(async (): Promise<void> => {
    if (!draft.trim() || isSaving) return;
    setIsSaving(true);
    setEditError('');
    try {
      await onEdit(note.id, draft.trim());
      setIsEditing(false);
    } catch (err) {
      setEditError(getErrorMessage(err, t('notes.failed_edit')));
    } finally {
      setIsSaving(false);
    }
  }, [draft, isSaving, onEdit, note.id, t]);

  return (
    <View style={styles.card}>
      {isEditing ? (
        <View style={styles.editWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={styles.editInput}
            multiline
            autoFocus
            accessibilityLabel={t('notes.note_label')}
            accessibilityHint={t('notes.note_hint')}
          />
          {!!editError && <Text style={styles.errorText}>{editError}</Text>}
          <View style={styles.editActions}>
            <Pressable
              onPress={cancelEdit}
              style={styles.editBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('notes.cancel')}
            >
              <Text style={styles.cancelText}>{t('notes.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              disabled={!draft.trim() || isSaving}
              style={[styles.editBtn, styles.saveBtn, (!draft.trim() || isSaving) && styles.btnOff]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('notes.save')}
              accessibilityState={{ disabled: !draft.trim() || isSaving }}
            >
              <Text style={styles.saveText}>{isSaving ? t('notes.saving') : t('notes.save')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.accent, { backgroundColor: authorColor }]} pointerEvents="none" />
          <View style={styles.metaRow}>
            <View style={[styles.avatar, { backgroundColor: authorColor }]}>
              {author?.avatarUrl ? (
                <Image
                  source={{ uri: author.avatarUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{authorInitial}</Text>
              )}
            </View>
            <View style={styles.metaTextWrap}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.metaText}>
                {postedDate}
                {wasEdited ? ` · ${t('notes.edited')}` : ''}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={startEdit}
                style={styles.iconBtn}
                hitSlop={8}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('notes.edit_note')}
              >
                <Ionicons name="pencil-outline" size={16} color={C.textSecondary} />
              </Pressable>
              {canDelete && (
                <Pressable
                  onPress={() => onDelete(note.id)}
                  style={styles.iconBtn}
                  hitSlop={8}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('notes.delete_note')}
                >
                  <Ionicons name="trash-outline" size={16} color={C.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.noteText}>{note.text}</Text>
        </>
      )}
    </View>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    card: {
      position: 'relative',
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 14,
      paddingRight: 14,
      paddingLeft: 16,
      gap: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    noteText: { fontSize: 14.5, ...font.regular, color: C.textPrimary, lineHeight: 21 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 28, height: 28 },
    avatarText: { fontSize: 12, ...font.extrabold, color: '#fff' },
    metaTextWrap: { flex: 1 },
    authorName: { fontSize: 13, ...font.bold, color: C.textPrimary },
    metaText: { fontSize: 11.5, ...font.medium, color: C.textTertiary, marginTop: 1 },
    actions: { flexDirection: 'row', gap: 4 },
    iconBtn: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },

    editWrap: { gap: 10 },
    editInput: {
      minHeight: 64,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 13,
      paddingVertical: 10,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
      textAlignVertical: 'top',
    },
    editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    editBtn: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveBtn: { backgroundColor: C.primary },
    btnOff: { backgroundColor: C.textDisabled },
    cancelText: { fontSize: 14, ...font.semibold, color: C.textSecondary },
    saveText: { fontSize: 14, ...font.semibold, color: '#fff' },
    errorText: { fontSize: 13, ...font.regular, color: C.danger },
  });
}
