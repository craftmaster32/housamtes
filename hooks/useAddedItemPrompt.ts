import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAddedItemPrompt {
  name: string | null;
  show: (name: string) => void;
  dismiss: () => void;
}

export function useAddedItemPrompt(durationMs: number): UseAddedItemPrompt {
  const [name, setName] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect((): (() => void) => {
    return (): void => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setName(null);
  }, []);

  const show = useCallback(
    (itemName: string): void => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setName(itemName);
      timerRef.current = setTimeout(() => {
        setName(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  return { name, show, dismiss };
}
