import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Modal,
  Platform,
  Animated,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, CURRENCIES, type ThemeMode } from '@stores/settingsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useBillsStore, calculateBalances } from '@stores/billsStore';
import { useVotingStore } from '@stores/votingStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { PREMIUM_ENABLED } from '@constants/featureFlags';

// Each feature carries an emoji in the store; on this screen we render a line
// icon instead so every row speaks one visual language (no emoji beside icons).
const FEATURE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  parking: 'car-outline',
  grocery: 'cart-outline',
  grocery_draft: 'create-outline',
  chores: 'sparkles-outline',
  chat: 'chatbubble-ellipses-outline',
  voting: 'document-text-outline',
  maintenance: 'construct-outline',
  condition: 'home-outline',
};

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const features = useSettingsStore((s) => s.features);
  const toggleFeature = useSettingsStore((s) => s.toggleFeature);
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const handleSelectMode = useCallback(
    (mode: ThemeMode) => (): void => {
      setThemeMode(mode);
    },
    [setThemeMode]
  );
  const leaveHouse = useAuthStore((s) => s.leaveHouse);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const houseName = useHousematesStore((s) => s.houseName);
  const bills = useBillsStore((s) => s.bills);
  const addProposal = useVotingStore((s) => s.addProposal);
  const calConnected = useCalendarSyncStore((s) => s.connected);
  const calAutoSync = useCalendarSyncStore((s) => s.autoSync);
  const calConnect = useCalendarSyncStore((s) => s.connect);
  const calDisconnect = useCalendarSyncStore((s) => s.disconnect);
  const calSetAutoSync = useCalendarSyncStore((s) => s.setAutoSync);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [debtAmount, setDebtAmount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [requestingVote, setRequestingVote] = useState(false);
  const [calLoading, setCalLoading] = useState(false);

  const currentLanguage = useLanguageStore((s) => s.language);
  const chevronName: React.ComponentProps<typeof Ionicons>['name'] = isRTL(currentLanguage)
    ? 'chevron-back'
    : 'chevron-forward';
  const currentCurrency = CURRENCIES.find((cur) => cur.symbol === currency);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

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

  const handleToggle = useCallback(
    (key: string) => {
      toggleFeature(key);
    },
    [toggleFeature]
  );

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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>{t('settings.features_intro')}</Text>

          {/* ── Appearance (temporary toggle — replaced by Batch 6 picker) ── */}
          <Text style={styles.sectionLabel}>{t('settings.appearance')}</Text>
          <View style={styles.card}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((mode, index, arr) => (
              <Pressable
                key={mode}
                accessible
                style={[styles.row, index < arr.length - 1 && styles.rowBorder]}
                onPress={handleSelectMode(mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: themeMode === mode }}
              >
                <View
                  style={[
                    styles.rowSq,
                    { backgroundColor: (themeMode === mode ? C.primary : C.textSecondary) + '18' },
                  ]}
                >
                  <Ionicons
                    name={
                      mode === 'dark'
                        ? 'moon-outline'
                        : mode === 'light'
                          ? 'sunny-outline'
                          : 'phone-portrait-outline'
                    }
                    size={18}
                    color={themeMode === mode ? C.primary : C.textSecondary}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.label, themeMode === mode && styles.selectedLabel]}>
                    {mode === 'system'
                      ? t('settings.appearance_system')
                      : mode === 'light'
                        ? t('settings.appearance_light')
                        : t('settings.appearance_dark')}
                  </Text>
                </View>
                {themeMode === mode && <Ionicons name="checkmark" size={20} color={C.primary} />}
              </Pressable>
            ))}
          </View>

          {/* ── Currency ── */}
          <Text style={styles.sectionLabel}>{t('settings.currency_section')}</Text>
          <View style={styles.card}>
            <Pressable
              style={styles.row}
              onPress={() => setShowCurrency(true)}
              accessibilityRole="button"
              accessibilityLabel={t('settings.currency_pick')}
            >
              <View style={[styles.rowSq, { backgroundColor: C.primary + '18' }]}>
                <Text style={[styles.currencyGlyph, { color: C.primary }]}>{currency}</Text>
              </View>
              <Text style={styles.label}>{t('settings.currency_section')}</Text>
              <View style={styles.rowValue}>
                <Text style={[styles.rowValueText, { color: C.textSecondary }]} numberOfLines={1}>
                  {currentCurrency ? currentCurrency.label.split('(')[0].trim() : currency}
                </Text>
                <Ionicons name={chevronName} size={18} color={C.textTertiary} />
              </View>
            </Pressable>
          </View>

          {/* ── Currency picker sheet ── */}
          <Modal
            visible={showCurrency}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCurrency(false)}
          >
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowCurrency(false)}>
              <Pressable style={styles.sheet} onPress={() => {}}>
                <View style={styles.sheetGrab} />
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle}>{t('settings.currency_pick')}</Text>
                  <Pressable
                    onPress={() => setShowCurrency(false)}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={[styles.sheetDone, { color: C.primary }]}>{t('common.done')}</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                  {CURRENCIES.map((cur) => {
                    const selected = cur.symbol === currency;
                    return (
                      <Pressable
                        key={cur.symbol}
                        style={[styles.sheetRow, selected && { backgroundColor: C.primary + '12' }]}
                        onPress={() => {
                          setCurrency(cur.symbol);
                          setShowCurrency(false);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.sheetGlyph,
                            { color: selected ? C.primary : C.textSecondary },
                          ]}
                        >
                          {cur.symbol}
                        </Text>
                        <Text
                          style={[
                            styles.sheetLabel,
                            { color: selected ? C.primary : C.textPrimary },
                            selected && font.bold,
                          ]}
                        >
                          {cur.label.split('(')[0].trim()}
                        </Text>
                        {selected && <Ionicons name="checkmark" size={20} color={C.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Premium ── */}
          {/* Parked until we publish premium — see constants/featureFlags.ts.
              The paywall screen (settings/premium.tsx) still exists; this is the
              only entry point to it, so hiding this row hides premium entirely. */}
          {PREMIUM_ENABLED && (
            <>
              <Text style={styles.sectionLabel}>{t('premium.settings_section')}</Text>
              <View style={styles.card}>
                <Link href="/(tabs)/settings/premium" asChild>
                  <Pressable
                    style={styles.row}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('premium.title')}
                  >
                    <View style={[styles.rowSq, { backgroundColor: C.warning + '18' }]}>
                      <Ionicons name="sparkles-outline" size={18} color={C.warning} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.label}>{t('premium.title')}</Text>
                      <Text style={styles.description}>{t('premium.settings_sub')}</Text>
                    </View>
                    <Ionicons name={chevronName} size={18} color={C.textTertiary} />
                  </Pressable>
                </Link>
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>{t('settings.features_section')}</Text>

          <View style={styles.card}>
            {features.map((feature, index) => (
              <View
                key={feature.key}
                style={[styles.row, index < features.length - 1 && styles.rowBorder]}
              >
                <View style={[styles.rowSq, { backgroundColor: C.primary + '18' }]}>
                  <Ionicons
                    name={FEATURE_ICONS[feature.key] ?? 'ellipse-outline'}
                    size={18}
                    color={C.primary}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={styles.label}>{feature.label}</Text>
                  <Text style={styles.description}>{feature.description}</Text>
                </View>
                <Switch
                  value={feature.enabled}
                  onValueChange={() => handleToggle(feature.key)}
                  trackColor={{ false: C.border, true: C.primary + '66' }}
                  thumbColor={feature.enabled ? C.primary : C.textSecondary}
                  activeThumbColor={C.primary}
                  style={styles.switchLtr}
                  accessible
                  accessibilityRole="switch"
                  accessibilityLabel={`Toggle ${feature.label}`}
                  accessibilityHint={feature.description}
                  accessibilityState={{ checked: feature.enabled }}
                />
              </View>
            ))}
          </View>

          <Text style={styles.note}>{t('settings.features_note')}</Text>

          {/* ── Calendar Integration ── */}
          <Text style={styles.sectionLabel}>{t('settings.calendar_section')}</Text>
          <View style={styles.card}>
            <View style={[styles.row, calConnected && styles.rowBorder]}>
              <View style={[styles.rowSq, { backgroundColor: C.positive + '18' }]}>
                <Ionicons name="calendar-outline" size={18} color={C.positive} />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>{t('settings.calendar_connect')}</Text>
                <Text style={styles.description}>
                  {Platform.OS === 'web'
                    ? t('settings.calendar_desc_web')
                    : calConnected
                      ? t('settings.calendar_syncing')
                      : t('settings.calendar_desc')}
                </Text>
              </View>
              <Switch
                value={calConnected}
                onValueChange={handleCalendarToggle}
                disabled={calLoading || Platform.OS === 'web'}
                trackColor={{ false: C.border, true: C.primary + '66' }}
                thumbColor={calConnected ? C.primary : C.textSecondary}
                activeThumbColor={C.primary}
                style={styles.switchLtr}
                accessible
                accessibilityRole="switch"
                accessibilityLabel="Connect my calendar"
                accessibilityHint="See your personal events in-app and auto-add house events"
                accessibilityState={{
                  checked: calConnected,
                  disabled: calLoading || Platform.OS === 'web',
                }}
              />
            </View>
            {calConnected && (
              <>
                <View style={[styles.row, styles.rowBorder]}>
                  <View style={[styles.rowSq, { backgroundColor: C.positive + '18' }]}>
                    <Ionicons name="checkmark-done-outline" size={18} color={C.positive} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.label}>{t('settings.calendar_auto_events')}</Text>
                    <Text style={styles.description}>
                      {t('settings.calendar_auto_events_desc')}
                    </Text>
                  </View>
                  <Switch
                    value={calAutoSync.events}
                    onValueChange={(v) => calSetAutoSync('events', v)}
                    trackColor={{ false: C.border, true: C.primary + '66' }}
                    thumbColor={calAutoSync.events ? C.primary : C.textSecondary}
                    activeThumbColor={C.primary}
                    style={styles.switchLtr}
                    accessible
                    accessibilityRole="switch"
                    accessibilityLabel="Auto-add house events"
                    accessibilityHint="New house events go straight to your calendar"
                    accessibilityState={{ checked: calAutoSync.events }}
                  />
                </View>
                <View style={styles.row}>
                  <View style={[styles.rowSq, { backgroundColor: C.positive + '18' }]}>
                    <Ionicons name="car-outline" size={18} color={C.positive} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.label}>{t('settings.calendar_auto_parking')}</Text>
                    <Text style={styles.description}>
                      {t('settings.calendar_auto_parking_desc')}
                    </Text>
                  </View>
                  <Switch
                    value={calAutoSync.parking}
                    onValueChange={(v) => calSetAutoSync('parking', v)}
                    trackColor={{ false: C.border, true: C.primary + '66' }}
                    thumbColor={calAutoSync.parking ? C.primary : C.textSecondary}
                    activeThumbColor={C.primary}
                    style={styles.switchLtr}
                    accessible
                    accessibilityRole="switch"
                    accessibilityLabel="Auto-add parking"
                    accessibilityHint="Reservations added as pending, updated when approved"
                    accessibilityState={{ checked: calAutoSync.parking }}
                  />
                </View>
              </>
            )}
          </View>

          {/* ── House ── */}
          <Text style={styles.sectionLabel}>{t('settings.house_section')}</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={handleLeavePress} accessibilityRole="button">
              <View style={[styles.rowSq, { backgroundColor: C.negative + '18' }]}>
                <Ionicons name="exit-outline" size={18} color={C.negative} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.label, { color: C.negative }]}>
                  {t('settings.leave_house')}
                </Text>
                <Text style={styles.description}>
                  {houseName
                    ? t('settings.leave_house_desc', { name: houseName })
                    : t('settings.leave_house_desc_default')}
                </Text>
              </View>
              <Ionicons name={chevronName} size={18} color={C.textTertiary} />
            </Pressable>
          </View>

          {/* ── Confirm leave modal ── */}
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
                  {houseName
                    ? t('settings.leave_house_body_named', { name: houseName })
                    : t('settings.leave_house_body')}
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

          {/* ── Debt block modal ── */}
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
                  {t('settings.settle_first_body', { amount: debtAmount.toFixed(2) })}
                </Text>
                <Pressable
                  style={[styles.modalBtnPrimary]}
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

          <Text style={styles.sectionLabel}>{t('settings.integrations_section')}</Text>
          <View style={styles.card}>
            <Link href="/(tabs)/settings/nfc-parking" asChild>
              <Pressable style={styles.row} accessibilityRole="button">
                <View style={[styles.rowSq, { backgroundColor: C.primary + '18' }]}>
                  <Ionicons name="wifi-outline" size={18} color={C.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.label}>{t('settings.nfc_title')}</Text>
                  <Text style={styles.description}>{t('settings.nfc_desc')}</Text>
                </View>
                <Ionicons name={chevronName} size={18} color={C.textTertiary} />
              </Pressable>
            </Link>
          </View>

          <Text style={styles.sectionLabel}>{t('settings.legal_section')}</Text>
          <View style={styles.card}>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/(tabs)/settings/privacy-policy')}
            >
              <View style={[styles.rowSq, { backgroundColor: C.textSecondary + '18' }]}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textSecondary} />
              </View>
              <Text style={[styles.label, { flex: 1 }]}>{t('settings.privacy')}</Text>
              <Ionicons name={chevronName} size={18} color={C.textTertiary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/(tabs)/settings/terms')}>
              <View style={[styles.rowSq, { backgroundColor: C.textSecondary + '18' }]}>
                <Ionicons name="document-text-outline" size={18} color={C.textSecondary} />
              </View>
              <Text style={[styles.label, { flex: 1 }]}>{t('settings.terms')}</Text>
              <Ionicons name={chevronName} size={18} color={C.textTertiary} />
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,
    content: { padding: sizes.lg, gap: sizes.sm },
    intro: { color: C.textSecondary, ...font.regular, fontSize: 15, lineHeight: 22 },
    sectionLabel: {
      fontSize: 12,
      color: C.textSecondary,
      ...font.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: sizes.sm,
      marginBottom: sizes.xs,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.md,
      gap: sizes.md,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    rowSq: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    info: { flex: 1 },
    label: {
      fontSize: 16,
      color: C.textPrimary,
      ...font.semibold,
    },
    selectedLabel: { color: C.primary },
    description: {
      fontSize: 13,
      color: C.textSecondary,
      ...font.regular,
      marginTop: 2,
    },
    note: {
      fontSize: 15,
      color: C.textSecondary,
      ...font.regular,
      textAlign: 'center',
      marginTop: sizes.md,
      fontStyle: 'italic',
    },
    currencyGlyph: { fontSize: 17, ...font.bold },
    rowValue: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    rowValueText: { fontSize: 14, ...font.medium, flexShrink: 1 },

    // ── Currency picker sheet
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(6,10,18,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 28,
      maxHeight: '72%',
    },
    sheetGrab: {
      width: 38,
      height: 5,
      borderRadius: 3,
      backgroundColor: C.textTertiary,
      opacity: 0.4,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    sheetTitle: { fontSize: 17, ...font.extrabold, color: C.textPrimary },
    sheetDone: { fontSize: 16, ...font.bold },
    sheetList: { paddingHorizontal: 12, paddingTop: 6 },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderRadius: 12,
    },
    sheetGlyph: { fontSize: 18, ...font.extrabold, width: 34, textAlign: 'center' },
    sheetLabel: { flex: 1, fontSize: 16, ...font.medium },

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
