// components/ui/Button.tsx
// Theme-aware button — Reanimated spring press + optional haptic.

import { ReactNode, useCallback } from 'react';
import { Pressable, Text, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { type } from '@constants/typography';
import { usePressScale, useHaptic } from '@utils/animations';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const HEIGHTS: Record<Size, number> = { sm: 44, md: 44, lg: 52 };
const PADDING_X: Record<Size, number> = { sm: 14, md: 18, lg: 22 };

interface Props {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Default 'tap'. Pass null to silence haptic. */
  haptic?: 'tap' | 'toggle' | 'success' | 'warn' | 'error' | null;
}

export function Button({
  children, onPress, variant = 'primary', size = 'md',
  icon, iconPosition = 'left', loading = false, disabled = false,
  fullWidth = false, style, accessibilityLabel, haptic = 'tap',
}: Props): React.JSX.Element {
  const C = useThemedColors();
  const isDisabled = disabled || loading;
  const press = usePressScale(0.96);
  const h = useHaptic();

  const palette = {
    primary:   { bg: C.primary,     fg: C.white,       bd: 'transparent' },
    secondary: { bg: C.surface,     fg: C.textPrimary, bd: C.border },
    ghost:     { bg: 'transparent', fg: C.primary,     bd: 'transparent' },
    danger:    { bg: C.danger,      fg: C.white,       bd: 'transparent' },
  }[variant];

  const iconNode = icon ? (
    <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={palette.fg} />
  ) : null;

  const handlePress = useCallback((): void => {
    if (haptic) h[haptic]();
    onPress?.();
  }, [haptic, h, onPress]);

  return (
    <Animated.View style={[press.animatedStyle, fullWidth && { alignSelf: 'stretch' }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          {
            height: HEIGHTS[size],
            minWidth: 44,
            paddingHorizontal: PADDING_X[size],
            borderRadius: 999,
            backgroundColor: palette.bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: palette.bd,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: isDisabled ? 0.5 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          } as ViewStyle,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          <>
            {iconPosition === 'left' && iconNode}
            <Text style={[size === 'sm' ? type.labelSm : type.label, { color: palette.fg }]}>
              {children}
            </Text>
            {iconPosition === 'right' && iconNode}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
