import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import {
  enableWebPush,
  getWebPushStatus,
  hasActiveWebPushSubscription,
  unregisterWebPush,
  type WebPushStatus,
} from '@lib/webPush';
import { useAuthStore } from '@stores/authStore';

interface UseWebPushToggleResult {
  webPushOn: boolean;
  webPushStatus: WebPushStatus;
  handleToggleWebPush: (next: boolean) => Promise<void>;
}

/**
 * Encapsulates all browser-push subscription orchestration: initial state
 * lookup, enable, and disable flows. Uses a generation counter to prevent a
 * slow initial lookup from overwriting a toggle that completed afterward.
 */
export function useWebPushToggle(): UseWebPushToggleResult {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);

  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>('unavailable');
  const [webPushOn, setWebPushOn] = useState(false);
  // Monotonically-increasing counter. The initial async lookup captures its
  // generation; the toggle handler increments it to invalidate pending lookups.
  const lookupGen = useRef(0);

  useEffect((): void => {
    if (Platform.OS !== 'web') return;
    setWebPushStatus(getWebPushStatus());
    const gen = ++lookupGen.current;
    hasActiveWebPushSubscription(user?.id, houseId ?? undefined)
      .then((active): void => {
        if (lookupGen.current === gen) setWebPushOn(active);
      })
      .catch((): void => {
        if (lookupGen.current === gen) setWebPushOn(false);
      });
  }, [user?.id, houseId]);

  const handleToggleWebPush = useCallback(
    async (next: boolean): Promise<void> => {
      if (!user?.id || !houseId) return;
      // Invalidate any in-flight initial lookup so its result cannot overwrite
      // the definitive state set by this toggle operation.
      lookupGen.current++;
      if (next) {
        try {
          const result = await enableWebPush(user.id, houseId);
          setWebPushStatus(result);
          if (result === 'granted') {
            setWebPushOn(true);
          } else if (result === 'denied') {
            setWebPushOn(false);
            Alert.alert(
              t('settings.notifications_blocked_title'),
              t('settings.notifications_blocked_body')
            );
          } else {
            // 'default' (prompt dismissed) or 'unavailable' — nothing enabled.
            setWebPushOn(false);
          }
        } catch {
          setWebPushOn(false);
          Alert.alert(t('common.error'), t('settings.notifications_enable_failed'));
        }
      } else {
        await unregisterWebPush(user.id, houseId);
        // Read the confirmed subscription state so the toggle reflects reality,
        // even if the server-side delete failed while the browser unsubscribed.
        const isStillOn = await hasActiveWebPushSubscription(user.id, houseId);
        setWebPushOn(isStillOn);
      }
    },
    [user?.id, houseId, t]
  );

  return { webPushOn, webPushStatus, handleToggleWebPush };
}
