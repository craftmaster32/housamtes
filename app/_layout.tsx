import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  AppState,
  InteractionManager,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { initErrorTracking } from '@lib/errorTracking';
import { RTL_WEB_FIX_CSS } from '@lib/rtlWebFix';
import { Stack, router, useSegments } from 'expo-router';
import { supabase } from '@lib/supabase';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useBillsStore } from '@stores/billsStore';
import { useRecurringBillsStore } from '@stores/recurringBillsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useAppliancesStore } from '@stores/appliancesStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useEventsStore } from '@stores/eventsStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useVotingStore } from '@stores/votingStore';
import { useNotificationStore } from '@stores/notificationStore';
import { useConditionStore } from '@stores/conditionStore';
import { useTasksStore } from '@stores/tasksStore';
import { TopBar } from '@components/shared/TopBar';
import { MorePopup } from '@components/shared/MorePopup';
import { ProfilePopup } from '@components/shared/ProfilePopup';
import { WebAlertHost } from '@components/shared/WebAlertHost';
import { BottomTabBar } from '@components/shared/BottomTabBar';
import { RouteTransition } from '@components/shared/RouteTransition';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { ChatFab } from '@components/shared/ChatFab';
import { AdBanner } from '@components/premium/AdBanner';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { darkColors } from '@constants/colors';
import { useColors } from '@hooks/useColors';
import { getInitialLanguage, setupI18n, isRTL as getIsRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import { useBadgeStore } from '@stores/badgeStore';
import { goBack } from '@stores/navigationStore';
import { registerWebPush } from '@lib/webPush';

initErrorTracking();

// On returning to the foreground, only re-fetch every store if the app was
// backgrounded at least this long — long enough that iOS may have dropped the
// realtime socket. Shorter absences keep their live connection, so a reload is
// wasted work.
const FOREGROUND_REFRESH_MS = 20_000;

// Web: opt out of browser auto-translation (Chrome/Safari). It mistranslates our
// labels ("Personal" → "Staff") and shatters the icon font into empty boxes.
// This runs at module load — earlier than any component render — because Expo's
// single web output ignores app/+html.tsx, so the meta tag has to be set here.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const html = document.documentElement;
  html.setAttribute('translate', 'no');
  html.classList.add('notranslate');
  if (!html.lang) html.lang = 'en';
  if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }

  // Note: sizing html/body/#root to the visible viewport is handled in the
  // static web template (web/index.html) — it measures the viewport in an inline
  // <head> script and publishes it as the --app-height CSS variable before this
  // bundle even loads, so the app fills the screen on the very first paint.
  // Injecting a competing height rule here would land after that template rule
  // in the <head> and override it, so it is intentionally not done.
}

