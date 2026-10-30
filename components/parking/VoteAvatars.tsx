import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import type { Housemate } from '@stores/housematesStore';
import type { ParkingVote } from '@stores/parkingStore';
import { mf, ms } from '@utils/responsive';

// Badge colours on paper (paper stays light in dark mode).
const BADGE = { approve: '#2F8550', reject: '#B84540', pending: '#B9B1A0' } as const;

interface VoteAvatarsProps {
  votes: ParkingVote[];
  housemates: Housemate[];
  requestedBy: string;
  votingClosed?: boolean;
}

/**
 * The other housemates as avatar circles, each with a small tick / cross /
 * dash badge for their vote, plus a handwritten "not voting?" note while
 * someone still hasn't voted.
 */
export function VoteAvatars({
  votes,
  housemates,
  requestedBy,
  votingClosed = false,
}: VoteAvatarsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const voters = housemates.filter((h) => h.id !== requestedBy);
  if (voters.length === 0) return null;

  const hasPendingVoters =
    !votingClosed && voters.some((h) => !votes.find((v) => v.userId === h.id));

  return (
    <View>
      <View style={styles.row}>
        {voters.map((h) => {
          const v = votes.find((vote) => vote.userId === h.id)?.vote;
          const badge =
            v === 'approve' ? BADGE.approve : v === 'reject' ? BADGE.reject : BADGE.pending;
          const icon = v === 'approve' ? 'checkmark' : v === 'reject' ? 'close' : 'remove';
          return (
            <View key={h.id} style={[styles.avatar, { backgroundColor: h.color }]}>
              <Text style={styles.initial}>{h.name.charAt(0).toUpperCase()}</Text>
              <View style={[styles.badge, { backgroundColor: badge, borderColor: c.paper }]}>
                <Ionicons name={icon} size={ms(9)} color="#FFFFFF" />
              </View>
            </View>
          );
        })}
      </View>
      {hasPendingVoters && (
        <Text style={[styles.abstain, hand, { color: c.paperMuted }]} accessibilityRole="text">
          {t('parking.abstain_note')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ms(8), marginTop: ms(8) },
  avatar: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#FFFFFF', fontSize: mf(12), ...font.extrabold },
  badge: {
    position: 'absolute',
    end: -ms(4),
    bottom: -ms(3),
    width: ms(15),
    height: ms(15),
    borderRadius: ms(8),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abstain: { fontSize: mf(17), lineHeight: mf(19), marginTop: ms(4) },
});
