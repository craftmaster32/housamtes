import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@components/shared/BackLink';
import { DotLeader } from '@components/shared/DotLeader';
import { SettingsLine } from '@components/settings/SettingsLine';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { HouseKeyTag } from '@components/settings/HouseKeyTag';
import { LeaveHouseModal } from '@components/settings/LeaveHouseModal';
import { SettleFirstModal } from '@components/settings/SettleFirstModal';
import { TimezoneSheet } from '@components/settings/TimezoneSheet';
import { CurrencySheet } from '@components/settings/CurrencySheet';
import { TIMEZONES } from '@components/settings/timezones';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore, CURRENCIES, type ThemeMode } from '@stores/settingsStore';
import { useLanguageStore } from '@stores/languageStore';
import type { AppLanguage } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useLeaveHouse } from '@hooks/useLeaveHouse';
import { mf, ms } from '@utils/responsive';
import { asWord } from '@utils/asWord';

const THEMES: ThemeMode[] = ['light', 'dark', 'system'];
const LANGUAGES: AppLanguage[] = ['en', 'he', 'es'];

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  // Settings is reached either as a main section (home avatar menu / More list)
  // or as a page of Profile (from=profile). Back follows the same split — Home
  // in the first case, Profile in the second — and the label names whichever it
  // actually is.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const housemates = useHousematesStore((s) => s.housemates);
  const houseTimezone = useHousematesStore((s) => s.timezone);
  const updateTimezone = useHousematesStore((s) => s.updateTimezone);
  const houseId = useAuthStore((s) => s.houseId);
  const myRole = useAuthStore((s) => s.role);

  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const leave = useLeaveHouse();
  const [showTimezone, setShowTimezone] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  const themeWords = useMemo<ChoiceWord<ThemeMode>[]>(
    () => THEMES.map((m) => ({ value: m, label: t(`settings.theme_${m}`) })),
    [t]
  );
  const languageWords = useMemo<ChoiceWord<AppLanguage>[]>(
    () => LANGUAGES.map((l) => ({ value: l, label: t(`settings.language_${l}`) })),
    [t]
  );

  const currencyName =
    CURRENCIES.find((cur) => cur.symbol === currency)
      ?.label.split('(')[0]
      .trim() ?? currency;
  const timezoneLabel = TIMEZONES.find((tz) => tz.id === houseTimezone)?.label ?? houseTimezone;
  const isOwner = myRole === 'owner';
  const canManageHouse = isOwner || myRole === 'admin';

  const handleTheme = useCallback(
    (mode: ThemeMode): void => {
      setThemeMode(mode);
      Haptics.selectionAsync().catch(() => {});
    },
    [setThemeMode]
  );

  const handleLanguage = useCallback(
    (lang: AppLanguage): void => {
      setLanguage(lang).catch(() => {});
    },
    [setLanguage]
  );

  const handleTimezoneSelect = useCallback(
    async (tz: string): Promise<void> => {
      if (!houseId) return;
      setSavingTimezone(true);
      try {
        await updateTimezone(houseId, tz);
        setShowTimezone(false);
      } catch {
        Alert.alert(t('common.error'), t('settings.could_not_update_timezone'));
      } finally {
        setSavingTimezone(false);
      }
    },
    [houseId, updateTimezone, t]
  );

  const handleCurrency = useCallback(
    (symbol: string): void => {
      setCurrency(symbol);
      setShowCurrency(false);
    },
    [setCurrency]
  );

  const handleShareCode = useCallback((): void => {
    Alert.alert(t('settings.invite_code'), t('profile.share_code'), [{ text: t('common.close') }], {
      code: inviteCode ?? undefined,
    });
  }, [inviteCode, t]);

  const openHousemates = useCallback((): void => router.push('/(tabs)/bills/setup'), []);
  const memberIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  const card = [styles.card, { backgroundColor: c.surface }];
  const section = [styles.section, heading, { color: c.textPrimary }];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.backRow}>
        <BackLink label={from === 'profile' ? t('nav.profile') : t('common.home')} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, heading, { color: c.textPrimary }]} accessibilityRole="header">
          {t('settings.title')}
        </Text>

        <Text style={section} accessibilityRole="header">
          {asWord(t('settings.general_section'))}
        </Text>
        <View style={card}>
          <SettingsLine
            label={t('settings.menu_notifications')}
            onPress={() => router.push('/(tabs)/settings/notifications')}
          />
          <SettingsLine
            label={t('settings.menu_appearance')}
            right={
              <ChoiceWords
                options={themeWords}
                selected={themeMode}
                onSelect={handleTheme}
                groupLabel={t('settings.menu_appearance')}
              />
            }
          />
          <SettingsLine
            label={t('settings.menu_language')}
            right={
              <ChoiceWords
                options={languageWords}
                selected={language}
                onSelect={handleLanguage}
                groupLabel={t('settings.menu_language')}
              />
            }
          />
          <SettingsLine
            label={t('settings.menu_calendar')}
            onPress={() => router.push('/(tabs)/settings/calendar')}
          />
          <SettingsLine
            label={t('settings.menu_currency')}
            value={`${currency} ${currencyName}`}
            onPress={() => setShowCurrency(true)}
            last
          />
        </View>

        <Text style={section} accessibilityRole="header">
          {asWord(t('settings.house_section'))}
        </Text>
        <HouseKeyTag
          houseName={houseName}
          memberIds={memberIds}
          inviteCode={inviteCode}
          onOpenHousemates={openHousemates}
          onShareCode={handleShareCode}
        />
        <View style={card}>
          <SettingsLine
            label={t('settings.timezone')}
            sub={isOwner ? t('settings.timezone_tap') : t('settings.timezone_owner_only')}
            value={timezoneLabel}
            onPress={() => setShowTimezone(true)}
            disabled={!isOwner}
            last={!canManageHouse}
          />
          {canManageHouse && (
            <>
              <SettingsLine
                label={t('settings.expense_categories')}
                sub={t('settings.expense_categories_sub')}
                onPress={() => router.push('/(tabs)/settings/categories')}
              />
              <SettingsLine
                label={t('settings.member_permissions')}
                sub={t('settings.member_permissions_sub')}
                onPress={() => router.push('/(tabs)/settings/members')}
                last
              />
            </>
          )}
        </View>

        <Pressable
          onPress={leave.startLeave}
          style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('settings.leave_house')}
          accessibilityHint={
            houseName
              ? t('settings.leave_house_desc', { name: houseName })
              : t('settings.leave_house_desc_default')
          }
        >
          <Text style={[styles.leaveText, { color: c.negative }]}>{t('settings.leave_house')}</Text>
          <Text style={[styles.leaveSub, { color: c.textSecondary }]}>
            {houseName
              ? t('settings.leave_house_desc', { name: houseName })
              : t('settings.leave_house_desc_default')}
          </Text>
        </Pressable>

        <View style={styles.rule}>
          <DotLeader color={c.textTertiary} />
        </View>
        <View style={styles.smallPrint}>
          <Text style={[styles.version, { color: c.textSecondary }]}>
            {t('settings.version')} 1.0.0
          </Text>
          <View style={styles.links}>
            <Pressable
              onPress={() => router.push('/(tabs)/settings/terms')}
              style={styles.link}
              accessible
              accessibilityRole="link"
              accessibilityLabel={t('settings.terms')}
              accessibilityHint={t('settings.terms_sub')}
            >
              <Text style={[styles.linkText, { color: c.primary }]}>{t('settings.terms')}</Text>
            </Pressable>
            <Text style={{ color: c.textTertiary }}>·</Text>
            <Pressable
              onPress={() => router.push('/(tabs)/settings/privacy-policy')}
              style={styles.link}
              accessible
              accessibilityRole="link"
              accessibilityLabel={t('settings.privacy')}
              accessibilityHint={t('settings.privacy_sub')}
            >
              <Text style={[styles.linkText, { color: c.primary }]}>{t('settings.privacy')}</Text>
            </Pressable>
          </View>
          <Text style={[styles.footer, hand, { color: c.textPrimary }]}>
            {t('settings.footer')}
          </Text>
        </View>
      </ScrollView>

      <LeaveHouseModal
        visible={leave.showLeaveConfirm}
        onClose={leave.closeLeave}
        houseName={houseName}
        mustPickSuccessor={leave.mustPickSuccessor}
        successors={leave.successors}
        successorId={leave.successorId}
        onPickSuccessor={leave.setSuccessorId}
        leaving={leave.leaving}
        onConfirm={leave.confirmLeave}
      />
      <SettleFirstModal
        visible={leave.showDebtModal}
        onClose={leave.closeDebt}
        amount={leave.debtLabel}
        requestingVote={leave.requestingVote}
        onSettleUp={leave.settleUp}
        onRequestVote={leave.requestLeaveVote}
      />
      <TimezoneSheet
        visible={showTimezone}
        onClose={() => setShowTimezone(false)}
        current={houseTimezone}
        saving={savingTimezone}
        onSelect={handleTimezoneSelect}
      />
      <CurrencySheet
        visible={showCurrency}
        onClose={() => setShowCurrency(false)}
        current={currency}
        onSelect={handleCurrency}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backRow: { paddingHorizontal: ms(20), paddingTop: ms(8) },
  scroll: { paddingHorizontal: ms(20), paddingBottom: ms(110) },
  title: {
    fontSize: mf(36),
    // Tall enough for the descenders, so no letter is clipped.
    lineHeight: mf(46),
    paddingBottom: ms(2),
    letterSpacing: -0.5,
    marginTop: ms(4),
  },
  section: { fontSize: mf(22), lineHeight: mf(29), marginTop: ms(26), marginBottom: ms(10) },
  card: { borderRadius: ms(22), paddingHorizontal: ms(18), paddingVertical: ms(2) },
  leave: { paddingTop: ms(18), paddingHorizontal: ms(4), minHeight: 44 },
  leaveText: { fontSize: mf(16), ...font.semibold },
  leaveSub: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  rule: { flexDirection: 'row', marginTop: ms(24) },
  smallPrint: {
    paddingTop: ms(8),
    alignItems: 'center',
    gap: ms(2),
  },
  version: { fontSize: mf(13.5), ...font.regular },
  links: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(4) },
  linkText: { fontSize: mf(13.5), ...font.medium },
  footer: { fontSize: mf(21), marginTop: ms(4) },
  pressed: { opacity: 0.6 },
});
