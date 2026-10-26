import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAnnouncementsStore, MAX_NOTES, type Announcement } from '@stores/announcementsStore';
import { useAuthStore } from '@stores/authStore';
import { NoteCard } from '@components/notes/NoteCard';
import { CorkBoard } from '@components/notes/CorkBoard';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { MateCameo } from '@components/shared/MateCameo';
import { MateSpot } from '@components/shared/MateSpot';
import { useMateScene } from '@hooks/useMateScene';
import { lightColors, useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { Alert } from '@lib/alert';
import { getErrorMessage } from '@utils/errors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

const PAPER = lightColors.paper;
const INK = lightColors.paperInk;
const MUTED = lightColors.paperMuted;

export default function NotesScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const notes = useAnnouncementsStore((s) => s.items);
  // An empty board already has its own Mate, so he only hides when there are notes.
  const mateSpot = useMateScene(MATE_SPOTS, notes.length > 0);
  const isLoading = useAnnouncementsStore((s) => s.isLoading);
  const storeError = useAnnouncementsStore((s) => s.error);
  const post = useAnnouncementsStore((s) => s.post);
  const edit = useAnnouncementsStore((s) => s.edit);
  const remove = useAnnouncementsStore((s) => s.remove);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);

  const C = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();
  const styles = useMemo(() => makeStyles(C), [C]);

  const myId = profile?.id ?? '';
  const isAdmin = role === 'owner' || role === 'admin';

  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const handlePost = useCallback(async (): Promise<void> => {
    if (!text.trim() || isPosting) return;
    setIsPosting(true);
    setPostError('');
    try {
      await post(text.trim(), myId, houseId ?? '');
      setText('');
    } catch (err) {
      setPostError(getErrorMessage(err, t('notes.failed_add')));
    } finally {
      setIsPosting(false);
    }
  }, [text, isPosting, post, myId, houseId, t]);

  const handleEdit = useCallback(
    async (id: string, newText: string): Promise<void> => {
      await edit(id, newText);
    },
    [edit]
  );

  const handleDelete = useCallback(
    (id: string): void => {
      remove(id).catch((err) => {
        Alert.alert(t('common.error'), getErrorMessage(err, t('notes.failed_delete')));
      });
    },
    [remove, t]
  );

  const renderNote = useCallback(
    ({ item, index }: { item: Announcement; index: number }): React.JSX.Element => (
      <CorkBoard part="middle" patternId={`cork-${item.id}`}>
        <View style={styles.noteGap}>
          <NoteCard
            note={item}
            index={index}
            myId={myId}
            canDelete={isAdmin || item.author === myId}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </View>
      </CorkBoard>
    ),
    [myId, isAdmin, handleEdit, handleDelete, styles]
  );

  const postOff = !text.trim() || isPosting;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={renderNote}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <BackLink label={t('common.home')} />
            <Text style={[styles.title, headingFont]}>{t('notes.title')}</Text>
            <Text style={styles.subtitle}>{t('notes.subtitle')}</Text>

            {/* A blank slip to write on, then pin it to the board. */}
            <View style={styles.compose}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('notes.placeholder')}
                placeholderTextColor={MUTED}
                style={styles.input}
                multiline
                accessibilityLabel={t('notes.note_label')}
                accessibilityHint={t('notes.note_hint')}
              />
              {!!postError && <Text style={styles.errorText}>{postError}</Text>}
            </View>
            <Pressable
              style={({ pressed }) => [styles.pinBtn, (postOff || pressed) && styles.dim]}
              onPress={handlePost}
              disabled={postOff}
              accessibilityRole="button"
              accessibilityLabel={t('notes.add_note')}
              accessibilityState={{ disabled: postOff }}
            >
              <Text style={styles.pinBtnText}>
                {isPosting ? t('notes.adding') : t('notes.add_note')}
              </Text>
            </Pressable>

            {!!storeError && <Text style={styles.errorText}>{storeError}</Text>}
            {/* Before the board so its frame hides his lower half. */}
            {mateSpot === 'peekOver' && (
              <View style={mateStyles.behind}>
                <MateSpot kind="peekOver" size={ms(38)} style={mateStyles.peek} />
              </View>
            )}
            <CorkBoard part="top" patternId="cork-top">
              {isLoading && notes.length === 0 && <LoadingSpinner size={64} />}
            </CorkBoard>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <CorkBoard part="middle" patternId="cork-empty">
              <View style={styles.empty}>
                <Mate size={ms(80)} />
                <View style={styles.emptySlip}>
                  <Text style={[styles.emptyTitle, hand]}>{t('notes.empty')}</Text>
                  <Text style={styles.emptyText}>{t('notes.empty_hint')}</Text>
                </View>
              </View>
            </CorkBoard>
          ) : null
        }
        ListFooterComponent={
          <View>
            <CorkBoard part="bottom" patternId="cork-bottom" />
            {notes.length > 0 && (
              <Text style={styles.capHint}>{t('notes.cap_hint', { count: MAX_NOTES })}</Text>
            )}
            {mateSpot === 'footer' && <MateCameo page="notes" always />}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    list: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(48) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    subtitle: { fontSize: mf(14), lineHeight: mf(20), ...font.regular, color: C.textSecondary },
    compose: {
      marginTop: ms(18),
      backgroundColor: PAPER,
      borderRadius: ms(4),
      paddingHorizontal: ms(16),
      paddingVertical: ms(12),
      transform: [{ rotate: '-0.6deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 2,
    },
    input: {
      minHeight: ms(72),
      fontSize: mf(15.5),
      lineHeight: mf(23),
      ...font.regular,
      color: INK,
      textAlignVertical: 'top',
    },
    pinBtn: {
      minHeight: 52,
      borderRadius: ms(17),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: ms(14),
      marginBottom: ms(24),
    },
    pinBtnText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
    dim: { opacity: 0.5 },
    errorText: { fontSize: mf(13), ...font.regular, color: C.danger, marginTop: ms(8) },
    noteGap: { paddingTop: ms(10), paddingBottom: ms(12) },
    empty: { alignItems: 'center', paddingVertical: ms(10), gap: ms(10) },
    emptySlip: {
      backgroundColor: PAPER,
      borderRadius: ms(3),
      padding: ms(16),
      alignItems: 'center',
      gap: ms(6),
      transform: [{ rotate: '-1deg' }],
    },
    emptyTitle: { fontSize: mf(21), lineHeight: mf(25), color: INK, textAlign: 'center' },
    emptyText: {
      fontSize: mf(13.5),
      lineHeight: mf(19),
      ...font.regular,
      color: MUTED,
      textAlign: 'center',
    },
    capHint: {
      fontSize: mf(12.5),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: ms(14),
    },
  });
}

// Where Mate may hide on a visit: peeking over the cork board's frame, or under
// the board.
const MATE_SPOTS = ['peekOver', 'footer'] as const;

const mateStyles = StyleSheet.create({
  behind: { height: 0 },
  peek: { end: ms(54), top: -ms(26) },
});
