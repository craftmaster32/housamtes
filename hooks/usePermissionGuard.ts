import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import type { MemberPermissions } from '@stores/authStore';

/**
 * Call at the top of any feature screen.
 * Redirects to dashboard if:
 *   - the house-level feature flag is disabled, OR
 *   - the user's personal permission for this feature is false
 */
export function usePermissionGuard(featureKey: keyof MemberPermissions): void {
  const permissions = useAuthStore((s) => s.permissions);
  const features = useSettingsStore((s) => s.features);

  useEffect(() => {
    const houseEnabled = features.find((f) => f.key === featureKey)?.enabled ?? true;
    const userAllowed = permissions[featureKey] ?? true;

    if (!houseEnabled || !userAllowed) {
      router.replace('/(tabs)/dashboard');
    }
  }, [featureKey, permissions, features]);
}
