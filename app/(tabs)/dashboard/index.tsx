import { useState, useCallback, useEffect } from 'react';
import { useScrollToTopOnNav } from '@hooks/useScrollToTopOnNav';
import { StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sizes } from '@constants/sizes';
import { useThemedColors } from '@constants/colors';
import { DadJokeCard } from '@components/shared/DadJokeCard';
import { DashboardErrorBanner } from '@components/dashboard/DashboardErrorBanner';
import { DashboardHeader } from '@components/dashboard/DashboardHeader';
import { PinnedNote } from '@components/dashboard/PinnedNote';
import { OwedCard } from '@components/dashboard/OwedCard';
import { DashboardCarousel } from '@components/dashboard/DashboardCarousel';
import { HappeningNow } from '@components/dashboard/HappeningNow';
import { WelcomeTour } from '@components/dashboard/WelcomeTour';
import { NotificationPermissionPrompt } from '@components/shared/NotificationPermissionPrompt';
import { shouldShowTour, markTourSeen } from '@utils/tour';

import { ms } from '@utils/responsive';
// The dashboard is the app's home base and, in a tabs navigator, can re-mount
// whenever it's returned to. Its staggered fade-in cascade (delays up to 380ms +
// ~450ms durations ≈ 0.8s) is a nice touch on the very first load, but replaying
// it every time you press Back to come home made returning feel slow ("lagging").
// This module-level flag plays the entrance once per app session; after that,
// home renders instantly.
let dashboardEntrancePlayed = false;

// ── Dashboard screen ────────────────────────────────────────────────────────────
export default function DashboardScreen(): React.JSX.Element {
  // Tapping your way here (even from this page) shows the top of the page.
  const scrollRef = useScrollToTopOnNav('dashboard/index');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={animateEntrance ? FadeIn.duration(400) : undefined}>
          <DashboardHeader />
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
          <OwedCard />
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
      <NotificationPermissionPrompt blocked={showTour || tourPending} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: ms(20),
    paddingTop: ms(8),
    paddingBottom: sizes.bottomTabContentPadding,
  },
  scrollWide: { paddingHorizontal: ms(24), maxWidth: ms(640), width: '100%', alignSelf: 'center' },
  block: { marginTop: ms(28) },
});
