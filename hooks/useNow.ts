import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The current time, refreshed every `intervalMs` and whenever the app comes
 * back to the foreground — so "2h ago"-style labels don't freeze while a
 * screen stays open or the app sits in the background.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = (): void => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return (): void => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}
