import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { Mate } from '@components/shared/Mate';

export type MateSpotKind = 'rope' | 'peekOver' | 'cling' | 'sit';

interface MateSpotProps {
  kind: MateSpotKind;
  size: number;
  /** Where he sits — absolute offsets inside a zero-height anchor on the page. */
  style?: StyleProp<ViewStyle>;
  /** Rope length for `rope`. */
  ropeLength?: number;
}

/**
 * Mate hiding somewhere on a page (not at the end of the list): hanging on a
 * rope off a card, peeking over the top of a paper, clinging to its torn
 * edge, or sitting under the calendar. He eases into place once and can never
 * be tapped or read out, so the page works exactly as before.
 *
 * Put it inside a zero-height anchor View right before (to be behind) or right
 * after (to be in front of) the thing he's playing with.
 */
export function MateSpot({ kind, size, style, ropeLength = 40 }: MateSpotProps): React.JSX.Element {
  const c = useThemedColors();
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Calm, physical entrance: he climbs/drops in once and settles.
    Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 0 : kind === 'rope' ? 900 : 450,
      delay: reduceMotion ? 0 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, kind, reduceMotion]);

  const motion =
    kind === 'rope'
      ? {
          opacity: enter.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
          transform: [
            {
              translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-ropeLength, 0] }),
            },
            // A small sway from the rope's top that settles as he stops.
            { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['9deg', '0deg'] }) },
          ],
          transformOrigin: 'top',
        }
      : kind === 'peekOver'
        ? {
            transform: [
              {
                translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [size * 0.6, 0] }),
              },
            ],
          }
        : {
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            ],
          };

  return (
    <Animated.View
      style={[styles.spot, style, motion]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {kind === 'rope' && (
        <>
          <View
            style={[
              styles.rope,
              { height: ropeLength, marginStart: size / 2, backgroundColor: c.textSecondary },
            ]}
          />
          <View style={styles.upsideDown}>
            <Mate size={size} wave={false} />
          </View>
        </>
      )}
      {kind === 'peekOver' && (
        <View style={styles.leanIn}>
          <Mate size={size} />
        </View>
      )}
      {kind === 'cling' && (
        <View style={styles.cling}>
          <Mate size={size} wave={false} />
        </View>
      )}
      {kind === 'sit' && (
        <View style={styles.sit}>
          <Mate size={size} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spot: { position: 'absolute' },
  rope: { width: 1.5 },
  upsideDown: { transform: [{ rotate: '180deg' }], marginTop: -2 },
  leanIn: { transform: [{ rotate: '-8deg' }] },
  cling: { transform: [{ rotate: '14deg' }] },
  sit: { transform: [{ rotate: '-6deg' }] },
});
