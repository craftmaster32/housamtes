import { useCallback, useEffect, useRef, useState } from 'react';
import { type GroceryItem } from '@stores/groceryStore';

// How long a ticked item stays where it is before it moves to the basket —
// long enough to see the tick and undo a wrong tap, and to tick a few things
// in a row without the list moving under your finger.
const HOLD_MS = 900;
// A touch longer than the Fold's close and open, so each finishes first.
const LEAVE_MS = 260;
const ARRIVE_MS = 400;

export interface BasketMoves {
  /** The side an item is shown on right now (true = in the basket). */
  isShownInBasket: (item: GroceryItem) => boolean;
  /** Rows folding away from their old side. */
  leavingIds: ReadonlySet<string>;
  /** Rows unfolding on their new side. */
  arrivingIds: ReadonlySet<string>;
}

function without(set: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(set);
  ids.forEach((id) => next.delete(id));
  return next;
}

/**
 * Moves ticked items between "Still to grab" and "In the basket" calmly: the
 * item stays put while you keep ticking, then folds away and unfolds on the
 * other side, so the rest of the list glides instead of jumping on each tap.
 */
export function useBasketMoves(
  items: GroceryItem[],
  isDone: (item: GroceryItem) => boolean
): BasketMoves {
  // The side each item is shown on. An item takes its side when first seen;
  // after that it only changes side by folding across (below).
  const sidesRef = useRef(new Map<string, boolean>());
  for (const item of items) {
    if (!sidesRef.current.has(item.id)) sidesRef.current.set(item.id, isDone(item));
  }
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const isDoneRef = useRef(isDone);
  isDoneRef.current = isDone;
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(new Set());
  const [arrivingIds, setArrivingIds] = useState<ReadonlySet<string>>(new Set());

  const isShownInBasket = useCallback(
    (item: GroceryItem): boolean => sidesRef.current.get(item.id) ?? isDone(item),
    [isDone]
  );

  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((fn: () => void, ms: number): void => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      fn();
    }, ms);
    timersRef.current.add(timer);
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    return (): void => timers.forEach(clearTimeout);
  }, []);

  // Once the ticking pauses, everything on the wrong side folds away together,
  // then unfolds on the other side. Each new tick restarts the wait, and
  // un-ticking in time means nothing moves at all.
  useEffect(() => {
    const waiting = items
      .filter((i) => sidesRef.current.get(i.id) !== isDone(i) && !leavingIds.has(i.id))
      .map((i) => i.id);
    if (waiting.length === 0) return undefined;
    const timer = setTimeout(() => {
      setLeavingIds((prev) => new Set([...prev, ...waiting]));
      later(() => {
        const moved: string[] = [];
        for (const id of waiting) {
          const item = itemsRef.current.find((i) => i.id === id);
          // Its state now, so an item un-ticked mid-fold unfolds where it was.
          // Gone from the list meanwhile (cleared, deleted): nothing arrives.
          if (!item) continue;
          sidesRef.current.set(id, isDoneRef.current(item));
          moved.push(id);
        }
        setLeavingIds((prev) => without(prev, waiting));
        setArrivingIds((prev) => new Set([...prev, ...moved]));
        later(() => setArrivingIds((prev) => without(prev, moved)), ARRIVE_MS);
      }, LEAVE_MS);
    }, HOLD_MS);
    return (): void => clearTimeout(timer);
  }, [items, isDone, leavingIds, later]);

  return { isShownInBasket, leavingIds, arrivingIds };
}
