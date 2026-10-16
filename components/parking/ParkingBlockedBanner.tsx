import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
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
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

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
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${body}`}
    >
      <Ionicons name="warning" size={18} color={C.danger} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: ms(10),
      backgroundColor: C.dangerTint,
      borderColor: C.danger,
      borderWidth: 1,
      borderRadius: ms(12),
      padding: ms(12),
      alignSelf: 'stretch',
    },
    copy: { flex: 1, gap: ms(2) },
    title: { fontSize: mf(14), ...font.semibold, color: C.danger },
    body: { fontSize: mf(13), ...font.regular, color: C.textPrimary, lineHeight: mf(19) },
  });
}
