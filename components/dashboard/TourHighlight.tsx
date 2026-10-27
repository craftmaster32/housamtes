import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import type { ColorTokens } from '@constants/colors';

// ── Pulsing spotlight ring drawn around the highlighted control ──────────────
// Opacity-only pulse (no scale) so it hugs targets of any width correctly, and
// a small, tight outset so it never sits on neighbouring content.
interface HighlightProps {
  C: ColorTokens;
  radius: number;
  children: React.ReactNode;
  circle?: boolean;
}

export const Highlight: React.FC<HighlightProps> = ({ C, radius, children, circle }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return (): void => loop.stop();
  }, [pulse]);

  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.55] });
  const rGlow = circle ? 999 : radius + 4;
  const rStatic = circle ? 999 : radius + 2;

  return (
    <View style={[styles.highlightWrap, circle && styles.highlightCircle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: C.primary, borderRadius: rGlow, opacity: glow }]}
      />
      <View style={[styles.ringStatic, { borderColor: C.primary, borderRadius: rStatic }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  highlightWrap: { alignSelf: 'stretch' },
  highlightCircle: { alignSelf: 'center' },
  ring: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderWidth: 2 },
  ringStatic: { borderWidth: 2 },
});
