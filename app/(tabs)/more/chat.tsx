import { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useChatStore, type ChatMessage } from '@stores/chatStore';
import { useAuthStore } from '@stores/authStore';
import { colors } from '@constants/colors';
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

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  onDelete,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const initial = msg.author[0]?.toUpperCase() ?? '?';
  const canDelete = isMine && Date.now() - new Date(msg.createdAt).getTime() < DELETE_WINDOW_MS;

  const { t } = useTranslation();

  const handleLongPress = useCallback(() => {
    if (!canDelete) return;
    Alert.alert(
      t('chat.delete_title'),
      t('chat.delete_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(msg.id) },
      ]
    );
  }, [canDelete, msg.id, onDelete, t]);

  return (
    <Pressable
      style={[styles.row, isMine && styles.rowMine]}
      onLongPress={handleLongPress}
      delayLongPress={400}
    >
      {!isMine && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}
      <View style={[styles.bubble, isMine && styles.bubbleMine]}>
        {!isMine && <Text style={styles.author}>{msg.author}</Text>}
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{msg.text}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(msg.createdAt)}</Text>
          {canDelete && (
            <Text style={styles.deleteHint}>{t('chat.hold_to_delete')}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── DateSeparator ─────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }): React.JSX.Element {
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
  const send = useChatStore((state) => state.send);
  const remove = useChatStore((state) => state.remove);
  const markRead = useChatStore((state) => state.markRead);
  const load = useChatStore((state) => state.load);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myName = profile?.name ?? '';

  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  // Lazy-load: chat is not loaded at startup, load it when this screen opens
  useEffect(() => {
    if (houseId) load(houseId);
    return () => { useChatStore.getState().unsubscribe(); };
  }, [houseId, load]);

  useEffect(() => { markRead(); }, [markRead]);

  const listItems = buildListItems(messages);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !houseId) return;
    await send(text.trim(), myName || 'Someone', houseId);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [text, myName, houseId, send]);

  const handleDelete = useCallback((id: string) => { remove(id); }, [remove]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('chat.title')}</Text>
        <View style={styles.backBtn} />
      </View>

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
                isMine={item.msg.author === myName}
                onDelete={handleDelete}
              />
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('chat.no_messages')}</Text>
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
            placeholderTextColor={colors.textDisabled}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    backgroundColor: colors.white,
    boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
  } as never,
  backBtn: { width: 60 },
  backText: { color: colors.primary, fontSize: sizes.fontMd, ...font.medium },
  headerTitle: { color: colors.textPrimary, ...font.bold, fontSize: sizes.fontLg },

  list: { padding: sizes.md, gap: sizes.sm, paddingBottom: sizes.lg },

  // Date separator
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    marginVertical: sizes.sm,
  },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  separatorLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    ...font.semibold,
    paddingHorizontal: 4,
  },

  // Message rows
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: sizes.sm },
  rowMine: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  avatarText: { color: colors.white, ...font.bold, fontSize: sizes.fontSm },

  bubble: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 10,
    paddingHorizontal: 13,
    maxWidth: '72%',
    gap: 3,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  } as never,
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },

  author: { color: colors.primary, fontSize: 11, ...font.bold, marginBottom: 1 },
  msgText: { color: colors.textPrimary, fontSize: 15, ...font.regular },
  msgTextMine: { color: colors.white },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  time: { color: colors.textSecondary, fontSize: 11, ...font.regular },
  timeMine: { color: 'rgba(255,255,255,0.7)' },
  deleteHint: { color: 'rgba(255,255,255,0.55)', fontSize: 10, ...font.regular },

  // Empty state
  empty: { alignItems: 'center', paddingTop: sizes.xxl },
  emptyText: { color: colors.textDisabled, ...font.regular, fontSize: sizes.fontMd },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    gap: sizes.sm,
    padding: sizes.md,
    paddingBottom: sizes.md,
    backgroundColor: colors.white,
    alignItems: 'flex-end',
    boxShadow: '0 -1px 0 rgba(0,0,0,0.06)',
  } as never,
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: sizes.md,
    paddingVertical: 10,
    fontSize: sizes.fontMd,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    ...font.regular,
  },
  sendBtn: {
    width: 40, height: 40,
    backgroundColor: colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: colors.white, fontSize: 18, ...font.bold, marginTop: -2 },
});
