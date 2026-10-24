import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { BackLink } from '@components/shared/BackLink';
import { InkTickBox } from '@components/shared/InkTickBox';
import { SettingsLine } from '@components/settings/SettingsLine';
import { mf, ms } from '@utils/responsive';

export default function CalendarSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const calConnected = useCalendarSyncStore((s) => s.connected);
  const calAutoSync = useCalendarSyncStore((s) => s.autoSync);
  const calConnect = useCalendarSyncStore((s) => s.connect);
  const calDisconnect = useCalendarSyncStore((s) => s.disconnect);
  const calSetAutoSync = useCalendarSyncStore((s) => s.setAutoSync);
  const showRecurringBillsOnCalendar = useSettingsStore((s) => s.showRecurringBillsOnCalendar);
  const toggleShowRecurringBillsOnCalendar = useSettingsStore(
    (s) => s.toggleShowRecurringBillsOnCalendar
  );
  const [calLoading, setCalLoading] = useState(false);
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');

  const handleCalendarToggle = useCallback(async (): Promise<void> => {
    setCalLoading(true);
    try {
      if (calConnected) await calDisconnect();
      else await calConnect();
    } finally {
      setCalLoading(false);
    }
  }, [calConnected, calConnect, calDisconnect]);

  const card = [styles.card, { backgroundColor: c.surface }];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.backRow}>
        <BackLink label={t('nav.settings')} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, heading, { color: c.textPrimary }]} accessibilityRole="header">
          {t('settings.menu_calendar')}
        </Text>

        <View style={card}>
          <SettingsLine
            label={t('settings.calendar_connect')}
            sub={calConnected ? t('settings.calendar_syncing') : t('settings.calendar_desc')}
            last={!calConnected}
            right={
              <InkTickBox
                checked={calConnected}
                onChange={() => void handleCalendarToggle()}
                disabled={calLoading}
                accessibilityLabel={t('settings.calendar_connect')}
              />
            }
          />
          {calConnected && (
            <>
              <SettingsLine
                label={t('settings.calendar_auto_events')}
                sub={t('settings.calendar_auto_events_desc')}
                right={
                  <InkTickBox
                    checked={calAutoSync.events}
                    onChange={(v) => calSetAutoSync('events', v)}
                    accessibilityLabel={t('settings.calendar_auto_events')}
                  />
                }
              />
              <SettingsLine
                label={t('settings.calendar_auto_parking')}
                sub={t('settings.calendar_auto_parking_desc')}
                last
                right={
                  <InkTickBox
                    checked={calAutoSync.parking}
                    onChange={(v) => calSetAutoSync('parking', v)}
                    accessibilityLabel={t('settings.calendar_auto_parking')}
                  />
                }
              />
            </>
          )}
        </View>

        <View style={[card, styles.gap]}>
          <SettingsLine
            label={t('settings.calendar_recurring')}
            sub={t('settings.calendar_recurring_desc')}
            last
            right={
              <InkTickBox
                checked={showRecurringBillsOnCalendar}
                onChange={() => toggleShowRecurringBillsOnCalendar()}
                accessibilityLabel={t('settings.calendar_recurring')}
              />
            }
          />
        </View>
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
    marginBottom: ms(16),
  },
  card: { borderRadius: ms(22), paddingHorizontal: ms(18), paddingVertical: ms(2) },
  gap: { marginTop: ms(18) },
});
