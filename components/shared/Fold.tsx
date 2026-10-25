import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useReduceMotion } from '@hooks/useReduceMotion';

const OPEN_MS = 300;
const CLOSE_MS = 240;

type Phase = 'open' | 'closing' | 'closed' | 'opening';

interface FoldProps {
  /** Shown (true) or folded away (false). */
  open: boolean;
  /** Unfold on first mount instead of just being there. */
  appear?: boolean;
  /** Called once the fold has fully closed. */
  onClosed?: () => void;
  children: React.ReactNode;
}

/**
 * Opens and closes its content by its own height, so whatever sits below
 * glides up or down with it instead of jumping. Uses RN Animated (works on the
 * web build) and shows the end state at once when reduce motion is on.
 */
export function Fold({
  open,
  appear = false,
  onClosed,
  children,
}: FoldProps): React.JSX.Element | null {
  const reduceMotion = useReduceMotion();
  const [phase, setPhase] = useState<Phase>(open ? (appear ? 'opening' : 'open') : 'closed');
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(open && !appear ? 1 : 0)).current;
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    if (open && (phase === 'closed' || phase === 'closing')) setPhase('opening');
    if (!open && (phase === 'open' || phase === 'opening')) setPhase('closing');
  }, [open, phase]);

  useEffect(() => {
    if (phase === 'closing') {
      const anim = Animated.timing(progress, {
        toValue: 0,
        duration: reduceMotion ? 0 : CLOSE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      });
      anim.start(({ finished }) => {
        if (!finished) return;
        setPhase('closed');
        onClosedRef.current?.();
      });
      return (): void => anim.stop();
    }
    // Opening waits for the content's height before it can unfold to it.
    if (phase === 'opening' && height > 0) {
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: reduceMotion ? 0 : OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      anim.start(({ finished }) => {
        if (finished) setPhase('open');
      });
      return (): void => anim.stop();
    }
    return undefined;
  }, [phase, height, progress, reduceMotion]);

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setHeight(h);
  }, []);

  if (phase === 'closed') return null;

  // At rest the content keeps its natural height, so a name that wraps or a
  // note that grows is never clipped. Only a moving fold has a set height.
  const moving = phase !== 'open';
  return (
    <Animated.View
      style={
        moving && [styles.clip, { height: Animated.multiply(progress, height), opacity: progress }]
      }
    >
      <View onLayout={handleLayout}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
