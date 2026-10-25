import { useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useReduceMotion } from '@hooks/useReduceMotion';

const ROLL_MS = 200;

interface RollingCountProps {
  /** What to show, e.g. "3/12". */
  text: string;
  /** The number behind it: going up rolls upwards, going down rolls down. */
  value: number;
  /** Fixed slot for the text, so a wider number never moves its neighbours. */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * A count that rolls to its new value like a little odometer when − or + is
 * tapped: the old number slides out as the new one slides in.
 */
export function RollingCount({
  text,
  value,
  style,
  textStyle,
}: RollingCountProps): React.JSX.Element {
  const reduceMotion = useReduceMotion();
  const roll = useRef(new Animated.Value(1)).current;
  const lastRef = useRef({ text, value });
  const [prev, setPrev] = useState<{ text: string; dir: number } | null>(null);

  // A layout effect, so the new number never flashes in place before it rolls.
  useLayoutEffect(() => {
    const last = lastRef.current;
    if (last.text === text) return;
    lastRef.current = { text, value };
    if (reduceMotion) {
      setPrev(null);
      return;
    }
    setPrev({ text: last.text, dir: value >= last.value ? 1 : -1 });
    // Starting again mid-roll simply rolls on from the newest number.
    roll.setValue(0);
    Animated.timing(roll, {
      toValue: 1,
      duration: ROLL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPrev(null);
    });
  }, [text, value, reduceMotion, roll]);

  const travel = 14 * (prev?.dir ?? 1);
  return (
    <View style={[styles.slot, style]}>
      {prev !== null && (
        <Animated.Text
          style={[
            textStyle,
            styles.layer,
            {
              opacity: roll.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) },
              ],
            },
          ]}
        >
          {prev.text}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          textStyle,
          {
            opacity: roll,
            transform: [
              { translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }) },
            ],
          },
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { overflow: 'hidden', justifyContent: 'center' },
  layer: { position: 'absolute', left: 0, right: 0 },
});
