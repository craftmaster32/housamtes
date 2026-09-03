import { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { goBack } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import {
  useNotificationStore,
  type BillDueDays,
  type EventReminderDays,
} from '@stores/notificationStore';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useWebPushToggle } from '@hooks/useWebPushToggle';

import { mf, ms } from '@utils/responsive';
const DAYS_OPTIONS: BillDueDays[] = [1, 2, 3, 7];
const EVENT_DAYS_OPTIONS: EventReminderDays[] = [0, 1, 2, 3, 7];

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, gap: sizes.md, paddingBottom: ms(60) },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,

    header: { gap: ms(4), marginBottom: sizes.xs },
    backBtn: { alignSelf: 'flex-start', marginBottom: sizes.sm },
    backText: { color: C.primary, fontSize: mf(15), ...font.semibold },
    heading: { fontSize: mf(26), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    subheading: { fontSize: mf(14), ...font.regular, color: C.textSecondary, marginTop: ms(2) },

    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      marginTop: sizes.xs,
    },
    sectionTitle: {
      fontSize: mf(13),
      ...font.semibold,
      color: C.textSecondary,
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: ms(14),
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sizes.md,
      paddingVertical: ms(14),
      gap: sizes.md,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowText: { flex: 1 },
    rowLabel: { fontSize: mf(15), ...font.medium, color: C.textPrimary },
    rowDesc: { fontSize: mf(12), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
    pushRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sizes.md,
      paddingVertical: ms(14),
      gap: sizes.md,
    },
    pushIcon: {
      width: ms(36),
      height: ms(36),
      borderRadius: sizes.borderRadiusSm,
      backgroundColor: C.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    daysRow: {
      paddingHorizontal: sizes.md,
      paddingBottom: sizes.md,
      gap: sizes.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingTop: sizes.sm,
    },
    daysLabel: { fontSize: mf(13), ...font.medium, color: C.textSecondary },
    daysOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    dayChip: {
      paddingVertical: ms(7),
      paddingHorizontal: sizes.sm,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    dayChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    dayChipText: { fontSize: mf(13), ...font.medium, color: C.textPrimary },
    dayChipTextActive: { color: '#fff' },

    footer: {
      fontSize: mf(12),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: sizes.sm,
      lineHeight: mf(18),
    },
  });

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
  isLast,
}: ToggleRowProps): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        accessible
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked: value }}
        trackColor={{ false: C.border, true: C.primary + '80' }}
        thumbColor={value ? C.primary : C.surface}
        activeThumbColor={C.primary}
        style={styles.switchLtr}
      />
    </View>
  );
}

