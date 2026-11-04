import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { shouldShowTour, markTourSeen, shouldShowWhatsNew, markWhatsNewSeen } from '@utils/tour';

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
      const account = user
        ? {
            createdAt: user.created_at,
            metadata: user.user_metadata as Record<string, unknown> | undefined,
          }
        : null;
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
      markWhatsNewSeen();
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
