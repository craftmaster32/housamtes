import { useState, useCallback, useMemo } from 'react';
import { useScrollToTopOnNav } from '@hooks/useScrollToTopOnNav';
import { View, StyleSheet, FlatList, Platform, type ListRenderItemInfo } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { MateCameo } from '@components/shared/MateCameo';
import { MateSpot } from '@components/shared/MateSpot';
import { useMateScene } from '@hooks/useMateScene';
import { Fold } from '@components/shared/Fold';
import { BillTabs } from '@components/bills/BillTabs';
import { PadSlice } from '@components/tasks/PadSlice';
import { TaskForm } from '@components/tasks/TaskForm';
import { TaskLine } from '@components/tasks/TaskLine';
import { TasksGlance } from '@components/tasks/TasksGlance';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { useTaskPadRows, type PadItem } from '@hooks/useTaskPadRows';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useBadgeStore } from '@stores/badgeStore';
import { useTasksStore, type NewTaskInput, type TaskFilter } from '@stores/tasksStore';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

const FILTERS: TaskFilter[] = ['all', 'active', 'completed'];

/**
 * Tasks — the house's one to-do list (Chores were merged in, Oct 2026): one-off
 * jobs and weekly / monthly repeating ones, on a to-do pad.
 */
export default function TasksScreen(): React.JSX.Element {
  // Tapping your way here (even from this page) shows the top of the page.
  const scrollRef = useScrollToTopOnNav('tasks/index');
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();
  const markSeen = useBadgeStore((s) => s.markSeen);
  const tasks = useTasksStore((s) => s.tasks);
  const isLoading = useTasksStore((s) => s.isLoading);
  const storeError = useTasksStore((s) => s.error);
  const addTask = useTasksStore((s) => s.addTask);
  const toggleTask = useTasksStore((s) => s.toggleTask);
  const assignTask = useTasksStore((s) => s.assignTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const resetRepeating = useTasksStore((s) => s.resetRepeating);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);
  const myId = profile?.id ?? '';
  const isAdmin = role === 'owner' || role === 'admin';
  const [filter, setFilter] = useState<TaskFilter>('all');

  // The menu badge for this list (still keyed 'chores') clears when you look.
  useFocusEffect(
    useCallback((): void => {
      markSeen('chores').catch(() => {});
    }, [markSeen])
  );

  const active = useMemo(() => tasks.filter((tk) => !tk.isComplete), [tasks]);
  const done = useMemo(() => tasks.filter((tk) => tk.isComplete), [tasks]);
  const canReset = isAdmin && done.some((tk) => tk.recurrence !== 'once');

  // A ticked task stays put for a beat, then folds down under "done".
  const listData = useTaskPadRows(tasks, filter);
  // An empty pad already has its own Mate, so he only hides when there's a list.
  const mateSpot = useMateScene(MATE_SPOTS, listData.length > 0);

  const handleAdd = useCallback(
    async (input: NewTaskInput): Promise<void> => {
      if (!houseId) return;
      await addTask(input, houseId);
    },
    [addTask, houseId]
  );

  const handleToggle = useCallback(
    (id: string): void => {
      toggleTask(id).catch((err) => {
        Alert.alert(t('common.error'), getErrorMessage(err, t('tasks.failed_update')));
      });
    },
    [toggleTask, t]
  );

  const handleAssign = useCallback(
    (id: string, userId: string | null): void => {
      assignTask(id, userId).catch((err) => {
        Alert.alert(t('common.error'), getErrorMessage(err, t('tasks.failed_update')));
      });
    },
    [assignTask, t]
  );

  const handleDelete = useCallback(
    (id: string): void => {
      deleteTask(id).catch((err) => {
        Alert.alert(t('common.error'), getErrorMessage(err, t('tasks.failed_delete')));
      });
    },
    [deleteTask, t]
  );

  // Un-ticks the weekly / monthly tasks for a new round. Confirm first.
  const handleResetRepeating = useCallback((): void => {
    if (!houseId) return;
    Alert.alert(t('tasks.reset_repeating_title'), t('tasks.reset_repeating_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tasks.reset_repeating'),
        style: 'destructive',
        onPress: (): void => {
          resetRepeating(houseId).catch((err) => {
            Alert.alert(t('common.error'), getErrorMessage(err, t('tasks.reset_failed')));
          });
        },
      },
    ]);
  }, [houseId, resetRepeating, t]);

  const keyExtractor = useCallback(
    (item: PadItem): string => (item._k === 'done-header' ? 'done-header' : item.task.id),
    []
  );

  // Every row is a slice of one to-do pad: the first carries the glued edge,
  // tasks that follow another get a dashed rule.
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PadItem>): React.JSX.Element => {
      const isFirst = index === 0;
      const isLast = index === listData.length - 1;
      if (item._k === 'done-header') {
        return (
          <Fold open={!item.leaving} appear={item.arriving}>
            <PadSlice isFirst={isFirst} isLast={isLast}>
              <Text style={[styles.doneHeader, hand, { color: c.receiptMuted }]}>
                {t('tasks.done', { count: item.count })}
              </Text>
            </PadSlice>
          </Fold>
        );
      }
      return (
        <Fold open={!item.leaving} appear={item.arriving}>
          <PadSlice
            isFirst={isFirst}
            isLast={isLast}
            dashedTop={listData[index - 1]?._k === 'task'}
          >
            <TaskLine
              task={item.task}
              myId={myId}
              canDelete={isAdmin || item.task.createdBy === myId}
              onToggle={handleToggle}
              onAssign={handleAssign}
              onDelete={handleDelete}
            />
          </PadSlice>
        </Fold>
      );
    },
    [listData, myId, isAdmin, handleToggle, handleAssign, handleDelete, hand, c, t]
  );

  const tabs = useMemo(() => FILTERS.map((f) => ({ key: f, label: t(`tasks.filter_${f}`) })), [t]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <FlatList
        ref={scrollRef}
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
              {t('tasks.title')}
            </Text>

            {/* Before the tile so it hides his lower half: peeking over its top. */}
            {mateSpot === 'peekOver' && (
              <View style={mateStyles.behind}>
                <MateSpot kind="peekOver" size={ms(38)} style={mateStyles.peek} />
              </View>
            )}
            <TasksGlance
              done={done.length}
              total={tasks.length}
              onResetRepeating={canReset ? handleResetRepeating : undefined}
            />

            <TaskForm onAdd={handleAdd} myId={myId} />

            {isLoading && tasks.length === 0 && <LoadingSpinner size={64} style={styles.loading} />}
            {!!storeError && (
              <Text style={[styles.storeError, { color: c.danger }]} accessibilityRole="alert">
                {storeError}
              </Text>
            )}

            {tasks.length > 0 && (
              <View style={styles.tabsRow}>
                <View style={styles.tabs}>
                  <BillTabs tabs={tabs} selected={filter} onSelect={setFilter} role="radio" />
                </View>
                <Text style={[styles.count, hand, { color: c.textSecondary }]}>
                  {t('tasks.active_count', { count: active.length })}
                </Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={mateSpot === 'footer' ? <MateCameo page="tasks" always /> : null}
        ListEmptyComponent={
          isLoading ? null : (
            // Mate keeps the empty pad company — the one Mate on this screen.
            <View style={styles.emptyWrap}>
              <PadSlice isFirst isLast>
                <View style={styles.empty}>
                  {filter !== 'completed' && <Mate size={ms(80)} />}
                  <Text style={[styles.emptyTitle, headingFont, { color: c.receiptInk }]}>
                    {filter === 'completed' ? t('tasks.no_completed') : t('tasks.no_tasks')}
                  </Text>
                  <Text style={[styles.emptyText, { color: c.receiptMuted }]}>
                    {t('tasks.no_tasks_hint')}
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
    // Tall enough for the descenders (the "g" in Parking was being clipped).
    lineHeight: mf(46),
    paddingBottom: ms(2),
    letterSpacing: -1,
    marginTop: ms(6),
    marginBottom: ms(14),
  },
  loading: { alignSelf: 'center', marginTop: ms(24) },
  storeError: { fontSize: mf(14), ...font.medium, marginTop: ms(12) },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: ms(8),
    marginTop: ms(24),
    marginBottom: ms(12),
  },
  tabs: { flex: 1, minWidth: 0 },
  count: { fontSize: mf(19), paddingBottom: ms(10) },
  doneHeader: { fontSize: mf(20), paddingHorizontal: ms(16), paddingTop: ms(10) },
  emptyWrap: { marginTop: ms(24) },
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

// Where Mate may hide on a visit: peeking over the "2 of 6 done" tile, or at
// the end of the pad.
const MATE_SPOTS = ['peekOver', 'footer'] as const;

const mateStyles = StyleSheet.create({
  behind: { height: 0 },
  peek: { start: '58%', top: -ms(26) },
});
