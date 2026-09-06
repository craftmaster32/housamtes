import type { MemberPermissions } from '@stores/authStore';

interface FeatureToggle {
  key: string;
  enabled: boolean;
}

// The keys that are gated by a per-member permission (mirrors MemberPermissions).
// Kept as a plain list so this util stays pure and never pulls the authStore —
// and its Supabase client — into places that only need the access rule.
const TRACKED_PERMISSION_KEYS: readonly string[] = [
  'bills',
  'grocery',
  'parking',
  'chores',
  'chat',
  'photos',
  'voting',
  'maintenance',
  'condition',
];

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
 *
 * Structural routes (Dashboard, More, …) are not tracked permissions, so they
 * are never gated here.
 */
export function hasFeatureAccess(
  key: string,
  features: FeatureToggle[],
  permissions: MemberPermissions | null | undefined
): boolean {
  // House-wide switch: hide only when the feature exists and is turned off.
  const feature = features.find((f) => f.key === key);
  if (feature && !feature.enabled) return false;

  // Per-member permission gate — only for tracked features.
  if (TRACKED_PERMISSION_KEYS.includes(key)) {
    // No permission record yet (e.g. mid-refresh): deny rather than briefly
    // expose a feature the member may not be allowed, including via a direct
    // web URL.
    if (!permissions) return false;
    return permissions[key as keyof MemberPermissions] !== false;
  }

  // Untracked / structural routes are always allowed.
  return true;
}
