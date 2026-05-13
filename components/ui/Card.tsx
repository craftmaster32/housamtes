// components/ui/Card.tsx
// Surface container — now animated.
//
// - Adds press-scale spring when `onPress` is provided.
// - Optional `entering` / `layout` props accept any Reanimated animation
//   so callers can stagger reveals.
// - Backward compatible with existing call sites (default usage unchanged).

import { ReactNode } from 'react';
import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  type EntryExitAnimationFunction,
  type LayoutAnimationFunction,
} from 'react-native-reanimated';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { usePressScale } from '@utils/animations';

type CardTone = 'default' | 'muted' | 'brand';
type Pad = 'none' | 'sm' | 'md' | 'lg';
type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg';

const PAD: Record<Pad, number> = { none: 0, sm: sizes.sm, md: sizes.md, lg: 20 };
const GAP: Record<Gap, number> = { none: 0, xs: sizes.xs, sm: sizes.sm, md: sizes.md, lg: 20 };

interface Props {
  children: ReactNode;
  tone?: CardTone;
  pad?: Pad;
  gap?: Gap;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  // Typed loosely so callers don't need to import Reanimated types.
  entering?: EntryExitAnimationFunction | unknown;
  layout?: LayoutAnimationFunction | unknown;
}

export function Card({
  children,
  tone = 'default',
  pad = 'md',
  gap = 'none',
  style,
  onPress,
  accessibilityLabel,
  entering,
  layout,
}: Props): React.JSX.Element {
  const C = useThemedColors();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  const bg =
    tone === 'brand' ? C.primary :
    tone === 'muted' ? C.surfaceSecondary :
    C.surface;

  const baseStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: sizes.borderRadiusLg,
    padding: PAD[pad],
    gap: GAP[gap],
    ...(tone === 'default' && {
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: C.borderLight,
    }),
  };

  if (onPress) {
    return (
      <Animated.View
        // @ts-expect-error entering typed loosely for caller convenience
        entering={entering}
        // @ts-expect-error layout typed loosely for caller convenience
        layout={layout}
        style={animatedStyle}
      >
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={[baseStyle, style]}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  if (entering || layout) {
    return (
      <Animated.View
        // @ts-expect-error entering typed loosely for caller convenience
        entering={entering}
        // @ts-expect-error layout typed loosely for caller convenience
        layout={layout}
        style={[baseStyle, style]}
      >
        {children}
      </Animated.View>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}
