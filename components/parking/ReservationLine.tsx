import { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated as RNAnimated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import {
  isVoteChangeLocked,
  type ParkingReservation,
  type ParkingVoteChoice,
} from '@stores/parkingStore';
import { resolveName } from '@utils/housemates';
import { parseDateParts, timeRange } from '@utils/parkingDates';
import { mf, ms } from '@utils/responsive';
import { MARGIN_W } from './PaperSlice';
import { reservationStatus } from './reservationStatus';
import { ThumpStamp } from './ThumpStamp';
import { VoteAvatars } from './VoteAvatars';

// Width of the swipe-to-delete panel, kept in sync between the reveal and its style.
const SWIPE_DELETE_WIDTH = ms(84);

// Vote circles and history ink on paper (paper stays light in dark mode).
const YES = '#2F8550';
const NO = '#B84540';

export interface ReservationLineProps {
  item: ParkingReservation;
  currentUserId: string;
  isAdmin: boolean;
  onCancel: (id: string) => void;
  onVote: (id: string, vote: ParkingVoteChoice) => void;
  onClear: (id: string) => void;
  onDatePress: (date: string) => void;
  isHistory: boolean;
  now: Date;
}

/**
 * One reservation written on the notebook page: the date in the margin, then
 * the time, who and their note, the housemates' votes, and a rubber stamp.
 * Vote / cancel / clear actions sit at the end of the line.
 */
export function ReservationLine({
  item,
  currentUserId,
  isAdmin,
  onCancel,
  onVote,
  onClear,
  onDatePress,
  isHistory,
  now,
}: ReservationLineProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);

  const isOwn = item.requestedBy === currentUserId;
  const isPending = item.status === 'pending';
  const approved = item.status === 'approved';
  const status = useMemo(() => reservationStatus(item, now, t), [item, now, t]);
  const { votingClosed } = status;
  const myVote = item.votes.find((v) => v.userId === currentUserId)?.vote;
  // Within the lock window, voters can't change their mind but non-voters can still cast a vote
  const voteChangeLocked =
    isPending && !votingClosed && isVoteChangeLocked(item.date, item.startTime, now);
  const canVote = !isOwn && isPending && !votingClosed && !(myVote && voteChangeLocked);
  // Admin can cancel any upcoming (non-history) reservation they don't own
  const canAdminCancel = isAdmin && !isOwn && !isHistory && (isPending || approved);
  const showOwnCancel = isOwn && isPending;

  const handleCancel = useCallback(() => onCancel(item.id), [onCancel, item.id]);
  const handleClear = useCallback(() => onClear(item.id), [onClear, item.id]);
  const handleApprove = useCallback(() => onVote(item.id, 'approve'), [onVote, item.id]);
  const handleReject = useCallback(() => onVote(item.id, 'reject'), [onVote, item.id]);
  const handleDatePress = useCallback(() => onDatePress(item.date), [onDatePress, item.date]);

  const { dayNum, monthAbbr, weekdayFull, weekdayShort } = parseDateParts(item.date, language);
  const timeText = timeRange(item);
  const who = isOwn ? t('parking.you') : resolveName(item.requestedBy, housemates);

  const line = (
    <View style={[styles.line, isHistory && styles.history]}>
      <Pressable
        style={styles.when}
        onPress={handleDatePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('parking.tap_see_day_schedule', {
          weekday: weekdayFull,
          day: dayNum,
          month: monthAbbr,
        })}
      >
        <Text style={[styles.day, headingFont, { color: c.paperInk }]}>{dayNum}</Text>
        <Text style={[styles.weekday, { color: c.paperMuted }]}>{weekdayShort}</Text>
      </Pressable>

      <View style={styles.body}>
        <Text
          style={[styles.time, { color: c.paperInk }, isHistory && styles.struck]}
          numberOfLines={1}
        >
          {timeText ?? t('parking.all_day')}
        </Text>
        <Text style={[styles.who, { color: c.paperMuted }]}>
          {who}
          {item.note ? ` · ${item.note}` : ''}
        </Text>
        <VoteAvatars
          votes={item.votes}
          housemates={housemates}
          requestedBy={item.requestedBy}
          // Only an open request is still waiting on votes.
          votingClosed={votingClosed || !isPending}
        />
        <ThumpStamp color={status.ink} style={styles.stamp}>
          {status.label}
        </ThumpStamp>
      </View>

      <View style={styles.actions}>
        {showOwnCancel && (
          <Pressable
            onPress={handleCancel}
            style={styles.textBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('parking.cancel_reservation')}
          >
            <Text style={[styles.textBtnLabel, { color: NO }]}>{t('common.cancel')}</Text>
          </Pressable>
        )}
        {canAdminCancel && (
          <Pressable
            onPress={handleCancel}
            style={styles.iconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('parking.admin_cancel_reservation')}
          >
            <Ionicons name="shield-outline" size={20} color={c.paperMuted} />
          </Pressable>
        )}
        {isHistory && (
          <Pressable
            onPress={handleClear}
            style={styles.iconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('parking.clear_from_history')}
          >
            <Ionicons name="trash-outline" size={18} color={c.paperMuted} />
          </Pressable>
        )}
        {canVote && (
          <>
            <Pressable
              onPress={handleApprove}
              style={({ pressed }) => [
                styles.vote,
                { borderColor: YES },
                myVote === 'approve' && { backgroundColor: YES },
                pressed && styles.pressed,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('parking.approve_request')}
              accessibilityState={{ selected: myVote === 'approve' }}
            >
              <Ionicons name="checkmark" size={20} color={myVote === 'approve' ? '#FFFFFF' : YES} />
            </Pressable>
            <Pressable
              onPress={handleReject}
              style={({ pressed }) => [
                styles.vote,
                { borderColor: NO },
                myVote === 'reject' && { backgroundColor: NO },
                pressed && styles.pressed,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('parking.reject_request')}
              accessibilityState={{ selected: myVote === 'reject' }}
            >
              <Ionicons name="close" size={20} color={myVote === 'reject' ? '#FFFFFF' : NO} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );

  // Old reservations: swipe left to reveal a red Delete, like the Bills expenses.
  // (The bin on the line stays as the screen-reader route.)
  if (!isHistory) return line;
  return (
    <Swipeable
      renderRightActions={(_progress, dragX): React.JSX.Element => {
        // Slide the panel in 1:1 with the drag so it stays glued to the line's edge.
        const translateX = dragX.interpolate({
          inputRange: [-SWIPE_DELETE_WIDTH, 0],
          outputRange: [0, SWIPE_DELETE_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <RNAnimated.View style={[styles.swipeLane, { transform: [{ translateX }] }]}>
            <Pressable
              style={[styles.swipeDelete, { backgroundColor: NO }]}
              onPress={handleClear}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('parking.clear_from_history')}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </RNAnimated.View>
        );
      }}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
    >
      {line}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', paddingVertical: ms(12), paddingEnd: ms(12) },
  history: { opacity: 0.6 },
  when: { width: MARGIN_W, alignItems: 'center', minHeight: 44 },
  day: { fontSize: mf(26), lineHeight: mf(30) },
  weekday: { fontSize: mf(11), ...font.bold, marginTop: ms(1) },
  body: { flex: 1, minWidth: 0, paddingStart: ms(14) },
  time: { fontSize: mf(15.5), ...font.bold },
  struck: { textDecorationLine: 'line-through' },
  who: { fontSize: mf(14), ...font.medium, marginTop: ms(1) },
  stamp: { marginTop: ms(8) },
  actions: { alignItems: 'flex-end', gap: ms(8), marginStart: ms(6) },
  textBtn: { minHeight: 44, justifyContent: 'center' },
  textBtnLabel: { fontSize: mf(14), ...font.bold },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  vote: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  swipeLane: { width: SWIPE_DELETE_WIDTH },
  swipeDelete: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: ms(3) },
  swipeDeleteText: { fontSize: mf(12), ...font.bold, color: '#FFFFFF' },
});
