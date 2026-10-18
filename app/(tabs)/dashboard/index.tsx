import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useThemedColors, darkColors } from '@constants/colors';
import { useTranslation } from 'react-i18next';
import { DadJokeCard } from '@components/shared/DadJokeCard';
import { DashboardErrorBanner } from '@components/dashboard/DashboardErrorBanner';
import { DashboardCarousel } from '@components/dashboard/DashboardCarousel';
import { HappeningNow } from '@components/dashboard/HappeningNow';
import { OwedHero } from '@components/dashboard/OwedHero';
import { PinnedNote } from '@components/dashboard/PinnedNote';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useBadgeStore } from '@stores/badgeStore';
import { useHouseActivity, useActionItems } from '@hooks/useHouseActivity';
import { ActivityPopup } from '@components/dashboard/ActivityPopup';
import { WelcomeTour } from '@components/dashboard/WelcomeTour';
import { NotificationPermissionPrompt } from '@components/shared/NotificationPermissionPrompt';
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

// ── Header ──────────────────────────────────────────────────────────────────
function Header(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
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
            accessibilityRole="header"
          >
            {greetingText(myName, t)}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.bell,
            { backgroundColor: c.surface, borderColor: isDark ? c.border : 'transparent' },
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

// ── Dashboard screen ────────────────────────────────────────────────────────────
export default function DashboardScreen(): React.JSX.Element {
  const c = useThemedColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

  // One-time welcome tour for users who just signed up.
  const [showTour, setShowTour] = useState(false);
  const [tourPending, setTourPending] = useState(true);
  useEffect(() => {
    let active = true;
    shouldShowTour().then((show) => {
      if (active && show) setShowTour(true);
      if (active) setTourPending(false);
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

  // One big thing first (money), then what's live, then the rest of the house.
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

        <Animated.View
          entering={animateEntrance ? FadeInDown.delay(60).duration(400) : undefined}
          style={styles.hero}
        >
          <OwedHero />
        </Animated.View>

        <Animated.View entering={animateEntrance ? FadeInDown.delay(100).duration(400) : undefined}>
          <HappeningNow />
        </Animated.View>

        <Animated.View entering={animateEntrance ? FadeInDown.delay(140).duration(400) : undefined}>
          <PinnedNote />
        </Animated.View>

        <Animated.View entering={animateEntrance ? FadeInDown.delay(200).duration(450) : undefined}>
          <DashboardCarousel />
        </Animated.View>

        <Animated.View entering={animateEntrance ? FadeInDown.delay(320).duration(450) : undefined}>
          <DadJokeCard animateEntrance={animateEntrance} />
        </Animated.View>
      </ScrollView>
      <WelcomeTour visible={showTour} onDone={handleTourDone} />
      <NotificationPermissionPrompt blocked={showTour || tourPending} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: sizes.bottomTabContentPadding,
  },
  scrollWide: { paddingHorizontal: ms(24), maxWidth: ms(640), width: '100%', alignSelf: 'center' },
  pressed: { opacity: 0.85 },
  hero: { marginTop: ms(18) },

  // ── Header
  header: { flexDirection: 'row', alignItems: 'center', gap: ms(12), paddingVertical: ms(8) },
  avatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: mf(18), ...font.bold, color: '#fff' },
  headerText: { flex: 1, minWidth: 0 },
  headerHouse: { fontSize: mf(13), ...font.medium },
  headerGreeting: { fontSize: mf(28), letterSpacing: -0.6, lineHeight: mf(34) },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: ms(-2),
    right: ms(-2),
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(3),
  },
  bellBadgeText: { fontSize: mf(10), ...font.bold, color: '#fff' },
});