export default function NotificationSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const prefs = useNotificationStore((s) => s.prefs);
  const updatePrefs = useNotificationStore((s) => s.update);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const { webPushOn, webPushStatus, handleToggleWebPush } = useWebPushToggle();

  const save = useCallback(
    (changes: Parameters<typeof updatePrefs>[2]) => {
      if (!user?.id || !houseId) return;
      updatePrefs(user.id, houseId, changes);
    },
    [user, houseId, updatePrefs]
  );

  const handleBack = useCallback((): void => {
    goBack();
  }, []);
  const handleSelectDay = useCallback((d: BillDueDays) => save({ billDueDaysBefore: d }), [save]);
  const handleSelectEventDay = useCallback(
    (d: EventReminderDays) => save({ eventReminderDaysBefore: d }),
    [save]
  );
  const eventDayLabel = useCallback(
    (d: EventReminderDays): string =>
      d === 0
        ? t('settings.event_on_day')
        : `${t('common.day', { count: d })} ${t('settings.before_event')}`,
    [t]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={12}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
            <Text style={[styles.heading, headingFont]}>{t('nav.settings')}</Text>
            <Text style={styles.subheading}>{t('settings.notifications_section')}</Text>
          </View>

          {webPushStatus !== 'unavailable' && (
            <View style={styles.card}>
              <View style={styles.pushRow}>
                <View style={styles.pushIcon}>
                  <Ionicons name="notifications-outline" size={18} color={C.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t('settings.browser_notifications')}</Text>
                  <Text style={styles.rowDesc}>
                    {webPushStatus === 'denied'
                      ? t('settings.notifications_blocked')
                      : webPushOn
                        ? t('settings.notifications_enabled')
                        : t('settings.notifications_tap_enable')}
                  </Text>
                </View>
                <Switch
                  value={webPushOn}
                  onValueChange={handleToggleWebPush}
                  disabled={webPushStatus === 'denied'}
                  accessible
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.browser_notifications')}
                  accessibilityState={{ checked: webPushOn, disabled: webPushStatus === 'denied' }}
                  trackColor={{ false: C.border, true: C.primary + '80' }}
                  thumbColor={webPushOn ? C.primary : C.surface}
                  activeThumbColor={C.primary}
                  style={styles.switchLtr}
                />
              </View>
            </View>
          )}

          <View style={styles.sectionTitleRow}>
            <Ionicons name="cash-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('nav.bills')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_bill_added')}
              description={t('settings.notify_bill_added_sub')}
              value={prefs.notifyBillAdded}
              onToggle={(v) => save({ notifyBillAdded: v })}
            />
            <ToggleRow
              label={t('settings.notify_bill_settled')}
              description={t('settings.notify_bill_settled_sub')}
              value={prefs.notifyBillSettled}
              onToggle={(v) => save({ notifyBillSettled: v })}
            />
            <ToggleRow
              label={t('settings.notify_bill_due')}
              description={t('settings.notify_bill_due_sub')}
              value={prefs.notifyBillDue}
              onToggle={(v) => save({ notifyBillDue: v })}
              isLast={!prefs.notifyBillDue}
            />
            {prefs.notifyBillDue && (
              <View style={styles.daysRow}>
                <Text style={styles.daysLabel}>{t('settings.remind_me')}</Text>
                <View style={styles.daysOptions}>
                  {DAYS_OPTIONS.map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        styles.dayChip,
                        prefs.billDueDaysBefore === d && styles.dayChipActive,
                      ]}
                      onPress={() => handleSelectDay(d)}
                      accessible
                      accessibilityRole="radio"
                      accessibilityState={{ selected: prefs.billDueDaysBefore === d }}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          prefs.billDueDaysBefore === d && styles.dayChipTextActive,
                        ]}
                      >
                        {t('common.day', { count: d })} {t('settings.before_due')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="car-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('nav.parking')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_parking_claimed')}
              description={t('settings.notify_parking_claimed_sub')}
              value={prefs.notifyParkingClaimed}
              onToggle={(v) => save({ notifyParkingClaimed: v })}
            />
            <ToggleRow
              label={t('settings.notify_parking_reservation')}
              description={t('settings.notify_parking_reservation_sub')}
              value={prefs.notifyParkingReservation}
              onToggle={(v) => save({ notifyParkingReservation: v })}
              isLast
            />
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="sparkles-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('nav.chores')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_chore')}
              description={t('settings.notify_chore_sub')}
              value={prefs.notifyChoreOverdue}
              onToggle={(v) => save({ notifyChoreOverdue: v })}
              isLast
            />
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="calendar-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('nav.calendar')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_event_added')}
              description={t('settings.notify_event_added_sub')}
              value={prefs.notifyEventAdded}
              onToggle={(v) => save({ notifyEventAdded: v })}
            />
            <ToggleRow
              label={t('settings.notify_event_reminder')}
              description={t('settings.notify_event_reminder_sub')}
              value={prefs.notifyEventReminder}
              onToggle={(v) => save({ notifyEventReminder: v })}
              isLast={!prefs.notifyEventReminder}
            />
            {prefs.notifyEventReminder && (
              <View style={styles.daysRow}>
                <Text style={styles.daysLabel}>{t('settings.remind_me')}</Text>
                <View style={styles.daysOptions}>
                  {EVENT_DAYS_OPTIONS.map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        styles.dayChip,
                        prefs.eventReminderDaysBefore === d && styles.dayChipActive,
                      ]}
                      onPress={() => handleSelectEventDay(d)}
                      accessible
                      accessibilityRole="radio"
                      accessibilityState={{ selected: prefs.eventReminderDaysBefore === d }}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          prefs.eventReminderDaysBefore === d && styles.dayChipTextActive,
                        ]}
                      >
                        {eventDayLabel(d)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('nav.tasks')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_task_assigned')}
              description={t('settings.notify_task_assigned_sub')}
              value={prefs.notifyTaskAssigned}
              onToggle={(v) => save({ notifyTaskAssigned: v })}
              isLast
            />
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('nav.chat')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_chat')}
              description={t('settings.notify_chat_sub')}
              value={prefs.notifyChatMessage}
              onToggle={(v) => save({ notifyChatMessage: v })}
              isLast
            />
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="happy-outline" size={15} color={C.textSecondary} />
            <Text style={styles.sectionTitle}>{t('settings.fun_section')}</Text>
          </View>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_daily_joke')}
              description={t('settings.notify_daily_joke_sub')}
              value={prefs.notifyDailyJoke}
              onToggle={(v) => save({ notifyDailyJoke: v })}
              isLast
            />
          </View>

          <Text style={styles.footer}>
            Changes save instantly. Notifications only work on a real device build, not in Expo Go.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
