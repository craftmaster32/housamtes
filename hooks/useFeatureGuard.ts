import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { hasFeatureAccess } from '@utils/featureAccess';

/**
 * Screen-level access guard for a permission-gated feature.
 *
 * Hiding a feature in the menu is not enough — on web every screen is a URL,
 * and back-navigation can land on it too. Any feature screen calls this with
 * its permission key; if the current member is not allowed the feature (house
 * switch off, or their permission revoked), they are bounced to the dashboard.
 *
 * Returns whether access is allowed so the screen can also render nothing while
 * the redirect happens.
 */
export function useFeatureGuard(key: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const features = useSettingsStore((s) => s.features);
  const allowed = hasFeatureAccess(key, features, permissions);

  useEffect((): void => {
    if (!allowed) router.replace('/(tabs)/dashboard');
  }, [allowed]);

  return allowed;
}
