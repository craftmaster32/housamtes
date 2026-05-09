import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch, Modal, Platform, Animated } from 'react-native';
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
import { enableWebPush, getWebPushStatus, type WebPushStatus } from '@lib/webPush';
import type { AppLanguage } from '@lib/i18n';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function MenuItem({
  icon,
  label,
  sub,
  onPress,
  rightText,
  disabled,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  rightText?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && !disabled && styles.menuItemPressed]}
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, disabled && styles.menuIconDisabled]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, disabled && styles.menuLabelDisabled]}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      {rightText ? (
        <Text style={styles.menuRightText}>{rightText}</Text>
      ) : (
        <Text style={[styles.menuChevron, disabled && styles.menuChevronDisabled]}>›</Text>
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
  icon: string;
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
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor={'#fff'}
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

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const housemates = useHousematesStore((s) => s.housemates);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const leaveHouse = useAuthStore((s) => s.leaveHouse);
  const bills = useBillsStore((s) => s.bills);
  const addProposal = useVotingStore((s) => s.addProposal);

  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);

  const calConnected   = useCalendarSyncStore((s) => s.connected);
  const calAutoSync    = useCalendarSyncStore((s) => s.autoSync);
  const calConnect     = useCalendarSyncStore((s) => s.connect);
  const calDisconnect  = useCalendarSyncStore((s) => s.disconnect);
  const calSetAutoSync = useCalendarSyncStore((s) => s.setAutoSync);

  const { from } = useLocalSearchParams<{ from?: string }>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleEnableWebPush = useCallback(async (): Promise<void> => {
    if (!user?.id || !houseId) return;
    const result = await enableWebPush(user.id, houseId);
    setWebPushStatus(result);
    if (result === 'denied') {
      Alert.alert('Notifications blocked', 'To enable, go to your browser settings and allow notifications for this site.');
    }
  }, [user?.id, houseId]);

  const handleLeavePress = useCallback((): void => {
    const myId = profile?.id ?? '';
    const balances = calculateBalances(bills.filter((b) => !b.settled), myId);
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
      Alert.alert('Error', 'Could not leave the house. Please try again.');
    } finally {
      setLeaving(false);
    }
  }, [leaveHouse]);

  const handleRequestLeaveVote = useCallback(async (): Promise<void> => {
    if (!profile || !houseId) return;
    setRequestingVote(true);
    try {
      await addProposal(
        `Approve ${profile.name}'s request to leave`,
        `${profile.name} wants to leave the house but has an unsettled balance of ${debtAmount.toFixed(2)}. Vote to approve their departure despite the outstanding balance.`,
        profile.id,
        houseId
      );
      setShowDebtModal(false);
      router.push('/(tabs)/voting');
    } catch {
      Alert.alert('Error', 'Could not create the vote. Please try again.');
    } finally {
      setRequestingVote(false);
    }
  }, [profile, houseId, debtAmount, addProposal]);

  const prefs = useNotificationStore((s) => s.prefs);
  const updatePrefs = useNotificationStore((s) => s.update);

  const showRecurringBillsOnCalendar = useSettingsStore((s) => s.showRecurringBillsOnCalendar);
  const toggleShowRecurringBillsOnCalendar = useSettingsStore((s) => s.toggleShowRecurringBillsOnCalendar);

  const currentLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const handleCalendarToggle = useCallback(async (): Promise<void> => {
    setCalLoading(true);
    try {
      if (calConnected) { await calDisconnect(); } else { await calConnect(); }
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

  const handleCopyInviteCode = useCallback(() => {
    Alert.alert(
      t('settings.invite_code'),
      `${t('profile.share_code')}\n\n${inviteCode}`,
      [{ text: t('common.ok') }]
    );
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
          onPress={() => from === 'profile' ? router.push('/(tabs)/profile') : router.back()}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backBtnText}>{t('settings.back')}</Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>{t('settings.title')}</Text>

          {/* Currency */}
          <SectionDivider label="CURRENCY" />
          <View style={[styles.menuGroup, styles.currencyGroup]}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c.symbol}
                style={[styles.currencyChip, currency === c.symbol && styles.currencyChipActive]}
                onPress={() => setCurrency(c.symbol)}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === c.symbol }}
              >
                <Text style={[styles.currencySymbol, currency === c.symbol && styles.currencySymbolActive]}>
                  {c.symbol}
                </Text>
                <Text style={[styles.currencyLabel, currency === c.symbol && styles.currencyLabelActive]}>
                  {c.label.split('(')[0].trim()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* House */}
          <SectionDivider label={t('settings.house_section')} />
          <View style={styles.menuGroup}>
            <MenuItem
              icon="🏠"
              label={t('settings.house_name')}
              rightText={houseName || '—'}
              onPress={() => {}}
              disabled
            />
            {!!inviteCode && (
              <>
                <RowDivider />
                <MenuItem
                  icon="🎟️"
                  label={t('settings.invite_code')}
                  sub={t('settings.invite_code_sub')}
                  onPress={handleCopyInviteCode}
                />
              </>
            )}
            <RowDivider />
            <MenuItem
              icon="👥"
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
                <Text style={[styles.menuLabel, { color: C.negative }]}>Leave House</Text>
                <Text style={styles.menuSub}>
                  {houseName ? `Leave "${houseName}" and join or create a new house` : 'Leave this house and start fresh'}
                </Text>
              </View>
              <Text style={[styles.menuChevron, { color: C.negative }]}>›</Text>
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
                <Text style={styles.modalTitle}>Leave House?</Text>
                <Text style={styles.modalBody}>
                  You will be removed from{houseName ? ` "${houseName}"` : ' the current house'}. Your data will stay but you{`'`}ll need to join or create a new house.
                </Text>
                <Pressable
                  style={[styles.modalBtnDanger, leaving && { opacity: 0.6 }]}
                  onPress={handleLeaveHouse}
                  disabled={leaving}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnDangerText}>{leaving ? 'Leaving…' : 'Yes, Leave House'}</Text>
                </Pressable>
                <Pressable
                  style={styles.modalBtnCancel}
                  onPress={() => setShowLeaveConfirm(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
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
                <Text style={styles.modalTitle}>Settle Up First</Text>
                <Text style={styles.modalBody}>
                  You owe your housemates {debtAmount.toFixed(2)}. Please settle your balance before leaving, or ask the house to vote on approving your departure.
                </Text>
                <Pressable
                  style={styles.modalBtnPrimary}
                  onPress={() => { setShowDebtModal(false); router.push('/(tabs)/bills'); }}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnPrimaryText}>Settle Up</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnSecondary, requestingVote && { opacity: 0.6 }]}
                  onPress={handleRequestLeaveVote}
                  disabled={requestingVote}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnSecondaryText}>{requestingVote ? 'Creating vote…' : 'Request a Vote to Leave'}</Text>
                </Pressable>
                <Pressable
                  style={styles.modalBtnCancel}
                  onPress={() => setShowDebtModal(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Calendar */}
          <SectionDivider label="CALENDAR" />
          <View style={styles.menuGroup}>
            <View style={styles.menuItem}>
              <View style={styles.menuIcon}><Text style={styles.menuIconText}>📅</Text></View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>Connect my calendar</Text>
                <Text style={styles.menuSub}>
                  {calConnected ? 'Syncing with your device calendar' : 'See personal events in-app and auto-add house events'}
                </Text>
              </View>
              <Switch
                value={calConnected}
                onValueChange={handleCalendarToggle}
                disabled={calLoading}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={'#fff'}
              />
            </View>
            {calConnected && (
              <>
                <RowDivider />
                <View style={styles.menuItem}>
                  <View style={styles.menuIcon}><Text style={styles.menuIconText}>📋</Text></View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>Auto-add house events</Text>
                    <Text style={styles.menuSub}>New house events go straight to your calendar</Text>
                  </View>
                  <Switch
                    value={calAutoSync.events}
                    onValueChange={(v) => calSetAutoSync('events', v)}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor={'#fff'}
                  />
                </View>
                <RowDivider />
                <View style={styles.menuItem}>
                  <View style={styles.menuIcon}><Text style={styles.menuIconText}>🚗</Text></View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>Auto-add parking</Text>
                    <Text style={styles.menuSub}>Pending when requested, confirmed when approved</Text>
                  </View>
                  <Switch
                    value={calAutoSync.parking}
                    onValueChange={(v) => calSetAutoSync('parking', v)}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor={'#fff'}
                  />
                </View>
              </>
            )}
            <RowDivider />
            <ToggleRow
              icon="💰"
              label="Show recurring bills"
              sub="Display recurring bill payments on the calendar"
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
                  style={({ pressed }) => [styles.menuItem, webPushStatus === 'default' && pressed && styles.menuItemPressed]}
                  onPress={webPushStatus === 'default' ? handleEnableWebPush : undefined}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Browser notifications"
                >
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>🔔</Text>
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>Browser notifications</Text>
                    <Text style={styles.menuSub}>
                      {webPushStatus === 'granted'
                        ? 'Enabled for this browser'
                        : webPushStatus === 'denied'
                        ? 'Blocked — allow in browser settings'
                        : 'Tap to enable push notifications'}
                    </Text>
                  </View>
                  {webPushStatus === 'granted' && (
                    <Text style={styles.webPushOn}>On</Text>
                  )}
                  {webPushStatus === 'default' && (
                    <Text style={styles.menuChevron}>›</Text>
                  )}
                </Pressable>
                <RowDivider />
              </>
            )}
            <ToggleRow
              icon="💰"
              label={t('settings.notify_bill_added')}
              sub={t('settings.notify_bill_added_sub')}
              value={prefs.notifyBillAdded}
              onToggle={(v) => toggle('notifyBillAdded', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="✅"
              label={t('settings.notify_bill_settled')}
              sub={t('settings.notify_bill_settled_sub')}
              value={prefs.notifyBillSettled}
              onToggle={(v) => toggle('notifyBillSettled', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="⏰"
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
                      style={[styles.dayChip, prefs.billDueDaysBefore === d && styles.dayChipActive]}
                      onPress={() => setDaysBefore(d)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t('common.day', { count: d })}
                      accessibilityState={{ selected: prefs.billDueDaysBefore === d }}
                    >
                      <Text style={[styles.dayChipText, prefs.billDueDaysBefore === d && styles.dayChipTextActive]}>
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
              icon="🚗"
              label={t('settings.notify_parking_claimed')}
              sub={t('settings.notify_parking_claimed_sub')}
              value={prefs.notifyParkingClaimed}
              onToggle={(v) => toggle('notifyParkingClaimed', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="📅"
              label={t('settings.notify_parking_reservation')}
              sub={t('settings.notify_parking_reservation_sub')}
              value={prefs.notifyParkingReservation}
              onToggle={(v) => toggle('notifyParkingReservation', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="🧹"
              label={t('settings.notify_chore')}
              sub={t('settings.notify_chore_sub')}
              value={prefs.notifyChoreOverdue}
              onToggle={(v) => toggle('notifyChoreOverdue', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="💬"
              label={t('settings.notify_chat')}
              sub={t('settings.notify_chat_sub')}
              value={prefs.notifyChatMessage}
              onToggle={(v) => toggle('notifyChatMessage', v)}
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
                    <Text style={[styles.menuChevron, { color: C.primary, fontSize: 18 }]}>✓</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>

          {/* About */}
          <SectionDivider label={t('settings.about_section')} />
          <View style={styles.menuGroup}>
            <MenuItem
              icon="📋"
              label={t('settings.version')}
              sub="HouseMates"
              onPress={() => {}}
              disabled
              rightText="1.0.0"
            />
            <RowDivider />
            <MenuItem
              icon="📄"
              label={t('settings.terms')}
              sub={t('settings.terms_sub')}
              onPress={() => router.push('/(tabs)/settings/terms')}
            />
            <RowDivider />
            <MenuItem
              icon="🔒"
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
      marginLeft: 4,
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
    rowDivider: { height: 1, backgroundColor: C.border, marginLeft: sizes.md + 36 + sizes.sm },
    footer: { color: C.textDisabled, fontSize: 13, ...font.regular, textAlign: 'center', marginTop: sizes.md },
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
      marginLeft: 4,
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
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalBox: { backgroundColor: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, gap: 12, alignItems: 'center' },
    modalIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.negative + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    modalTitle: { fontSize: 18, ...font.extrabold, color: C.textPrimary, textAlign: 'center' },
    modalBody: { fontSize: 14, ...font.regular, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
    modalBtnDanger: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: C.negative, alignItems: 'center', marginTop: 4 },
    modalBtnDangerText: { fontSize: 15, ...font.semibold, color: '#fff' },
    modalBtnPrimary: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', marginTop: 4 },
    modalBtnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
    modalBtnSecondary: { width: '100%', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center' },
    modalBtnSecondaryText: { fontSize: 15, ...font.semibold, color: C.primary },
    modalBtnCancel: { width: '100%', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
    modalBtnCancelText: { fontSize: 15, ...font.semibold, color: C.textPrimary },
  });
}
