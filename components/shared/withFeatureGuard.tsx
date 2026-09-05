import React from 'react';
import { useFeatureGuard } from '@hooks/useFeatureGuard';

/**
 * Wrap a feature screen so its body only mounts when the current member is
 * allowed the feature.
 *
 * `useFeatureGuard` redirects a denied member to the dashboard, but that
 * redirect runs in an effect — after the first render. If the screen body were
 * rendered anyway it would paint protected data for a frame and, worse, run its
 * own effects (loading bills, starting a shopping run) before the redirect
 * lands, especially on a web deep-link or back-navigation. Rendering nothing
 * until access is confirmed keeps those effects from ever mounting.
 */
export function withFeatureGuard(key: string, Screen: React.ComponentType): React.FC {
  const Guarded: React.FC = () => {
    const allowed = useFeatureGuard(key);
    if (!allowed) return null;
    return <Screen />;
  };
  Guarded.displayName = `withFeatureGuard(${key})`;
  return Guarded;
}
