import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { summarizeProposalVotes, useVotingStore, type Proposal } from '@stores/votingStore';
import { resolveName } from '@utils/housemates';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { Stamp } from '@components/shared/Stamp';
import { BallotRow } from '@components/voting/BallotRow';
import { mf, ms } from '@utils/responsive';

// The ballot is paper: it keeps the light inks in both themes.
const P = lightColors;

function timeAgo(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  return t('common.days_ago', { n: days });
}

interface BallotCardProps {
  proposal: Proposal;
  myId: string;
  totalPeople: number;
}

/**
 * A proposal as a ballot slip: the question in Fraunces, who raised it in
 * handwriting, Yes / No boxes you cross in pen with tally marks, and a rubber
 * stamp with the result once it's closed.
 */
export function BallotCard({ proposal, myId, totalPeople }: BallotCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const housemates = useHousematesStore((s) => s.housemates);
  const castVote = useVotingStore((s) => s.castVote);
  const closeProposal = useVotingStore((s) => s.closeProposal);
  const remove = useVotingStore((s) => s.remove);
  const [voteError, setVoteError] = useState<string | null>(null);

  const summary = summarizeProposalVotes(proposal.votes);
  const myVote = summary.votes.find((v) => v.person === myId)?.choice ?? null;
  const allVotedYes = summary.totalVoted === totalPeople && summary.yesVotes === totalPeople;
  const closed = !proposal.isOpen;
  const nameOf = (id: string): string =>
    id === myId ? t('common.you') : resolveName(id, housemates);
  const yesNames = summary.votes.filter((v) => v.choice === 'yes').map((v) => nameOf(v.person));
  const noNames = summary.votes.filter((v) => v.choice === 'no').map((v) => nameOf(v.person));

  const handleVote = useCallback(
    (choice: 'yes' | 'no'): void => {
      setVoteError(null);
      castVote(proposal.id, myId, choice).catch(() => setVoteError(t('voting.vote_error')));
    },
    [proposal.id, myId, castVote, t]
  );

  const result = closed ? summary.result : null;
  const stampColor =
    result === 'passed' ? P.positive : result === 'rejected' ? P.negative : P.warning;
  const stampText =
    result === 'passed'
      ? t('voting.passed')
      : result === 'rejected'
        ? t('voting.rejected')
        : t('voting.blocked');

  return (
    <View style={styles.slip}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={[styles.title, heading]}>{proposal.title}</Text>
          <Text style={[styles.meta, hand]}>
            {t('voting.proposed_by', { name: resolveName(proposal.createdBy, housemates) })} ·{' '}
            {timeAgo(proposal.createdAt, t)}
          </Text>
        </View>
        {myId === proposal.createdBy && (
          <Pressable
            onPress={() => remove(proposal.id)}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`${t('common.delete')}: ${proposal.title}`}
          >
            <Ionicons name="close" size={18} color={P.paperMuted} />
          </Pressable>
        )}
      </View>

      {proposal.description ? <Text style={styles.description}>{proposal.description}</Text> : null}

      <View style={styles.rule} />
      <View accessibilityRole="radiogroup">
        <BallotRow
          label={t('voting.yes_label')}
          color={P.positive}
          count={summary.yesVotes}
          voters={yesNames}
          mine={myVote === 'yes'}
          disabled={closed}
          onPress={() => handleVote('yes')}
        />
        <BallotRow
          label={t('voting.no_label')}
          color={P.negative}
          count={summary.noVotes}
          voters={noNames}
          mine={myVote === 'no'}
          disabled={closed}
          onPress={() => handleVote('no')}
        />
      </View>

      <View style={styles.foot}>
        <Text style={styles.count}>
          {t('voting.voted_count', { voted: summary.totalVoted, total: totalPeople })}
        </Text>
        {proposal.isOpen && !allVotedYes && myId === proposal.createdBy && (
          <Pressable
            onPress={() => closeProposal(proposal.id)}
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel={t('voting.close_vote')}
          >
            <Text style={[styles.linkText, { color: P.primary }]}>{t('voting.close_vote')}</Text>
          </Pressable>
        )}
      </View>

      {proposal.isOpen && allVotedYes && (
        <Pressable
          style={({ pressed }) => [styles.approve, pressed && styles.dim]}
          onPress={() => closeProposal(proposal.id)}
          accessibilityRole="button"
        >
          <Text style={styles.approveText}>{t('voting.everyoneAgreedCloseApprove')}</Text>
        </Pressable>
      )}
      {!!voteError && <Text style={styles.error}>{voteError}</Text>}

      {closed && (
        <View style={styles.stamp} pointerEvents="none">
          <Stamp color={stampColor} big>
            {stampText}
          </Stamp>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    backgroundColor: P.paper,
    borderRadius: ms(4),
    paddingHorizontal: ms(18),
    paddingTop: ms(14),
    paddingBottom: ms(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(6) },
  headCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: mf(22), lineHeight: mf(28), color: P.paperInk, letterSpacing: -0.3 },
  meta: { fontSize: mf(18), lineHeight: mf(21), color: P.paperMuted, marginTop: ms(2) },
  remove: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -ms(10),
    marginEnd: -ms(10),
  },
  description: {
    fontSize: mf(14.5),
    lineHeight: mf(21),
    ...font.regular,
    color: P.paperInk,
    marginTop: ms(8),
  },
  rule: {
    height: 1.5,
    backgroundColor: 'rgba(107,98,80,0.25)',
    marginTop: ms(12),
    marginBottom: ms(4),
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  count: { fontSize: mf(13), ...font.medium, color: P.paperMuted },
  link: { minHeight: 44, justifyContent: 'center', paddingStart: ms(12) },
  linkText: { fontSize: mf(14.5), ...font.semibold },
  approve: {
    minHeight: 48,
    borderRadius: ms(15),
    backgroundColor: P.positive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(14),
    marginBottom: ms(6),
  },
  approveText: { fontSize: mf(14.5), ...font.semibold, color: '#FFFFFF', textAlign: 'center' },
  dim: { opacity: 0.6 },
  error: { fontSize: mf(13), ...font.regular, color: P.danger, marginBottom: ms(6) },
  stamp: { position: 'absolute', end: ms(18), bottom: ms(12) },
});
