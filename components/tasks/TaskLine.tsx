import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useHandFont } from '@hooks/useHandFont';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import type { HouseTask } from '@stores/tasksStore';
import { resolveName } from '@utils/housemates';
import { todayString } from '@utils/parkingDates';
import { repeatLabel } from '@utils/taskRepeat';
import { mf, ms } from '@utils/responsive';
import { priorityColor } from './PriorityWords';

// Pen colours on the pad (the pad stays light in dark mode).
const INK = '#22201D';
const PEN = lightColors.primary;
const RED_PEN = lightColors.danger;

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
}

/** "21 Oct" for a YYYY-MM-DD due date, in the app language. */
function formatDueDate(iso: string, lang: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short' });
}

export interface TaskLineProps {
  task: HouseTask;
  myId: string;
  canDelete: boolean;
  onToggle: (id: string) => void;
  onAssign: (id: string, userId: string | null) => void;
  onDelete: (id: string) => void;
}

/**
 * One task on the to-do pad: a square checkbox ticked in blue pen, the priority
 * dot and title (struck through once done), details, how often it repeats and
 * the due date in handwriting, and who it's for — or a "Take it" tag.
 */
export function TaskLine({
  task,
  myId,
  canDelete,
  onToggle,
  onAssign,
  onDelete,
}: TaskLineProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const done = task.isComplete;
  const isMine = task.assignedTo === myId;
  const repeat = repeatLabel(task, t, language);
  const overdue = !!task.dueDate && !done && task.dueDate < todayString();
  const dueText = task.dueDate
    ? overdue
      ? t('tasks.overdue', { date: formatDueDate(task.dueDate, language) })
      : formatDueDate(task.dueDate, language)
    : null;

  const handleToggle = useCallback(() => onToggle(task.id), [onToggle, task.id]);
  const handleTake = useCallback(() => onAssign(task.id, myId), [onAssign, task.id, myId]);
  const handleDrop = useCallback(() => onAssign(task.id, null), [onAssign, task.id]);
  const handleDelete = useCallback(() => onDelete(task.id), [onDelete, task.id]);

  return (
    <View style={styles.line}>
      <Pressable
        style={styles.checkHit}
        onPress={handleToggle}
        accessible
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={task.title}
      >
        <View style={styles.box}>
          {done && (
            <Svg width={ms(26)} height={ms(26)} viewBox="0 0 26 26" style={styles.tick}>
              <Path
                d="M4 13 L10.5 20 L23 3"
                stroke={PEN}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          )}
        </View>
      </Pressable>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {!done && (
            <View style={[styles.dot, { backgroundColor: priorityColor(task.priority, c) }]} />
          )}
          <Text
            style={[styles.title, { color: done ? c.receiptMuted : INK }, done && styles.struck]}
          >
            {task.title}
          </Text>
        </View>
        {task.description.length > 0 && (
          <Text style={[styles.description, { color: c.receiptMuted }]} numberOfLines={2}>
            {task.description}
          </Text>
        )}
        {!!repeat && <Text style={[styles.hand, hand, { color: PEN }]}>{repeat}</Text>}

        {(task.assignedTo || dueText) && (
          <View style={styles.metaRow}>
            {task.assignedTo && (
              <View style={styles.who}>
                <UserAvatar userId={task.assignedTo} size={ms(22)} />
                <Text style={[styles.whoText, { color: c.receiptMuted }]}>
                  {isMine ? t('tasks.assigned_you') : resolveName(task.assignedTo, housemates)}
                </Text>
                {isMine && !done && (
                  <Pressable
                    onPress={handleDrop}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    accessible
                    accessibilityRole="button"
                  >
                    <Text style={[styles.drop, { color: PEN }]}>{t('tasks.drop')}</Text>
                  </Pressable>
                )}
              </View>
            )}
            {!!dueText && (
              <Text style={[styles.hand, hand, { color: overdue ? RED_PEN : PEN }]}>{dueText}</Text>
            )}
          </View>
        )}

        {!task.assignedTo && !done && (
          <View style={styles.tag}>
            <PaperTag label={t('tasks.take')} onPress={handleTake} />
          </View>
        )}
      </View>

      {canDelete && (
        <Pressable
          onPress={handleDelete}
          style={styles.deleteHit}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('tasks.delete_task')}
        >
          <Ionicons name="close" size={17} color={c.receiptMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: ms(8),
    paddingStart: ms(4),
    paddingEnd: ms(4),
  },
  checkHit: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  // A square drawn in ink, a little crooked, like on a paper to-do list.
  box: {
    width: ms(24),
    height: ms(24),
    borderWidth: 2.2,
    borderColor: INK,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: ms(1), top: -ms(7) },
  body: { flex: 1, minWidth: 0, paddingTop: ms(10) },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(7) },
  dot: { width: ms(9), height: ms(9), borderRadius: ms(5), marginTop: ms(6) },
  title: { flex: 1, fontSize: mf(16), ...font.bold },
  struck: { textDecorationLine: 'line-through', textDecorationColor: PEN },
  description: { fontSize: mf(13.5), ...font.medium, lineHeight: mf(18), marginTop: ms(2) },
  hand: { fontSize: mf(18), lineHeight: mf(21), marginTop: ms(1) },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(12),
    marginTop: ms(5),
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: ms(7) },
  whoText: { fontSize: mf(13.5), ...font.semibold },
  drop: { fontSize: mf(13.5), ...font.bold },
  tag: { alignSelf: 'flex-start', marginTop: ms(8), marginBottom: ms(4) },
  deleteHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
