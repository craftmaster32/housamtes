import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the person has asked their device to reduce motion. Starts true
 * (no motion) until the setting is read, so nothing animates and then snaps
 * back off on devices that have it switched on.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (active) setReduce(on);
      })
      .catch(() => {
        if (active) setReduce(false);
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return (): void => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
