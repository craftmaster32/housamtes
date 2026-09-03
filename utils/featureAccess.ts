import type { MemberPermissions } from '@stores/authStore';

interface FeatureToggle {
  key: string;
  enabled: boolean;
}

/**
 * Single source of truth for "may this person use this feature right now?".
 *
 * Two layers decide access, both of which must pass:
 *   1. The house-wide feature switch (settingsStore). A feature with no switch
 *      — e.g. bills — is treated as always on.
 *   2. The member's own per-feature permission (house_members.permissions),
 *      which an owner/admin can revoke on the Members screen.
 *
 * Used by the bottom tab bar, the More menu, and the per-screen guard so the
 * rule can never drift between them.
 */
export function hasFeatureAccess(
  key: string,
  features: FeatureToggle[],
  permissions: MemberPermissions | null | undefined
): boolean {
  // House-wide switch: hide only when the feature exists and is turned off.
  const feature = features.find((f) => f.key === key);
  if (feature && !feature.enabled) return false;

  // Per-member permission: hide only when it is explicitly revoked.
  if (permissions && key in permissions) {
    return permissions[key as keyof MemberPermissions] !== false;
  }

  return true;
}
