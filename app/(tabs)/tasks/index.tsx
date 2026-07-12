import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnimatedListItem } from '@components/shared/AnimatedListItem';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useTasksStore,
  type HouseTask,
  type NewTaskInput,
  type TaskFilter,
} from '@stores/tasksStore';
import { useAuthStore } from '@stores/authStore';
import { TaskRow } from '@components/tasks/TaskRow';
import { AddTaskForm } from '@components/tasks/AddTaskForm';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

const FILTERS: TaskFilter[] = ['all', 'active', 'completed'];

export default function TasksScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const tasks = useTasksStore((s) => s.tasks);
  const isLoading = useTasksStore((s) => s.isLoading);
  const storeError = useTasksStore((s) => s.error);
  const addTask = useTasksStore((s) => s.addTask);
  const toggleTask = useTasksStore((s) => s.toggleTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const myId = profile?.id ?? '';
  const isAdmin = role === 'owner' || role === 'admin';
  const [filter, setFilter] = useState<TaskFilter>('all');

  const visibleTasks = useMemo(() => {
    if (filter === 'active') return tasks.filter((task) => !task.isComplete);
    if (filter === 'completed') return tasks.filter((task) => task.isComplete);
    return tasks;
  }, [tasks, filter]);

  const activeCount = useMemo(() => tasks.filter((task) => !task.isComplete).length, [tasks]);

  const handleAdd = useCallback(
    async (input: NewTaskInput): Promise<void> => {
      await addTask(input, houseId ?? '');
    },
    [addTask, houseId]
  );

  const handleToggle = useCallback(
    (id: string): void => {
      toggleTask(id);
    },
    [toggleTask]
  );

  const handleDelete = useCallback(
    (id: string): void => {
      deleteTask(id);
    },
    [deleteTask]
  );

  const renderTask = useCallback(
    ({ item, index }: { item: HouseTask; index: number }): React.JSX.Element => (
      <AnimatedListItem index={index}>
        <TaskRow
          task={item}
          myId={myId}
          canDelete={isAdmin || item.createdBy === myId}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </AnimatedListItem>
    ),
    [myId, isAdmin, handleToggle, handleDelete]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.flex}>
        <FlatList
          data={visibleTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <View>
              <View style={styles.heroCard}>
                <View style={styles.heroCopy}>
                  <Text style={styles.titleHero}>{t('tasks.title')}</Text>
                  <Text style={styles.textBase}>{t('tasks.subtitle')}</Text>
                </View>
                <AddTaskForm onAdd={handleAdd} />
              </View>

              {isLoading && tasks.length === 0 && (
                <ActivityIndicator size="small" color={C.primary} style={styles.loadingIndicator} />
              )}
              {!!storeError && (
                <View style={styles.storeErrorBox}>
                  <Text style={styles.storeErrorText}>{storeError}</Text>
                </View>
              )}

              {tasks.length > 0 && (
                <View style={styles.filterRow}>
                  {FILTERS.map((f) => (
                    <Pressable
                      key={f}
                      style={[styles.filterChip, filter === f && styles.filterChipActive]}
                      onPress={() => setFilter(f)}
                      accessible
                      accessibilityRole="radio"
                      accessibilityLabel={t(`tasks.filter_${f}`)}
                      accessibilityState={{ selected: filter === f }}
                    >
                      <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                        {t(`tasks.filter_${f}`)}
                      </Text>
                    </Pressable>
                  ))}
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>
                      {t('tasks.active_count', { count: activeCount })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="list-outline" size={36} color={C.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>
                  {filter === 'completed' ? t('tasks.no_completed') : t('tasks.no_tasks')}
                </Text>
                <Text style={styles.emptyText}>{t('tasks.no_tasks_hint')}</Text>
              </View>
            ) : null
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
    sep: { height: 8 },

    heroCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      gap: 14,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    heroCopy: { gap: 6 },
    titleHero: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.78 },
    textBase: { fontSize: 15, ...font.regular, color: C.textSecondary, lineHeight: 22 },

    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    filterText: { fontSize: 13, ...font.semibold, color: C.textSecondary },
    filterTextActive: { color: '#fff' },
    countPill: {
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: 9999,
      backgroundColor: C.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginStart: 'auto',
    },
    countPillText: { fontSize: 11, ...font.bold, color: C.secondaryForeground },

    emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTitle: { fontSize: 16, ...font.bold, color: C.textPrimary },
    emptyText: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    loadingIndicator: { marginBottom: 8 },
    storeErrorBox: {
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    storeErrorText: { fontSize: 13, color: C.danger },
  });
}
