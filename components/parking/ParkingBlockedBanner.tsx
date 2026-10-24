import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import type { ParkingReservation } from '@stores/parkingStore';

interface ParkingBlockedBannerProps {
  /** The approved reservation whose slot is running while another car is parked. */
  reservation: ParkingReservation;
  occupantId: string;
  myId: string;
  resolveName: (userId: string) => string;
}

// Shown on the parking screen when someone's reserved slot has started but a
// different car is still in the spot. The wording depends on who is looking:
// the parked person is asked to move, the holder is told who is still there.
export function ParkingBlockedBanner({
  reservation,
  occupantId,
  myId,
  resolveName,
}: ParkingBlockedBannerProps): React.JSX.Element {
  const { t } = useTranslation();

  // The ticket slides gently into place when it appears.
  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          settle.setValue(1);
          return;
        }
        Animated.timing(settle, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      })
      .catch(() => settle.setValue(1));
    return (): void => {
      cancelled = true;
    };
  }, [settle]);

  const holder = resolveName(reservation.requestedBy).split(' ')[0];
  const occupant = resolveName(occupantId).split(' ')[0];
  const until = reservation.endTime
    ? t('parking.blocked_until', { time: reservation.endTime })
    : t('parking.blocked_all_day');

  let title: string;
  let body: string;
  if (occupantId === myId) {
    title = t('parking.blocked_move_title');
    body = t('parking.blocked_move_body', { name: holder, until });
  } else if (reservation.requestedBy === myId) {
    title = t('parking.blocked_yours_title');
    body = t('parking.blocked_yours_body', { name: occupant, until });
  } else {
    title = t('parking.blocked_other_title');
    body = t('parking.blocked_other_body', { holder, occupant, until });
  }

  return (
    <Animated.View
      style={[
        styles.ticket,
        {
          opacity: settle.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [-ms(8), 0] }) },
            {
              rotate: settle.interpolate({
                inputRange: [0, 1],
                outputRange: ['-2.5deg', '-1deg'],
              }),
            },
          ],
        },
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${body}`}
    >
      <View style={styles.tape} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Animated.View>
  );
}

// A pink parking ticket taped onto the spot card.
const TICKET = '#F6D8D2';
const TICKET_INK = '#8E2F28';

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: TICKET,
    borderRadius: ms(6),
    paddingVertical: ms(12),
    paddingHorizontal: ms(14),
    marginTop: ms(14),
    marginHorizontal: ms(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tape: {
    position: 'absolute',
    top: -ms(9),
    alignSelf: 'center',
    width: ms(54),
    height: ms(16),
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '3deg' }],
  },
  title: { fontSize: mf(14.5), ...font.extrabold, color: TICKET_INK },
  body: {
    fontSize: mf(13.5),
    ...font.medium,
    color: TICKET_INK,
    lineHeight: mf(19),
    marginTop: ms(2),
  },
});
