import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useThemedColors } from '@constants/colors';
import { ms } from '@utils/responsive';

// Notebook ruling: a faint blue line every RULE_GAP, starting below the top edge.
const RULE_GAP = ms(32);
const RULE_TOP = ms(44);
// The scalloped tear along the bottom, like a page pulled from a pad.
const SCALLOP = ms(12);

interface NotebookPaperProps {
  children: React.ReactNode;
  /** Padding etc. for the page itself. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A page torn from a notebook: ruled lines, a red margin (on the reading-start
 * side) and a scalloped bottom edge. Stays light in dark mode, like real paper
 * on a dark table. Used for the money cards on Home and Bills.
 */
export function NotebookPaper({ children, contentStyle }: NotebookPaperProps): React.JSX.Element {
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  const ruleCount =
    size.h > RULE_TOP ? Math.floor((size.h - RULE_TOP - SCALLOP) / RULE_GAP) + 1 : 0;
  const scallopCount = size.w > 0 ? Math.ceil(size.w / SCALLOP) + 1 : 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.page, { backgroundColor: c.paper }, contentStyle]} onLayout={onLayout}>
        {/* Ruled lines + the red margin line, drawn behind the content. */}
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
        {children}
      </View>
      {/* Scalloped tear: dots of the page colour hanging off the bottom edge. */}
      <View style={styles.scallops} pointerEvents="none">
        {Array.from({ length: scallopCount }, (_, i) => (
          <View key={i} style={[styles.scallop, { backgroundColor: c.paper }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(14) },
    shadowOpacity: 0.16,
    shadowRadius: ms(18),
    elevation: 6,
  },
  page: {
    borderTopLeftRadius: ms(22),
    borderTopRightRadius: ms(22),
    paddingHorizontal: ms(24),
    paddingTop: ms(20),
    paddingBottom: ms(18),
    overflow: 'hidden',
  },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2 },
  margin: { position: 'absolute', top: 0, bottom: 0, width: 1.5 },
  marginLTR: { left: ms(14) },
  marginRTL: { right: ms(14) },
  scallops: { flexDirection: 'row', height: SCALLOP / 2, overflow: 'hidden' },
  scallop: {
    width: SCALLOP,
    height: SCALLOP,
    borderRadius: SCALLOP / 2,
    marginTop: -SCALLOP / 2,
  },
});
