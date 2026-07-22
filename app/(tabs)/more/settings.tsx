import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  Platform,
  Animated,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore, calculateBalances } from '@stores/billsStore';
import { useVotingStore } from '@stores/votingStore';
import { useSettingsStore, CURRENCIES } from '@stores/settingsStore';
import { useNotificationStore, BillDueDays } from '@stores/notificationStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useLanguageStore } from '@stores/languageStore';
import { enableWebPush, getWebPushStatus, refreshWebPush, type WebPushStatus } from '@lib/webPush';
import type { AppLanguage } from '@lib/i18n';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuItem({
  icon,
  label,
  sub,
  onPress,
  rightText,
  disabled,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress: () => void;
  rightText?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const currentLanguage = useLanguageStore((s) => s.language);
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && !disabled && styles.menuItemPressed]}
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, disabled && styles.menuIconDisabled]}>
        <Ionicons name={icon} size={18} color={disabled ? C.textTertiary : C.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, disabled && styles.menuLabelDisabled]}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      {rightText ? (
        <Text style={styles.menuRightText}>{rightText}</Text>
      ) : (
        <Ionicons
          name={isRTL(currentLanguage) ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={disabled ? C.textTertiary : C.textTertiary}
        />
      )}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onToggle,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={C.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        accessible
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={sub}
        accessibilityState={{ checked: value }}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor={'#fff'}
        activeThumbColor={'#fff'}
        style={styles.switchLtr}
      />
    </View>
  );
}

function RowDivider(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return <View style={styles.rowDivider} />;
}

function SectionDivider({ label }: { label: string }): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

const DAYS_OPTIONS: BillDueDays[] = [1, 2, 3, 7];

