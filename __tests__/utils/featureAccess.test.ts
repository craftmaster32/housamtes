import { hasFeatureAccess } from '@utils/featureAccess';
// Type-only import so this test never pulls the authStore (and its Supabase
// client) into the runtime — the util is pure and needs no environment.
import type { MemberPermissions } from '@stores/authStore';

const ALL_TRUE: MemberPermissions = {
  bills: true,
  grocery: true,
  parking: true,
  chores: true,
  chat: true,
  photos: true,
  voting: true,
  maintenance: true,
  condition: true,
};

const enabled = (keys: string[]): { key: string; enabled: boolean }[] =>
  keys.map((key) => ({ key, enabled: true }));

describe('hasFeatureAccess', () => {
  it('allows a feature that has no house switch and no revoked permission', () => {
    // bills is never in the settings feature list, so it is always-on house-wide.
    expect(hasFeatureAccess('bills', [], ALL_TRUE)).toBe(true);
  });

  it('hides a feature the house has switched off', () => {
    expect(hasFeatureAccess('parking', [{ key: 'parking', enabled: false }], ALL_TRUE)).toBe(false);
  });

  it("hides a feature the member's permission revokes", () => {
    expect(hasFeatureAccess('bills', [], { ...ALL_TRUE, bills: false })).toBe(false);
  });

  it('requires both the house switch on and the permission granted', () => {
    expect(hasFeatureAccess('grocery', enabled(['grocery']), ALL_TRUE)).toBe(true);
    expect(hasFeatureAccess('grocery', enabled(['grocery']), { ...ALL_TRUE, grocery: false })).toBe(
      false
    );
  });

  it('denies a tracked feature while permissions are unavailable', () => {
    // Mid-refresh (or before load) a tracked feature must not leak — deny until
    // a permission record is present.
    expect(hasFeatureAccess('chores', enabled(['chores']), null)).toBe(false);
    expect(hasFeatureAccess('chores', enabled(['chores']), undefined)).toBe(false);
  });

  it('ignores keys that are not tracked permissions', () => {
    // Structural routes stay reachable even with no permission record.
    expect(hasFeatureAccess('dashboard', [], ALL_TRUE)).toBe(true);
    expect(hasFeatureAccess('dashboard', [], null)).toBe(true);
    expect(hasFeatureAccess('more', [], undefined)).toBe(true);
  });
});
