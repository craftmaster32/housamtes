import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type GroceryItem } from '@stores/groceryStore';
import { getItemAge, isItemStale } from '@utils/groceryAge';

const STALE_KEPT_KEY = 'grocery_stale_kept';

export interface StaleNudge {
  /** The item the "Still need it?" strip sits under, or null for none. */
  nudge: { id: string; name: string; days: number } | null;
  /** False while it folds away (the item was ticked or kept). */
  isOpen: boolean;
  /** Unfold it (true) when it takes over from one that was just handled. */
  appear: boolean;
  handleKeep: () => void;
  handleRemove: () => void;
  /** The strip has folded away. */
  handleClosed: () => void;
}

/**
 * "Still need it?" — the oldest shared item that's been waiting 3+ days and
 * nobody has said "keep it" to on this phone. Once shown, the strip stays with
 * that item: ticking the item folds it away instead of moving it to another
 * row, so ticking never shifts the list around.
 */
export function useStaleNudge(
  items: GroceryItem[],
  now: number,
  onDelete: (id: string) => void
): StaleNudge {
  const [keptStaleIds, setKeptStaleIds] = useState<string[]>([]);
  useEffect((): void => {
    AsyncStorage.getItem(STALE_KEPT_KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setKeptStaleIds(parsed.filter((x) => typeof x === 'string'));
      })
      .catch(() => {});
  }, []);

  const candidate = useMemo(
    (): GroceryItem | undefined =>
      items
        .filter(
          (i) =>
            !i.isChecked &&
            !i.isPersonal &&
            !i.isDraft &&
            !keptStaleIds.includes(i.id) &&
            isItemStale(i.createdAt, now)
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0],
    [items, keptStaleIds, now]
  );

  // The item the strip is stuck to. It is let go only once its strip has
  // folded away after "Keep it", or when the item leaves the list.
  const [lockId, setLockId] = useState<string | null>(null);
  const [appear, setAppear] = useState(false);
  const locked = lockId ? items.find((i) => i.id === lockId) : undefined;
  const target = locked ?? candidate;
  useEffect(() => {
    if (target && target.id !== lockId) setLockId(target.id);
  }, [target, lockId]);

  const nudge = useMemo((): StaleNudge['nudge'] => {
    if (!target) return null;
    const age = getItemAge(target.createdAt, now);
    return { id: target.id, name: target.name, days: age.unit === 'days' ? age.count : 3 };
  }, [target, now]);
  const isOpen = !!target && !target.isChecked && !keptStaleIds.includes(target.id);

  const keptRef = useRef(keptStaleIds);
  keptRef.current = keptStaleIds;
  const handleClosed = useCallback((): void => {
    // Folded because it was kept: let the next waiting item have the strip.
    // Folded because it was ticked: keep it here, so nothing else moves.
    if (lockId && keptRef.current.includes(lockId)) {
      setLockId(null);
      setAppear(true);
    }
  }, [lockId]);

  const handleKeep = useCallback((): void => {
    if (!nudge) return;
    Haptics.selectionAsync().catch(() => {});
    // Only remember ids still on the list so the stored set can't grow forever.
    const liveIds = new Set(items.map((i) => i.id));
    const next = [...keptStaleIds.filter((id) => liveIds.has(id)), nudge.id];
    setKeptStaleIds(next);
    AsyncStorage.setItem(STALE_KEPT_KEY, JSON.stringify(next)).catch(() => {});
  }, [nudge, items, keptStaleIds]);

  const handleRemove = useCallback((): void => {
    if (!nudge) return;
    setAppear(true);
    onDelete(nudge.id);
  }, [nudge, onDelete]);

  return { nudge, isOpen, appear, handleKeep, handleRemove, handleClosed };
}
