import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { navigateToBase } from '@stores/navigationStore';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import {
  useBillsStore,
  calculateAllNetBalances,
  calculateSimplifiedBalancesForUser,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useMemberName } from '@hooks/useMemberName';
import { useSettingsStore } from '@stores/settingsStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { DadJokeCard } from '@components/shared/DadJokeCard';
import { DashboardErrorBanner } from '@components/dashboard/DashboardErrorBanner';
import { DashboardCarousel } from '@components/dashboard/DashboardCarousel';
import { HappeningNow } from '@components/dashboard/HappeningNow';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useBadgeStore } from '@stores/badgeStore';
import { useHouseActivity, useActionItems } from '@hooks/useHouseActivity';
import { ActivityPopup } from '@components/dashboard/ActivityPopup';
import { WelcomeTour } from '@components/dashboard/WelcomeTour';
import { shouldShowTour, markTourSeen } from '@utils/tour';

import { mf, ms } from '@utils/responsive';
// The dashboard is the app's home base and, in a tabs navigator, can re-mount
// whenever it's returned to. Its staggered fade-in cascade (delays up to 380ms +
// ~450ms durations ≈ 0.8s) is a nice touch on the very first load, but replaying
// it every time you press Back to come home made returning feel slow ("lagging").
// This module-level flag plays the entrance once per app session; after that,
// home renders instantly.
let dashboardEntrancePlayed = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function greetingText(name: string, t: (key: string) => string): string {
  const h = new Date().getHours();
  const timeKey = h < 12 ? 'greeting_morning' : h < 18 ? 'greeting_afternoon' : 'greeting_evening';
  return `${t(`dashboard.${timeKey}`)}, ${name}`;
}

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
}

function timeAgo(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.just_now');
  if (mins < 60) return t('common.minutes_ago', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.hours_ago', { n: hours });
  return new Date(iso).toLocaleDateString(localeFor(lang), { month: 'short', day: 'numeric' });
}

// ── Header ──────────────────────────────────────────────────────────────────
function Header(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont();
  const profile = useAuthStore((s) => s.profile);
  const houseName = useHousematesStore((s) => s.houseName);
  const openProfile = useProfilePopupStore((s) => s.open);
  // The dashboard avatar sits on the leading edge, so anchor the menu there.
  const handleOpenProfile = useCallback((): void => openProfile('start'), [openProfile]);

  const activity = useHouseActivity();
  const actionItems = useActionItems();
  const lastSeenActivity = useBadgeStore((s) => s.lastSeen.activity);
  const markActivitySeen = useBadgeStore((s) => s.markSeen);
  const [showActivity, setShowActivity] = useState(false);
  const [seenBefore, setSeenBefore] = useState('');
  const myName = profile?.name ?? 'there';
  const myId = profile?.id ?? '';
  const initials = myName.charAt(0).toUpperCase();
  // Unread "news" clears when the bell is opened; action items (votes you owe,
  // parking requests awaiting you) persist in the badge until you act on them.
  const actionIds = useMemo(() => new Set(actionItems.map((a) => a.id)), [actionItems]);
  const unreadNews = activity.filter(
    (e) => e.createdAt > lastSeenActivity && e.actorId !== myId && !actionIds.has(e.id)
  ).length;
  const newActivity = actionItems.length + unreadNews;
  const openActivity = useCallback((): void => {
    setSeenBefore(lastSeenActivity);
    setShowActivity(true);
    markActivitySeen('activity').catch(() => {});
  }, [markActivitySeen, lastSeenActivity]);

  return (
    <>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.avatar,
            {
              backgroundColor: profile?.avatarUrl
                ? 'transparent'
                : (profile?.avatarColor ?? c.primary),
            },
            pressed && styles.pressed,
          ]}
          onPress={handleOpenProfile}
          hitSlop={{ top: ms(6), bottom: ms(6), left: ms(6), right: ms(6) }}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.open_profile')}
        >
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </Pressable>

        <View style={styles.headerText}>
          {houseName ? (
            <Text style={[styles.headerHouse, { color: c.textSecondary }]} numberOfLines={1}>
              {houseName}
            </Text>
          ) : null}
          <Text
            style={[styles.headerGreeting, headingFont, { color: c.textPrimary }]}
            numberOfLines={1}
          >
            {greetingText(myName, t)}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.bell,
            { backgroundColor: c.surface, borderColor: c.border },
            pressed && styles.pressed,
          ]}
          onPress={openActivity}
          hitSlop={{ top: ms(6), bottom: ms(6), left: ms(6), right: ms(6) }}
          accessibilityRole="button"
          accessibilityLabel={t('activity.title')}
        >
          <Ionicons name="notifications-outline" size={20} color={c.textPrimary} />
          {newActivity > 0 && (
            <View
              style={[styles.bellBadge, { backgroundColor: c.danger, borderColor: c.background }]}
            >
              <Text style={styles.bellBadgeText}>{newActivity > 9 ? '9+' : newActivity}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <ActivityPopup
        visible={showActivity}
        seenBefore={seenBefore}
        onClose={() => setShowActivity(false)}
      />
    </>
  );
}

