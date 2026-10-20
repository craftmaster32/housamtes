import { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

export const WHEEL_ITEM_H = ms(40);
const VISIBLE = 5;
const PAD = WHEEL_ITEM_H * Math.floor(VISIBLE / 2);

interface TimeWheelProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Read out with each value, e.g. "Hours". */
  label: string;
}

/**
 * One quiet scroll wheel (hours or minutes). The chosen value is a large
 * serif number; the rest fade out above and below. Scrolling settles on the
 * nearest value; tapping a value picks it. Same snapping approach as the shared
 * TimePicker wheel, which works on iOS, Android and web.
 */
export function TimeWheel({
  items,
  selectedIndex,
  onSelect,
  label,
}: TimeWheelProps): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const scrollRef = useRef<ScrollView>(null);
  const lastEmitted = useRef(selectedIndex);
  const liveY = useRef(selectedIndex * WHEEL_ITEM_H);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettling = useRef(false); // true while we scroll it ourselves

  const selectItem = useCallback(
    (index: number): void => {
      const clipped = Math.max(0, Math.min(index, items.length - 1));
      const y = clipped * WHEEL_ITEM_H;
      isSettling.current = true;
      scrollRef.current?.scrollTo({ y, animated: true });
      liveY.current = y;
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        isSettling.current = false;
      }, 450);
      if (clipped !== lastEmitted.current) {
        lastEmitted.current = clipped;
        onSelect(clipped);
      }
    },
    [items.length, onSelect]
  );

  // Start on the chosen value, without animating.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: false });
      liveY.current = selectedIndex * WHEEL_ITEM_H;
    }, 40);
    return (): void => clearTimeout(t);
    // Only on mount — later changes come from this wheel itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => (): void => {
      if (commitTimer.current !== null) clearTimeout(commitTimer.current);
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    },
    []
  );

  // Settle on the nearest value 100 ms after the last scroll event.
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      if (isSettling.current) return;
      liveY.current = e.nativeEvent.contentOffset.y;
      if (commitTimer.current !== null) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        selectItem(Math.round(liveY.current / WHEEL_ITEM_H));
      }, 100);
    },
    [selectItem]
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_H}
      decelerationRate="fast"
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.content}
    >
      {items.map((value, index) => {
        const dist = Math.abs(index - selectedIndex);
        return (
          <Pressable
            key={value}
            style={styles.item}
            onPress={() => selectItem(index)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${value}`}
            accessibilityState={{ selected: dist === 0 }}
          >
            <Text
              style={
                dist === 0
                  ? [styles.selected, headingFont, { color: c.textPrimary }]
                  : [
                      styles.value,
                      dist === 1 ? styles.near : styles.far,
                      { color: dist === 1 ? c.textSecondary : c.textTertiary },
                    ]
              }
            >
              {value}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wheel: { height: WHEEL_ITEM_H * VISIBLE, width: ms(84) },
  content: { paddingVertical: PAD },
  item: { height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' },
  selected: { fontSize: mf(34), lineHeight: mf(40), fontVariant: ['tabular-nums'] },
  value: { ...font.medium, fontVariant: ['tabular-nums'] },
  near: { fontSize: mf(20) },
  far: { fontSize: mf(17) },
});
