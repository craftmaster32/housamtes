import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  PanResponder,
  AppState,
  InteractionManager,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { initErrorTracking } from '@lib/errorTracking';
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
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useEventsStore } from '@stores/eventsStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useVotingStore } from '@stores/votingStore';
import { useNotificationStore } from '@stores/notificationStore';
import { useConditionStore } from '@stores/conditionStore';
import { TopBar } from '@components/shared/TopBar';
import { MorePopup } from '@components/shared/MorePopup';
import { ProfilePopup } from '@components/shared/ProfilePopup';
import { BottomTabBar } from '@components/shared/BottomTabBar';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { darkColors } from '@constants/colors';
import { useColors } from '@hooks/useColors';
import { getInitialLanguage, setupI18n, isRTL as getIsRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import { useBadgeStore } from '@stores/badgeStore';
import { registerWebPush } from '@lib/webPush';

initErrorTracking();

export default function RootLayout(): React.JSX.Element | null {
  const c = useColors();
  const [i18nReady, setI18nReady] = useState(false);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const language = useLanguageStore((s) => s.language);

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
        tag.textContent = [
          'html[dir="rtl"] body, html[dir="rtl"] #root, html[dir="rtl"] #root > div { direction: rtl !important; }',
          'html[dir="rtl"] input, html[dir="rtl"] textarea, html[dir="rtl"] select { text-align: right; direction: rtl; }',
          // react-native-paper's Text component hardcodes textAlign: 'left' in its base
          // style, which silently overrides RNW's RTL-aware default for any Paper <Text>
          // that doesn't set its own textAlign. Patch it the same way upstream-library
          // RTL gaps are handled elsewhere in this block.
          'html[dir="rtl"] [dir="auto"] { text-align: right !important; }',
        ].join('\n');
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

  const loadHousemates = useHousematesStore((s) => s.load);
  const loadBills = useBillsStore((s) => s.load);
  const loadRecurringBills = useRecurringBillsStore((s) => s.load);
  const loadParking = useParkingStore((s) => s.load);
  const loadGrocery = useGroceryStore((s) => s.load);
  const loadChores = useChoresStore((s) => s.load);
  const loadEvents = useEventsStore((s) => s.load);
  const loadAnnouncements = useAnnouncementsStore((s) => s.load);
  const loadMaintenance = useMaintenanceStore((s) => s.load);
  const loadVoting = useVotingStore((s) => s.load);
  const loadCondition = useConditionStore((s) => s.load);
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

  useEffect(() => {
    if (!houseId) return;
    loadHousemates(houseId);
    loadBills(houseId);
    loadRecurringBills(houseId);

    const deferred = InteractionManager.runAfterInteractions(() => {
      loadParking(houseId);
      loadGrocery(houseId);
      loadChores(houseId);
      loadEvents(houseId);
      loadAnnouncements(houseId);
      loadMaintenance(houseId);
      loadVoting(houseId);
      loadCondition(houseId);
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
      useGroceryStore.getState().unsubscribe();
      useChoresStore.getState().unsubscribe();
      useEventsStore.getState().unsubscribe();
      useAnnouncementsStore.getState().unsubscribe();
      useMaintenanceStore.getState().unsubscribe();
      useVotingStore.getState().unsubscribe();
      useConditionStore.getState().unsubscribe();
    };
  }, [
    houseId,
    user,
    loadHousemates,
    loadBills,
    loadRecurringBills,
    loadParking,
    loadGrocery,
    loadChores,
    loadEvents,
    loadAnnouncements,
    loadMaintenance,
    loadVoting,
    loadCondition,
    loadNotificationPrefs,
  ]);

  // Re-fetch all data when app comes back to foreground — iOS drops the
  // WebSocket connection when backgrounded, so realtime misses updates.
  const foregroundDeferred = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);
  useEffect(() => {
    if (!houseId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadHousemates(houseId);
        loadBills(houseId);
        loadRecurringBills(houseId);
        foregroundDeferred.current?.cancel();
        foregroundDeferred.current = InteractionManager.runAfterInteractions(() => {
          loadParking(houseId);
          loadGrocery(houseId);
          loadChores(houseId);
          loadEvents(houseId);
          loadAnnouncements(houseId);
          loadMaintenance(houseId);
          loadVoting(houseId);
          loadCondition(houseId);
        });
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
    loadGrocery,
    loadChores,
    loadEvents,
    loadAnnouncements,
    loadMaintenance,
    loadVoting,
    loadCondition,
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
        if (dx > 70 && router.canGoBack()) {
          router.back();
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
              <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />
            </View>
            {showChrome && <BottomTabBar />}
            {showChrome && <MorePopup />}
            {showChrome && <ProfilePopup />}
            {(isLoading || !fontsLoaded) && (
              <View style={styles.splash}>
                <ActivityIndicator size="large" color={darkColors.primary} />
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
