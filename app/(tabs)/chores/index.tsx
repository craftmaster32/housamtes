import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform, type ListRenderItemInfo } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { ChoreLine } from '@components/chores/ChoreLine';
import { ChoresGlance } from '@components/chores/ChoresGlance';
import { NewChoreForm } from '@components/chores/NewChoreForm';
import { PadSlice } from '@components/chores/PadSlice';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useBadgeStore } from '@stores/badgeStore';
import { useChoresStore, type Chore, type Recurrence } from '@stores/choresStore';
import { WEEK_DAYS } from '@utils/choreLabels';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

// Rows of the to-do pad: chores, and the handwritten "3 done" before the done ones.
type PadItem = { _k: 'chore'; chore: Chore } | { _k: 'done-header'; count: number };

function ChoresScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();
  const markSeen = useBadgeStore((s) => s.markSeen);

  useFocusEffect(
    useCallback((): void => {
      markSeen('chores').catch(() => {});
    }, [markSeen])
  );

  const chores = useChoresStore((state) => state.chores);
  const isLoading = useChoresStore((state) => state.isLoading);
  const storeError = useChoresStore((state) => state.error);
  const addChore = useChoresStore((state) => state.addChore);
  const toggleChore = useChoresStore((state) => state.toggleChore);
  const claimChore = useChoresStore((state) => state.claimChore);
  const unclaimChore = useChoresStore((state) => state.unclaimChore);
  const deleteChore = useChoresStore((state) => state.deleteChore);
  const resetAll = useChoresStore((state) => state.resetAll);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);
  const canReset = role === 'owner' || role === 'admin';
  const myId = profile?.id ?? '';

  const [choreName, setChoreName] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [recurrenceDay, setRecurrenceDay] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const pending = useMemo(() => chores.filter((ch) => !ch.isComplete), [chores]);
  const done = useMemo(() => chores.filter((ch) => ch.isComplete), [chores]);
  const listData = useMemo(
    (): PadItem[] => [
      ...pending.map((chore) => ({ _k: 'chore' as const, chore })),
      ...(done.length > 0 ? [{ _k: 'done-header' as const, count: done.length }] : []),
      ...done.map((chore) => ({ _k: 'chore' as const, chore })),
    ],
    [pending, done]
  );

  const handleRecurrenceChange = useCallback((r: Recurrence): void => {
    setRecurrence(r);
    if (r === 'weekly') {
      setRecurrenceDay(WEEK_DAYS[new Date().getDay()]);
    } else if (r === 'monthly') {
      setRecurrenceDay(String(new Date().getDate()));
    } else {
      setRecurrenceDay(null);
    }
  }, []);

  const handleAdd = useCallback(async (): Promise<void> => {
    if (!choreName.trim() || isAdding) return;
    setIsAdding(true);
    setAddError('');
    try {
      await addChore(choreName.trim(), recurrence, recurrenceDay, houseId ?? '');
      setChoreName('');
      setRecurrence('once');
      setRecurrenceDay(null);
    } catch (err) {
      setAddError(getErrorMessage(err, t('chores.failed_add')));
    } finally {
      setIsAdding(false);
    }
  }, [choreName, recurrence, recurrenceDay, addChore, houseId, isAdding, t]);

  const handleToggle = useCallback((id: string): void => void toggleChore(id), [toggleChore]);
  const handleClaim = useCallback(
    (id: string): void => void claimChore(id, myId),
    [claimChore, myId]
  );
  const handleUnclaim = useCallback((id: string): void => void unclaimChore(id), [unclaimChore]);
  const handleDelete = useCallback((id: string): void => void deleteChore(id), [deleteChore]);

  // Destructive: wipes every chore's completion + claims. Confirm first, and
  // surface a failed reset instead of leaving the rejected promise unhandled.
  const handleResetAll = useCallback((): void => {
    if (!houseId) return;
    Alert.alert(t('chores.reset_confirm_title'), t('chores.reset_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chores.reset_all'),
        style: 'destructive',
        onPress: (): void => {
          resetAll(houseId).catch((err) => {
            Alert.alert(t('common.error'), getErrorMessage(err, t('chores.reset_failed')));
          });
        },
      },
    ]);
  }, [houseId, resetAll, t]);

  const keyExtractor = useCallback(
    (item: PadItem): string => (item._k === 'done-header' ? 'done-header' : item.chore.id),
    []
  );

  // Every row is a slice of one to-do pad: the first carries the glued edge,
  // chores that follow another get a dashed rule.
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PadItem>): React.JSX.Element => {
      const isFirst = index === 0;
      const isLast = index === listData.length - 1;
      if (item._k === 'done-header') {
        return (
          <PadSlice isFirst={isFirst} isLast={isLast}>
            <Text style={[styles.doneHeader, hand, { color: c.receiptMuted }]}>
              {t('chores.done', { count: item.count })}
            </Text>
          </PadSlice>
        );
      }
      return (
        <PadSlice isFirst={isFirst} isLast={isLast} dashedTop={listData[index - 1]?._k === 'chore'}>
          <ChoreLine
            chore={item.chore}
            myId={myId}
            onToggle={handleToggle}
            onClaim={handleClaim}
            onUnclaim={handleUnclaim}
            onDelete={handleDelete}
          />
        </PadSlice>
      );
    },
    [listData, myId, handleToggle, handleClaim, handleUnclaim, handleDelete, hand, c, t]
  );

  const todoTitle = t('chores.todo');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <BackLink label={t('common.home')} />
            <Text
              style={[styles.pageTitle, headingFont, { color: c.textPrimary }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {t('chores.title')}
            </Text>

            <ChoresGlance
              done={done.length}
              total={chores.length}
              onResetAll={done.length > 0 && canReset ? handleResetAll : undefined}
            />

            <NewChoreForm
              name={choreName}
              onNameChange={setChoreName}
              recurrence={recurrence}
              onRecurrenceChange={handleRecurrenceChange}
              recurrenceDay={recurrenceDay}
              onRecurrenceDayChange={setRecurrenceDay}
              isAdding={isAdding}
              error={addError}
              onAdd={handleAdd}
            />

            {isLoading && chores.length === 0 && (
              <LoadingSpinner size={64} style={styles.loading} />
            )}
            {!!storeError && (
              <Text style={[styles.storeError, { color: c.danger }]} accessibilityRole="alert">
                {storeError}
              </Text>
            )}

            {chores.length > 0 && (
              <Text
                style={[styles.sectionTitle, headingFont, { color: c.textPrimary }]}
                accessibilityRole="header"
              >
                {/* "TO DO" in the translations — written in sentence case here. */}
                {todoTitle.charAt(0) + todoTitle.slice(1).toLowerCase()}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            // Mate keeps the empty pad company — the one Mate on this screen.
            <View style={styles.emptyWrap}>
              <PadSlice isFirst isLast>
                <View style={styles.empty}>
                  <Mate size={ms(80)} />
                  <Text style={[styles.emptyTitle, headingFont, { color: c.receiptInk }]}>
                    {t('chores.no_chores')}
                  </Text>
                  <Text style={[styles.emptyText, { color: c.receiptMuted }]}>
                    {t('chores.no_chores_hint')}
                  </Text>
                </View>
              </PadSlice>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    paddingHorizontal: ms(16),
    paddingTop: ms(4),
    // On web the tab bar floats over the page, so leave its full height free
    // (as Bills does) — otherwise the last rows hide behind it.
    paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
  },
  pageTitle: {
    fontSize: mf(36),
    lineHeight: mf(40),
    letterSpacing: -1,
    marginTop: ms(6),
    marginBottom: ms(14),
  },
  loading: { alignSelf: 'center', marginTop: ms(24) },
  storeError: { fontSize: mf(14), ...font.medium, marginTop: ms(12) },
  sectionTitle: { fontSize: mf(22), letterSpacing: -0.4, marginTop: ms(28), marginBottom: ms(12) },
  doneHeader: { fontSize: mf(20), paddingHorizontal: ms(16), paddingTop: ms(10) },
  emptyWrap: { marginTop: ms(28) },
  empty: {
    alignItems: 'center',
    paddingTop: ms(26),
    paddingBottom: ms(30),
    paddingHorizontal: ms(24),
    gap: ms(6),
  },
  emptyTitle: { fontSize: mf(19), textAlign: 'center', marginTop: ms(8) },
  emptyText: { fontSize: mf(14), ...font.medium, textAlign: 'center', lineHeight: mf(20) },
});

export default withFeatureGuard('chores', ChoresScreen);