export default function RootLayout(): React.JSX.Element | null {
  const c = useColors();
  const [i18nReady, setI18nReady] = useState(false);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const language = useLanguageStore((s) => s.language);

  // Web: paint the page canvas behind the app with the theme background.
  // The app root is sized `height: 100%`, which iOS Safari measures against the
  // viewport with its toolbars showing. Whenever the visual viewport is briefly
  // taller than that — the toolbar collapsing on scroll, a rubber-band
  // overscroll, the keyboard closing — the strip below the app is the browser's
  // own canvas, and an unpainted canvas defaults to white. That reads as a white
  // band under the page, glaring against the dark theme. Colouring html/body
  // (and declaring the scheme, so scrollbars and form controls follow) makes
  // that strip indistinguishable from the app.
  useEffect((): void => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const isDark = c === darkColors;
    document.documentElement.style.backgroundColor = c.background;
    document.body.style.backgroundColor = c.background;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [c]);

  const paperTheme = useMemo(() => {
    const isDark = c === darkColors;
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    const fontFamily =
      Platform.OS !== 'web' && language === 'he' ? 'Heebo_400Regular' : 'Inter_400Regular';
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.primary,
        secondary: c.primaryLight,
        background: c.background,
        surface: c.surface,
        onSurface: c.textPrimary,
        onBackground: c.textPrimary,
        onSurfaceVariant: c.textSecondary,
      },
      fonts: configureFonts({ config: { fontFamily } }),
    };
  }, [c, language]);

  useEffect(() => {
    getInitialLanguage().then((lang) => {
      setupI18n(lang);
      useLanguageStore.setState({ language: lang });
      setI18nReady(true);
    });
  }, [setLanguage]);

  // Keep the browser document in sync with the active language on web
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const dir = getIsRTL(language) ? 'rtl' : 'ltr';
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
      document.body.style.direction = dir;
      const root = document.getElementById('root');
      if (root) root.style.direction = dir;

      const STYLE_ID = 'rtl-web-fix';
      let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (dir === 'rtl') {
        if (!tag) {
          tag = document.createElement('style');
          tag.id = STYLE_ID;
          document.head.appendChild(tag);
        }
        tag.textContent = RTL_WEB_FIX_CSS;
      } else if (tag) {
        tag.remove();
      }
    }
  }, [language]);

  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Inter_400Regular: require('../assets/fonts/Inter_400Regular.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Inter_500Medium: require('../assets/fonts/Inter_500Medium.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Inter_800ExtraBold: require('../assets/fonts/Inter_800ExtraBold.ttf'),
    // Fraunces — display serif for headings (Latin only; Hebrew falls back to Heebo).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Fraunces_600SemiBold: require('../assets/fonts/Fraunces_600SemiBold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Fraunces_700Bold: require('../assets/fonts/Fraunces_700Bold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Heebo_400Regular: require('../assets/fonts/Heebo_400Regular.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Heebo_500Medium: require('../assets/fonts/Heebo_500Medium.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Heebo_600SemiBold: require('../assets/fonts/Heebo_600SemiBold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Heebo_700Bold: require('../assets/fonts/Heebo_700Bold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Heebo_800ExtraBold: require('../assets/fonts/Heebo_800ExtraBold.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ionicons: require('../assets/fonts/Ionicons.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'material-community': require('../assets/fonts/MaterialCommunityIcons.ttf'),
  });

  // On web, register Heebo as the Hebrew-script provider under Inter family names.
  // The browser uses unicode-range to pick Heebo for Hebrew glyphs automatically.
  useEffect(() => {
    if (Platform.OS !== 'web' || !fontsLoaded) return;

    const STYLE_ID = 'heebo-hebrew-range';
    if (document.getElementById(STYLE_ID)) return;

    const HEBREW_RANGE =
      'U+0590-05FF, U+FB1D-FB4F, U+200F, U+20AA, U+05BE, U+05C0-05C6, U+05F0-05F4';
    const WEIGHT_MAP: [string, string][] = [
      ['Inter_400Regular', 'Heebo_400Regular'],
      ['Inter_500Medium', 'Heebo_500Medium'],
      ['Inter_600SemiBold', 'Heebo_600SemiBold'],
      ['Inter_700Bold', 'Heebo_700Bold'],
      ['Inter_800ExtraBold', 'Heebo_800ExtraBold'],
    ];

    const expoStyle = document.getElementById('expo-generated-fonts') as HTMLStyleElement | null;
    const sheet = expoStyle?.sheet;
    if (!sheet) return;

    const heeboSrcs: Record<string, string> = {};
    for (let i = 0; i < sheet.cssRules.length; i++) {
      const rule = sheet.cssRules[i];
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue('font-family').replace(/"/g, '');
        if (family.startsWith('Heebo_')) {
          const srcMatch = rule.cssText.match(/src:\s*([^;]+)/);
          if (srcMatch) heeboSrcs[family] = srcMatch[1];
        }
      }
    }

    const css = WEIGHT_MAP.map(([interName, heeboName]) => {
      const src = heeboSrcs[heeboName];
      if (!src) return '';
      return `@font-face{font-family:"${interName}";src:${src};unicode-range:${HEBREW_RANGE};font-display:swap}`;
    })
      .filter(Boolean)
      .join('\n');

    if (css) {
      const tag = document.createElement('style');
      tag.id = STYLE_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }
  }, [fontsLoaded]);

  const initialize = useAuthStore((s) => s.initialize);
  const reloadMembership = useAuthStore((s) => s.reloadMembership);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);
  const needsTermsAcceptance = useAuthStore((s) => s.needsTermsAcceptance);
  // Guard: track whether auth has been stable (not loading) for at least one render
  // so we never redirect mid-initialization when houseId hasn't loaded yet
  const [authStable, setAuthStable] = useState(false);
  useEffect(() => {
    if (!isLoading && fontsLoaded) setAuthStable(true);
  }, [isLoading, fontsLoaded]);
  const segments = useSegments();
  const segArr = segments as string[];
  const segmentsKey = segArr[0] ?? '';
  const currentScreen = segArr[1] ?? '';

  // The swipe-back gesture lives at the root and is created once, so it reads
  // this ref rather than segmentsKey directly — it must only act inside the tabs,
  // never on auth/onboarding. Updated in a layout effect (after commit) so the
  // gesture never observes a route from a render that was thrown away.
  const inTabsRef = useRef(false);
  useLayoutEffect((): void => {
    inTabsRef.current = segmentsKey === '(tabs)';
  }, [segmentsKey]);

  const loadHousemates = useHousematesStore((s) => s.load);
  const loadBills = useBillsStore((s) => s.load);
  const loadRecurringBills = useRecurringBillsStore((s) => s.load);
  const loadParking = useParkingStore((s) => s.load);
  const loadAppliances = useAppliancesStore((s) => s.load);
  const loadGrocery = useGroceryStore((s) => s.load);
  const loadChores = useChoresStore((s) => s.load);
  const loadEvents = useEventsStore((s) => s.load);
  const loadAnnouncements = useAnnouncementsStore((s) => s.load);
  const loadMaintenance = useMaintenanceStore((s) => s.load);
  const loadVoting = useVotingStore((s) => s.load);
  const loadCondition = useConditionStore((s) => s.load);
  const loadTasks = useTasksStore((s) => s.load);
  const loadNotificationPrefs = useNotificationStore((s) => s.load);
  const loadBadges = useBadgeStore((s) => s.load);

  useEffect(() => {
    initialize();
    loadBadges();
  }, [initialize, loadBadges]);

  // Handle deep link auth callbacks (password reset, email confirmation)
  useEffect(() => {
    const handleUrl = async (url: string): Promise<void> => {
      // PKCE flow: token_hash in query params
      const parsed = Linking.parse(url);
      const params = parsed.queryParams ?? {};
      const tokenHash = params['token_hash'];
      if (typeof tokenHash === 'string' && params['type'] === 'recovery') {
        await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        return;
      }

      // Implicit flow: tokens in the hash fragment
      const hashPart = url.split('#')[1];
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') ?? '';
        if (accessToken && hashParams.get('type') === 'recovery') {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    };

    // App opened cold from deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // App already open and deep link arrives
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    return (): void => sub.remove();
  }, []);

  // Navigate based on auth state — only once auth is fully stable
  useEffect(() => {
    if (!authStable) return;

    // Never redirect away from these screens — they handle their own flow
    if (currentScreen === 'reset-password' || currentScreen === 'forgot-password') return;

    if (isPasswordRecovery) {
      router.replace('/(auth)/reset-password');
      return;
    }

    const inAuth = segmentsKey === '(auth)';
    const inOnboarding = segmentsKey === '(onboarding)';
    const inTabs = segmentsKey === '(tabs)';

    if (!user && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (user && needsTermsAcceptance) {
      router.replace('/(auth)/accept-terms');
    } else if (user && !houseId && !inOnboarding) {
      // Only redirect to house-setup if user genuinely has no house
      // (authStable ensures initialize() has already fetched from Supabase)
      router.replace('/(onboarding)/house-setup');
    } else if (user && houseId && !inTabs) {
      router.replace('/(tabs)/dashboard');
    }
  }, [
    user,
    houseId,
    authStable,
    segmentsKey,
    currentScreen,
    isPasswordRecovery,
    needsTermsAcceptance,
  ]);

  // Keep the current user's own role and permissions live. The housemates roster
  // already re-fetches on membership changes, but my own role/permissions were
  // only read at login — so a promotion, a revoked feature, or being removed from
  // the house wouldn't take effect until a restart. Re-read my membership whenever
  // any row in my house changes.
  useEffect((): void | (() => void) => {
    if (!houseId) return;
    const channel = supabase
      .channel(`my-membership:${houseId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'house_members', filter: `house_id=eq.${houseId}` },
        () => {
          reloadMembership();
        }
      )
      .subscribe();
    return (): void => {
      supabase.removeChannel(channel);
    };
  }, [houseId, reloadMembership]);

  useEffect(() => {
    if (!houseId) return;
    loadHousemates(houseId);
    loadBills(houseId);
    loadRecurringBills(houseId);

    const deferred = InteractionManager.runAfterInteractions(() => {
      loadParking(houseId);
      loadAppliances(houseId);
      loadGrocery(houseId);
      loadChores(houseId);
      loadEvents(houseId);
      loadAnnouncements(houseId);
      loadMaintenance(houseId);
      loadVoting(houseId);
      loadCondition(houseId);
      loadTasks(houseId);
      if (user?.id) {
        loadNotificationPrefs(user.id, houseId);
        registerWebPush(user.id, houseId);
      }
    });
    return (): void => {
      deferred.cancel();
      useHousematesStore.getState().unsubscribe();
      useBillsStore.getState().unsubscribe();
      useRecurringBillsStore.getState().unsubscribe();
      useParkingStore.getState().unsubscribe();
      useAppliancesStore.getState().unsubscribe();
      useGroceryStore.getState().unsubscribe();
      useChoresStore.getState().unsubscribe();
      useEventsStore.getState().unsubscribe();
      useAnnouncementsStore.getState().unsubscribe();
      useMaintenanceStore.getState().unsubscribe();
      useVotingStore.getState().unsubscribe();
      useConditionStore.getState().unsubscribe();
      useTasksStore.getState().unsubscribe();
    };
  }, [
    houseId,
    user,
    loadHousemates,
    loadBills,
    loadRecurringBills,
    loadParking,
    loadAppliances,
    loadGrocery,
    loadChores,
    loadEvents,
    loadAnnouncements,
    loadMaintenance,
    loadVoting,
    loadCondition,
    loadTasks,
    loadNotificationPrefs,
  ]);

  // Re-fetch all data when the app comes back to foreground — iOS drops the
  // WebSocket connection when backgrounded, so realtime misses updates. But a
  // quick app-switch (or a transient 'inactive' from the notification shade)
  // doesn't drop the socket, so re-fetching all ~13 stores every time is wasted
  // work that makes returning to the app feel slow. Only do the full refresh
  // once the app has actually been away longer than FOREGROUND_REFRESH_MS.
  const backgroundedAt = useRef<number | null>(null);
  const foregroundDeferred = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);
  useEffect(() => {
    if (!houseId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Skip the refresh for short absences — realtime stayed connected and
        // already has the latest data.
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (away !== null && Date.now() - away < FOREGROUND_REFRESH_MS) return;

        loadHousemates(houseId);
        loadBills(houseId);
        loadRecurringBills(houseId);
        foregroundDeferred.current?.cancel();
        foregroundDeferred.current = InteractionManager.runAfterInteractions(() => {
          loadParking(houseId);
          loadAppliances(houseId);
          loadGrocery(houseId);
          loadChores(houseId);
          loadEvents(houseId);
          loadAnnouncements(houseId);
          loadMaintenance(houseId);
          loadVoting(houseId);
          loadCondition(houseId);
          loadTasks(houseId);
        });
      } else if (backgroundedAt.current === null) {
        // Left the foreground ('background' or 'inactive') — stamp when.
        backgroundedAt.current = Date.now();
      }
    });
    return (): void => {
      foregroundDeferred.current?.cancel();
      sub.remove();
    };
  }, [
    houseId,
    loadHousemates,
    loadBills,
    loadRecurringBills,
    loadParking,
    loadAppliances,
    loadGrocery,
    loadChores,
    loadEvents,
    loadAnnouncements,
    loadMaintenance,
    loadVoting,
    loadCondition,
    loadTasks,
  ]);

  const showChrome = !!user && !!houseId && !needsTermsAcceptance;

  // Swipe-back gesture: zone starts from 22–70 px from left edge (distinct from drawer open zone at 0–22 px)
  const backSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, { dx, dy }) => {
        const startX = evt.nativeEvent.pageX - dx;
        return startX > 22 && startX < 70 && dx > 20 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, { dx }) => {
        // Only inside the tabs — never hijack an auth/onboarding swipe.
        if (inTabsRef.current && dx > 70) {
          goBack();
        }
      },
    })
  ).current;

  const rootDirection = getIsRTL(language) ? 'rtl' : ('ltr' as const);

  // Block render until i18n is initialised — avoids untranslated flash
  if (!i18nReady) return null;

  // Stack must always render — navigation happens via useEffect above
  return (
    <GestureHandlerRootView
      style={[styles.gestureRoot, { backgroundColor: c.background, direction: rootDirection }]}
    >
      <PaperProvider theme={paperTheme}>
        <StatusBar style="light" />
        <ErrorBoundary>
          <View
            style={[styles.root, { backgroundColor: c.background, direction: rootDirection }]}
            {...backSwipe.panHandlers}
          >
            {showChrome && <TopBar />}
            <View style={styles.content}>
              <RouteTransition>
                <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />
              </RouteTransition>
            </View>
            {showChrome && <AdBanner />}
            {showChrome && <ChatFab />}
            {showChrome && <BottomTabBar />}
            {showChrome && <MorePopup />}
            {showChrome && <ProfilePopup />}
            <WebAlertHost />
            {(isLoading || !fontsLoaded) && (
              <View style={styles.splash}>
                <LoadingSpinner size={140} color={darkColors.primary} />
              </View>
            )}
          </View>
        </ErrorBoundary>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  root: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, minHeight: 0 },
  splash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkColors.background,
  },
});
