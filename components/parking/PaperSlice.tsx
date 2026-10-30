import { useCallback, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { isRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import { ms } from '@utils/responsive';

/** Width of the date column, left of (or in Hebrew, right of) the red margin. */
export const MARGIN_W = ms(60);
const RULE_GAP = ms(30);
const RULE_TOP = ms(26);
const SCALLOP = ms(12);

interface PaperSliceProps {
  children: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  /** A dashed rule across the top, between two reservations. */
  dashedTop?: boolean;
}

/**
 * One row's share of the reservations notebook page. Rows sit flush in the
 * list so together they read as a single ruled page with a red margin; the
 * first row rounds the top corners and the last adds the scalloped tear.
 */
export function PaperSlice({
  children,
  isFirst,
  isLast,
  dashedTop = false,
}: PaperSliceProps): React.JSX.Element {
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  const ruleCount = size.h > RULE_TOP ? Math.floor((size.h - RULE_TOP) / RULE_GAP) + 1 : 0;
  const scallopCount = isLast && size.w > 0 ? Math.ceil(size.w / SCALLOP) + 1 : 0;

  return (
    <View style={isLast && styles.lastWrap}>
      <View
        style={[styles.page, { backgroundColor: c.paper }, isFirst && styles.first]}
        onLayout={onLayout}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: ruleCount }, (_, i) => (
            <View
              key={i}
              style={[styles.rule, { top: RULE_TOP + i * RULE_GAP, backgroundColor: c.paperRule }]}
            />
          ))}
          <View
            style={[
              styles.margin,
              rtl ? styles.marginRTL : styles.marginLTR,
              { backgroundColor: c.paperMargin },
            ]}
          />
        </View>
        {dashedTop && (
          // iOS can't dash a single border side, so the rule is drawn as dashes.
          <View style={styles.dashes} pointerEvents="none">
            {Array.from({ length: 48 }, (_, i) => (
              <View key={i} style={[styles.dash, { backgroundColor: c.receiptRule }]} />
            ))}
          </View>
        )}
        {children}
      </View>
      {isLast && (
        <View style={styles.scallops} pointerEvents="none">
          {Array.from({ length: scallopCount }, (_, i) => (
            <View key={i} style={[styles.scallop, { backgroundColor: c.paper }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lastWrap: { paddingBottom: SCALLOP / 2 },
  page: { overflow: 'hidden' },
  first: { borderTopLeftRadius: ms(6), borderTopRightRadius: ms(6) },
  rule: { position: 'absolute', left: 0, right: 0, height: 1.5 },
  margin: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  marginLTR: { left: MARGIN_W },
  marginRTL: { right: MARGIN_W },
  dashes: {
    flexDirection: 'row',
    gap: ms(4),
    height: 1.5,
    overflow: 'hidden',
    marginStart: MARGIN_W + ms(14),
    marginEnd: ms(12),
  },
  dash: { width: ms(5), height: 1.5 },
  scallops: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCALLOP / 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  scallop: {
    width: SCALLOP,
    height: SCALLOP,
    borderRadius: SCALLOP / 2,
    marginTop: -SCALLOP / 2,
  },
});
