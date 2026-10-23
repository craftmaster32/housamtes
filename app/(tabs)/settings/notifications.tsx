import { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  useNotificationStore,
  type BillDueDays,
  type EventReminderDays,
  type NotificationPrefs,
} from '@stores/notificationStore';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useWebPushToggle } from '@hooks/useWebPushToggle';
import { BackLink } from '@components/shared/BackLink';
import { InkTickBox } from '@components/shared/InkTickBox';
import { SettingsLine } from '@components/settings/SettingsLine';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { mf, ms } from '@utils/responsive';

const DAYS_OPTIONS: BillDueDays[] = [1, 2, 3, 7];
const EVENT_DAYS_OPTIONS: EventReminderDays[] = [0, 1, 2, 3, 7];

type BoolPref = {
  [K in keyof NotificationPrefs]: NotificationPrefs[K] extends boolean ? K : never;
}[keyof NotificationPrefs];

interface Toggle {
  key: BoolPref;
  label: string;
  sub: string;
}

interface Group {
  title: string;
  toggles: Toggle[];
  /** Extra line under the group, e.g. how many days ahead. */
  extra?: React.ReactNode;
}

export default function NotificationSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const prefs = useNotificationStore((s) => s.prefs);
  const updatePrefs = useNotificationStore((s) => s.update);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const { webPushOn, webPushStatus, handleToggleWebPush } = useWebPushToggle();

  const save = useCallback(
    (changes: Parameters<typeof updatePrefs>[2]): void => {
      if (!user?.id || !houseId) return;
      updatePrefs(user.id, houseId, changes);
    },
    [user, houseId, updatePrefs]
  );

  const billDays = useMemo<ChoiceWord<string>[]>(
    () =>
      DAYS_OPTIONS.map((d) => ({
        value: String(d),
        label: `${t('common.day', { count: d })} ${t('settings.before_due')}`,
      })),
    [t]
  );
  const eventDays = useMemo<ChoiceWord<string>[]>(
    () =>
      EVENT_DAYS_OPTIONS.map((d) => ({
        value: String(d),
        label:
          d === 0
            ? t('settings.event_on_day')
            : `${t('common.day', { count: d })} ${t('settings.before_event')}`,
      })),
    [t]
  );

  const remindMe = (
    words: ChoiceWord<string>[],
    selected: number,
    onPick: (v: string) => void
  ): React.JSX.Element => (
    <View style={styles.extra}>
      <Text style={[styles.extraLabel, { color: c.textSecondary }]}>{t('settings.remind_me')}</Text>
      <ChoiceWords
        options={words}
        selected={String(selected)}
        onSelect={onPick}
        groupLabel={t('settings.remind_me')}
      />
    </View>
  );

  const groups: Group[] = [
    {
      title: t('nav.bills'),
      toggles: [
        {
          key: 'notifyBillAdded',
          label: t('settings.notify_bill_added'),
          sub: t('settings.notify_bill_added_sub'),
        },
        {
          key: 'notifyBillSettled',
          label: t('settings.notify_bill_settled'),
          sub: t('settings.notify_bill_settled_sub'),
        },
        {
          key: 'notifyBillDue',
          label: t('settings.notify_bill_due'),
          sub: t('settings.notify_bill_due_sub'),
        },
      ],
      extra: prefs.notifyBillDue
        ? remindMe(billDays, prefs.billDueDaysBefore, (v) =>
            save({ billDueDaysBefore: Number(v) as BillDueDays })
          )
        : null,
    },
    {
      title: t('nav.parking'),
      toggles: [
        {
          key: 'notifyParkingClaimed',
          label: t('settings.notify_parking_claimed'),
          sub: t('settings.notify_parking_claimed_sub'),
        },
        {
          key: 'notifyParkingReservation',
          label: t('settings.notify_parking_reservation'),
          sub: t('settings.notify_parking_reservation_sub'),
        },
      ],
    },
    {
      title: t('nav.machines'),
      toggles: [
        {
          key: 'notifyApplianceDone',
          label: t('settings.notify_appliance_done'),
          sub: t('settings.notify_appliance_done_sub'),
        },
      ],
    },
    {
      title: t('nav.grocery'),
      toggles: [
        {
          key: 'notifyGroceryStale',
          label: t('settings.notify_grocery_stale'),
          sub: t('settings.notify_grocery_stale_sub'),
        },
      ],
    },
    {
      title: t('nav.chores'),
      toggles: [
        {
          key: 'notifyChoreOverdue',
          label: t('settings.notify_chore'),
          sub: t('settings.notify_chore_sub'),
        },
      ],
    },
    {
      title: t('nav.calendar'),
      toggles: [
        {
          key: 'notifyEventAdded',
          label: t('settings.notify_event_added'),
          sub: t('settings.notify_event_added_sub'),
        },
        {
          key: 'notifyEventReminder',
          label: t('settings.notify_event_reminder'),
          sub: t('settings.notify_event_reminder_sub'),
        },
      ],
      extra: prefs.notifyEventReminder
        ? remindMe(eventDays, prefs.eventReminderDaysBefore, (v) =>
            save({ eventReminderDaysBefore: Number(v) as EventReminderDays })
          )
        : null,
    },
    {
      title: t('nav.tasks'),
      toggles: [
        {
          key: 'notifyTaskAssigned',
          label: t('settings.notify_task_assigned'),
          sub: t('settings.notify_task_assigned_sub'),
        },
      ],
    },
    {
      title: t('nav.chat'),
      toggles: [
        {
          key: 'notifyChatMessage',
          label: t('settings.notify_chat'),
          sub: t('settings.notify_chat_sub'),
        },
      ],
    },
    {
      title: t('settings.fun_section'),
      toggles: [
        {
          key: 'notifyDailyJoke',
          label: t('settings.notify_daily_joke'),
          sub: t('settings.notify_daily_joke_sub'),
        },
      ],
    },
  ];

  const card = [styles.card, { backgroundColor: c.surface }];
  const section = [styles.section, heading, { color: c.textPrimary }];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.backRow}>
        <BackLink label={t('nav.settings')} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, heading, { color: c.textPrimary }]} accessibilityRole="header">
          {t('settings.menu_notifications')}
        </Text>

        {webPushStatus !== 'unavailable' && (
          <View style={[card, styles.first]}>
            <SettingsLine
              label={t('settings.browser_notifications')}
              sub={
                webPushStatus === 'denied'
                  ? t('settings.notifications_blocked')
                  : webPushOn
                    ? t('settings.notifications_enabled')
                    : t('settings.notifications_tap_enable')
              }
              right={
                <InkTickBox
                  checked={webPushOn}
                  onChange={handleToggleWebPush}
                  disabled={webPushStatus === 'denied'}
                  accessibilityLabel={t('settings.browser_notifications')}
                  accessibilityHint={
                    webPushOn
                      ? t('settings.notifications_hint_disable')
                      : t('settings.notifications_hint_enable')
                  }
                />
              }
              last
            />
          </View>
        )}

        {groups.map((g) => (
          <View key={g.title}>
            <Text style={section} accessibilityRole="header">
              {g.title}
            </Text>
            <View style={card}>
              {g.toggles.map((tg, i) => (
                <SettingsLine
                  key={tg.key}
                  label={tg.label}
                  sub={tg.sub}
                  last={i === g.toggles.length - 1 && !g.extra}
                  right={
                    <InkTickBox
                      checked={prefs[tg.key]}
                      onChange={(v) => save({ [tg.key]: v })}
                      accessibilityLabel={tg.label}
                      accessibilityHint={tg.sub}
                    />
                  }
                />
              ))}
              {g.extra}
            </View>
          </View>
        ))}

        <Text style={[styles.footer, hand, { color: c.textSecondary }]}>
          {t('settings.notifications_footer')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backRow: { paddingHorizontal: ms(20), paddingTop: ms(8) },
  scroll: { paddingHorizontal: ms(20), paddingBottom: ms(80) },
  title: {
    fontSize: mf(36),
    lineHeight: mf(46),
    paddingBottom: ms(2),
    letterSpacing: -0.5,
    marginTop: ms(4),
  },
  first: { marginTop: ms(16) },
  section: { fontSize: mf(22), lineHeight: mf(29), marginTop: ms(26), marginBottom: ms(10) },
  card: { borderRadius: ms(22), paddingHorizontal: ms(18), paddingVertical: ms(2) },
  extra: { paddingVertical: ms(10), gap: ms(2) },
  extraLabel: { fontSize: mf(13), ...font.semibold },
  footer: { fontSize: mf(19), lineHeight: mf(23), textAlign: 'center', marginTop: ms(24) },
});
