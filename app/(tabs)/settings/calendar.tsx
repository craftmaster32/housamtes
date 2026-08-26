import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { goBack } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ToggleRowProps {
  icon: IconName;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
  disabled,
  isLast,
}: ToggleRowProps): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={C.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        accessible
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor={'#fff'}
        activeThumbColor={'#fff'}
        style={styles.switchLtr}
      />
    </View>
  );
}

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

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const handleBack = useCallback((): void => {
    goBack();
  }, []);
  const handleCalendarToggle = useCallback(async (): Promise<void> => {
    setCalLoading(true);
    try {
      if (calConnected) {
        await calDisconnect();
      } else {
        await calConnect();
      }
    } finally {
      setCalLoading(false);
    }
  }, [calConnected, calConnect, calDisconnect]);

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
            <Text style={styles.subheading}>{t('settings.calendar_section')}</Text>
          </View>

          <View style={styles.card}>
            <ToggleRow
              icon="calendar-outline"
              label={t('settings.calendar_connect')}
              description={
                calConnected ? t('settings.calendar_syncing') : t('settings.calendar_desc')
              }
              value={calConnected}
              onToggle={handleCalendarToggle}
              disabled={calLoading}
              isLast={!calConnected}
            />
            {calConnected && (
              <>
                <ToggleRow
                  icon="checkmark-done-outline"
                  label={t('settings.calendar_auto_events')}
                  description={t('settings.calendar_auto_events_desc')}
                  value={calAutoSync.events}
                  onToggle={(v) => calSetAutoSync('events', v)}
                />
                <ToggleRow
                  icon="car-outline"
                  label={t('settings.calendar_auto_parking')}
                  description={t('settings.calendar_auto_parking_desc')}
                  value={calAutoSync.parking}
                  onToggle={(v) => calSetAutoSync('parking', v)}
                  isLast
                />
              </>
            )}
          </View>

          <View style={styles.card}>
            <ToggleRow
              icon="cash-outline"
              label={t('settings.calendar_recurring')}
              description={t('settings.calendar_recurring_desc')}
              value={showRecurringBillsOnCalendar}
              onToggle={() => toggleShowRecurringBillsOnCalendar()}
              isLast
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, gap: sizes.md, paddingBottom: ms(60) },
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,
    header: { gap: ms(4), marginBottom: sizes.xs },
    backBtn: { alignSelf: 'flex-start', marginBottom: sizes.sm },
    backText: { color: C.primary, fontSize: mf(15), ...font.semibold },
    heading: { fontSize: mf(26), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    subheading: { fontSize: mf(14), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
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
    rowIcon: {
      width: ms(36),
      height: ms(36),
      borderRadius: sizes.borderRadiusSm,
      backgroundColor: C.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowText: { flex: 1 },
    rowLabel: { fontSize: mf(15), ...font.medium, color: C.textPrimary },
    rowDesc: { fontSize: mf(12), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
  });
}
