import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Stamp } from '@components/shared/Stamp';
import { useReduceMotion } from '@hooks/useReduceMotion';

interface ThumpStampProps {
  children: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A rubber stamp that thumps down onto the paper when its wording changes
 * (Pending → Approved, say): it comes in a little large and light, then
 * presses flat with a small spring. The first render just shows the stamp.
 */
export function ThumpStamp({ children, color, style }: ThumpStampProps): React.JSX.Element {
  const reduceMotion = useReduceMotion();
  const press = useRef(new Animated.Value(1)).current;
  const lastLabel = useRef(children);

  useEffect(() => {
    if (lastLabel.current === children) return;
    lastLabel.current = children;
    if (reduceMotion) return;
    press.setValue(0);
    Animated.spring(press, {
      toValue: 1,
      friction: 5,
      tension: 170,
      useNativeDriver: true,
    }).start();
  }, [children, reduceMotion, press]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        style,
        {
          opacity: press.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
          transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }],
        },
      ]}
    >
      <Stamp color={color}>{children}</Stamp>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
});
