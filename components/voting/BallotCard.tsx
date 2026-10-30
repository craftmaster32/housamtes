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
import { BallotChoice } from '@components/voting/BallotChoice';
import { UserAvatar } from '@components/shared/UserAvatar';
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
 * A proposal as a ballot paper: a perforated top saying BALLOT with who raised
 * it, the question in the serif, then Yes and No side by side as boxes you
 * cross in blue pen (tally marks and faces under each), the faces of who still
 * has to vote, and a rubber stamp with the result once it's decided.
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
  const yesIds = summary.votes.filter((v) => v.choice === 'yes').map((v) => v.person);
  const noIds = summary.votes.filter((v) => v.choice === 'no').map((v) => v.person);
  const votedIds = new Set(summary.votes.map((v) => v.person));
  const waitingIds = housemates.map((h) => h.id).filter((id) => !votedIds.has(id));

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
      {/* The perforated top: BALLOT and who raised it */}
      <View style={styles.top}>
        <Text style={styles.kind}>{t('voting.ballot').toUpperCase()}</Text>
        <Text style={[styles.meta, hand]} numberOfLines={1}>
          {t('voting.proposed_by', { name: resolveName(proposal.createdBy, housemates) })} ·{' '}
          {timeAgo(proposal.createdAt, t)}
        </Text>
        {myId === proposal.createdBy && (
          <Pressable
            onPress={() => remove(proposal.id)}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`${t('common.delete')}: ${proposal.title}`}
          >
            <Ionicons name="close" size={17} color={P.receiptMuted} />
          </Pressable>
        )}
      </View>
      <View style={styles.perforation} />

      <View style={styles.body}>
        <Text style={[styles.title, heading]}>{proposal.title}</Text>
        {proposal.description ? (
          <Text style={styles.description}>{proposal.description}</Text>
        ) : null}

        <View style={styles.choices} accessibilityRole="radiogroup">
          <BallotChoice
            label={t('voting.yes_label')}
            color={P.positive}
            voterIds={yesIds}
            voterNames={yesIds.map(nameOf)}
            mine={myVote === 'yes'}
            closed={closed}
            onPress={() => handleVote('yes')}
          />
          <BallotChoice
            label={t('voting.no_label')}
            color={P.negative}
            voterIds={noIds}
            voterNames={noIds.map(nameOf)}
            mine={myVote === 'no'}
            closed={closed}
            onPress={() => handleVote('no')}
          />
        </View>

        {!closed && waitingIds.length > 0 && (
          <View
            style={styles.waiting}
            accessible
            accessibilityLabel={`${t('voting.waiting_for')} ${waitingIds.map(nameOf).join(', ')}`}
          >
            <Text style={styles.waitingText}>{t('voting.waiting_for')}</Text>
            <View style={styles.waitingFaces}>
              {waitingIds.slice(0, 5).map((id) => (
                <View key={id} style={styles.waitingFace}>
                  <UserAvatar userId={id} size={ms(22)} />
                </View>
              ))}
            </View>
          </View>
        )}

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
      </View>

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
    backgroundColor: P.receipt,
    borderRadius: ms(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.12,
    shadowRadius: ms(10),
    elevation: 3,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    minHeight: 40,
    paddingStart: ms(16),
    paddingEnd: ms(6),
  },
  kind: { fontSize: mf(10.5), ...font.extrabold, letterSpacing: 1.6, color: P.receiptMuted },
  meta: { flex: 1, fontSize: mf(17), color: P.receiptMuted, textAlign: 'right' },
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // The tear-off line under the top, drawn as dashes all round so iOS can draw it.
  perforation: {
    height: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: P.receiptRule,
    marginHorizontal: -1,
  },
  body: { paddingHorizontal: ms(16), paddingTop: ms(12), paddingBottom: ms(10) },
  title: { fontSize: mf(20), lineHeight: mf(26), color: P.paperInk, letterSpacing: -0.2 },
  description: {
    fontSize: mf(14.5),
    lineHeight: mf(21),
    ...font.regular,
    color: P.paperInk,
    marginTop: ms(4),
  },
  choices: { flexDirection: 'row', gap: ms(12), marginTop: ms(14) },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginTop: ms(12) },
  waitingText: { fontSize: mf(13), ...font.medium, color: P.receiptMuted },
  waitingFaces: { flexDirection: 'row', gap: ms(4) },
  waitingFace: { opacity: 0.5 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  count: { fontSize: mf(13), ...font.medium, color: P.receiptMuted },
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
  stamp: { position: 'absolute', end: ms(16), top: ms(50) },
});
