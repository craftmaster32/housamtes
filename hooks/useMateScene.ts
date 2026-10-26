import { useState } from 'react';

// Mate turns up on roughly two visits in three, so he stays a surprise.
const SHOW_CHANCE = 0.65;

/**
 * Picks where Mate hides on this visit to a page — one of the page's spots, or
 * nowhere — once, when the page opens. One pick per page keeps the rule of at
 * most one Mate per screen. Pass `enabled = false` while the page shows its
 * empty-state Mate, so the two never meet.
 */
export function useMateScene<T extends string>(spots: readonly T[], enabled = true): T | null {
  const [spot] = useState<T | null>(() =>
    spots.length > 0 && Math.random() < SHOW_CHANCE
      ? spots[Math.floor(Math.random() * spots.length)]
      : null
  );
  return enabled ? spot : null;
}
