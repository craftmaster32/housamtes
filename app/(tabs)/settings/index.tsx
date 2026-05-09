import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable, Alert, Modal, Platform, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, CURRENCIES, type ThemeMode } from '@stores/settingsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useBillsStore, calculateBalances } from '@stores/billsStore';
import { useVotingStore } from '@stores/votingStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const features = useSettingsStore((s) => s.features);
  const toggleFeature = useSettingsStore((s) => s.toggleFeature);
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const handleSelectMode = useCallback((mode: ThemeMode) => (): void => {
    setThemeMode(mode);
  }, [setThemeMode]);
  const leaveHouse = useAuthStore((s) => s.leaveHouse);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const houseName = useHousematesStore((s) => s.houseName);
  const bills = useBillsStore((s) => s.bills);
  const addProposal = useVotingStore((s) => s.addProposal);
  const calConnected    = useCalendarSyncStore((s) => s.connected);
  const calAutoSync     = useCalendarSyncStore((s) => s.autoSync);
  const calConnect      = useCalendarSyncStore((s) => s.connect);
  const calDisconnect   = useCalendarSyncStore((s) => s.disconnect);
  const calSetAutoSync  = useCalendarSyncStore((s) => s.setAutoSync);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtAmount, setDebtAmount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [requestingVote, setRequestingVote] = useState(false);
  const [calLoading, setCalLoading] = useState(false);

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
                <Ionicons
                  name={mode === 'dark' ? 'moon-outline' : mode === 'light' ? 'sunny-outline' : 'phone-portrait-outline'}
                  size={22}
                  color={themeMode === mode ? C.primary : C.textSecondary}
                  style={styles.iconNative}
                />
                <View style={styles.info}>
                  <Text style={[styles.label, themeMode === mode && styles.selectedLabel]}>
                    {mode === 'system' ? t('settings.appearance_system') : mode === 'light' ? t('settings.appearance_light') : t('settings.appearance_dark')}
                  </Text>
                </View>
                {themeMode === mode && (
                  <Ionicons name="checkmark" size={20} color={C.primary} />
                )}
              </Pressable>
            ))}
          </View>

          {/* ── Currency ── */}
          <Text style={styles.sectionLabel}>CURRENCY</Text>
          <View style={styles.card}>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
              {CURRENCIES.map((c) => (
                <Pressable
                  key={c.symbol}
                  style={[styles.currencyChip, currency === c.symbol && styles.currencyChipActive]}
                  onPress={() => setCurrency(c.symbol)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: currency === c.symbol }}
                >
                  <Text style={[styles.currencyChipText, currency === c.symbol && styles.currencyChipTextActive]}>
                    {c.symbol}
                  </Text>
                  <Text style={[styles.currencyChipLabel, currency === c.symbol && styles.currencyChipLabelActive]}>
                    {c.label.split('(')[0].trim()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('settings.features_section')}</Text>

          <View style={styles.card}>
            {features.map((feature, index) => (
              <View
                key={feature.key}
                style={[
                  styles.row,
                  index < features.length - 1 && styles.rowBorder,
                ]}
              >
                <Text style={styles.icon}>{feature.icon}</Text>
                <View style={styles.info}>
                  <Text style={styles.label}>{feature.label}</Text>
                  <Text style={styles.description}>{feature.description}</Text>
                </View>
                <Switch
                  value={feature.enabled}
                  onValueChange={() => handleToggle(feature.key)}
                  trackColor={{ false: C.border, true: C.primary + '66' }}
                  thumbColor={feature.enabled ? C.primary : C.textSecondary}
                  accessible
                  accessibilityLabel={`Toggle ${feature.label}`}
                  accessibilityState={{ checked: feature.enabled }}
                />
              </View>
            ))}
          </View>

          <Text style={styles.note}>{t('settings.features_note')}</Text>

          {/* ── Calendar Integration ── */}
          <Text style={styles.sectionLabel}>CALENDAR</Text>
          <View style={styles.card}>
            <View style={[styles.row, calConnected && styles.rowBorder]}>
              <Text style={styles.icon}>📅</Text>
              <View style={styles.info}>
                <Text style={styles.label}>Connect my calendar</Text>
                <Text style={styles.description}>
                  {Platform.OS === 'web'
                    ? 'Open any event in the Calendar tab to export to Google Calendar or download an .ics file'
                    : calConnected
                      ? 'Syncing with your device calendar'
                      : 'See your personal events in-app and auto-add house events'}
                </Text>
              </View>
              <Switch
                value={calConnected}
                onValueChange={handleCalendarToggle}
                disabled={calLoading || Platform.OS === 'web'}
                trackColor={{ false: C.border, true: C.primary + '66' }}
                thumbColor={calConnected ? C.primary : C.textSecondary}
                accessible
                accessibilityLabel="Connect my calendar"
              />
            </View>
            {calConnected && (
              <>
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.icon}>📋</Text>
                  <View style={styles.info}>
                    <Text style={styles.label}>Auto-add house events</Text>
                    <Text style={styles.description}>New house events go straight to your calendar</Text>
                  </View>
                  <Switch
                    value={calAutoSync.events}
                    onValueChange={(v) => calSetAutoSync('events', v)}
                    trackColor={{ false: C.border, true: C.primary + '66' }}
                    thumbColor={calAutoSync.events ? C.primary : C.textSecondary}
                    accessible
                    accessibilityLabel="Auto-add house events"
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.icon}>🚗</Text>
                  <View style={styles.info}>
                    <Text style={styles.label}>Auto-add parking</Text>
                    <Text style={styles.description}>Reservations added as pending, updated when approved</Text>
                  </View>
                  <Switch
                    value={calAutoSync.parking}
                    onValueChange={(v) => calSetAutoSync('parking', v)}
                    trackColor={{ false: C.border, true: C.primary + '66' }}
                    thumbColor={calAutoSync.parking ? C.primary : C.textSecondary}
                    accessible
                    accessibilityLabel="Auto-add parking"
                  />
                </View>
              </>
            )}
          </View>

          {/* ── House ── */}
          <Text style={styles.sectionLabel}>YOUR HOUSE</Text>
          <View style={styles.card}>
            <Pressable
              style={styles.row}
              onPress={handleLeavePress}
              accessibilityRole="button"
            >
              <Ionicons name="exit-outline" size={22} color={C.negative} style={styles.iconNative} />
              <View style={styles.info}>
                <Text style={[styles.label, { color: C.negative }]}>Leave House</Text>
                <Text style={styles.description}>
                  {houseName ? `Leave "${houseName}" and join or create a new house` : 'Leave this house and start fresh'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
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
                <Text style={styles.modalTitle}>Settle Up First</Text>
                <Text style={styles.modalBody}>
                  You owe your housemates {debtAmount.toFixed(2)}. Please settle your balance before leaving, or ask the house to vote on approving your departure.
                </Text>
                <Pressable
                  style={[styles.modalBtnPrimary]}
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

          <Text style={styles.sectionLabel}>LEGAL</Text>
          <View style={styles.card}>
            <Pressable style={[styles.row, styles.rowBorder]} onPress={() => router.push('/(tabs)/settings/privacy-policy')}>
              <Text style={styles.icon}>🔒</Text>
              <Text style={[styles.label, { flex: 1 }]}>{t('settings.privacy')}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/(tabs)/settings/terms')}>
              <Text style={styles.icon}>📄</Text>
              <Text style={[styles.label, { flex: 1 }]}>{t('settings.terms')}</Text>
              <Text style={styles.chevron}>›</Text>
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
    icon: { fontSize: 24, width: 32, textAlign: 'center' },
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
    chevron: { color: C.textSecondary, fontSize: 20 },
    iconNative: { width: 32, textAlign: 'center' },

    currencyChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.background,
    },
    currencyChipActive: {
      borderColor: C.primary, backgroundColor: C.primary + '12',
    },
    currencyChipText: { fontSize: 16, ...font.bold, color: C.textSecondary },
    currencyChipTextActive: { color: C.primary },
    currencyChipLabel: { fontSize: 12, ...font.regular, color: C.textSecondary },
    currencyChipLabelActive: { color: C.primary },

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
