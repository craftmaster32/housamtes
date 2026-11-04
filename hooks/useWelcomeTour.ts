import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import {
  shouldShowTour,
  markTourSeen,
  shouldShowWhatsNew,
  markWhatsNewSeen,
  WHATS_NEW_META_KEY,
  WHATS_NEW_VERSION,
  type WhatsNewAccount,
} from '@utils/tour';

interface WelcomeTour {
  showTour: boolean;
  /** True until we know whether a tour or "new look" note is coming — hold other pop-ups. */
  busy: boolean;
  handleTourDone: () => void;
}

/**
 * Home's first-visit pop-ups: the welcome tour for people who just signed up,
 * or — for people who used the app before 3.0 — a one-time "new look" note
 * offering the same tour. The note is remembered per account, not per device.
 */
export function useWelcomeTour(): WelcomeTour {
  const { t } = useTranslation();
  const [showTour, setShowTour] = useState(false);
  const [busy, setBusy] = useState(true);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    let active = true;
    // Block other pop-ups for every new check, including after userId changes.
    setBusy(true);
    (async (): Promise<void> => {
      if (await shouldShowTour()) {
        if (active) {
          setShowTour(true);
          setBusy(false);
        }
        return;
      }
      // Read the account at check time so a "seen" saved moments ago counts.
      const user = useAuthStore.getState().user;
      let account: WhatsNewAccount | null = user
        ? {
            id: user.id,
            createdAt: user.created_at,
            metadata: user.user_metadata as Record<string, unknown> | undefined,
          }
        : null;
      // If cached metadata does not already have the seen flag, fetch the live
      // user record so a dismissal on another device is respected.
      if (account && account.metadata?.[WHATS_NEW_META_KEY] !== WHATS_NEW_VERSION) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          account = {
            id: data.user.id,
            createdAt: data.user.created_at,
            metadata: data.user.user_metadata as Record<string, unknown> | undefined,
          };
        }
      }
      if (!(await shouldShowWhatsNew(account))) {
        if (active) setBusy(false);
        return;
      }
      // Left Home before the check finished: offer the note next visit instead.
      if (!active) return;
      Alert.alert(
        t('dashboard.whats_new_title'),
        t('dashboard.whats_new_body'),
        [
          {
            text: t('dashboard.whats_new_later'),
            style: 'cancel',
            onPress: (): void => setBusy(false),
          },
          { text: t('dashboard.whats_new_show'), onPress: (): void => setShowTour(true) },
        ],
        { onDismiss: (): void => setBusy(false) }
      );
      markWhatsNewSeen(account?.id);
    })();
    return (): void => {
      active = false;
    };
  }, [t, userId]);

  const handleTourDone = useCallback((): void => {
    setShowTour(false);
    setBusy(false);
    markTourSeen();
  }, []);

  return { showTour, busy, handleTourDone };
}
