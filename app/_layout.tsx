import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, PanResponder } from 'react-native';
import * as Linking from 'expo-linking';
import { initErrorTracking } from '@lib/errorTracking';
import { Stack, router, useSegments } from 'expo-router';
import { supabase } from '@lib/supabase';
import { PaperProvider, MD3LightTheme, configureFonts } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
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
import { DrawerMenu } from '@components/shared/DrawerMenu';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { colors } from '@constants/colors';
import { getInitialLanguage, setupI18n, isRTL as getIsRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';

const fontConfig = { fontFamily: 'Inter_400Regular' };

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.primaryLight,
    background: colors.background,
    surface: colors.surface,
  },
  fonts: configureFonts({ config: fontConfig }),
};

initErrorTracking();

export default function RootLayout(): React.JSX.Element | null {
  const [i18nReady, setI18nReady] = useState(false);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const language = useLanguageStore((s) => s.language);

  useEffect(() => {
    getInitialLanguage().then((lang) => {
      setupI18n(lang);
      // Sync the store so the language picker shows the right selection
      useLanguageStore.setState({ language: lang });
      setI18nReady(true);
    });
  }, [setLanguage]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);
  const segments = useSegments();
  const segmentsKey = segments[0] ?? '';
  const currentScreen = segments[1] ?? '';

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

  useEffect(() => {
    initialize();
  }, [initialize]);

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
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    };

    // App opened cold from deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // App already open and deep link arrives
    const sub = Linking.addEventListener('url', ({ url }) => { handleUrl(url); });
    return () => sub.remove();
  }, []);

  // Navigate based on auth state — only when loading is done and fonts are ready
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    // Never redirect away from the reset-password screen — it handles itself
    if (currentScreen === 'reset-password') return;

    if (isPasswordRecovery) {
      router.replace('/(auth)/reset-password');
      return;
    }

    const inAuth = segmentsKey === '(auth)';
    const inOnboarding = segmentsKey === '(onboarding)';
    const inTabs = segmentsKey === '(tabs)';

    if (!user && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (user && !houseId && !inOnboarding) {
      router.replace('/(onboarding)/house-setup');
    } else if (user && houseId && !inTabs) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, houseId, isLoading, fontsLoaded, segmentsKey, currentScreen, isPasswordRecovery]);

  useEffect(() => {
    if (!houseId) return;
    if (user?.id) loadNotificationPrefs(user.id, houseId);
    loadHousemates(houseId);
    loadBills(houseId);
    loadRecurringBills(houseId);
    loadParking(houseId);
    loadGrocery(houseId);
    loadChores(houseId);
    loadEvents(houseId);
    loadAnnouncements(houseId);
    loadMaintenance(houseId);
    loadVoting(houseId);
    loadCondition(houseId);
    return () => {
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
    loadHousemates, loadBills, loadRecurringBills, loadParking, loadGrocery,
    loadChores, loadEvents, loadAnnouncements, loadMaintenance,
    loadVoting, loadCondition,
  ]);

  const showChrome = !!user && !!houseId;

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

  // Block render until i18n is initialised — avoids untranslated flash
  if (!i18nReady) return null;

  // Stack must always render — navigation happens via useEffect above
  return (
    <PaperProvider theme={theme}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <View style={[styles.root, { direction: getIsRTL(language) ? 'rtl' : 'ltr' }]} {...backSwipe.panHandlers}>
          {showChrome && <TopBar />}
          <View style={styles.content}>
            <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />
          </View>
          {showChrome && <DrawerMenu />}
          {(isLoading || !fontsLoaded) && (
            <View style={styles.splash}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>
      </ErrorBoundary>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  splash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
