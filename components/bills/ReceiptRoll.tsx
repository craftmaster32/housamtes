import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemedColors } from '@constants/colors';
import { ms } from '@utils/responsive';

const TOOTH = ms(12);
const EDGE_H = ms(8);

function zigzag(width: number, flip: boolean): string {
  const teeth = Math.ceil(width / TOOTH);
  let d = flip ? `M0 0 ` : `M0 ${EDGE_H} `;
  for (let i = 0; i < teeth; i++) {
    const x = i * TOOTH;
    d += flip
      ? `L${x + TOOTH / 2} ${EDGE_H} L${x + TOOTH} 0 `
      : `L${x + TOOTH / 2} 0 L${x + TOOTH} ${EDGE_H} `;
  }
  return d + (flip ? `L${teeth * TOOTH} 0 Z` : `L${teeth * TOOTH} ${EDGE_H} Z`);
}

interface ReceiptEdgeProps {
  width: number;
  color: string;
  bottom?: boolean;
}

// The torn, zig-zag edge of a receipt slip.
export function ReceiptEdge({ width, color, bottom = false }: ReceiptEdgeProps): React.JSX.Element {
  if (width <= 0) return <View style={{ height: EDGE_H }} />;
  return (
    <Svg width={width} height={EDGE_H} style={styles.edge}>
      <Path d={zigzag(width, bottom)} fill={color} />
    </Svg>
  );
}

interface ReceiptRollProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Draw the torn top / bottom edge. Off for middle pieces of a long list. */
  top?: boolean;
  bottom?: boolean;
}

/**
 * A printed receipt with torn top and bottom edges. Stays light in dark mode,
 * like the notebook page — paper on a dark table.
 */
export function ReceiptRoll({
  children,
  style,
  contentStyle,
  top = true,
  bottom = true,
}: ReceiptRollProps): React.JSX.Element {
  const c = useThemedColors();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
  }, []);
  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {top && <ReceiptEdge width={width} color={c.receipt} />}
      <View style={[styles.body, { backgroundColor: c.receipt }, contentStyle]}>{children}</View>
      {bottom && <ReceiptEdge width={width} color={c.receipt} bottom />}
    </View>
  );
}

const styles = StyleSheet.create({
  // A soft shadow lifts the slip off the page; pieces of one long receipt
  // overlap their shadows, so it stays light.
  wrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.08,
    shadowRadius: ms(10),
    elevation: 2,
  },
  edge: { display: 'flex' },
  body: { paddingHorizontal: ms(18), paddingTop: ms(4), paddingBottom: ms(12) },
});
