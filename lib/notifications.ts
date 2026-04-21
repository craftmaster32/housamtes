import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';

// How notifications look when the app is in the foreground (native only)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request permission and register the device push token.
 * Saves the token to Supabase so Edge Functions can target this device.
 * Safe to call on every sign-in — uses upsert so no duplicates.
 */
export async function registerPushToken(userId: string, houseId: string): Promise<void> {
  try {
    // Push notifications only work on physical devices
    if (Platform.OS === 'web') return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return; // user declined — respect it silently

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;

    await supabase.from('push_tokens').upsert(
      { user_id: userId, house_id: houseId, token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,house_id' }
    );
  } catch (err) {
    // Non-fatal — app works fine without push
    captureError(err, { context: 'registerPushToken' });
  }
}

/**
 * Remove the push token when the user signs out so they stop
 * receiving notifications for a house they've left.
 */
export async function unregisterPushToken(userId: string, houseId: string): Promise<void> {
  try {
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('house_id', houseId);
  } catch (err) {
    captureError(err, { context: 'unregisterPushToken' });
  }
}
