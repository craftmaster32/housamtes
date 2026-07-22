import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
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
  const assignee = task.assignedTo ? housemates.find((h) => h.id === task.assignedTo) : undefined;
  const assigneeLabel = task.assignedTo
    ? task.assignedTo === myId
      ? t('tasks.assigned_you')
      : resolveName(task.assignedTo, housemates)
    : null;
  const assigneeColor = assignee?.color ?? C.primary;

  return (
    <View style={[styles.row, task.isComplete && styles.rowDone]}>
      {!task.isComplete && (
        <View
          style={[styles.accent, { backgroundColor: priorityColor[task.priority] }]}
          pointerEvents="none"
        />
      )}
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
          {!task.isComplete && (
            <View style={[styles.priorityDot, { backgroundColor: priorityColor[task.priority] }]} />
          )}
          <Text style={[styles.title, task.isComplete && styles.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
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
                <View style={[styles.assigneeAvatar, { backgroundColor: assigneeColor }]}>
                  {assignee?.avatarUrl ? (
                    <Image
                      source={{ uri: assignee.avatarUrl }}
                      style={styles.assigneeAvatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.assigneeInitial}>
                      {(assigneeLabel || '?').trim().charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
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
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingRight: 14,
      paddingLeft: 16,
      borderRadius: 16,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    rowDone: { backgroundColor: C.surfaceSecondary, borderColor: 'transparent' },
    accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    checkBtn: { flexShrink: 0, minWidth: 44, minHeight: 44, justifyContent: 'center' },
    info: { flex: 1, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    priorityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    title: { fontSize: 15, ...font.bold, color: C.textPrimary, flexShrink: 1 },
    titleDone: { textDecorationLine: 'line-through', color: C.textSecondary, ...font.semibold },
    description: { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 18 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    assigneeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.surfaceSecondary,
      paddingLeft: 3,
      paddingRight: 9,
      paddingVertical: 3,
      borderRadius: 9999,
    },
    assigneeAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    assigneeAvatarImg: { width: 20, height: 20 },
    assigneeInitial: { fontSize: 9, ...font.extrabold, color: '#fff' },
    assigneeText: { fontSize: 12, ...font.bold, color: C.textSecondary },
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
