import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Announcement } from '@stores/announcementsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { getErrorMessage } from '@utils/errors';
import { PushPin } from '@components/notes/PushPin';
import { mf, ms } from '@utils/responsive';

// Each housemate's notes are on their own colour of paper; ink stays dark on all.
const PAPERS = ['#FCF6E3', '#FCE9A8', '#F6D8D2', '#D9E6F5', '#DCEBD3'];
const INK = lightColors.paperInk;
const MUTED = lightColors.paperMuted;

interface NoteCardProps {
  note: Announcement;
  myId: string;
  canDelete: boolean;
  /** Alternates the tilt so the board doesn't look machine-stacked. */
  index: number;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => void;
}

/** A note pinned to the cork board: paper slip, push pin, signed in handwriting. */
export function NoteCard({
  note,
  myId,
  canDelete,
  index,
  onEdit,
  onDelete,
}: NoteCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const c = useThemedColors();
  const hand = useHandFont();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const authorName =
    note.author === myId ? t('notes.author_you') : resolveName(note.author, housemates);
  const authorIndex = housemates.findIndex((h) => h.id === note.author);
  const author = authorIndex >= 0 ? housemates[authorIndex] : undefined;
  const paper = PAPERS[(authorIndex + 1) % PAPERS.length];
  const pinColor = author?.color ?? c.primary;
  const postedDate = new Date(note.createdAt).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
  });
  const wasEdited = note.updatedAt !== note.createdAt;
  const tilt = index % 2 === 0 ? styles.tiltLeft : styles.tiltRight;

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

  const saveOff = !draft.trim() || isSaving;

  return (
    <View style={[styles.slip, { backgroundColor: paper }, !isEditing && tilt]}>
      <View style={styles.pin} pointerEvents="none">
        <PushPin color={pinColor} />
      </View>

      {isEditing ? (
        <View style={styles.editWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={[styles.editInput, { borderBottomColor: MUTED }]}
            multiline
            autoFocus
            accessibilityLabel={t('notes.note_label')}
            accessibilityHint={t('notes.note_hint')}
          />
          {!!editError && <Text style={[styles.error, { color: c.danger }]}>{editError}</Text>}
          <View style={styles.editActions}>
            <Pressable
              onPress={cancelEdit}
              style={styles.textBtn}
              accessibilityRole="button"
              accessibilityLabel={t('notes.cancel')}
            >
              <Text style={[styles.textBtnLabel, { color: MUTED }]}>{t('notes.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              disabled={saveOff}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: lightColors.primary },
                (saveOff || pressed) && styles.dim,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('notes.save')}
              accessibilityState={{ disabled: saveOff }}
            >
              <Text style={styles.saveText}>{isSaving ? t('notes.saving') : t('notes.save')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.actions}>
            <Pressable
              onPress={startEdit}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('notes.edit_note')}
            >
              <Ionicons name="pencil-outline" size={16} color={MUTED} />
            </Pressable>
            {canDelete && (
              <Pressable
                onPress={() => onDelete(note.id)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('notes.delete_note')}
              >
                <Ionicons name="trash-outline" size={16} color={MUTED} />
              </Pressable>
            )}
          </View>
          <Text style={styles.text}>{note.text}</Text>
          <Text style={[styles.sign, hand]}>
            — {authorName}, {postedDate}
            {wasEdited ? ` · ${t('notes.edited')}` : ''}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    borderRadius: ms(3),
    paddingTop: ms(18),
    paddingBottom: ms(12),
    paddingHorizontal: ms(16),
    shadowColor: '#3A2410',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  tiltLeft: { transform: [{ rotate: '-0.8deg' }] },
  tiltRight: { transform: [{ rotate: '0.7deg' }] },
  pin: { position: 'absolute', top: ms(-8), alignSelf: 'center' },
  actions: {
    position: 'absolute',
    top: 0,
    end: 0,
    flexDirection: 'row',
  },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  text: {
    fontSize: mf(15.5),
    lineHeight: mf(23),
    ...font.regular,
    color: INK,
    marginTop: ms(8),
    paddingEnd: ms(44),
  },
  sign: { fontSize: mf(19), color: MUTED, marginTop: ms(8), alignSelf: 'flex-end' },
  editWrap: { gap: ms(10), marginTop: ms(6) },
  editInput: {
    minHeight: ms(64),
    borderBottomWidth: 1.5,
    paddingVertical: ms(6),
    fontSize: mf(15.5),
    lineHeight: mf(23),
    ...font.regular,
    color: INK,
    textAlignVertical: 'top',
  },
  error: { fontSize: mf(13), ...font.regular },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: ms(6),
  },
  textBtn: { minHeight: 44, paddingHorizontal: ms(12), justifyContent: 'center' },
  textBtnLabel: { fontSize: mf(14.5), ...font.semibold },
  saveBtn: {
    minHeight: 44,
    paddingHorizontal: ms(20),
    borderRadius: ms(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: { fontSize: mf(14.5), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
