import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { captureError } from '@lib/errorTracking';
import { View, StyleSheet, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useChatStore, type ChatMessage } from '@stores/chatStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const DELETE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// ── Time helpers ─────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const msgDay = new Date(d); msgDay.setHours(0, 0, 0, 0);
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function sameDateKey(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

// ── List item types ───────────────────────────────────────────────────────────

type ListItem =
  | { kind: 'separator'; id: string; label: string }
  | { kind: 'message'; msg: ChatMessage };

function buildListItems(messages: ChatMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDateKey = '';
  for (const msg of messages) {
    const key = sameDateKey(msg.createdAt);
    if (key !== lastDateKey) {
      items.push({ kind: 'separator', id: `sep-${key}`, label: formatDateLabel(msg.createdAt) });
      lastDateKey = key;
    }
    items.push({ kind: 'message', msg });
  }
  return items;
}

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      backgroundColor: C.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    backBtn: { width: 60 },
    backText: { color: C.primary, fontSize: sizes.fontMd, ...font.medium },
    headerTitle: { color: C.textPrimary, ...font.bold, fontSize: sizes.fontLg },

    list: { padding: sizes.md, gap: sizes.sm, paddingBottom: sizes.lg },

    separatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      marginVertical: sizes.sm,
    },
    separatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    separatorLabel: {
      color: C.textSecondary,
      fontSize: 11,
      ...font.semibold,
      paddingHorizontal: 4,
    },

    row: { flexDirection: 'row', alignItems: 'flex-end', gap: sizes.sm },
    rowMine: { flexDirection: 'row-reverse' },
    avatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 2,
      overflow: 'hidden',
    },
    avatarImg: { width: 32, height: 32 },
    avatarText: { color: '#fff', ...font.bold, fontSize: sizes.fontSm },

    bubble: {
      backgroundColor: C.surface,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      padding: 10,
      paddingHorizontal: 13,
      maxWidth: '72%',
      gap: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    bubbleMine: {
      backgroundColor: C.primary,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 4,
    },

    author: { color: C.primary, fontSize: 11, ...font.bold, marginBottom: 1 },
    msgText: { color: C.textPrimary, fontSize: 15, ...font.regular },
    msgTextMine: { color: '#fff' },

    meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
    time: { color: C.textSecondary, fontSize: 11, ...font.regular },
    timeMine: { color: 'rgba(255,255,255,0.7)' },
    deleteHint: { color: 'rgba(255,255,255,0.55)', fontSize: 10, ...font.regular },
    reportHint: { color: C.textDisabled, fontSize: 10, ...font.regular },

    empty: { alignItems: 'center', paddingTop: sizes.xxl },
    emptyText: { color: C.textDisabled, ...font.regular, fontSize: sizes.fontMd },

    errorBanner: { backgroundColor: C.danger + '15', padding: sizes.sm, borderBottomWidth: 1, borderBottomColor: C.danger + '40' },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.danger, textAlign: 'center' },

    inputBar: {
      flexDirection: 'row',
      gap: sizes.sm,
      padding: sizes.md,
      paddingBottom: sizes.md,
      backgroundColor: C.surface,
      alignItems: 'flex-end',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    input: {
      flex: 1,
      backgroundColor: C.background,
      borderRadius: 22,
      paddingHorizontal: sizes.md,
      paddingVertical: 10,
      fontSize: sizes.fontMd,
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.border,
      ...font.regular,
    },
    sendBtn: {
      width: 40, height: 40,
      backgroundColor: C.primary,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: C.border },
    sendBtnText: { color: '#fff', fontSize: 18, ...font.bold, marginTop: -2 },
});

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  authorName,
  authorAvatarUrl,
  onDelete,
  onReport,
}: {
  msg: ChatMessage;
  isMine: boolean;
  authorName: string;
  authorAvatarUrl?: string;
  onDelete: (id: string) => void;
  onReport: (id: string, authorName: string) => void;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const initial = authorName[0]?.toUpperCase() ?? '?';
  const canDelete = isMine && Date.now() - new Date(msg.createdAt).getTime() < DELETE_WINDOW_MS;

  const { t } = useTranslation();

  const handleLongPress = useCallback(() => {
    if (isMine) {
      if (!canDelete) return;
      Alert.alert(
        t('chat.delete_title'),
        t('chat.delete_body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: (): void => onDelete(msg.id) },
        ]
      );
    } else {
      Alert.alert(
        'Report Message',
        `Report this message from ${authorName} as inappropriate, harmful, or illegal content?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Report',
            style: 'destructive',
            onPress: (): void => onReport(msg.id, authorName),
          },
        ]
      );
    }
  }, [isMine, canDelete, msg.id, authorName, onDelete, onReport, t]);

  return (
    <Pressable
      style={[styles.row, isMine && styles.rowMine]}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessible
      accessibilityLabel={isMine ? 'Your message. Long-press to delete.' : `Message from ${authorName}. Long-press to report.`}
    >
      {!isMine && (
        <View style={[styles.avatar, authorAvatarUrl ? { backgroundColor: 'transparent' } : undefined]}>
          {authorAvatarUrl
            ? <Image source={{ uri: authorAvatarUrl }} style={styles.avatarImg} contentFit="cover" />
            : <Text style={styles.avatarText}>{initial}</Text>
          }
        </View>
      )}
      <View style={[styles.bubble, isMine && styles.bubbleMine]}>
        {!isMine && <Text style={styles.author}>{authorName}</Text>}
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{msg.text}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(msg.createdAt)}</Text>
          {canDelete && <Text style={styles.deleteHint}>{t('chat.hold_to_delete')}</Text>}
          {!isMine && <Text style={styles.reportHint}>Hold to report</Text>}
        </View>
      </View>
    </Pressable>
  );
}

// ── DateSeparator ─────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.separatorRow}>
      <View style={styles.separatorLine} />
      <Text style={styles.separatorLabel}>{label}</Text>
      <View style={styles.separatorLine} />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChatScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const messages = useChatStore((state) => state.messages);
  const isLoading = useChatStore((state) => state.isLoading);
  const chatError = useChatStore((state) => state.error);
  const send = useChatStore((state) => state.send);
  const remove = useChatStore((state) => state.remove);
  const markRead = useChatStore((state) => state.markRead);
  const load = useChatStore((state) => state.load);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const myId   = profile?.id ?? '';
  const myName = profile?.name ?? '';

  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Lazy-load: chat is not loaded at startup, load it when this screen opens
  useEffect(() => {
    if (houseId) load(houseId);
    return (): void => { useChatStore.getState().unsubscribe(); };
  }, [houseId, load]);

  useEffect(() => { markRead(); }, [markRead]);

  const listItems = buildListItems(messages);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !houseId) return;
    await send(text.trim(), myId, myName || 'Someone', houseId);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [text, myId, myName, houseId, send]);

  const handleDelete = useCallback((id: string) => { remove(id); }, [remove]);

  const handleReport = useCallback((messageId: string, reportedAuthor: string): void => {
    Alert.alert(
      'Report Submitted',
      `Thank you. Your report about a message from ${reportedAuthor} has been recorded. Our team will review it within 48 hours.\n\nFor urgent safety concerns, email safety@housemates.app`,
      [{ text: 'OK' }]
    );
    captureError(new Error('User content report'), {
      type: 'content_report',
      reportedMessageId: messageId,
      reportedAuthor,
      reporterId: myId,
      houseId: houseId ?? '',
    });
  }, [myId, houseId]);

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('chat.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {!!chatError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{chatError}</Text>
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={listItems}
            keyExtractor={(item) => item.kind === 'separator' ? item.id : item.msg.id}
            renderItem={({ item }) => {
              if (item.kind === 'separator') {
                return <DateSeparator label={item.label} />;
              }
              return (
                <MessageBubble
                  msg={item.msg}
                  isMine={item.msg.author === myId}
                  authorName={resolveName(item.msg.author, housemates)}
                  authorAvatarUrl={housemates.find((h) => h.id === item.msg.author)?.avatarUrl}
                  onDelete={handleDelete}
                  onReport={handleReport}
                />
              );
            }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {isLoading ? t('common.loading') : t('chat.no_messages')}
                </Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={t('chat.message_placeholder')}
              placeholderTextColor={C.textDisabled}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              multiline={false}
            />
            <Pressable
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}
