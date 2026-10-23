import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, SectionList, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { BallotCard } from '@components/voting/BallotCard';
import { ProposalSheet } from '@components/voting/ProposalSheet';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useVotingStore, type Proposal } from '@stores/votingStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface BallotSection {
  key: 'open' | 'closed';
  data: Proposal[];
}

function VotingScreen(): React.JSX.Element {
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
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();

  const myId = profile?.id ?? '';
  const totalPeople = Math.max(1, housemates.length);
  const open = proposals.filter((p) => p.isOpen);
  const closed = proposals.filter((p) => !p.isOpen);

  const sections = useMemo<BallotSection[]>(
    () => [
      { key: 'open', data: open },
      { key: 'closed', data: showClosed ? closed : [] },
    ],
    [open, closed, showClosed]
  );

  const handleOpenForm = useCallback((): void => setShowForm(true), []);
  const handleCloseForm = useCallback((): void => setShowForm(false), []);
  const toggleShowClosed = useCallback((): void => setShowClosed((v) => !v), []);

  const renderItem = useCallback(
    ({ item }: { item: Proposal }): React.JSX.Element => (
      <View style={styles.item}>
        <BallotCard proposal={item} myId={myId} totalPeople={totalPeople} />
      </View>
    ),
    [myId, totalPeople, styles]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: BallotSection }): React.JSX.Element | null => {
      if (section.key === 'open') {
        return open.length === 0 && !isLoading ? (
          <View style={styles.empty}>
            <Mate size={ms(80)} />
            <Text style={[styles.emptyTitle, hand]}>{t('voting.no_open')}</Text>
            <Text style={styles.emptyText}>{t('voting.no_open_hint')}</Text>
          </View>
        ) : null;
      }
      if (closed.length === 0) return null;
      return (
        <Pressable
          style={styles.closedToggle}
          onPress={toggleShowClosed}
          accessibilityRole="button"
          accessibilityLabel={`${t('voting.past_votes')} (${closed.length})`}
          accessibilityState={{ expanded: showClosed }}
        >
          <Text style={styles.closedToggleText}>
            {t('voting.past_votes')} ({closed.length})
          </Text>
          <Ionicons
            name={showClosed ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={C.textSecondary}
          />
        </Pressable>
      );
    },
    [open.length, closed.length, isLoading, showClosed, toggleShowClosed, styles, hand, t, C]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <BackLink label={t('common.home')} />
            <Text style={[styles.title, headingFont]}>{t('voting.title')}</Text>
            <Text style={styles.subtitle}>{t('voting.subtitle')}</Text>
            <Pressable
              style={({ pressed }) => [styles.newBtn, pressed && styles.dim]}
              onPress={handleOpenForm}
              accessibilityRole="button"
              accessibilityLabel={t('voting.new_proposal')}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.newBtnText}>
                {t('voting.new_proposal').replace(/^\+\s*/, '')}
              </Text>
            </Pressable>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {isLoading && proposals.length === 0 && (
              <View style={styles.loading}>
                <LoadingSpinner accessibilityLabel={t('common.loading')} />
              </View>
            )}
          </View>
        }
      />
      <ProposalSheet
        visible={showForm}
        createdBy={myId}
        houseId={houseId ?? ''}
        onClose={handleCloseForm}
      />
    </SafeAreaView>
  );
}

export default withFeatureGuard('voting', VotingScreen);

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    list: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    subtitle: { fontSize: mf(14), lineHeight: mf(20), ...font.regular, color: C.textSecondary },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      minHeight: 52,
      borderRadius: ms(17),
      backgroundColor: C.primary,
      marginTop: ms(18),
      marginBottom: ms(22),
    },
    newBtnText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
    dim: { opacity: 0.6 },
    errorText: { fontSize: mf(13), ...font.regular, color: C.danger, marginBottom: ms(12) },
    loading: { paddingVertical: ms(40), alignItems: 'center' },
    item: { marginBottom: ms(18) },
    empty: { alignItems: 'center', paddingVertical: ms(20), gap: ms(8) },
    emptyTitle: { fontSize: mf(22), lineHeight: mf(26), color: C.textPrimary, textAlign: 'center' },
    emptyText: {
      fontSize: mf(13.5),
      lineHeight: mf(19),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingHorizontal: ms(16),
    },
    closedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      minHeight: 44,
      marginBottom: ms(10),
    },
    closedToggleText: { fontSize: mf(14), ...font.semibold, color: C.textSecondary },
  });
