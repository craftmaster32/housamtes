import { View, StyleSheet, Pressable, Animated as RNAnimated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

// Width of the swipe-to-delete panel, kept in sync between the reveal animation
// and its style so the red panel slides in flush with the line's edge.
const SWIPE_DELETE_WIDTH = ms(96);

interface SwipeToDeleteProps {
  /** Called when the red Delete is tapped (confirm inside it). */
  onDelete: () => void;
  /** Screen-reader label for the Delete button, e.g. "Delete Pizza". */
  label: string;
  children: React.ReactNode;
}

/** Swipe a receipt line left to reveal a red Delete, like a native list. */
export function SwipeToDelete({
  onDelete,
  label,
  children,
}: SwipeToDeleteProps): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  return (
    <Swipeable
      renderRightActions={(_progress, dragX): React.JSX.Element => {
        // Slide the panel in 1:1 with the drag so it stays glued to the line's
        // edge instead of sitting revealed as a floating box underneath.
        const translateX = dragX.interpolate({
          inputRange: [-SWIPE_DELETE_WIDTH, 0],
          outputRange: [0, SWIPE_DELETE_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <RNAnimated.View style={[styles.lane, { transform: [{ translateX }] }]}>
            <Pressable
              style={({ pressed }) => [
                styles.delete,
                { backgroundColor: c.dangerTint, borderColor: c.danger },
                pressed && styles.pressed,
              ]}
              onPress={onDelete}
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Ionicons name="trash-outline" size={20} color={c.danger} />
              <Text style={[styles.text, { color: c.danger }]}>{t('common.delete')}</Text>
            </Pressable>
          </RNAnimated.View>
        );
      }}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
    >
      <View>{children}</View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  // Space all round so the soft red "stamp" never touches the amount.
  lane: { width: SWIPE_DELETE_WIDTH, paddingStart: ms(12), paddingVertical: ms(10) },
  delete: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: ms(3),
    borderRadius: ms(16),
    borderWidth: 1.5,
  },
  text: { fontSize: mf(12.5), ...font.bold },
  pressed: { opacity: 0.7 },
});
