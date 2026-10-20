import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Stamp } from '@components/shared/Stamp';
import { useReduceMotion } from '@hooks/useReduceMotion';

interface ThumpStampProps {
  children: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A rubber stamp that presses onto the paper when its wording changes
 * (Pending → Approved, say): a short, small press — slightly larger and lighter,
 * easing to flat. The first render just shows the stamp.
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
    Animated.timing(press, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [children, reduceMotion, press]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        style,
        {
          opacity: press.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }],
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
