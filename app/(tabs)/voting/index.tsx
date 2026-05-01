import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useVotingStore, type Proposal } from '@stores/votingStore';
import { resolveName } from '@utils/housemates';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function ProposalCard({
  proposal,
  myId,
  totalPeople,
}: {
  proposal: Proposal;
  myId: string;
  totalPeople: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const castVote = useVotingStore((s) => s.castVote);
  const closeProposal = useVotingStore((s) => s.closeProposal);
  const remove = useVotingStore((s) => s.remove);
  const [voteError, setVoteError] = useState<string | null>(null);

  const yesVotes = proposal.votes.filter((v) => v.choice === 'yes').length;
  const noVotes = proposal.votes.filter((v) => v.choice === 'no').length;
  const myVote = proposal.votes.find((v) => v.person === myId)?.choice ?? null;
  const totalVoted = proposal.votes.length;
  const allVotedYes = yesVotes === totalPeople;

  const handleVote = useCallback(
    (choice: 'yes' | 'no') => {
      setVoteError(null);
      castVote(proposal.id, myId, choice).catch(() => {
        setVoteError('Could not save your vote. Try again.');
      });
    },
    [proposal.id, myId, castVote]
  );

  const result = !proposal.isOpen
    ? yesVotes === totalPeople
      ? 'passed'
      : noVotes > totalPeople / 2
      ? 'rejected'
      : 'blocked'
    : null;

  const resultColor =
    result === 'passed' ? colors.positive :
    result === 'rejected' ? colors.negative :
    result === 'blocked' ? colors.warning :
    colors.textSecondary;

  return (
    <View style={[styles.card, !proposal.isOpen && styles.cardClosed]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{proposal.title}</Text>
          <Text style={styles.cardMeta}>
            {t('voting.proposed_by', { name: resolveName(proposal.createdBy, housemates) })} · {timeAgo(proposal.createdAt)}
          </Text>
        </View>
        {proposal.isOpen ? (
          <View style={styles.openBadge}>
            <Text style={styles.openBadgeText}>{t('voting.open')}</Text>
          </View>
        ) : (
          <View style={[styles.resultBadge, { backgroundColor: resultColor + '18' }]}>
            <Text style={[styles.resultBadgeText, { color: resultColor }]}>
              {result === 'passed' ? t('voting.passed') : result === 'rejected' ? t('voting.rejected') : t('voting.blocked')}
            </Text>
          </View>
        )}
        {myId === proposal.createdBy && (
          <Pressable onPress={() => remove(proposal.id)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {proposal.description ? (
        <Text style={styles.cardDescription}>{proposal.description}</Text>
      ) : null}

      {/* Vote tally */}
      <View style={styles.tallyRow}>
        <View style={styles.tallyItem}>
          <Text style={[styles.tallyNum, { color: colors.positive }]}>{yesVotes}</Text>
          <Text style={styles.tallyLabel}>Yes</Text>
        </View>
        <View style={styles.tallyBar}>
          {totalVoted > 0 && (
            <View style={[styles.tallyFillYes, { flex: yesVotes }]} />
          )}
          {totalVoted > 0 && noVotes > 0 && (
            <View style={[styles.tallyFillNo, { flex: noVotes }]} />
          )}
          {totalVoted === 0 && <View style={{ flex: 1, backgroundColor: colors.border, borderRadius: 4 }} />}
        </View>
        <View style={styles.tallyItem}>
          <Text style={[styles.tallyNum, { color: colors.negative }]}>{noVotes}</Text>
          <Text style={styles.tallyLabel}>No</Text>
        </View>
      </View>

      <Text style={styles.tallyMeta}>{t('voting.voted_count', { voted: totalVoted, total: totalPeople })}</Text>

      {/* Voter status — who voted what, who's still pending */}
      <View style={styles.voterList}>
        {housemates.map((hm) => {
          const vote = proposal.votes.find((v) => v.person === hm.id);
          return (
            <View key={hm.id} style={styles.voterRow}>
              <Text style={styles.voterName}>{hm.name}</Text>
              {vote?.choice === 'yes' && (
                <View style={[styles.voterChip, styles.voterChipYes]}>
                  <Text style={[styles.voterChipText, { color: colors.positive }]}>{t('voting.yes')}</Text>
                </View>
              )}
              {vote?.choice === 'no' && (
                <View style={[styles.voterChip, styles.voterChipNo]}>
                  <Text style={[styles.voterChipText, { color: colors.negative }]}>{t('voting.no')}</Text>
                </View>
              )}
              {!vote && (
                <View style={styles.voterChip}>
                  <Text style={[styles.voterChipText, { color: colors.textDisabled }]}>{t('voting.waiting')}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Voting buttons — only if open */}
      {proposal.isOpen && (
        <>
          <View style={styles.voteRow}>
            <Pressable
              style={[styles.voteBtn, styles.voteBtnYes, myVote === 'yes' && styles.voteBtnYesActive]}
              onPress={() => handleVote('yes')}
            >
              <Text style={[styles.voteBtnText, myVote === 'yes' && styles.voteBtnTextActive]}>
                👍 Yes
              </Text>
            </Pressable>
            <Pressable
              style={[styles.voteBtn, styles.voteBtnNo, myVote === 'no' && styles.voteBtnNoActive]}
              onPress={() => handleVote('no')}
            >
              <Text style={[styles.voteBtnText, myVote === 'no' && styles.voteBtnTextActive]}>
                👎 No
              </Text>
            </Pressable>
          </View>
          {allVotedYes ? (
            <Pressable
              style={[styles.closeResultBtn, styles.closeResultBtnPositive]}
              onPress={() => closeProposal(proposal.id)}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ disabled: false }}
            >
              <Text style={styles.closeResultBtnText}>{t('voting.everyoneAgreedCloseApprove')}</Text>
            </Pressable>
          ) : myId === proposal.createdBy ? (
            <Pressable
              style={styles.closeBtn}
              onPress={() => closeProposal(proposal.id)}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ disabled: false }}
            >
              <Text style={styles.closeBtnText}>{t('voting.close_vote')}</Text>
            </Pressable>
          ) : null}
          {!!voteError && <Text style={styles.voteErrorText}>{voteError}</Text>}
        </>
      )}
    </View>
  );
}

function AddProposalForm({ onClose, createdBy, houseId }: { onClose: () => void; createdBy: string; houseId: string }): React.JSX.Element {
  const { t } = useTranslation();
  const addProposal = useVotingStore((s) => s.addProposal);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = useCallback(async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await addProposal(title.trim(), description.trim(), createdBy, houseId);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('voting.failed_post'));
      setIsSaving(false);
    }
  }, [title, description, createdBy, houseId, addProposal, onClose, isSaving, t]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('voting.new_proposal_title')}</Text>

      <Text style={styles.fieldLabel}>{t('voting.proposal_placeholder')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('voting.proposal_placeholder')}
        placeholderTextColor={colors.textDisabled}
      />

      <Text style={styles.fieldLabel}>{t('voting.context_label')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('voting.context_placeholder')}
        placeholderTextColor={colors.textDisabled}
        multiline
        numberOfLines={3}
      />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? t('voting.posting') : t('voting.post_proposal')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function VotingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const proposals = useVotingStore((s) => s.proposals);
  const isLoading = useVotingStore((s) => s.isLoading);
  const error = useVotingStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const [showForm, setShowForm] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const myId = profile?.id ?? '';
  const totalPeople = Math.max(1, housemates.length);

  const open = proposals.filter((p) => p.isOpen);
  const closed = proposals.filter((p) => !p.isOpen);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.pageHeader}>
          <Text style={styles.heading}>{t('voting.title')}</Text>
          <Text style={styles.headingSub}>{t('voting.subtitle')}</Text>
        </View>

        {showForm ? (
          <AddProposalForm onClose={() => setShowForm(false)} createdBy={myId} houseId={houseId ?? ''} />
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addBtnText}>{t('voting.new_proposal')}</Text>
          </Pressable>
        )}

        {open.length === 0 && !showForm && (
          <View style={styles.emptySection}>
            <Text style={styles.emptyTitle}>{t('voting.no_open')}</Text>
            <Text style={styles.emptyText}>{t('voting.no_open_hint')}</Text>
          </View>
        )}

        {open.map((p) => (
          <ProposalCard key={p.id} proposal={p} myId={myId} totalPeople={totalPeople} />
        ))}

        {closed.length > 0 && (
          <>
            <Pressable style={styles.closedToggle} onPress={() => setShowClosed((v) => !v)}>
              <Text style={styles.closedToggleText}>
                {showClosed ? '▲' : '▼'} {t('voting.past_votes')} ({closed.length})
              </Text>
            </Pressable>
            {showClosed && closed.map((p) => (
              <ProposalCard key={p.id} proposal={p} myId={myId} totalPeople={totalPeople} />
            ))}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

  pageHeader: { marginBottom: sizes.xs },
  heading: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  headingSub: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, marginTop: 2 },

  addBtn: { borderWidth: 2, borderColor: colors.primary + '40', borderStyle: 'dashed', borderRadius: 14, paddingVertical: sizes.md, alignItems: 'center' },
  addBtnText: { color: colors.primary, ...font.semibold, fontSize: sizes.fontMd },

  card: { backgroundColor: colors.white, borderRadius: 16, padding: sizes.md, gap: sizes.sm, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as never,
  cardClosed: { opacity: 0.75 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  cardMeta: { fontSize: sizes.fontXs, ...font.regular, color: colors.textSecondary },
  cardDescription: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, lineHeight: 20 },
  openBadge: { backgroundColor: colors.primary + '15', borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 3 },
  openBadgeText: { fontSize: sizes.fontXs, color: colors.primary, ...font.bold },
  resultBadge: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 3 },
  resultBadgeText: { fontSize: sizes.fontXs, ...font.bold },
  removeBtn: { padding: 4 },
  removeBtnText: { color: colors.textDisabled, fontSize: sizes.fontSm },

  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, height: 32 },
  tallyItem: { width: 32, alignItems: 'center', gap: 1 },
  tallyNum: { fontSize: sizes.fontLg, ...font.extrabold, lineHeight: 22 },
  tallyLabel: { fontSize: 10, color: colors.textSecondary, ...font.semibold },
  tallyBar: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.border, flexDirection: 'row' },
  tallyFillYes: { backgroundColor: colors.positive, minWidth: 1 },
  tallyFillNo: { backgroundColor: colors.negative, minWidth: 1 },
  tallyMeta: { fontSize: sizes.fontXs, ...font.regular, color: colors.textSecondary },

  voteRow: { flexDirection: 'row', gap: sizes.sm, flexWrap: 'wrap' },
  voteBtn: { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: sizes.borderRadiusFull, borderWidth: 2 },
  voteBtnYes: { borderColor: colors.positive, backgroundColor: colors.white },
  voteBtnYesActive: { backgroundColor: colors.positive },
  voteBtnNo: { borderColor: colors.negative, backgroundColor: colors.white },
  voteBtnNoActive: { backgroundColor: colors.negative },
  voteBtnText: { fontSize: sizes.fontSm, ...font.bold, color: colors.textPrimary },
  voteBtnTextActive: { color: colors.white },
  closeBtn: { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: sizes.borderRadiusFull, borderWidth: 1, borderColor: colors.border },
  closeBtnText: { color: colors.textSecondary, fontSize: sizes.fontSm, ...font.regular },
  closeResultBtn: { borderRadius: 12, paddingVertical: sizes.sm, paddingHorizontal: sizes.md, alignItems: 'center' },
  closeResultBtnPositive: { backgroundColor: colors.positive },
  closeResultBtnText: { color: colors.white, fontSize: sizes.fontSm, ...font.bold },
  voteErrorText: { color: colors.danger, fontSize: sizes.fontXs, ...font.regular },

  voterList: { gap: 6 },
  voterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voterName: { fontSize: sizes.fontSm, ...font.medium, color: colors.textPrimary },
  voterChip: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 2, backgroundColor: colors.border + '60' },
  voterChipYes: { backgroundColor: colors.positive + '18' },
  voterChipNo: { backgroundColor: colors.negative + '18' },
  voterChipText: { fontSize: sizes.fontXs, ...font.semibold },

  form: { backgroundColor: colors.white, borderRadius: 16, padding: sizes.md, gap: sizes.sm, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as never,
  formTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary, marginBottom: sizes.xs },
  fieldLabel: { fontSize: 12, ...font.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: colors.background, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd, color: colors.textPrimary, ...font.regular },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: sizes.sm, justifyContent: 'flex-end', marginTop: sizes.xs },
  cancelBtn: { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textSecondary, ...font.medium },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12 },
  saveBtnDisabled: { backgroundColor: colors.textDisabled },
  saveBtnText: { color: colors.white, ...font.semibold },
  saveError: { color: colors.danger, fontSize: 13, ...font.regular },

  closedToggle: { paddingVertical: sizes.sm, alignItems: 'center' },
  closedToggleText: { color: colors.textSecondary, fontSize: sizes.fontSm, ...font.medium },

  emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
  emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorBanner: { backgroundColor: colors.danger + '15', borderRadius: 10, padding: sizes.sm, borderWidth: 1, borderColor: colors.danger + '40' },
  errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: colors.danger },
});
