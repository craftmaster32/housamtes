import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Owner: he should turn up on about 3 visits in 6 — on every page that has him.
const SHOW_CHANCE = 0.5;

function pick<T extends string>(spots: readonly T[]): T | null {
  return spots.length > 0 && Math.random() < SHOW_CHANCE
    ? spots[Math.floor(Math.random() * spots.length)]
    : null;
}

/**
 * Picks where Mate hides on this visit to a page — one of the page's spots, or
 * nowhere. The app keeps pages open in the background, so the pick is made
 * again every time the page comes into view, not only the first time.
 * One pick per page keeps the rule of at most one Mate per screen. Pass
 * `enabled = false` while the page shows its empty-state Mate, so the two
 * never meet.
 */
export function useMateScene<T extends string>(spots: readonly T[], enabled = true): T | null {
  const [spot, setSpot] = useState<T | null>(() => pick(spots));
  useFocusEffect(
    useCallback(() => {
      setSpot(pick(spots));
    }, [spots])
  );
  return enabled ? spot : null;
}
