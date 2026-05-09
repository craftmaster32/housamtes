// components/ui/Pill.tsx
// Small status / category pill. Theme-aware tint + foreground.

import { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { type } from '@constants/typography';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
type Size = 'sm' | 'md';

interface Props {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export function Pill({ children, tone = 'neutral', size = 'sm', icon, style }: Props): React.JSX.Element {
  const C = useThemedColors();

  const palette = {
    neutral: { bg: C.surfaceSecondary,    fg: C.textPrimary },
    brand:   { bg: C.primary + '18',      fg: C.primary },
    success: { bg: C.success + '1A',      fg: C.success },
    warning: { bg: C.warning + '1A',      fg: C.warning },
    danger:  { bg: C.danger + '1A',       fg: C.danger },
    info:    { bg: C.primary + '12',      fg: C.primary },
  }[tone];

  const px = size === 'md' ? 12 : 10;
  const py = size === 'md' ? 6 : 4;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.bg, paddingHorizontal: px, paddingVertical: py },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={size === 'md' ? 14 : 12} color={palette.fg} />}
      <Text style={[size === 'md' ? type.labelSm : type.captionMed, { color: palette.fg }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
  } as ViewStyle,
});
