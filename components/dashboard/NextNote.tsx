import {
  View,
  StyleSheet,
  Animated,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors } from '@constants/colors';
import type { Announcement } from '@stores/announcementsStore';

interface NextNoteProps {
  note: Announcement;
  /** 0 → 1 while the top note is tossed aside. */
  toss: Animated.Value;
  /** Where this note rests in the pile before it rises. */
  restY: number;
  restRotate: number;
  byLine: string;
  // The top note's own styles, so the two match exactly once this one arrives.
  noteStyle: StyleProp<ViewStyle>;
  tapeStyle: StyleProp<ViewStyle>;
  bodyStyle: StyleProp<ViewStyle>;
  byStyle: StyleProp<TextStyle>;
  textStyle: StyleProp<TextStyle>;
  shadeStyle: StyleProp<ViewStyle>;
  /** Dots + "See all", drawn (not tappable) so nothing appears at the swap. */
  footer?: React.ReactNode;
}

/**
 * The next sticky note, waiting under the top one with its real text. While the
 * top note is flicked away it lifts out of the pile, straightens and loses its
 * shade, ending exactly in the top note's place — so the swap is seamless.
 */
export function NextNote({
  note,
  toss,
  restY,
  restRotate,
  byLine,
  noteStyle,
  tapeStyle,
  bodyStyle,
  byStyle,
  textStyle,
  shadeStyle,
  footer,
}: NextNoteProps): React.JSX.Element {
  const c = useThemedColors();
  const handFont = useHandFont();
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            { translateY: toss.interpolate({ inputRange: [0, 1], outputRange: [restY, 0] }) },
            {
              rotate: toss.interpolate({
                inputRange: [0, 1],
                outputRange: [`${restRotate}deg`, '0deg'],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[noteStyle, styles.fill, { backgroundColor: c.note }]}>
        <View style={tapeStyle} />
        <View style={bodyStyle}>
          <Text style={[byStyle, { color: c.noteInk }]} numberOfLines={1}>
            {byLine}
          </Text>
          <Text style={[textStyle, handFont, { color: c.noteInk }]} numberOfLines={2}>
            {note.text}
          </Text>
        </View>
        {footer}
        <Animated.View
          style={[
            shadeStyle,
            { opacity: toss.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