const TIMEZONES: { id: string; label: string; region: string }[] = [
  { id: 'Pacific/Auckland', label: 'Auckland', region: 'UTC+12/13' },
  { id: 'Australia/Sydney', label: 'Sydney', region: 'UTC+10/11' },
  { id: 'Asia/Tokyo', label: 'Tokyo', region: 'UTC+9' },
  { id: 'Australia/Perth', label: 'Perth', region: 'UTC+8' },
  { id: 'Asia/Singapore', label: 'Singapore', region: 'UTC+8' },
  { id: 'Asia/Bangkok', label: 'Bangkok', region: 'UTC+7' },
  { id: 'Asia/Kolkata', label: 'Mumbai / Kolkata', region: 'UTC+5:30' },
  { id: 'Asia/Dubai', label: 'Dubai', region: 'UTC+4' },
  { id: 'Europe/Moscow', label: 'Moscow', region: 'UTC+3' },
  { id: 'Asia/Jerusalem', label: 'Jerusalem', region: 'UTC+2/3' },
  { id: 'Africa/Cairo', label: 'Cairo', region: 'UTC+2/3' },
  { id: 'Europe/Paris', label: 'Paris / Berlin', region: 'UTC+1/2' },
  { id: 'Europe/London', label: 'London', region: 'UTC+0/1' },
  { id: 'America/Sao_Paulo', label: 'São Paulo', region: 'UTC−3' },
  { id: 'America/New_York', label: 'New York', region: 'UTC−5' },
  { id: 'America/Chicago', label: 'Chicago', region: 'UTC−6' },
  { id: 'America/Denver', label: 'Denver', region: 'UTC−7' },
  { id: 'America/Los_Angeles', label: 'Los Angeles', region: 'UTC−8' },
  { id: 'Pacific/Honolulu', label: 'Honolulu', region: 'UTC−10' },
];

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const housemates = useHousematesStore((s) => s.housemates);
  const houseTimezone = useHousematesStore((s) => s.timezone);
  const updateTimezone = useHousematesStore((s) => s.updateTimezone);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myRole = useAuthStore((s) => s.role);
  const leaveHouse = useAuthStore((s) => s.leaveHouse);
  const bills = useBillsStore((s) => s.bills);
  const addProposal = useVotingStore((s) => s.addProposal);

  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);

  const calConnected = useCalendarSyncStore((s) => s.connected);
  const calAutoSync = useCalendarSyncStore((s) => s.autoSync);
  const calConnect = useCalendarSyncStore((s) => s.connect);
  const calDisconnect = useCalendarSyncStore((s) => s.disconnect);
  const calSetAutoSync = useCalendarSyncStore((s) => s.setAutoSync);

  const { from } = useLocalSearchParams<{ from?: string }>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [debtAmount, setDebtAmount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [requestingVote, setRequestingVote] = useState(false);
  const [calLoading, setCalLoading] = useState(false);

  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>('unavailable');
  useEffect(() => {
    if (Platform.OS === 'web') setWebPushStatus(getWebPushStatus());
  }, []);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleEnableWebPush = useCallback(async (): Promise<void> => {
    if (!user?.id || !houseId) return;
    try {
      const result = await enableWebPush(user.id, houseId);
      if (result === 'unavailable') {
        Alert.alert(t('common.error'), t('settings.notifications_enable_failed'));
      } else {
        setWebPushStatus(result);
        if (result === 'denied') {
          Alert.alert(
            t('settings.notifications_blocked_title'),
            t('settings.notifications_blocked_body')
          );
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('settings.notifications_enable_failed'));
    }
  }, [user?.id, houseId, t]);

  // Force a fresh subscribe when the "On" state is stuck (Safari invalidates
  // subscriptions from time to time and the OS won't retrigger the subscribe
  // path on its own). This runs regardless of the current webPushStatus.
  const handleRefreshOrEnableWebPush = useCallback(async (): Promise<void> => {
    if (!user?.id || !houseId) return;
    if (webPushStatus === 'granted') {
      const result = await refreshWebPush(user.id, houseId);
      setWebPushStatus(getWebPushStatus());
      if (result.ok) {
        Alert.alert(t('common.done'), 'Fresh subscription saved. Notifications should work now.');
      } else {
        const detail = result.message ? `\n\n${result.message}` : '';
        Alert.alert('Refresh failed', `${result.reason}${detail}`);
      }
      return;
    }
    await handleEnableWebPush();
  }, [user?.id, houseId, webPushStatus, handleEnableWebPush, t]);

  const handleLeavePress = useCallback((): void => {
    const myId = profile?.id ?? '';
    const balances = calculateBalances(
      bills.filter((b) => !b.settled),
      myId
    );
    const owed = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
    if (owed > 0.01) {
      setDebtAmount(owed);
      setShowDebtModal(true);
    } else {
      setShowLeaveConfirm(true);
    }
  }, [profile, bills]);

  const handleLeaveHouse = useCallback(async (): Promise<void> => {
    setLeaving(true);
    try {
      await leaveHouse();
      setShowLeaveConfirm(false);
      router.replace('/(onboarding)/house-setup');
    } catch {
      Alert.alert(t('common.error'), t('settings.could_not_leave'));
    } finally {
      setLeaving(false);
    }
  }, [leaveHouse, t]);

  const handleRequestLeaveVote = useCallback(async (): Promise<void> => {
    if (!profile || !houseId) return;
    setRequestingVote(true);
    try {
      await addProposal(
        t('settings.approve_leave_title', { name: profile.name }),
        t('settings.approve_leave_body', {
          name: profile.name,
          amount: `${currency}${debtAmount.toFixed(2)}`,
        }),
        profile.id,
        houseId
      );
      setShowDebtModal(false);
      router.push('/(tabs)/voting');
    } catch {
      Alert.alert(t('common.error'), t('settings.could_not_create_vote'));
    } finally {
      setRequestingVote(false);
    }
  }, [profile, houseId, debtAmount, currency, addProposal, t]);

  const prefs = useNotificationStore((s) => s.prefs);
  const updatePrefs = useNotificationStore((s) => s.update);

  const showRecurringBillsOnCalendar = useSettingsStore((s) => s.showRecurringBillsOnCalendar);
  const toggleShowRecurringBillsOnCalendar = useSettingsStore(
    (s) => s.toggleShowRecurringBillsOnCalendar
  );

  const currentLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

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

  const toggle = useCallback(
    (key: keyof typeof prefs, value: boolean) => {
      if (!user?.id || !houseId) return;
      updatePrefs(user.id, houseId, { [key]: value });
    },
    [user?.id, houseId, updatePrefs]
  );

  const setDaysBefore = useCallback(
    (days: BillDueDays) => {
      if (!user?.id || !houseId) return;
      updatePrefs(user.id, houseId, { billDueDaysBefore: days });
    },
    [user?.id, houseId, updatePrefs]
  );

  const handleTimezoneSelect = useCallback(
    async (tz: string): Promise<void> => {
      if (!houseId) return;
      setSavingTimezone(true);
      try {
        await updateTimezone(houseId, tz);
        setShowTimezoneModal(false);
      } catch {
        Alert.alert(t('common.error'), t('settings.could_not_update_timezone'));
      } finally {
        setSavingTimezone(false);
      }
    },
    [houseId, updateTimezone, t]
  );

  const timezoneLabel = TIMEZONES.find((t) => t.id === houseTimezone)?.label ?? houseTimezone;

  const handleCopyInviteCode = useCallback(() => {
    Alert.alert(t('settings.invite_code'), `${t('profile.share_code')}\n\n${inviteCode}`, [
      { text: t('common.ok') },
    ]);
  }, [inviteCode, t]);

  const LANGUAGE_OPTIONS: { code: AppLanguage; label: string; flag: string }[] = [
    { code: 'en', label: t('settings.language_en'), flag: '🇬🇧' },
    { code: 'he', label: t('settings.language_he'), flag: '🇮🇱' },
    { code: 'es', label: t('settings.language_es'), flag: '🇪🇸' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (from === 'profile' ? router.push('/(tabs)/profile') : router.back())}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backBtnText}>
            {isRTL(currentLanguage) ? t('settings.back_rtl') : t('settings.back')}
          </Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.heading, headingFont]}>{t('settings.title')}</Text>

          {/* Currency */}
          <SectionDivider label={t('settings.currency_section')} />
          <View style={[styles.menuGroup, styles.currencyGroup]}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c.symbol}
                style={[styles.currencyChip, currency === c.symbol && styles.currencyChipActive]}
                onPress={() => setCurrency(c.symbol)}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === c.symbol }}
              >
                <Text
                  style={[
                    styles.currencySymbol,
                    currency === c.symbol && styles.currencySymbolActive,
                  ]}
                >
                  {c.symbol}
                </Text>
                <Text
                  style={[
                    styles.currencyLabel,
                    currency === c.symbol && styles.currencyLabelActive,
                  ]}
                >
                  {c.label.split('(')[0].trim()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* House */}
          <SectionDivider label={t('settings.house_section')} />
          <View style={styles.menuGroup}>
            <MenuItem
              icon="home-outline"
              label={t('settings.house_name')}
              rightText={houseName || '—'}
              onPress={() => {}}
              disabled
            />
            {!!inviteCode && (
              <>
                <RowDivider />
                <MenuItem
                  icon="ticket-outline"
                  label={t('settings.invite_code')}
                  sub={t('settings.invite_code_sub')}
                  onPress={handleCopyInviteCode}
                />
              </>
            )}
            <RowDivider />
            <MenuItem
              icon="globe-outline"
              label={t('settings.timezone')}
              sub={
                myRole === 'owner' ? t('settings.timezone_tap') : t('settings.timezone_owner_only')
              }
              rightText={timezoneLabel}
              onPress={() => {
                if (myRole === 'owner') setShowTimezoneModal(true);
              }}
              disabled={myRole !== 'owner'}
            />
            <RowDivider />
            <MenuItem
              icon="people-outline"
              label={t('settings.housemates')}
              sub={t('common.person', { count: housemates.length })}
              onPress={() => router.push('/(tabs)/bills/setup')}
            />
            <RowDivider />
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleLeavePress}
              accessible
              accessibilityRole="button"
            >
              <View style={[styles.menuIcon, { backgroundColor: C.negative + '15' }]}>
                <Ionicons name="exit-outline" size={18} color={C.negative} />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, { color: C.negative }]}>
                  {t('settings.leave_house')}
                </Text>
                <Text style={styles.menuSub}>
                  {houseName
                    ? t('settings.leave_house_desc', { name: houseName })
                    : t('settings.leave_house_desc_default')}
                </Text>
              </View>
              <Ionicons
                name={isRTL(currentLanguage) ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={C.negative}
              />
            </Pressable>
          </View>

          {/* Leave house confirmation modal */}
          <Modal
            visible={showLeaveConfirm}
            transparent
            animationType="fade"
            onRequestClose={() => setShowLeaveConfirm(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowLeaveConfirm(false)}>
              <Pressable style={styles.modalBox} onPress={() => {}}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="exit-outline" size={28} color={C.negative} />
                </View>
                <Text style={styles.modalTitle}>{t('settings.leave_house_title')}</Text>
                <Text style={styles.modalBody}>
                  {t(houseName ? 'settings.leave_house_body_named' : 'settings.leave_house_body', {
                    name: houseName,
                  })}
                </Text>
                <Pressable
                  style={[styles.modalBtnDanger, leaving && { opacity: 0.6 }]}
                  onPress={handleLeaveHouse}
                  disabled={leaving}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnDangerText}>
                    {leaving ? t('settings.leaving') : t('settings.yes_leave')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.modalBtnCancel}
                  onPress={() => setShowLeaveConfirm(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Debt block modal */}
          <Modal
            visible={showDebtModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDebtModal(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowDebtModal(false)}>
              <Pressable style={styles.modalBox} onPress={() => {}}>
                <View style={[styles.modalIconWrap, { backgroundColor: '#FFF3CD' }]}>
                  <Ionicons name="warning-outline" size={28} color="#856404" />
                </View>
                <Text style={styles.modalTitle}>{t('settings.settle_first_title')}</Text>
                <Text style={styles.modalBody}>
                  {t('settings.settle_first_body', {
                    amount: `${currency}${debtAmount.toFixed(2)}`,
                  })}
                </Text>
                <Pressable
                  style={styles.modalBtnPrimary}
                  onPress={() => {
                    setShowDebtModal(false);
                    router.push('/(tabs)/bills');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnPrimaryText}>{t('settings.settle_up')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnSecondary, requestingVote && { opacity: 0.6 }]}
                  onPress={handleRequestLeaveVote}
                  disabled={requestingVote}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnSecondaryText}>
                    {requestingVote
                      ? t('settings.creating_vote')
                      : t('settings.request_vote_leave')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.modalBtnCancel}
                  onPress={() => setShowDebtModal(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Timezone picker */}
          <Modal
            visible={showTimezoneModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTimezoneModal(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowTimezoneModal(false)}>
              <Pressable style={styles.tzModalBox} onPress={() => {}}>
                <Text style={styles.modalTitle}>{t('settings.timezone_title')}</Text>
                <Text style={[styles.modalBody, { marginBottom: 8 }]}>
                  {t('settings.timezone_desc')}
                </Text>
                <ScrollView style={styles.tzModalList} showsVerticalScrollIndicator={false}>
                  {TIMEZONES.map((tz, idx) => (
                    <View key={tz.id}>
                      {idx > 0 && <View style={styles.rowDivider} />}
                      <Pressable
                        style={({ pressed }) => [
                          styles.tzOption,
                          pressed && styles.menuItemPressed,
                        ]}
                        onPress={() => {
                          if (!savingTimezone) handleTimezoneSelect(tz.id);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: houseTimezone === tz.id }}
                      >
                        <View style={styles.menuText}>
                          <Text style={styles.menuLabel}>{tz.label}</Text>
                          <Text style={styles.menuSub}>{tz.region}</Text>
                        </View>
                        {houseTimezone === tz.id && (
                          <Ionicons name="checkmark" size={20} color={C.primary} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Pressable
                  style={styles.modalBtnCancel}
                  onPress={() => setShowTimezoneModal(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Calendar */}
          <SectionDivider label={t('settings.calendar_section')} />
          <View style={styles.menuGroup}>
            <View style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <Ionicons name="calendar-outline" size={18} color={C.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{t('settings.calendar_connect')}</Text>
                <Text style={styles.menuSub}>
                  {calConnected ? t('settings.calendar_syncing') : t('settings.calendar_desc')}
                </Text>
              </View>
              <Switch
                value={calConnected}
                onValueChange={handleCalendarToggle}
                disabled={calLoading}
                accessible
                accessibilityRole="switch"
                accessibilityLabel={t('settings.calendar_connect')}
                accessibilityHint={
                  calConnected ? t('settings.calendar_syncing') : t('settings.calendar_desc')
                }
                accessibilityState={{ checked: calConnected, disabled: calLoading }}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={'#fff'}
                activeThumbColor={'#fff'}
                style={styles.switchLtr}
              />
            </View>
            {calConnected && (
              <>
                <RowDivider />
                <View style={styles.menuItem}>
                  <View style={styles.menuIcon}>
                    <Ionicons name="checkmark-done-outline" size={18} color={C.primary} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{t('settings.calendar_auto_events')}</Text>
                    <Text style={styles.menuSub}>{t('settings.calendar_auto_events_desc')}</Text>
                  </View>
                  <Switch
                    value={calAutoSync.events}
                    onValueChange={(v) => calSetAutoSync('events', v)}
                    accessible
                    accessibilityRole="switch"
                    accessibilityLabel={t('settings.calendar_auto_events')}
                    accessibilityHint={t('settings.calendar_auto_events_desc')}
                    accessibilityState={{ checked: calAutoSync.events }}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor={'#fff'}
                    activeThumbColor={'#fff'}
                    style={styles.switchLtr}
                  />
                </View>
                <RowDivider />
                <View style={styles.menuItem}>
                  <View style={styles.menuIcon}>
                    <Ionicons name="car-outline" size={18} color={C.primary} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{t('settings.calendar_auto_parking')}</Text>
                    <Text style={styles.menuSub}>{t('settings.calendar_auto_parking_desc')}</Text>
                  </View>
                  <Switch
                    value={calAutoSync.parking}
                    onValueChange={(v) => calSetAutoSync('parking', v)}
                    accessible
                    accessibilityRole="switch"
                    accessibilityLabel={t('settings.calendar_auto_parking')}
                    accessibilityHint={t('settings.calendar_auto_parking_desc')}
                    accessibilityState={{ checked: calAutoSync.parking }}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor={'#fff'}
                    activeThumbColor={'#fff'}
                    style={styles.switchLtr}
                  />
                </View>
              </>
            )}
            <RowDivider />
            <ToggleRow
              icon="cash-outline"
              label={t('settings.calendar_recurring')}
              sub={t('settings.calendar_recurring_desc')}
              value={showRecurringBillsOnCalendar}
              onToggle={() => toggleShowRecurringBillsOnCalendar()}
            />
          </View>

          {/* Notifications */}
          <SectionDivider label={t('settings.notifications_section')} />
          <View style={styles.menuGroup}>
            {webPushStatus !== 'unavailable' && (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.menuItem,
                    webPushStatus !== 'denied' && pressed && styles.menuItemPressed,
                  ]}
                  onPress={webPushStatus === 'denied' ? undefined : handleRefreshOrEnableWebPush}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.browser_notifications')}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name="notifications-outline" size={18} color={C.primary} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{t('settings.browser_notifications')}</Text>
                    <Text style={styles.menuSub}>
                      {webPushStatus === 'granted'
                        ? t('settings.notifications_enabled')
                        : webPushStatus === 'denied'
                          ? t('settings.notifications_blocked')
                          : t('settings.notifications_tap_enable')}
                    </Text>
                  </View>
                  {webPushStatus === 'granted' && (
                    <Text style={styles.webPushOn}>{t('settings.notifications_on')}</Text>
                  )}
                  {webPushStatus !== 'denied' && (
                    <Ionicons
                      name={isRTL(currentLanguage) ? 'chevron-back' : 'chevron-forward'}
                      size={18}
                      color={C.textTertiary}
                    />
                  )}
                </Pressable>
                <RowDivider />
              </>
            )}
            <ToggleRow
              icon="cash-outline"
              label={t('settings.notify_bill_added')}
              sub={t('settings.notify_bill_added_sub')}
              value={prefs.notifyBillAdded}
              onToggle={(v) => toggle('notifyBillAdded', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="checkmark-circle-outline"
              label={t('settings.notify_bill_settled')}
              sub={t('settings.notify_bill_settled_sub')}
              value={prefs.notifyBillSettled}
              onToggle={(v) => toggle('notifyBillSettled', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="time-outline"
              label={t('settings.notify_bill_due')}
              sub={t('settings.notify_bill_due_sub')}
              value={prefs.notifyBillDue}
              onToggle={(v) => toggle('notifyBillDue', v)}
            />
            {prefs.notifyBillDue && (
              <View style={styles.daysPickerRow}>
                <Text style={styles.daysPickerLabel}>{t('settings.remind_me')}</Text>
                <View style={styles.daysChips}>
                  {DAYS_OPTIONS.map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        styles.dayChip,
                        prefs.billDueDaysBefore === d && styles.dayChipActive,
                      ]}
                      onPress={() => setDaysBefore(d)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t('common.day', { count: d })}
                      accessibilityState={{ selected: prefs.billDueDaysBefore === d }}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          prefs.billDueDaysBefore === d && styles.dayChipTextActive,
                        ]}
                      >
                        {d}d
                      </Text>
                    </Pressable>
                  ))}
                  <Text style={styles.daysPickerSuffix}>{t('settings.before_due')}</Text>
                </View>
              </View>
            )}
            <RowDivider />
            <ToggleRow
              icon="car-outline"
              label={t('settings.notify_parking_claimed')}
              sub={t('settings.notify_parking_claimed_sub')}
              value={prefs.notifyParkingClaimed}
              onToggle={(v) => toggle('notifyParkingClaimed', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="calendar-outline"
              label={t('settings.notify_parking_reservation')}
              sub={t('settings.notify_parking_reservation_sub')}
              value={prefs.notifyParkingReservation}
              onToggle={(v) => toggle('notifyParkingReservation', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="sparkles-outline"
              label={t('settings.notify_chore')}
              sub={t('settings.notify_chore_sub')}
              value={prefs.notifyChoreOverdue}
              onToggle={(v) => toggle('notifyChoreOverdue', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="chatbubble-ellipses-outline"
              label={t('settings.notify_chat')}
              sub={t('settings.notify_chat_sub')}
              value={prefs.notifyChatMessage}
              onToggle={(v) => toggle('notifyChatMessage', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="cart-outline"
              label={t('settings.notify_grocery_shared')}
              sub={t('settings.notify_grocery_shared_sub')}
              value={prefs.notifyGroceryShared}
              onToggle={(v) => toggle('notifyGroceryShared', v)}
            />
          </View>

          {/* Language */}
          <SectionDivider label={t('settings.language_section')} />
          <View style={styles.menuGroup}>
            {LANGUAGE_OPTIONS.map((opt, idx) => (
              <View key={opt.code}>
                {idx > 0 && <RowDivider />}
                <Pressable
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={() => setLanguage(opt.code)}
                  accessible
                  accessibilityRole="radio"
                  accessibilityState={{ checked: currentLanguage === opt.code }}
                >
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>{opt.flag}</Text>
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{opt.label}</Text>
                  </View>
                  {currentLanguage === opt.code && (
                    <Ionicons name="checkmark" size={20} color={C.primary} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>

          {/* About */}
          <SectionDivider label={t('settings.about_section')} />
          <View style={styles.menuGroup}>
            <MenuItem
              icon="list-outline"
              label={t('settings.version')}
              sub="HouseMates"
              onPress={() => {}}
              disabled
              rightText="1.0.0"
            />
            <RowDivider />
            <MenuItem
              icon="document-text-outline"
              label={t('settings.terms')}
              sub={t('settings.terms_sub')}
              onPress={() => router.push('/(tabs)/settings/terms')}
            />
            <RowDivider />
            <MenuItem
              icon="lock-closed-outline"
              label={t('settings.privacy')}
              sub={t('settings.privacy_sub')}
              onPress={() => router.push('/(tabs)/settings/privacy-policy')}
            />
          </View>

          <Text style={styles.footer}>{t('settings.footer')}</Text>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,
    backBtn: {
      paddingHorizontal: sizes.lg,
      paddingVertical: sizes.sm,
      alignSelf: 'flex-start',
    },
    backBtnText: { fontSize: 16, ...font.semibold, color: C.primary },
    scroll: { paddingHorizontal: sizes.lg, paddingBottom: 60 },
    heading: {
      fontSize: 28,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
      marginBottom: sizes.lg,
      marginTop: sizes.xs,
    },
    sectionLabel: {
      color: C.textSecondary,
      fontSize: 11,
      ...font.bold,
      letterSpacing: 1.2,
      marginBottom: sizes.sm,
      marginTop: sizes.xs,
      marginStart: 4,
    },
    menuGroup: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      marginBottom: sizes.lg,
      overflow: 'hidden',
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
    menuItemPressed: { backgroundColor: C.background },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: sizes.borderRadiusSm,
      backgroundColor: C.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuIconDisabled: { opacity: 0.4 },
    menuIconText: { fontSize: 18 },
    menuText: { flex: 1 },
    menuLabel: { color: C.textPrimary, ...font.semibold, fontSize: 15 },
    menuLabelDisabled: { color: C.textSecondary },
    menuSub: { color: C.textSecondary, fontSize: 13, ...font.regular, marginTop: 1 },
    menuChevron: { color: C.textDisabled, fontSize: 22 },
    menuChevronDisabled: { opacity: 0 },
    menuRightText: { color: C.textSecondary, ...font.regular, fontSize: 14 },
    rowDivider: { height: 1, backgroundColor: C.border, marginStart: sizes.md + 36 + sizes.sm },
    footer: {
      color: C.textDisabled,
      fontSize: 13,
      ...font.regular,
      textAlign: 'center',
      marginTop: sizes.md,
    },
    daysPickerRow: {
      paddingHorizontal: sizes.md,
      paddingBottom: sizes.md,
      gap: sizes.xs,
    },
    daysPickerLabel: {
      fontSize: 13,
      ...font.semibold,
      color: C.textSecondary,
      marginBottom: 4,
    },
    daysChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.xs,
      flexWrap: 'wrap',
    },
    dayChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: C.background,
      borderWidth: 1,
      borderColor: C.border,
    },
    dayChipActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    dayChipText: {
      fontSize: 13,
      ...font.semibold,
      color: C.textSecondary,
    },
    dayChipTextActive: {
      color: '#fff',
    },
    webPushOn: { color: C.positive, ...font.semibold, fontSize: 13 },
    daysPickerSuffix: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      marginStart: 4,
    },
    currencyGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: sizes.md,
    },
    currencyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.background,
    },
    currencyChipActive: {
      borderColor: C.primary,
      backgroundColor: C.primary + '12',
    },
    currencySymbol: { fontSize: 16, ...font.bold, color: C.textSecondary },
    currencySymbolActive: { color: C.primary },
    currencyLabel: { fontSize: 12, ...font.regular, color: C.textSecondary },
    currencyLabelActive: { color: C.primary },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalBox: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 360,
      gap: 12,
      alignItems: 'center',
    },
    tzModalBox: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 20,
      paddingBottom: 16,
      width: '100%',
      maxWidth: 360,
      maxHeight: '80%',
      alignItems: 'stretch',
      gap: 12,
    },
    tzModalList: { flexGrow: 0 },
    tzOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    modalIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.negative + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    modalTitle: { fontSize: 18, ...font.extrabold, color: C.textPrimary, textAlign: 'center' },
    modalBody: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalBtnDanger: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.negative,
      alignItems: 'center',
      marginTop: 4,
    },
    modalBtnDangerText: { fontSize: 15, ...font.semibold, color: '#fff' },
    modalBtnPrimary: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.primary,
      alignItems: 'center',
      marginTop: 4,
    },
    modalBtnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
    modalBtnSecondary: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.primary,
      alignItems: 'center',
    },
    modalBtnSecondaryText: { fontSize: 15, ...font.semibold, color: C.primary },
    modalBtnCancel: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
    },
    modalBtnCancelText: { fontSize: 15, ...font.semibold, color: C.textPrimary },
  });
}
