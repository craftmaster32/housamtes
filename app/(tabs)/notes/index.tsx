import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnimatedListItem } from '@components/shared/AnimatedListItem';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAnnouncementsStore, MAX_NOTES, type Announcement } from '@stores/announcementsStore';
import { useAuthStore } from '@stores/authStore';
import { NoteCard } from '@components/notes/NoteCard';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { Alert } from '@lib/alert';
import { getErrorMessage } from '@utils/errors';
import { useHeadingFont } from '@hooks/useHeadingFont';

export default function NotesScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const notes = useAnnouncementsStore((s) => s.items);
  const isLoading = useAnnouncementsStore((s) => s.isLoading);
  const storeError = useAnnouncementsStore((s) => s.error);
  const post = useAnnouncementsStore((s) => s.post);
  const edit = useAnnouncementsStore((s) => s.edit);
  const remove = useAnnouncementsStore((s) => s.remove);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);

  const C = useThemedColors();
  const headingFont = useHeadingFont();
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
      <AnimatedListItem index={index}>
        <NoteCard
          note={item}
          myId={myId}
          canDelete={isAdmin || item.author === myId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </AnimatedListItem>
    ),
    [myId, isAdmin, handleEdit, handleDelete]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.flex}>
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderNote}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <View>
              <View style={styles.heroCard}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.titleHero, headingFont]}>{t('notes.title')}</Text>
                  <Text style={styles.textBase}>{t('notes.subtitle')}</Text>
                </View>

                <View style={styles.composeRow}>
                  <View
                    style={[
                      styles.composeAvatar,
                      { backgroundColor: profile?.avatarColor ?? C.primary },
                    ]}
                  >
                    {profile?.avatarUrl ? (
                      <Image
                        source={{ uri: profile.avatarUrl }}
                        style={styles.composeAvatarImg}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.composeAvatarText}>
                        {(profile?.name ?? '?').trim().charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={t('notes.placeholder')}
                    placeholderTextColor={C.textSecondary}
                    style={[styles.input, styles.composeInput]}
                    multiline
                    accessibilityLabel={t('notes.note_label')}
                    accessibilityHint={t('notes.note_hint')}
                  />
                </View>

                {!!postError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={14} color={C.danger} />
                    <Text style={styles.errorText}>{postError}</Text>
                  </View>
                )}

                <Pressable
                  style={[styles.btnPrimary, (!text.trim() || isPosting) && styles.btnOff]}
                  onPress={handlePost}
                  disabled={isPosting}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('notes.add_note')}
                  accessibilityState={{ disabled: !text.trim() || isPosting }}
                >
                  <Ionicons name="pin-outline" size={16} color="#fff" style={styles.btnIcon} />
                  <Text style={styles.btnPrimaryText}>
                    {isPosting ? t('notes.adding') : t('notes.add_note')}
                  </Text>
                </Pressable>
              </View>

              {isLoading && notes.length === 0 && (
                <ActivityIndicator size="small" color={C.primary} style={styles.loadingIndicator} />
              )}
              {!!storeError && (
                <View style={styles.storeErrorBox}>
                  <Text style={styles.storeErrorText}>{storeError}</Text>
                </View>
              )}
            </View>
          }
          ListFooterComponent={
            notes.length > 0 ? (
              <Text style={styles.capHint}>{t('notes.cap_hint', { count: MAX_NOTES })}</Text>
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="clipboard-outline" size={36} color={C.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>{t('notes.empty')}</Text>
                <Text style={styles.emptyText}>{t('notes.empty_hint')}</Text>
              </View>
            ) : null
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
    sep: { height: 8 },

    heroCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      gap: 14,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    heroCopy: { gap: 6 },
    titleHero: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.78 },
    textBase: { fontSize: 15, ...font.regular, color: C.textSecondary, lineHeight: 22 },

    input: {
      minHeight: 64,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
      textAlignVertical: 'top',
    },
    composeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    composeInput: { flex: 1, backgroundColor: C.surfaceSecondary },
    composeAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    composeAvatarImg: { width: 34, height: 34 },
    composeAvatarText: { fontSize: 14, ...font.extrabold, color: '#fff' },

    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: C.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    btnOff: { backgroundColor: C.textDisabled },
    btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
    btnIcon: { marginEnd: 6 },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: 10,
    },
    errorText: { fontSize: 13, ...font.regular, color: C.danger, flex: 1 },

    capHint: {
      fontSize: 12,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },

    emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTitle: { fontSize: 16, ...font.bold, color: C.textPrimary },
    emptyText: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    loadingIndicator: { marginBottom: 8 },
    storeErrorBox: {
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    storeErrorText: { fontSize: 13, color: C.danger },
  });
}
