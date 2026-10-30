import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { PenCount } from '@components/shared/tabbar/PenCount';
import { ms } from '@utils/responsive';

const MARKER_MS = 240;

interface TabButtonProps {
  /** Draws the icon in the given colour. */
  renderIcon: (color: string) => React.ReactNode;
  active: boolean;
  badge: number;
  label: string;
  onPress: () => void;
}

/**
 * One place in the bottom menu: just its icon. The page you're on is blue with
 * a soft marker stroke under it, swiped in left to right when you arrive.
 */
export function TabButton({
  renderIcon,
  active,
  badge,
  label,
  onPress,
}: TabButtonProps): React.JSX.Element {
  const c = useThemedColors();
  const reduceMotion = useReduceMotion();
  const swipe = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const anim = Animated.timing(swipe, {
      toValue: active ? 1 : 0,
      duration: reduceMotion ? 0 : active ? MARKER_MS : 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return (): void => anim.stop();
  }, [active, reduceMotion, swipe]);

  const half = MARKER_W / 2;
  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View>
        {renderIcon(active ? c.primary : c.textSecondary)}
        <PenCount count={badge} />
      </View>
      {/* The marker grows from its left end, like a pen swiped across. */}
      <Animated.View
        style={[
          styles.marker,
          {
            backgroundColor: c.primary,
            opacity: swipe.interpolate({ inputRange: [0, 1], outputRange: [0, 0.38] }),
            transform: [
              { translateX: swipe.interpolate({ inputRange: [0, 1], outputRange: [-half, 0] }) },
              { scaleX: swipe },
              { rotate: '-3deg' },
            ],
          },
        ]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const MARKER_W = ms(28);

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(5),
    minHeight: ms(48),
  },
  marker: { width: MARKER_W, height: ms(5), borderRadius: ms(3) },
});
