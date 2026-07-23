import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { summarizeProposalVotes, useVotingStore, type Proposal } from '@stores/votingStore';
import { resolveName } from '@utils/housemates';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

    pageHeader: { marginBottom: sizes.xs },
    heading: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    headingSub: { fontSize: sizes.fontSm, ...font.regular, color: C.textSecondary, marginTop: 2 },

    addBtn: {
      borderWidth: 2,
      borderColor: C.primary + '40',
      borderStyle: 'dashed',
      borderRadius: 14,
      paddingVertical: sizes.md,
      alignItems: 'center',
    },
    addBtnText: { color: C.primary, ...font.semibold, fontSize: sizes.fontMd },

    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: sizes.md,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    cardClosed: { opacity: 0.75 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
    cardInfo: { flex: 1, gap: 2 },
    cardTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    cardMeta: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },
    cardDescription: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
    },
    openBadge: {
      backgroundColor: C.primary + '15',
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.sm,
      paddingVertical: 3,
    },
    openBadgeText: { fontSize: sizes.fontXs, color: C.primary, ...font.bold },
    resultBadge: {
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.sm,
      paddingVertical: 3,
    },
    resultBadgeText: { fontSize: sizes.fontXs, ...font.bold },
    removeBtn: { padding: 4 },

    tallyMeta: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },

    // Poll bars (Yes / No) — tap to vote; the fill shows each side's share and
    // the voters' faces sit on it. Replaces the old tally + voter list + buttons.
    poll: { gap: 10 },
    pollRow: {
      position: 'relative',
      height: 48,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12 },
    pollContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13 },
    pollIco: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pollOpt: { fontSize: 15, ...font.extrabold },
    pollFaces: { flexDirection: 'row', marginStart: 6 },
    pollFace: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginStart: -7,
      borderWidth: 2,
      borderColor: C.surface,
    },
    pollFaceImg: { width: 22, height: 22 },
    pollFaceText: { fontSize: 9, ...font.extrabold, color: '#fff' },
    pollCount: { marginStart: 'auto' as never, fontSize: 16, ...font.extrabold },
    pollMine: { marginStart: 6 },

    closeBtn: {
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1,
      borderColor: C.border,
    },
    closeBtnText: { color: C.textSecondary, fontSize: sizes.fontSm, ...font.regular },
    closeResultBtn: {
      borderRadius: 12,
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.md,
      alignItems: 'center',
    },
    closeResultBtnPositive: { backgroundColor: C.positive },
    closeResultBtnText: { color: '#fff', fontSize: sizes.fontSm, ...font.bold },
    voteErrorText: { color: C.danger, fontSize: sizes.fontXs, ...font.regular },

    form: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: sizes.md,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    formTitle: { fontSize: 17, ...font.bold, color: C.textPrimary, marginBottom: sizes.xs },
    fieldLabel: {
      fontSize: 12,
      ...font.semibold,
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: C.background,
      borderRadius: sizes.borderRadiusSm,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: sizes.sm,
      paddingVertical: sizes.sm,
      fontSize: sizes.fontMd,
      color: C.textPrimary,
      ...font.regular,
    },
    inputMultiline: { height: 80, textAlignVertical: 'top' },
    formActions: {
      flexDirection: 'row',
      gap: sizes.sm,
      justifyContent: 'flex-end',
      marginTop: sizes.xs,
    },
    cancelBtn: {
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    cancelBtnText: { color: C.textSecondary, ...font.medium },
    saveBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
    },
    saveBtnDisabled: { backgroundColor: C.textDisabled },
    saveBtnText: { color: '#fff', ...font.semibold },
    saveError: { color: C.danger, fontSize: 13, ...font.regular },

    closedToggle: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: sizes.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closedToggleText: { color: C.textSecondary, fontSize: sizes.fontSm, ...font.medium },

    emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
    emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    emptyText: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorBanner: {
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: sizes.sm,
      borderWidth: 1,
      borderColor: C.danger + '40',
    },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.danger },
  });

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
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const housemates = useHousematesStore((s) => s.housemates);
  const castVote = useVotingStore((s) => s.castVote);
  const closeProposal = useVotingStore((s) => s.closeProposal);
  const remove = useVotingStore((s) => s.remove);
  const [voteError, setVoteError] = useState<string | null>(null);

  const voteSummary = summarizeProposalVotes(proposal.votes);
  const yesVotes = voteSummary.yesVotes;
  const noVotes = voteSummary.noVotes;
  const myVote = voteSummary.votes.find((v) => v.person === myId)?.choice ?? null;
  const totalVoted = voteSummary.totalVoted;
  const allVotedYes = totalVoted === totalPeople && yesVotes === totalPeople;

  const handleVote = useCallback(
    (choice: 'yes' | 'no') => {
      setVoteError(null);
      castVote(proposal.id, myId, choice).catch(() => {
        setVoteError('Could not save your vote. Try again.');
      });
    },
    [proposal.id, myId, castVote]
  );

  const result = !proposal.isOpen ? voteSummary.result : null;
  const closed = !proposal.isOpen;
  const yesIds = voteSummary.votes.filter((v) => v.choice === 'yes').map((v) => v.person);
  const noIds = voteSummary.votes.filter((v) => v.choice === 'no').map((v) => v.person);
  const pctOf = (n: number): number => (totalPeople > 0 ? (n / totalPeople) * 100 : 0);

  const renderFaces = (ids: string[]): React.JSX.Element => (
    <View style={styles.pollFaces}>
      {ids.slice(0, 3).map((id) => {
        const hm = housemates.find((h) => h.id === id);
        return (
          <View key={id} style={[styles.pollFace, { backgroundColor: hm?.color ?? C.primary }]}>
            {hm?.avatarUrl ? (
              <Image source={{ uri: hm.avatarUrl }} style={styles.pollFaceImg} contentFit="cover" />
            ) : (
              <Text style={styles.pollFaceText}>{(hm?.name ?? '?')[0]?.toUpperCase()}</Text>
            )}
          </View>
        );
      })}
    </View>
  );

  const resultColor =
    result === 'passed'
      ? C.positive
      : result === 'rejected'
        ? C.negative
        : result === 'blocked'
          ? C.warning
          : C.textSecondary;

  return (
    <View style={[styles.card, !proposal.isOpen && styles.cardClosed]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{proposal.title}</Text>
          <Text style={styles.cardMeta}>
            {t('voting.proposed_by', { name: resolveName(proposal.createdBy, housemates) })} ·{' '}
            {timeAgo(proposal.createdAt)}
          </Text>
        </View>
        {proposal.isOpen ? (
          <View style={styles.openBadge}>
            <Text style={styles.openBadgeText}>{t('voting.open')}</Text>
          </View>
        ) : (
          <View style={[styles.resultBadge, { backgroundColor: resultColor + '18' }]}>
            <Text style={[styles.resultBadgeText, { color: resultColor }]}>
              {result === 'passed'
                ? t('voting.passed')
                : result === 'rejected'
                  ? t('voting.rejected')
                  : t('voting.blocked')}
            </Text>
          </View>
        )}
        {myId === proposal.createdBy && (
          <Pressable
            onPress={() => remove(proposal.id)}
            style={styles.removeBtn}
            hitSlop={12}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${t('common.delete')}: ${proposal.title}`}
          >
            <Ionicons name="close" size={18} color={C.textDisabled} />
          </Pressable>
        )}
      </View>

      {proposal.description ? (
        <Text style={styles.cardDescription}>{proposal.description}</Text>
      ) : null}

      <View style={styles.poll}>
        <Pressable
          style={styles.pollRow}
          onPress={closed ? undefined : (): void => handleVote('yes')}
          disabled={closed}
          accessibilityRole="radio"
          accessibilityState={{ selected: myVote === 'yes', disabled: closed }}
          accessibilityLabel={t('voting.yes_label')}
        >
          <View
            style={[
              styles.pollFill,
              { backgroundColor: C.positive + '22', width: `${Math.max(pctOf(yesVotes), 6)}%` },
            ]}
          />
          <View style={styles.pollContent}>
            <View style={[styles.pollIco, { backgroundColor: C.positive }]}>
              <Ionicons name="checkmark" size={13} color="#fff" />
            </View>
            <Text style={[styles.pollOpt, { color: C.positive }]}>{t('voting.yes')}</Text>
            {renderFaces(yesIds)}
            <Text style={[styles.pollCount, { color: C.positive }]}>{yesVotes}</Text>
            {myVote === 'yes' && (
              <Ionicons name="checkmark" size={18} color={C.positive} style={styles.pollMine} />
            )}
          </View>
        </Pressable>

        <Pressable
          style={styles.pollRow}
          onPress={closed ? undefined : (): void => handleVote('no')}
          disabled={closed}
          accessibilityRole="radio"
          accessibilityState={{ selected: myVote === 'no', disabled: closed }}
          accessibilityLabel={t('voting.no_label')}
        >
          <View
            style={[
              styles.pollFill,
              { backgroundColor: C.negative + '22', width: `${Math.max(pctOf(noVotes), 6)}%` },
            ]}
          />
          <View style={styles.pollContent}>
            <View style={[styles.pollIco, { backgroundColor: C.negative }]}>
              <Ionicons name="close" size={14} color="#fff" />
            </View>
            <Text style={[styles.pollOpt, { color: C.negative }]}>{t('voting.no')}</Text>
            {renderFaces(noIds)}
            <Text style={[styles.pollCount, { color: C.negative }]}>{noVotes}</Text>
            {myVote === 'no' && (
              <Ionicons name="checkmark" size={18} color={C.negative} style={styles.pollMine} />
            )}
          </View>
        </Pressable>
      </View>

      <Text style={styles.tallyMeta}>
        {t('voting.voted_count', { voted: totalVoted, total: totalPeople })}
      </Text>

      {proposal.isOpen && (
        <>
          {allVotedYes ? (
            <Pressable
              style={[styles.closeResultBtn, styles.closeResultBtnPositive]}
              onPress={() => closeProposal(proposal.id)}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ disabled: false }}
            >
              <Text style={styles.closeResultBtnText}>
                {t('voting.everyoneAgreedCloseApprove')}
              </Text>
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

function AddProposalForm({
  onClose,
  createdBy,
  houseId,
}: {
  onClose: () => void;
  createdBy: string;
  houseId: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
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
      setSaveError(getErrorMessage(err, t('voting.failed_post')));
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
        placeholderTextColor={C.textDisabled}
        maxLength={100}
        accessibilityLabel={t('voting.proposal_placeholder')}
        accessibilityHint={t('voting.proposal_placeholder')}
      />

      <Text style={styles.fieldLabel}>{t('voting.context_label')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('voting.context_placeholder')}
        placeholderTextColor={C.textDisabled}
        multiline
        numberOfLines={3}
        maxLength={1000}
        accessibilityLabel={t('voting.context_label')}
        accessibilityHint={t('voting.context_placeholder')}
      />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityState={{ disabled: isSaving }}
        >
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!title.trim() || isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('voting.post_proposal')}
          accessibilityState={{ disabled: !title.trim() || isSaving }}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? t('voting.posting') : t('voting.post_proposal')}
          </Text>
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

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const myId = profile?.id ?? '';
  const totalPeople = Math.max(1, housemates.length);

  const open = proposals.filter((p) => p.isOpen);
  const closed = proposals.filter((p) => !p.isOpen);

  const handleCloseForm = useCallback(() => setShowForm(false), [setShowForm]);
  const handleOpenForm = useCallback(() => setShowForm(true), [setShowForm]);
  const toggleShowClosed = useCallback(() => setShowClosed((v) => !v), [setShowClosed]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View style={styles.pageHeader}>
            <Text style={[styles.heading, headingFont]}>{t('voting.title')}</Text>
            <Text style={styles.headingSub}>{t('voting.subtitle')}</Text>
          </View>

          {showForm ? (
            <AddProposalForm onClose={handleCloseForm} createdBy={myId} houseId={houseId ?? ''} />
          ) : (
            <Pressable
              style={styles.addBtn}
              onPress={handleOpenForm}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('voting.new_proposal')}
            >
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
              <Pressable
                style={styles.closedToggle}
                onPress={toggleShowClosed}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${t('voting.past_votes')} (${closed.length})`}
                accessibilityState={{ expanded: showClosed }}
              >
                <Ionicons
                  name={showClosed ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={C.textSecondary}
                />
                <Text style={styles.closedToggleText}>
                  {t('voting.past_votes')} ({closed.length})
                </Text>
              </Pressable>
              {showClosed &&
                closed.map((p) => (
                  <ProposalCard key={p.id} proposal={p} myId={myId} totalPeople={totalPeople} />
                ))}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
