// components/ui/Button.tsx
// Theme-aware button with size + variant. Uses Pressable so it composes
// with Reanimated press scales if you want them later.

import { ReactNode } from 'react';
import { Pressable, Text, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { type } from '@constants/typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const HEIGHTS: Record<Size, number> = { sm: 36, md: 44, lg: 52 };
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
}

export function Button({
  children, onPress, variant = 'primary', size = 'md',
  icon, iconPosition = 'left', loading = false, disabled = false,
  fullWidth = false, style, accessibilityLabel,
}: Props): React.JSX.Element {
  const C = useThemedColors();
  const isDisabled = disabled || loading;

  const palette = {
    primary:   { bg: C.primary,             fg: C.white,        bd: 'transparent' },
    secondary: { bg: C.surface,             fg: C.textPrimary,  bd: C.border },
    ghost:     { bg: 'transparent',         fg: C.primary,      bd: 'transparent' },
    danger:    { bg: C.danger,              fg: C.white,        bd: 'transparent' },
  }[variant];

  const iconNode = icon ? (
    <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={palette.fg} />
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
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
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
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
  );
}
