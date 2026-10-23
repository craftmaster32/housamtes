import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import {
  formatShortDate,
  recurrenceLabel,
  typeColor,
  typeLabelKey,
  type CalendarEvent,
} from '@components/calendar/calendarMeta';
import { mf, ms } from '@utils/responsive';

export interface EventSyncState {
  /** Native: show the "add to my calendar" button. */
  showSync: boolean;
  alreadySynced: boolean;
  /** Web: Google / .ics links instead of a native sync. */
  webLinks: boolean;
}

interface EventEntryProps {
  item: CalendarEvent;
  expanded: boolean;
  sync: EventSyncState;
  onToggle: (id: string) => void;
  onEdit: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onSync: (item: CalendarEvent) => void;
  onGoogle: (item: CalendarEvent) => void;
  onIcs: (item: CalendarEvent) => void;
}

/**
 * One entry on the chosen day: the time in handwriting on the left, a coloured
 * stroke for what kind it is, the title. Tap to open the details and actions.
 */
function EventEntryComponent({
  item,
  expanded,
  sync,
  onToggle,
  onEdit,
  onDelete,
  onSync,
  onGoogle,
  onIcs,
}: EventEntryProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const color = typeColor(item.type, c);

  const range =
    item.endDate && item.endDate !== item.date
      ? `${formatShortDate(item.date, i18n.language)} – ${formatShortDate(item.endDate, i18n.language)}`
      : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onToggle(item.id)}
      accessibilityRole="button"
      accessibilityLabel={
        expanded
          ? t('calendar.collapse', { title: item.title })
          : t('calendar.expand', { title: item.title })
      }
      accessibilityState={{ expanded }}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, hand, { color: c.textSecondary }]}>{item.startTime ?? ''}</Text>
        {!!item.endTime && (
          <Text style={[styles.timeEnd, hand, { color: c.textTertiary }]}>{item.endTime}</Text>
        )}
      </View>
      <View style={[styles.stroke, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={expanded ? 0 : 1}>
          {item.title}
        </Text>
        <Text style={[styles.kind, { color }]}>
          {t(typeLabelKey(item.type))}
          {item.recurrence
            ? ` · ${recurrenceLabel(t, item.recurrence, item.recurrenceInterval ?? 1)}`
            : ''}
        </Text>

        {expanded && (
          <View style={styles.details}>
            {!!range && <Text style={[styles.detail, { color: c.textSecondary }]}>{range}</Text>}
            {!!item.detail && (
              <Text style={[styles.detail, { color: c.textSecondary }]}>{item.detail}</Text>
            )}
            {!!item.notes && (
              <Text style={[styles.notes, hand, { color: c.textPrimary }]}>{item.notes}</Text>
            )}
            <View style={styles.actions}>
              {sync.webLinks && Platform.OS === 'web' && (
                <>
                  <Pressable
                    style={styles.icon}
                    onPress={() => onGoogle(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.add_to_google')}
                  >
                    <Ionicons name="logo-google" size={16} color={c.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={styles.icon}
                    onPress={() => onIcs(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.download_ics')}
                  >
                    <Ionicons name="download-outline" size={17} color={c.textSecondary} />
                  </Pressable>
                </>
              )}
              {sync.showSync && Platform.OS !== 'web' && (
                <Pressable
                  style={styles.icon}
                  onPress={() => onSync(item)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sync.alreadySynced
                      ? t('calendar.added_to_calendar')
                      : t('calendar.add_to_my_calendar')
                  }
                >
                  <Ionicons
                    name={sync.alreadySynced ? 'checkmark-circle' : 'calendar-outline'}
                    size={18}
                    color={sync.alreadySynced ? c.positive : c.textSecondary}
                  />
                </Pressable>
              )}
              {item.type === 'event' && (
                <>
                  <Pressable
                    style={styles.link}
                    onPress={() => onEdit(item.sourceId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.edit_event_btn')}
                  >
                    <Text style={[styles.linkText, { color: c.primary }]}>
                      {t('calendar.edit_event_btn')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.link}
                    onPress={() => onDelete(item.sourceId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.delete_event')}
                  >
                    <Text style={[styles.linkText, { color: c.negative }]}>
                      {t('calendar.delete_event')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const EventEntry = React.memo(EventEntryComponent);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: ms(10), paddingVertical: ms(8) },
  pressed: { opacity: 0.7 },
  timeCol: { width: ms(54), alignItems: 'flex-end', paddingTop: ms(1) },
  time: { fontSize: mf(17), lineHeight: mf(21), paddingEnd: ms(3) },
  timeEnd: { fontSize: mf(14.5), lineHeight: mf(18), paddingEnd: ms(3) },
  stroke: { width: 3, borderRadius: 2 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: mf(16), lineHeight: mf(22), ...font.semibold },
  kind: { fontSize: mf(12.5), ...font.semibold, marginTop: ms(1) },
  details: { marginTop: ms(6), gap: ms(3) },
  detail: { fontSize: mf(13.5), ...font.regular },
  notes: { fontSize: mf(18), lineHeight: mf(22), marginTop: ms(2) },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: ms(2) },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 44, justifyContent: 'center', paddingEnd: ms(16) },
  linkText: { fontSize: mf(14), ...font.semibold },
});
