import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { HouseTask, TaskPriority } from '@stores/tasksStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

interface TaskRowProps {
  task: HouseTask;
  myId: string;
  canDelete: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function isOverdue(task: HouseTask): boolean {
  if (!task.dueDate || task.isComplete) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  return task.dueDate < todayStr;
}

export function TaskRow({
  task,
  myId,
  canDelete,
  onToggle,
  onDelete,
}: TaskRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const priorityColor: Record<TaskPriority, string> = {
    low: C.positive,
    medium: C.warning,
    high: C.danger,
  };
  const overdue = isOverdue(task);
  const assigneeLabel = task.assignedTo
    ? task.assignedTo === myId
      ? t('tasks.assigned_you')
      : resolveName(task.assignedTo, housemates)
    : null;

  return (
    <View style={[styles.row, task.isComplete && styles.rowDone]}>
      <Pressable
        style={styles.checkBtn}
        onPress={() => onToggle(task.id)}
        accessible
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        accessibilityState={{ checked: task.isComplete }}
      >
        <Ionicons
          name={task.isComplete ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={task.isComplete ? C.positive : C.border}
        />
      </Pressable>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, task.isComplete && styles.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          <View
            style={[styles.priorityPill, { backgroundColor: priorityColor[task.priority] + '22' }]}
          >
            <Text style={[styles.priorityText, { color: priorityColor[task.priority] }]}>
              {t(`tasks.priority_${task.priority}`)}
            </Text>
          </View>
        </View>

        {task.description.length > 0 && (
          <Text style={styles.description} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        {(assigneeLabel || task.dueDate) && (
          <View style={styles.metaRow}>
            {assigneeLabel && (
              <View style={styles.assigneeBadge}>
                <Ionicons name="person-outline" size={11} color={C.primary} />
                <Text style={styles.assigneeText}>{assigneeLabel}</Text>
              </View>
            )}
            {task.dueDate && (
              <View style={styles.dueRow}>
                <Ionicons
                  name={overdue ? 'alert-circle-outline' : 'calendar-outline'}
                  size={12}
                  color={overdue ? C.danger : C.textSecondary}
                />
                <Text style={[styles.dueText, overdue && styles.dueTextOverdue]}>
                  {overdue ? t('tasks.overdue', { date: task.dueDate }) : task.dueDate}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {canDelete && (
        <Pressable
          onPress={() => onDelete(task.id)}
          style={styles.deleteBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('tasks.delete_task')}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={C.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    rowDone: { backgroundColor: C.surfaceSecondary, borderColor: 'transparent' },
    checkBtn: { flexShrink: 0, minWidth: 44, minHeight: 44, justifyContent: 'center' },
    info: { flex: 1, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 15, ...font.semibold, color: C.textPrimary, flexShrink: 1 },
    titleDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    priorityPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
    priorityText: { fontSize: 10, ...font.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
    description: { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 18 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    assigneeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.primary + '18',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 9999,
    },
    assigneeText: { fontSize: 12, ...font.bold, color: C.primary },
    dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dueText: { fontSize: 12, ...font.medium, color: C.textSecondary },
    dueTextOverdue: { color: C.danger, ...font.bold },
    deleteBtn: {
      padding: 4,
      flexShrink: 0,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