// ── Pinned note (latest house announcement) ───────────────────────────────────
function PinnedNote(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const notes = useAnnouncementsStore((s) => s.items);
  const memberName = useMemberName();
  const latest = notes[0];

  if (!latest) return <></>;

  const author = memberName(latest.author).split(' ')[0];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.pinned,
        { backgroundColor: c.secondary },
        pressed && styles.pressed,
      ]}
      onPress={() => navigateToBase('/(tabs)/notes')}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.pinned_by', { name: author })}
    >
      <View style={styles.pinnedIcon}>
        <Ionicons name="megaphone-outline" size={16} color={c.secondaryForeground} />
      </View>
      <View style={styles.flex1}>
        <View style={styles.pinnedTop}>
          <Text style={[styles.pinnedLabel, { color: c.secondaryForeground }]} numberOfLines={1}>
            {t('dashboard.pinned_by', { name: author })}
          </Text>
          <Text style={[styles.pinnedAgo, { color: c.textSecondary }]}>
            {timeAgo(latest.createdAt, t, language)}
          </Text>
        </View>
        <Text style={[styles.pinnedText, { color: c.textPrimary }]} numberOfLines={3}>
          {latest.text}
        </Text>
      </View>
    </Pressable>
  );
}

// ── "You're owed" hero ────────────────────────────────────────────────────────
function OwedHero(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const bills = useBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const householdMembers = useHousematesStore((s) => s.housemates);
  const myId = profile?.id ?? '';

  const activeBills = bills.filter((b) => !b.settled);
  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(
    householdBills,
    payments,
    householdMembers.map((h) => h.id)
  )) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const balances = calculateSimplifiedBalancesForUser(combinedNet, myId);
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netAmount = totalOwed - totalOwe;
  const isOwed = netAmount >= 0;
  const peopleCount = balances.length;
  const settled = balances.length === 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.heroWrap, pressed && styles.pressed]}
      onPress={() => navigateToBase('/(tabs)/bills')}
      accessibilityRole="button"
      accessibilityLabel={
        settled
          ? t('dashboard.balance_all_settled')
          : t(isOwed ? 'dashboard.balance_owed_amount' : 'dashboard.balance_you_owe_amount', {
              amount: formatFull(Math.abs(netAmount), currencyCode),
            })
      }
    >
      <LinearGradient
        colors={c.owedGradient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[styles.hero, { shadowColor: c.owedShadow }]}
      >
        <View style={[styles.heroDeco, rtl ? styles.heroDecoLeft : styles.heroDecoRight]} />
        <View style={[styles.heroDecoSm, rtl ? styles.heroDecoSmLeft : styles.heroDecoSmRight]} />
        <View style={styles.heroHighlight} />

        {settled ? (
          <View style={styles.heroSettledRow}>
            <View>
              <Text style={styles.heroLabel}>{t('dashboard.balance_all_settled')}</Text>
              <Text style={styles.heroSub}>{t('dashboard.no_debts')}</Text>
            </View>
            <View style={styles.heroCheck}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.heroRow}>
            <View style={styles.flex1}>
              <Text style={styles.heroLabel}>
                {isOwed ? t('dashboard.balance_owed') : t('dashboard.balance_you_owe')}
              </Text>
              <Money
                amount={Math.abs(netAmount)}
                currencyCode={currencyCode}
                size={44}
                color="#fff"
                style={styles.heroAmtRow}
                animate
              />
              <Text style={styles.heroSub}>
                {peopleCount !== 1
                  ? t('dashboard.balance_across_plural', { count: peopleCount })
                  : t('dashboard.balance_across', { count: peopleCount })}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.heroAnalysisBtn, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/profile/spending')}
              accessibilityRole="button"
              accessibilityLabel={t('spending.view_spending')}
            >
              <Ionicons name="stats-chart-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ── Dashboard screen ────────────────────────────────────────────────────────────
export default function DashboardScreen(): React.JSX.Element {
  const c = useThemedColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

  // One-time welcome tour for users who just signed up.
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    let active = true;
    shouldShowTour().then((show) => {
      if (active && show) setShowTour(true);
    });
    return (): void => {
      active = false;
    };
  }, []);
  const handleTourDone = useCallback((): void => {
    setShowTour(false);
    markTourSeen();
  }, []);

  // Only animate the entrance the first time home is shown this session; later
  // returns render instantly so pressing Back to come home feels snappy.
  const [animateEntrance] = useState(() => !dashboardEntrancePlayed);
  useEffect(() => {
    dashboardEntrancePlayed = true;
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={animateEntrance ? FadeIn.duration(400) : undefined}>
          <Header />
        </Animated.View>

        <DashboardErrorBanner />

        <Animated.View entering={animateEntrance ? FadeInDown.delay(60).duration(400) : undefined}>
          <PinnedNote />
        </Animated.View>

        <Animated.View entering={animateEntrance ? FadeInDown.delay(100).duration(400) : undefined}>
          <HappeningNow />
        </Animated.View>

        <Animated.View
          entering={animateEntrance ? FadeInDown.delay(140).duration(450) : undefined}
          style={styles.block}
        >
          <OwedHero />
        </Animated.View>

        <Animated.View
          entering={animateEntrance ? FadeInDown.delay(200).duration(450) : undefined}
          style={styles.block}
        >
          <DashboardCarousel />
        </Animated.View>

        <Animated.View
          entering={animateEntrance ? FadeInDown.delay(320).duration(450) : undefined}
          style={styles.block}
        >
          <DadJokeCard animateEntrance={animateEntrance} />
        </Animated.View>
      </ScrollView>
      <WelcomeTour visible={showTour} onDone={handleTourDone} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: ms(18),
    paddingTop: ms(8),
    paddingBottom: sizes.bottomTabContentPadding,
  },
  scrollWide: { paddingHorizontal: ms(24), maxWidth: ms(640), width: '100%', alignSelf: 'center' },
  flex1: { flex: 1, minWidth: 0 },
  block: { marginTop: ms(14) },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  // ── Header
  header: { flexDirection: 'row', alignItems: 'center', gap: ms(11), paddingVertical: ms(8) },
  avatar: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: mf(17), ...font.bold, color: '#fff' },
  headerText: { flex: 1, minWidth: 0 },
  headerHouse: { fontSize: mf(12), ...font.medium },
  headerGreeting: { fontSize: mf(19), ...font.extrabold, letterSpacing: -0.5 },
  bell: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: ms(-2),
    right: ms(-2),
    minWidth: ms(17),
    height: ms(17),
    borderRadius: ms(9),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(3),
  },
  bellBadgeText: { fontSize: mf(10), ...font.bold, color: '#fff' },

  // ── Pinned note
  pinned: {
    marginTop: ms(14),
    flexDirection: 'row',
    gap: ms(11),
    borderRadius: ms(18),
    padding: ms(14),
  },
  pinnedIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(10),
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedTop: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginBottom: ms(4) },
  pinnedLabel: {
    flex: 1,
    fontSize: mf(10.5),
    ...font.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pinnedAgo: { fontSize: mf(11), ...font.regular },
  pinnedText: { fontSize: mf(13.5), ...font.medium, lineHeight: mf(20) },

  // ── Owed hero
  heroWrap: { borderRadius: ms(18) },
  hero: {
    borderRadius: ms(18),
    padding: ms(20),
    overflow: 'hidden',
    shadowOffset: { width: 0, height: ms(14) },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  // The decorative rings sit on the side opposite the amount. In RTL the amount
  // moves to the right, so the rings flip to the left to stay clear of it.
  heroDeco: {
    position: 'absolute',
    bottom: ms(-40),
    width: ms(150),
    height: ms(150),
    borderRadius: ms(75),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  heroDecoRight: { right: ms(-20) },
  heroDecoLeft: { left: ms(-20) },
  heroDecoSm: {
    position: 'absolute',
    bottom: ms(-8),
    width: ms(96),
    height: ms(96),
    borderRadius: ms(48),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroDecoSmRight: { right: ms(20) },
  heroDecoSmLeft: { left: ms(20) },
  // Hairline of light along the top edge — the "lit from above" cue that reads
  // as depth on the gradient.
  heroHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ms(1),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
  },
  heroAnalysisBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSettledRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCheck: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: mf(12.5), ...font.semibold, color: 'rgba(255,255,255,0.82)' },
  heroAmtRow: { marginTop: ms(6) },
  heroSub: {
    fontSize: mf(11.5),
    ...font.medium,
    color: 'rgba(255,255,255,0.74)',
    marginTop: ms(6),
  },

  // ── Grid row (parking + chores)
  gridRow: { flexDirection: 'row', gap: ms(12), marginTop: ms(14) },
  gridCol: { flex: 1 },

  // ── Parking tile
  parkTile: {
    flex: 1,
    minHeight: ms(118),
    borderRadius: ms(18),
    padding: ms(15),
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  parkHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ms(1),
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  parkTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parkChip: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkPill: { paddingHorizontal: ms(8), paddingVertical: ms(3), borderRadius: 9999 },
  parkPillText: { fontSize: mf(10.5), ...font.bold },
  parkLabel: {
    fontSize: mf(11),
    ...font.semibold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  parkStatus: {
    fontSize: mf(17),
    ...font.bold,
    color: '#fff',
    letterSpacing: -0.3,
    marginTop: ms(2),
  },
  parkSub: { fontSize: mf(11.5), color: 'rgba(255,255,255,0.62)', marginTop: ms(1) },

  // ── Chores tile
  choreTile: {
    flex: 1,
    minHeight: ms(118),
    borderRadius: ms(18),
    borderWidth: 1,
    padding: ms(15),
    justifyContent: 'space-between',
  },
  choreTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choreRingWrap: { width: ms(46), height: ms(46), alignItems: 'center', justifyContent: 'center' },
  choreRingLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choreRingPct: { fontSize: mf(11), ...font.extrabold },
  choreLabel: {
    fontSize: mf(11),
    ...font.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  choreNum: { fontSize: mf(22), ...font.extrabold, letterSpacing: -0.5 },
  choreDenom: { fontSize: mf(15), ...font.bold },
  choreSub: { fontSize: mf(11.5), ...font.regular, marginTop: ms(1) },

  // ── Generic card (grocery)
  card: { borderRadius: ms(18), borderWidth: 1, padding: ms(16) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: ms(9), marginBottom: ms(12) },
  cardIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: mf(14), ...font.bold },
  cardMetaRight: { marginLeft: 'auto', fontSize: mf(12), ...font.semibold },
  emptyText: { fontSize: mf(13), ...font.regular },
  groceryItems: { gap: ms(11) },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  groceryBox: {
    width: ms(18),
    height: ms(18),
    borderRadius: ms(6),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryName: { flex: 1, fontSize: mf(13.5), ...font.medium },
  groceryDone: { textDecorationLine: 'line-through' },
  groceryWho: { fontSize: mf(11), ...font.regular },
});
