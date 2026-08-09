import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@lib/supabase';

export default function AuthLayout(): React.JSX.Element {
  // Keep the session's token auto-refresh tied to app focus while the user is in
  // the auth flow (e.g. mid password-reset). Without this the recovery session
  // can silently expire if the app is backgrounded, because the root layout's
  // AppState handler only kicks in once a house is loaded.
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state): void => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return (): void => {
      sub.remove();
      // Leave auto-refresh running for the authenticated app once we unmount
      // (unmount happens on navigation into the app, i.e. while foregrounded).
      supabase.auth.startAutoRefresh();
    };
  }, []);

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}
