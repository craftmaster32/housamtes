import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal, Platform, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { navigateToBase } from '@stores/navigationStore';
import { BackLink } from '@components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore, calculateBalances } from '@stores/billsStore';
import { useVotingStore } from '@stores/votingStore';
import { useSettingsStore, CURRENCIES } from '@stores/settingsStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuItem({
  icon,
  label,
  sub,
  onPress,
  rightText,
  disabled,
  danger,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress: () => void;
  rightText?: string;
  disabled?: boolean;
  danger?: boolean;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const currentLanguage = useLanguageStore((s) => s.language);
  const iconColor = danger ? C.negative : disabled ? C.textTertiary : C.primary;
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && !disabled && styles.menuItemPressed]}
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.menuIcon,
          disabled && styles.menuIconDisabled,
          danger && { backgroundColor: C.negative + '15' },
        ]}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.menuText}>
        <Text
          style={[
            styles.menuLabel,
            disabled && styles.menuLabelDisabled,
            danger && { color: C.negative },
          ]}
        >
          {label}
        </Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      {rightText ? (
        <Text style={styles.menuRightText}>{rightText}</Text>
      ) : (
        <Ionicons
          name={isRTL(currentLanguage) ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={danger ? C.negative : C.textTertiary}
          style={disabled ? styles.menuChevronDisabled : undefined}
        />
      )}
    </Pressable>
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

const TIMEZONES: { id: string; label: string; region: string }[] = [
  { id: 'Pacific/Kiritimati', label: 'Kiritimati', region: 'Kiribati · UTC+14' },
  { id: 'Pacific/Auckland', label: 'Auckland', region: 'New Zealand · UTC+12/13' },
  { id: 'Pacific/Fiji', label: 'Suva', region: 'Fiji · UTC+12' },
  { id: 'Australia/Sydney', label: 'Sydney', region: 'Australia · UTC+10/11' },
  { id: 'Australia/Melbourne', label: 'Melbourne', region: 'Australia · UTC+10/11' },
  { id: 'Australia/Brisbane', label: 'Brisbane', region: 'Australia · UTC+10' },
  { id: 'Pacific/Guam', label: 'Guam', region: 'Guam · UTC+10' },
  { id: 'Australia/Adelaide', label: 'Adelaide', region: 'Australia · UTC+9:30/10:30' },
  { id: 'Asia/Tokyo', label: 'Tokyo', region: 'Japan · UTC+9' },
  { id: 'Asia/Seoul', label: 'Seoul', region: 'South Korea · UTC+9' },
  { id: 'Asia/Shanghai', label: 'Beijing / Shanghai', region: 'China · UTC+8' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong', region: 'Hong Kong · UTC+8' },
  { id: 'Asia/Taipei', label: 'Taipei', region: 'Taiwan · UTC+8' },
  { id: 'Australia/Perth', label: 'Perth', region: 'Australia · UTC+8' },
  { id: 'Asia/Singapore', label: 'Singapore', region: 'Singapore · UTC+8' },
  { id: 'Asia/Manila', label: 'Manila', region: 'Philippines · UTC+8' },
  { id: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur', region: 'Malaysia · UTC+8' },
  { id: 'Asia/Jakarta', label: 'Jakarta', region: 'Indonesia · UTC+7' },
  { id: 'Asia/Bangkok', label: 'Bangkok', region: 'Thailand · UTC+7' },
  { id: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City', region: 'Vietnam · UTC+7' },
  { id: 'Asia/Dhaka', label: 'Dhaka', region: 'Bangladesh · UTC+6' },
  { id: 'Asia/Almaty', label: 'Almaty', region: 'Kazakhstan · UTC+6' },
  { id: 'Asia/Kathmandu', label: 'Kathmandu', region: 'Nepal · UTC+5:45' },
  { id: 'Asia/Kolkata', label: 'Mumbai / Kolkata', region: 'India · UTC+5:30' },
  { id: 'Asia/Colombo', label: 'Colombo', region: 'Sri Lanka · UTC+5:30' },
  { id: 'Asia/Karachi', label: 'Karachi', region: 'Pakistan · UTC+5' },
  { id: 'Asia/Tashkent', label: 'Tashkent', region: 'Uzbekistan · UTC+5' },
  { id: 'Asia/Dubai', label: 'Dubai / Abu Dhabi', region: 'UAE · UTC+4' },
  { id: 'Asia/Baku', label: 'Baku', region: 'Azerbaijan · UTC+4' },
  { id: 'Asia/Tehran', label: 'Tehran', region: 'Iran · UTC+3:30' },
  { id: 'Europe/Moscow', label: 'Moscow', region: 'Russia · UTC+3' },
  { id: 'Asia/Jerusalem', label: 'Jerusalem / Tel Aviv', region: 'Israel · UTC+2/3' },
  { id: 'Asia/Riyadh', label: 'Riyadh', region: 'Saudi Arabia · UTC+3' },
  { id: 'Africa/Nairobi', label: 'Nairobi', region: 'Kenya · UTC+3' },
  { id: 'Europe/Istanbul', label: 'Istanbul', region: 'Türkiye · UTC+3' },
  { id: 'Africa/Cairo', label: 'Cairo', region: 'Egypt · UTC+2/3' },
  { id: 'Africa/Johannesburg', label: 'Johannesburg', region: 'South Africa · UTC+2' },
  { id: 'Europe/Athens', label: 'Athens', region: 'Greece · UTC+2/3' },
  { id: 'Europe/Bucharest', label: 'Bucharest', region: 'Romania · UTC+2/3' },
  { id: 'Europe/Helsinki', label: 'Helsinki', region: 'Finland · UTC+2/3' },
  { id: 'Europe/Kyiv', label: 'Kyiv', region: 'Ukraine · UTC+2/3' },
  { id: 'Europe/Paris', label: 'Paris', region: 'France · UTC+1/2' },
  { id: 'Europe/Berlin', label: 'Berlin', region: 'Germany · UTC+1/2' },
  { id: 'Europe/Madrid', label: 'Madrid', region: 'Spain · UTC+1/2' },
  { id: 'Europe/Rome', label: 'Rome', region: 'Italy · UTC+1/2' },
  { id: 'Europe/Amsterdam', label: 'Amsterdam', region: 'Netherlands · UTC+1/2' },
  { id: 'Europe/Brussels', label: 'Brussels', region: 'Belgium · UTC+1/2' },
  { id: 'Europe/Zurich', label: 'Zurich', region: 'Switzerland · UTC+1/2' },
  { id: 'Europe/Vienna', label: 'Vienna', region: 'Austria · UTC+1/2' },
  { id: 'Europe/Warsaw', label: 'Warsaw', region: 'Poland · UTC+1/2' },
  { id: 'Europe/Stockholm', label: 'Stockholm', region: 'Sweden · UTC+1/2' },
  { id: 'Africa/Lagos', label: 'Lagos', region: 'Nigeria · UTC+1' },
  { id: 'Europe/London', label: 'London', region: 'United Kingdom · UTC+0/1' },
  { id: 'Europe/Dublin', label: 'Dublin', region: 'Ireland · UTC+0/1' },
  { id: 'Europe/Lisbon', label: 'Lisbon', region: 'Portugal · UTC+0/1' },
  { id: 'Atlantic/Reykjavik', label: 'Reykjavík', region: 'Iceland · UTC+0' },
  { id: 'Africa/Casablanca', label: 'Casablanca', region: 'Morocco · UTC+0/1' },
  { id: 'Atlantic/Cape_Verde', label: 'Cape Verde', region: 'Cabo Verde · UTC−1' },
  { id: 'America/Noronha', label: 'Fernando de Noronha', region: 'Brazil · UTC−2' },
  { id: 'America/Sao_Paulo', label: 'São Paulo', region: 'Brazil · UTC−3' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', region: 'Argentina · UTC−3' },
  { id: 'America/Santiago', label: 'Santiago', region: 'Chile · UTC−3/4' },
  { id: 'America/St_Johns', label: "St. John's", region: 'Canada · UTC−3:30/2:30' },
  { id: 'America/Halifax', label: 'Halifax', region: 'Canada · UTC−4/3' },
  { id: 'America/Caracas', label: 'Caracas', region: 'Venezuela · UTC−4' },
  { id: 'America/Toronto', label: 'Toronto', region: 'Canada · UTC−5/4' },
  { id: 'America/New_York', label: 'New York', region: 'US Eastern · UTC−5/4' },
  { id: 'America/Bogota', label: 'Bogotá', region: 'Colombia · UTC−5' },
  { id: 'America/Lima', label: 'Lima', region: 'Peru · UTC−5' },
  { id: 'America/Mexico_City', label: 'Mexico City', region: 'Mexico · UTC−6' },
  { id: 'America/Chicago', label: 'Chicago', region: 'US Central · UTC−6/5' },
  { id: 'America/Denver', label: 'Denver', region: 'US Mountain · UTC−7/6' },
  { id: 'America/Phoenix', label: 'Phoenix', region: 'US Arizona · UTC−7' },
  { id: 'America/Los_Angeles', label: 'Los Angeles', region: 'US Pacific · UTC−8/7' },
  { id: 'America/Vancouver', label: 'Vancouver', region: 'Canada · UTC−8/7' },
  { id: 'America/Anchorage', label: 'Anchorage', region: 'US Alaska · UTC−9/8' },
  { id: 'Pacific/Honolulu', label: 'Honolulu', region: 'US Hawaii · UTC−10' },
  { id: 'Pacific/Pago_Pago', label: 'Pago Pago', region: 'Samoa · UTC−11' },
];

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  // Settings is reached either as a main section (home avatar menu / More list)
  // or as a page of Profile (from=profile). Back follows the same split — Home
  // in the first case, Profile in the second — and the label names whichever it
  // actually is.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const housemates = useHousematesStore((s) => s.housemates);
  const houseTimezone = useHousematesStore((s) => s.timezone);
  const updateTimezone = useHousematesStore((s) => s.updateTimezone);

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myRole = useAuthStore((s) => s.role);
  const leaveHouse = useAuthStore((s) => s.leaveHouse);
  const bills = useBillsStore((s) => s.bills);
  const addProposal = useVotingStore((s) => s.addProposal);

  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const currentCurrencyLabel =
    CURRENCIES.find((c) => c.symbol === currency)
      ?.label.split('(')[0]
      .trim() ?? currency;

  const currentLanguage = useLanguageStore((s) => s.language);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [tzQuery, setTzQuery] = useState('');
  const filteredTimezones = useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    if (!q) return TIMEZONES;
    return TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.region.toLowerCase().includes(q) ||
        tz.id.toLowerCase().replace(/_/g, ' ').includes(q)
    );
  }, [tzQuery]);
  const [debtAmount, setDebtAmount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [requestingVote, setRequestingVote] = useState(false);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont();

  const themeLabel = t(`settings.theme_${themeMode}`);
  const languageLabel = t(`settings.language_${currentLanguage}`);

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
      setSuccessorId(null);
      setShowLeaveConfirm(true);
    }
  }, [profile, bills]);

  // When an owner leaves they must hand ownership to a fellow manager first, so
  // the house is never left without an owner.
  const myMemberUserId = profile?.id ?? '';
  const iAmOwner = myRole === 'owner';
  const otherMembers = useMemo(
    () => housemates.filter((h) => h.id !== myMemberUserId),
    [housemates, myMemberUserId]
  );
  const eligibleSuccessors = useMemo(
    () => otherMembers.filter((h) => h.role === 'owner' || h.role === 'admin'),
    [otherMembers]
  );
  const mustPickSuccessor = iAmOwner && otherMembers.length > 0;
  const noEligibleSuccessor = mustPickSuccessor && eligibleSuccessors.length === 0;
  const [successorId, setSuccessorId] = useState<string | null>(null);

  const handleLeaveHouse = useCallback(async (): Promise<void> => {
    if (mustPickSuccessor && !successorId) return;
    setLeaving(true);
    try {
      await leaveHouse(successorId ?? undefined);
      setShowLeaveConfirm(false);
      router.replace('/(onboarding)/house-setup');
    } catch {
      Alert.alert(t('common.error'), t('settings.could_not_leave'));
    } finally {
      setLeaving(false);
    }
  }, [leaveHouse, t, mustPickSuccessor, successorId]);

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
      navigateToBase('/(tabs)/voting');
    } catch {
      Alert.alert(t('common.error'), t('settings.could_not_create_vote'));
    } finally {
      setRequestingVote(false);
    }
  }, [profile, houseId, debtAmount, currency, addProposal, t]);

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

  const timezoneLabel = TIMEZONES.find((tz) => tz.id === houseTimezone)?.label ?? houseTimezone;

  const handleCopyInviteCode = useCallback(() => {
    Alert.alert(t('settings.invite_code'), `${t('profile.share_code')}\n\n${inviteCode}`, [
      { text: t('common.ok') },
    ]);
  }, [inviteCode, t]);

  const canManageHouse = myRole === 'owner' || myRole === 'admin';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.flex}>
        <View style={styles.backRow}>
          <BackLink label={from === 'profile' ? t('nav.profile') : t('common.home')} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.heading, headingFont]}>{t('settings.title')}</Text>

          {/* General */}
          <SectionDivider label={t('settings.general_section')} />
          <View style={styles.menuGroup}>
            <MenuItem
              icon="notifications-outline"
              label={t('settings.menu_notifications')}
              onPress={() => router.push('/(tabs)/settings/notifications')}
            />
            <RowDivider />
            <MenuItem
              icon="color-palette-outline"
              label={t('settings.menu_appearance')}
              rightText={themeLabel}
              onPress={() => router.push('/(tabs)/settings/appearance')}
            />
            <RowDivider />
            <MenuItem
              icon="language-outline"
              label={t('settings.menu_language')}
              rightText={languageLabel}
              onPress={() => router.push('/(tabs)/settings/language')}
            />
            <RowDivider />
            <MenuItem
              icon="calendar-outline"
              label={t('settings.menu_calendar')}
              onPress={() => router.push('/(tabs)/settings/calendar')}
            />
            <RowDivider />
            <MenuItem
              icon="cash-outline"
              label={t('settings.menu_currency')}
              rightText={`${currency}  ${currentCurrencyLabel}`}
              onPress={() => setShowCurrencyModal(true)}
            />
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
            {canManageHouse && (
              <>
                <RowDivider />
                <MenuItem
                  icon="pricetag-outline"
                  label={t('settings.expense_categories')}
                  sub={t('settings.expense_categories_sub')}
                  onPress={() => router.push('/(tabs)/settings/categories')}
                />
                <RowDivider />
                <MenuItem
                  icon="people-circle-outline"
                  label={t('settings.member_permissions')}
                  sub={t('settings.member_permissions_sub')}
                  onPress={() => router.push('/(tabs)/settings/members')}
                />
              </>
            )}
            <RowDivider />
            <MenuItem
              icon="exit-outline"
              label={t('settings.leave_house')}
              sub={
                houseName
                  ? t('settings.leave_house_desc', { name: houseName })
                  : t('settings.leave_house_desc_default')
              }
              onPress={handleLeavePress}
              danger
            />
          </View>

          {/* About */}
          <SectionDivider label={t('settings.about_section')} />
          <View style={styles.menuGroup}>
            <MenuItem
              icon="information-circle-outline"
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
              <Text style={[styles.modalTitle, headingFont]}>
                {t('settings.leave_house_title')}
              </Text>
              <Text style={styles.modalBody}>
                {t(houseName ? 'settings.leave_house_body_named' : 'settings.leave_house_body', {
                  name: houseName,
                })}
              </Text>

              {mustPickSuccessor &&
                (noEligibleSuccessor ? (
                  <>
                    <Text style={styles.successorHint}>{t('settings.leave_needs_manager')}</Text>
                    <Pressable
                      style={styles.modalBtnSecondary}
                      onPress={() => {
                        setShowLeaveConfirm(false);
                        router.push('/(tabs)/settings/members');
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.modalBtnSecondaryText}>
                        {t('settings.manage_members')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.successorWrap}>
                    <Text style={styles.successorLabel}>{t('settings.choose_successor')}</Text>
                    {eligibleSuccessors.map((h) => {
                      const active = successorId === h.id;
                      return (
                        <Pressable
                          key={h.id}
                          style={[styles.successorRow, active && styles.successorRowActive]}
                          onPress={() => setSuccessorId(h.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                        >
                          <View style={[styles.successorAvatar, { backgroundColor: h.color }]}>
                            <Text style={styles.successorAvatarText}>
                              {h.name[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.successorName}>{h.name}</Text>
                          <Text style={styles.successorRole}>
                            {h.role === 'owner' ? t('members.owner') : t('members.admin')}
                          </Text>
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={active ? C.primary : C.textSecondary}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                ))}

              {!noEligibleSuccessor && (
                <Pressable
                  style={[
                    styles.modalBtnDanger,
                    (leaving || (mustPickSuccessor && !successorId)) && { opacity: 0.6 },
                  ]}
                  onPress={handleLeaveHouse}
                  disabled={leaving || (mustPickSuccessor && !successorId)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnDangerText}>
                    {leaving ? t('settings.leaving') : t('settings.yes_leave')}
                  </Text>
                </Pressable>
              )}
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
              <Text style={[styles.modalTitle, headingFont]}>
                {t('settings.settle_first_title')}
              </Text>
              <Text style={styles.modalBody}>
                {t('settings.settle_first_body', {
                  amount: `${currency}${debtAmount.toFixed(2)}`,
                })}
              </Text>
              <Pressable
                style={styles.modalBtnPrimary}
                onPress={() => {
                  setShowDebtModal(false);
                  navigateToBase('/(tabs)/bills');
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
                  {requestingVote ? t('settings.creating_vote') : t('settings.request_vote_leave')}
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
          onRequestClose={() => {
            setShowTimezoneModal(false);
            setTzQuery('');
          }}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setShowTimezoneModal(false);
              setTzQuery('');
            }}
          >
            <Pressable style={styles.tzModalBox} onPress={() => {}}>
              <View style={styles.tzHandle} />
              <Text style={[styles.modalTitle, headingFont]}>{t('settings.timezone_title')}</Text>
              <Text style={[styles.modalBody, { marginBottom: ms(12) }]}>
                {t('settings.timezone_desc')}
              </Text>
              <View style={styles.tzSearchBox}>
                <Ionicons name="search" size={16} color={C.textSecondary} />
                <TextInput
                  value={tzQuery}
                  onChangeText={setTzQuery}
                  placeholder={t('settings.timezone_search')}
                  placeholderTextColor={C.textDisabled}
                  style={styles.tzSearchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel={t('settings.timezone_search')}
                  accessibilityHint={t('settings.timezone_search_hint')}
                />
                {tzQuery.length > 0 && (
                  <Pressable
                    onPress={() => setTzQuery('')}
                    hitSlop={{ top: ms(14), bottom: ms(14), left: ms(14), right: ms(14) }}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('common.clear')}
                  >
                    <Ionicons name="close-circle" size={17} color={C.textTertiary} />
                  </Pressable>
                )}
              </View>
              <Text style={styles.tzCount}>
                {t('settings.timezone_matches', {
                  count: filteredTimezones.length,
                  total: TIMEZONES.length,
                })}
              </Text>
              <ScrollView
                style={styles.tzModalList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredTimezones.length === 0 ? (
                  <Text style={styles.tzEmpty}>{t('settings.timezone_none')}</Text>
                ) : (
                  filteredTimezones.map((tz, idx) => (
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
                  ))
                )}
              </ScrollView>
              <Pressable
                style={styles.modalBtnCancel}
                onPress={() => {
                  setShowTimezoneModal(false);
                  setTzQuery('');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.modalBtnCancelText}>{t('common.close')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Currency picker sheet */}
        <Modal
          visible={showCurrencyModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCurrencyModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCurrencyModal(false)}>
            <Pressable style={styles.tzModalBox} onPress={() => {}}>
              <View style={styles.tzHandle} />
              <Text style={[styles.modalTitle, headingFont]}>{t('settings.currency_pick')}</Text>
              <ScrollView style={styles.tzModalList} showsVerticalScrollIndicator={false}>
                {CURRENCIES.map((cur, idx) => {
                  const selected = cur.symbol === currency;
                  return (
                    <View key={cur.symbol}>
                      {idx > 0 && <View style={styles.rowDivider} />}
                      <Pressable
                        style={({ pressed }) => [
                          styles.tzOption,
                          pressed && styles.menuItemPressed,
                        ]}
                        onPress={() => {
                          setCurrency(cur.symbol);
                          setShowCurrencyModal(false);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                      >
                        <Text
                          style={[
                            styles.currencyGlyphLg,
                            { color: selected ? C.primary : C.textSecondary },
                          ]}
                        >
                          {cur.symbol}
                        </Text>
                        <View style={styles.menuText}>
                          <Text
                            style={[
                              styles.menuLabel,
                              selected && { color: C.primary, ...font.bold },
                            ]}
                          >
                            {cur.label.split('(')[0].trim()}
                          </Text>
                        </View>
                        {selected && <Ionicons name="checkmark" size={20} color={C.primary} />}
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
              <Pressable
                style={styles.modalBtnCancel}
                onPress={() => setShowCurrencyModal(false)}
                accessibilityRole="button"
              >
                <Text style={styles.modalBtnCancelText}>{t('common.done')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    backRow: { paddingHorizontal: sizes.lg, paddingTop: sizes.sm },
    scroll: { paddingHorizontal: sizes.lg, paddingBottom: ms(60) },
    heading: {
      fontSize: mf(28),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
      marginBottom: sizes.lg,
      marginTop: sizes.xs,
    },
    sectionLabel: {
      color: C.textSecondary,
      fontSize: mf(12),
      ...font.bold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: sizes.sm,
      marginTop: sizes.lg,
      marginStart: ms(4),
    },
    menuGroup: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      marginBottom: sizes.xs,
      borderWidth: 1,
      borderColor: C.borderLight,
      overflow: 'hidden',
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
    menuItemPressed: { backgroundColor: C.background },
    menuIcon: {
      width: ms(36),
      height: ms(36),
      borderRadius: sizes.borderRadiusSm,
      backgroundColor: C.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuIconDisabled: { opacity: 0.4 },
    menuText: { flex: 1 },
    menuLabel: { color: C.textPrimary, ...font.semibold, fontSize: mf(15) },
    menuLabelDisabled: { color: C.textSecondary },
    menuSub: { color: C.textSecondary, fontSize: mf(13), ...font.regular, marginTop: ms(1) },
    menuChevronDisabled: { opacity: 0 },
    menuRightText: { color: C.textSecondary, ...font.regular, fontSize: mf(14) },
    rowDivider: { height: ms(1), backgroundColor: C.border, marginStart: sizes.md + 36 + sizes.sm },
    footer: {
      color: C.textDisabled,
      fontSize: mf(13),
      ...font.regular,
      textAlign: 'center',
      marginTop: sizes.md,
    },
    currencyGlyphLg: {
      width: ms(30),
      textAlign: 'center',
      fontSize: mf(18),
      ...font.bold,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ms(24),
    },
    modalBox: {
      backgroundColor: C.surface,
      borderRadius: ms(20),
      padding: ms(24),
      width: '100%',
      maxWidth: ms(360),
      gap: ms(12),
      alignItems: 'center',
    },
    tzModalBox: {
      backgroundColor: C.surface,
      borderRadius: ms(24),
      padding: ms(22),
      paddingBottom: ms(16),
      width: '100%',
      maxWidth: ms(380),
      maxHeight: '82%',
      alignItems: 'stretch',
      gap: ms(8),
    },
    tzHandle: {
      width: ms(40),
      height: ms(4),
      borderRadius: ms(2),
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: ms(2),
    },
    tzSearchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(9),
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(12),
      borderWidth: 1.5,
      borderColor: C.border,
      paddingHorizontal: ms(13),
      paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    },
    tzSearchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: mf(15),
      ...font.medium,
      color: C.textPrimary,
      padding: 0,
    },
    tzCount: {
      fontSize: mf(11),
      ...font.bold,
      color: C.textTertiary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginTop: ms(4),
      marginBottom: ms(2),
    },
    tzEmpty: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingVertical: ms(24),
    },
    tzModalList: { flexGrow: 0 },
    tzOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(12),
      paddingHorizontal: ms(4),
      gap: sizes.sm,
    },
    modalIconWrap: {
      width: ms(56),
      height: ms(56),
      borderRadius: ms(28),
      backgroundColor: C.negative + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: ms(4),
    },
    modalTitle: { fontSize: mf(18), ...font.extrabold, color: C.textPrimary, textAlign: 'center' },
    modalBody: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: mf(20),
    },
    modalBtnDanger: {
      width: '100%',
      paddingVertical: ms(14),
      borderRadius: ms(12),
      backgroundColor: C.negative,
      alignItems: 'center',
      marginTop: ms(4),
    },
    modalBtnDangerText: { fontSize: mf(15), ...font.semibold, color: '#fff' },
    modalBtnPrimary: {
      width: '100%',
      paddingVertical: ms(14),
      borderRadius: ms(12),
      backgroundColor: C.primary,
      alignItems: 'center',
      marginTop: ms(4),
    },
    modalBtnPrimaryText: { fontSize: mf(15), ...font.semibold, color: '#fff' },
    modalBtnSecondary: {
      width: '100%',
      paddingVertical: ms(12),
      borderRadius: ms(12),
      borderWidth: 1.5,
      borderColor: C.primary,
      alignItems: 'center',
    },
    modalBtnSecondaryText: { fontSize: mf(15), ...font.semibold, color: C.primary },
    modalBtnCancel: {
      width: '100%',
      paddingVertical: ms(12),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
    },
    modalBtnCancelText: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    successorWrap: { width: '100%', gap: ms(8), marginTop: ms(4) },
    successorLabel: {
      fontSize: mf(13),
      ...font.semibold,
      color: C.textPrimary,
      textAlign: 'center',
    },
    successorHint: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: mf(19),
    },
    successorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      paddingVertical: ms(10),
      paddingHorizontal: sizes.md,
      borderRadius: ms(12),
      borderWidth: 1.5,
      borderColor: C.border,
    },
    successorRowActive: { borderColor: C.primary, backgroundColor: C.primary + '12' },
    successorAvatar: {
      width: ms(32),
      height: ms(32),
      borderRadius: ms(16),
      justifyContent: 'center',
      alignItems: 'center',
    },
    successorAvatarText: { color: '#fff', fontSize: mf(14), ...font.bold },
    successorName: { flex: 1, fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    successorRole: { fontSize: mf(12), ...font.regular, color: C.textSecondary },
  });
}
