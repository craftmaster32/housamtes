import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  type ListRenderItemInfo,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { BackLink } from '@components/shared/BackLink';
import { Mate } from '@components/shared/Mate';
import { DayHeading } from '@components/chat/DayHeading';
import { MessageBar } from '@components/chat/MessageBar';
import { MessageSlip } from '@components/chat/MessageSlip';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { Alert } from '@lib/alert';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import { useChatStore } from '@stores/chatStore';
import { useHousematesStore } from '@stores/housematesStore';
import { buildListItems, type ChatListItem } from '@utils/chatDays';
import { resolveName } from '@utils/housemates';
import { mf, ms } from '@utils/responsive';

function ChatScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
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
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatListItem>>(null);

  // Lazy-load: chat is not loaded at startup, load it when this screen opens
  useEffect(() => {
    if (houseId) load(houseId);
    return (): void => {
      useChatStore.getState().unsubscribe();
    };
  }, [houseId, load]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  const listItems = useMemo(() => buildListItems(messages), [messages]);

  const handleSend = useCallback(async (): Promise<void> => {
    if (!text.trim() || !houseId) return;
    await send(text.trim(), myId, myName || 'Someone', houseId);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [text, myId, myName, houseId, send]);

  const handleDelete = useCallback(
    (id: string): void => {
      remove(id).catch((err: unknown) => {
        captureError(err, {
          type: 'message_delete_failed',
          messageId: id,
          houseId: houseId ?? '',
          userId: myId,
        });
        Alert.alert(t('common.error'), t('chat.delete_failed'));
      });
    },
    [remove, t, houseId, myId]
  );

  const handleReport = useCallback(
    (messageId: string, reportedAuthorName: string, reportedAuthorId: string): void => {
      Alert.alert(
        t('chat.report_submitted_title'),
        t('chat.report_submitted_body', { name: reportedAuthorName }),
        [{ text: t('common.ok') }]
      );
      captureError(new Error('User content report'), {
        type: 'content_report',
        reportedMessageId: messageId,
        reportedAuthorId,
        reporterId: myId,
        houseId: houseId ?? '',
      });
    },
    [myId, houseId, t]
  );

  const keyExtractor = useCallback(
    (item: ChatListItem): string => (item.kind === 'separator' ? item.id : item.msg.id),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatListItem>): React.JSX.Element => {
      if (item.kind === 'separator') return <DayHeading label={item.label} />;
      return (
        <MessageSlip
          msg={item.msg}
          isMine={item.msg.author === myId}
          authorName={resolveName(item.msg.author, housemates)}
          onDelete={handleDelete}
          onReport={handleReport}
        />
      );
    },
    [myId, housemates, handleDelete, handleReport]
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.top}>
        <BackLink label={t('common.back')} />
        <Text
          style={[styles.title, headingFont, { color: c.textPrimary }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {t('chat.title')}
        </Text>
      </View>
      {!!chatError && (
        <Text style={[styles.error, { color: c.danger }]} accessibilityRole="alert">
          {chatError}
        </Text>
      )}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            // Mate keeps the empty chat company — the one Mate on this screen.
            <View style={styles.empty}>
              {isLoading ? (
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                  {t('common.loading')}
                </Text>
              ) : (
                <>
                  <Mate size={ms(84)} />
                  <Text style={[styles.emptyTitle, headingFont, { color: c.textPrimary }]}>
                    {t('chat.no_messages')}
                  </Text>
                </>
              )}
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <MessageBar value={text} onChangeText={setText} onSend={handleSend} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { paddingHorizontal: ms(18), paddingTop: ms(4), paddingBottom: ms(6) },
  title: {
    fontSize: mf(36),
    // Tall enough for the descenders, so no letter is clipped.
    lineHeight: mf(46),
    paddingBottom: ms(2),
    letterSpacing: -0.5,
    marginTop: ms(4),
  },
  error: { fontSize: mf(14), ...font.medium, textAlign: 'center', paddingHorizontal: ms(18) },
  list: { paddingHorizontal: ms(18), paddingBottom: ms(16), gap: ms(10), flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(40) },
  emptyTitle: { fontSize: mf(20), textAlign: 'center', marginTop: ms(10) },
  emptyText: { fontSize: mf(15), ...font.medium, textAlign: 'center' },
});

export default withFeatureGuard('chat', ChatScreen);
