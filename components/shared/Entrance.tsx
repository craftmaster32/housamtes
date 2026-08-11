import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

interface EntranceProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** Distance (px) the content slides up from as it fades in. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades + slides its children in on mount. Driven by requestAnimationFrame +
 * React state on a plain View — NOT reanimated. Reanimated's animations
 * (both `entering=` and shared-value `useAnimatedStyle`) don't run on this
 * react-native-web build, and a stuck opacity:0 blanks the screen. rAF always
 * reaches opacity 1, so the content can never get stuck invisible.
 */
export function Entrance({
  children,
  delay = 0,
  duration = 420,
  offset = 16,
  style,
}: EntranceProps): React.JSX.Element {
  const [p, setP] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const begin = Date.now() + delay;
    const loop = (): void => {
      const now = Date.now();
      if (now < begin) {
        raf.current = requestAnimationFrame(loop);
        return;
      }
      const t = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setP(eased);
      if (t < 1) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [delay, duration]);

  return (
    <View style={[style, { opacity: p, transform: [{ translateY: (1 - p) * offset }] }]}>
      {children}
    </View>
  );
}
