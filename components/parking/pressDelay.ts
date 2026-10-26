import { Platform } from 'react-native';

// How long a touch waits before a card shows itself pressed, so a finger that
// lands on it only to scroll doesn't make it dip. A real tap still fires at
// once. The web's Pressable calls this `delayPressIn`; the phone's calls it
// `unstable_pressDelay`.
const MS = 90;

export const PRESS_DELAY: Record<string, number> =
  Platform.OS === 'web' ? { delayPressIn: MS } : { unstable_pressDelay: MS };
