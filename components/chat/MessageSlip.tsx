import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useHandFont } from '@hooks/useHandFont';
import { Alert } from '@lib/alert';
import type { ChatMessage } from '@stores/chatStore';
import { formatTime } from '@utils/chatDays';
import { mf, ms } from '@utils/responsive';

/** Your own messages can be deleted for this long after sending. */
export const DELETE_WINDOW_MS = 15 * 60 * 1000;

// Pen colour for names on paper (the paper stays light in dark mode).
const PEN = lightColors.primary;

export interface MessageSlipProps {
  msg: ChatMessage;
  isMine: boolean;
  authorName: string;
  onDelete: (id: string) => void;
  onReport: (id: string, authorName: string, authorId: string) => void;
}

/**
 * One message. Someone else's is a paper slip with their name in handwriting;
 * yours is a blue sticky note on the other side. Long-press deletes your own
 * (for 15 minutes) or reports someone else's.
 */
export function MessageSlip({
  msg,
  isMine,
  authorName,
  onDelete,
  onReport,
}: MessageSlipProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const canDelete = isMine && Date.now() - new Date(msg.createdAt).getTime() < DELETE_WINDOW_MS;

  const handleLongPress = useCallback((): void => {
    if (isMine) {
      if (!canDelete) return;
      Alert.alert(t('chat.delete_title'), t('chat.delete_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: (): void => onDelete(msg.id) },
      ]);
    } else {
      Alert.alert(t('chat.report_title'), t('chat.report_body', { name: authorName }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.report_action'),
          style: 'destructive',
          onPress: (): void => onReport(msg.id, authorName, msg.author),
        },
      ]);
    }
  }, [isMine, canDelete, msg.id, msg.author, authorName, onDelete, onReport, t]);

  const paper = isMine ? c.note : c.receipt;
  const ink = isMine ? c.noteInk : c.receiptInk;
  const muted = isMine ? c.noteInk : c.receiptMuted;

  return (
    <Pressable
      style={[styles.row, isMine && styles.rowMine]}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        isMine
          ? canDelete
            ? t('chat.your_message_hint')
            : t('chat.your_message_hint_locked')
          : t('chat.other_message_hint', { name: authorName })
      }
    >
      <UserAvatar userId={msg.author} size={ms(30)} />
      <View
        style={[
          styles.slip,
          isMine ? styles.slipMine : styles.slipOther,
          { backgroundColor: paper },
        ]}
      >
        {!isMine && <Text style={[styles.author, hand, { color: PEN }]}>{authorName}</Text>}
        <Text style={[styles.text, { color: ink }]}>{msg.text}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: muted }]}>{formatTime(msg.createdAt)}</Text>
          {canDelete && (
            <Text style={[styles.hint, { color: muted }]}>{t('chat.hold_to_delete')}</Text>
          )}
          {!isMine && (
            <Text style={[styles.hint, { color: muted }]}>{t('chat.hold_to_report')}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(9) },
  rowMine: { flexDirection: 'row-reverse' },
  slip: {
    maxWidth: '76%',
    paddingHorizontal: ms(13),
    paddingTop: ms(9),
    paddingBottom: ms(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // The corner on the avatar's side is nearly square, like a slip torn off a pad.
  slipOther: {
    borderTopStartRadius: ms(3),
    borderBottomStartRadius: ms(3),
    borderTopEndRadius: ms(14),
    borderBottomEndRadius: ms(14),
  },
  slipMine: {
    borderTopEndRadius: ms(3),
    borderBottomEndRadius: ms(3),
    borderTopStartRadius: ms(14),
    borderBottomStartRadius: ms(14),
  },
  author: { fontSize: mf(18), lineHeight: mf(19), marginBottom: ms(1) },
  text: { fontSize: mf(15.5), lineHeight: mf(21), ...font.regular },
  meta: { flexDirection: 'row', alignItems: 'center', gap: ms(6), marginTop: ms(3) },
  time: { fontSize: mf(11), ...font.semibold, opacity: 0.75 },
  hint: { fontSize: mf(10.5), ...font.semibold, opacity: 0.6 },
});
