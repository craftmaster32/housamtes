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
import { MateCameo } from '@components/shared/MateCameo';
import { BallotCard } from '@components/voting/BallotCard';
import { ProposalSheet } from '@components/voting/ProposalSheet';
import { PaperTag } from '@components/bills/recurring/PaperTag';
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
        if (open.length === 0) {
          return isLoading ? null : (
            <View style={styles.empty}>
              <Mate size={ms(80)} />
              <Text style={[styles.emptyTitle, hand]}>{t('voting.no_open')}</Text>
              <Text style={styles.emptyText}>{t('voting.no_open_hint')}</Text>
            </View>
          );
        }
        return (
          <View style={styles.section} accessibilityRole="header">
            <Text style={[styles.sectionTitle, headingFont]}>{t('voting.section_open')}</Text>
            <Text style={[styles.sectionCount, hand]}>
              {t('voting.to_decide', { count: open.length })}
            </Text>
          </View>
        );
      }
      if (closed.length === 0) return null;
      // Decided ballots fold away under their heading; tap it to show them.
      return (
        <Pressable
          style={({ pressed }) => [styles.section, pressed && styles.dim]}
          onPress={toggleShowClosed}
          accessibilityRole="button"
          accessibilityLabel={`${t('voting.section_decided')} (${closed.length})`}
          accessibilityState={{ expanded: showClosed }}
        >
          <Text style={[styles.sectionTitle, headingFont]}>{t('voting.section_decided')}</Text>
          <Text style={[styles.sectionCount, hand]}>{closed.length}</Text>
          <Ionicons
            name={showClosed ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={C.textSecondary}
            style={styles.chevron}
          />
        </Pressable>
      );
    },
    [
      open.length,
      closed.length,
      isLoading,
      showClosed,
      toggleShowClosed,
      styles,
      hand,
      headingFont,
      t,
      C,
    ]
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
        ListFooterComponent={open.length > 0 ? <MateCameo page="voting" /> : null}
        ListHeaderComponent={
          <View>
            <BackLink label={t('common.home')} />
            <View style={styles.titleRow}>
              <Text style={[styles.title, headingFont]}>{t('voting.title')}</Text>
              <View style={styles.tag}>
                <PaperTag label={t('voting.new_proposal')} onPress={handleOpenForm} />
              </View>
            </View>
            <Text style={styles.subtitle}>{t('voting.subtitle')}</Text>
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: ms(10),
      marginTop: ms(4),
    },
    title: {
      flexShrink: 1,
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      color: C.textPrimary,
    },
    tag: { paddingBottom: ms(10) },
    subtitle: { fontSize: mf(14), lineHeight: mf(20), ...font.regular, color: C.textSecondary },
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
    section: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: ms(10),
      minHeight: 44,
      paddingTop: ms(18),
      marginBottom: ms(10),
    },
    sectionTitle: { fontSize: mf(22), lineHeight: mf(28), color: C.textPrimary },
    sectionCount: { fontSize: mf(20), color: C.primary },
    chevron: { alignSelf: 'flex-end', marginBottom: ms(6) },
  });
