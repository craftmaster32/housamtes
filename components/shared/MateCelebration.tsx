import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { Mate } from '@components/shared/Mate';
import { subscribeCelebration, getCelebration, finishCelebration } from '@lib/celebrate';
import { mf, ms } from '@utils/responsive';

const LINES_PER_KIND = 4;
const IN_MS = 380;
const STAY_MS = 2400;
const OUT_MS = 300;
// Clear of the bottom menu.
const ABOVE_MENU = 88;

/**
 * Mate popping up from the bottom for a moment when something good happens on
 * this phone (a bill settled, every task done, the grocery list ticked off, a
 * vote passed), with a handwritten line on a little note. Never in the way:
 * it can't be tapped and slides off by itself.
 */
export function MateCelebration(): React.JSX.Element | null {
  const celebration = useSyncExternalStore(subscribeCelebration, getCelebration, () => null);
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const rise = useRef(new Animated.Value(0)).current;
  const [line, setLine] = useState(1);
  const id = celebration?.id;

  useEffect(() => {
    if (id === undefined) return undefined;
    setLine(1 + Math.floor(Math.random() * LINES_PER_KIND));
    rise.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(rise, {
        toValue: 1,
        duration: reduceMotion ? 0 : IN_MS,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.delay(STAY_MS),
      Animated.timing(rise, {
        toValue: 0,
        duration: reduceMotion ? 0 : OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) finishCelebration(id);
    });
    return (): void => anim.stop();
  }, [id, reduceMotion, rise]);

  if (!celebration) return null;

  const slide = rise.interpolate({ inputRange: [0, 1], outputRange: [ms(140), 0] });
  return (
    <View style={[styles.layer, { bottom: insets.bottom + ms(ABOVE_MENU) }]} pointerEvents="none">
      <Animated.View
        style={[styles.row, { opacity: rise, transform: [{ translateY: slide }] }]}
        accessibilityLiveRegion="polite"
      >
        <Mate key={celebration.id} size={ms(64)} tappable={false} />
        <View style={[styles.note, { backgroundColor: c.note }]}>
          <Text style={[styles.say, hand, { color: c.noteInk }]} numberOfLines={2}>
            {t(`celebrate.${celebration.kind}_${line}`)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(6), paddingHorizontal: ms(16) },
  note: {
    maxWidth: ms(230),
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    borderRadius: ms(4),
    marginBottom: ms(18),
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(6) },
    shadowOpacity: 0.18,
    shadowRadius: ms(12),
    elevation: 6,
  },
  say: { fontSize: mf(21), lineHeight: mf(25) },
});
