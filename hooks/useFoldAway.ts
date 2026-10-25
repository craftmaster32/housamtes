import { useCallback, useEffect, useRef, useState } from 'react';

// A touch longer than the Fold's close, so rows are gone before they're removed.
const FOLD_MS = 200;

export interface FoldAway {
  /** Rows folding away right now. */
  foldingIds: ReadonlySet<string>;
  /** Fold these rows away, then run `remove` (e.g. delete them). */
  foldAway: (ids: string[], remove: () => Promise<void>) => void;
}

/**
 * Removes rows with a fold instead of making them vanish: they close up while
 * the rows below glide into their place, and only then are they removed. If
 * removing fails and the rows come back, they simply unfold again.
 */
export function useFoldAway(): FoldAway {
  const [foldingIds, setFoldingIds] = useState<ReadonlySet<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => (): void => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const foldAway = useCallback((ids: string[], remove: () => Promise<void>): void => {
    if (ids.length === 0) return;
    setFoldingIds(new Set(ids));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      remove()
        .catch(() => {})
        .finally(() => setFoldingIds(new Set()));
    }, FOLD_MS);
  }, []);

  return { foldingIds, foldAway };
}
