import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedColors, darkColors } from '@constants/colors';
import { ms } from '@utils/responsive';

interface ArtStickerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The hand-drawn pictures use dark ink. In dark mode they sit on a small light
 * sticker — like the notebook page, paper on a dark table — so they keep their
 * look instead of disappearing into the card.
 */
export function ArtSticker({ children, style }: ArtStickerProps): React.JSX.Element {
  const c = useThemedColors();
  const dark = c.background === darkColors.background;
  return (
    <View style={[dark && [styles.sticker, { backgroundColor: c.sticker }], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    padding: ms(6),
    borderRadius: ms(16),
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.35,
    shadowRadius: ms(8),
    elevation: 4,
  },
});
