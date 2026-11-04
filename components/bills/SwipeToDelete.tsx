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
const SWIPE_DELETE_WIDTH = ms(84);

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
              style={[styles.delete, { backgroundColor: c.danger }]}
              onPress={onDelete}
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.text}>{t('common.delete')}</Text>
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
  lane: { width: SWIPE_DELETE_WIDTH },
  delete: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: ms(3) },
  text: { fontSize: mf(12), ...font.bold, color: '#fff' },
});
