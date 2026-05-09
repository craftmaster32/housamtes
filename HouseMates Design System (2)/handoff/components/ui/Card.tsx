// components/ui/Card.tsx
// Surface container. Theme-aware. Replaces ad-hoc `borderRadius + boxShadow`
// blocks scattered across screens.
//
// Usage:
//   <Card>...</Card>                    // default white surface, soft shadow
//   <Card tone="muted">...</Card>       // surfaceSecondary
//   <Card tone="brand">...</Card>       // primary background, white text
//   <Card pad="lg" gap="md">...</Card>  // built-in padding/gap

import { ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';

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
}

export function Card({ children, tone = 'default', pad = 'md', gap = 'none', style }: Props): React.JSX.Element {
  const C = useThemedColors();
  const bg =
    tone === 'brand' ? C.primary :
    tone === 'muted' ? C.surfaceSecondary :
    C.surface;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: sizes.borderRadiusLg,
          padding: PAD[pad],
          gap: GAP[gap],
          // Soft shadow only on light surface; dark mode uses a subtle border instead.
          ...(tone === 'default' && {
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderWidth: 1,
            borderColor: C.borderLight,
          }),
        } as ViewStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
