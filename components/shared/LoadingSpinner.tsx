import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { MateDrawing } from '@components/shared/MateDrawing';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { LOADING_QUIP_KEYS as QUIP_KEYS } from '@constants/loadingQuips';

interface LoadingSpinnerProps {
  /** Overall width in px, as before; Mate is drawn at about half of it. Default 96. */
  size?: number;
  /** Roof colour. Defaults to the theme's brand blue. */
  color?: string;
  /** How long one hop takes, in ms. Default 900. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Show a funny line under Mate. Defaults to on for big (full-screen) loaders. */
  showQuip?: boolean;
  /** Force colours for an always-dark backdrop (the app's boot splash). */
  onDark?: boolean;
}

// Long enough to read a line comfortably before the next one fades in.
const QUIP_EVERY_MS = 5000;
const QUIP_FADE_MS = 300;
// One sweep of the progress bar across its track.
const BAR_SWEEP_MS = 1400;
const BAR_WIDTH = 140;
const BAR_FILL = 0.35;
// Big loaders (boot splash, full screens) talk; small inline ones just hop.
const QUIP_MIN_SIZE = 120;

/**
 * HouseMates' loading indicator: Mate hops on the spot and waves, with his
 * shadow shrinking as he leaves the ground. Big loaders add a progress bar that
 * keeps sweeping (so it's obvious the app is working) and a funny line that
 * gently fades to a new one every few seconds.
 *
 * Driven by requestAnimationFrame — NOT reanimated. Reanimated's shared-value
 * animations don't run on this app's react-native-web build (see
 * components/shared/Entrance.tsx), so rAF is the one approach that animates on
 * both web and native.
 */
export function LoadingSpinner({
  size = 96,
  color,
  duration = 900,
  style,
  accessibilityLabel = 'Loading',
  showQuip,
  onDark,
}: LoadingSpinnerProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const talks = showQuip ?? size >= QUIP_MIN_SIZE;

  const reduceMotion = useReduceMotion();

  const [progress, setProgress] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  useEffect(() => {
    if (reduceMotion) return;
    const start = Date.now();
    const loop = (): void => {
      setProgress((Date.now() - start) / duration);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [duration, reduceMotion]);

  // Start on a random line so repeat visits don't always open the same joke.
  const [quipIndex, setQuipIndex] = useState(() => Math.floor(Math.random() * QUIP_KEYS.length));
  const quipOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!talks) return;
    const next = (): void => setQuipIndex((i) => (i + 1) % QUIP_KEYS.length);
    const id = setInterval(() => {
      if (reduceMotion) {
        next();
        return;
      }
      // Fade the old line out, swap it while invisible, then fade the new one in.
      Animated.timing(quipOpacity, {
        toValue: 0,
        duration: QUIP_FADE_MS,
        useNativeDriver: true,
      }).start(() => {
        next();
        Animated.timing(quipOpacity, {
          toValue: 1,
          duration: QUIP_FADE_MS,
          useNativeDriver: true,
        }).start();
      });
    }, QUIP_EVERY_MS);
    return (): void => {
      clearInterval(id);
      quipOpacity.stopAnimation();
      quipOpacity.setValue(1);
    };
  }, [talks, reduceMotion, quipOpacity]);

  const mateSize = Math.max(36, Math.round(size * 0.55));
  const hopHeight = mateSize * 0.22;

  const pose = useMemo(() => {
    if (reduceMotion) return { lift: 0, squash: 0, arm: 0 };
    const phase = progress % 1;
    // Up and down on a half-sine; a quick squash right as he lands.
    const lift = Math.sin(phase * Math.PI);
    const squash = phase < 0.12 ? 1 - phase / 0.12 : 0;
    // The arm keeps waving across hops, a bit faster than he jumps.
    const arm = -14 * Math.sin(progress * Math.PI * 1.5);
    return { lift, squash, arm };
  }, [progress, reduceMotion]);

  const dark = onDark ?? C.background === darkColors.background;
  const quipColor = dark ? darkColors.textSecondary : C.textSecondary;
  const barColor = color ?? (dark ? darkColors.primary : C.primary);
  const trackColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  // The bar's filled chunk slides in from the left and out the right, over and over.
  const barSweep = ((progress * duration) / BAR_SWEEP_MS) % 1;
  const barLeft = (barSweep * (1 + BAR_FILL) - BAR_FILL) * BAR_WIDTH;

  return (
    <View
      style={[styles.wrap, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width: mateSize, height: mateSize + hopHeight }}>
        <View
          style={[
            styles.shadow,
            {
              width: mateSize * 0.6,
              height: mateSize * 0.08,
              borderRadius: mateSize * 0.04,
              left: mateSize * 0.2,
              bottom: mateSize * 0.06,
              backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
              transform: [{ scaleX: 1 - pose.lift * 0.35 }],
            },
          ]}
        />
        <View
          style={{
            position: 'absolute',
            top: hopHeight,
            transform: [
              { translateY: -pose.lift * hopHeight + pose.squash * mateSize * 0.03 },
              { scaleX: 1 + pose.squash * 0.06 },
              { scaleY: 1 - pose.squash * 0.07 },
            ],
          }}
        >
          <MateDrawing size={mateSize} armAngle={pose.arm} onDark={onDark} roofColor={color} />
        </View>
      </View>
      {talks && !reduceMotion && (
        <View
          testID="loading-bar"
          style={[styles.barTrack, { backgroundColor: trackColor }]}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.barFill, { backgroundColor: barColor, left: barLeft }]} />
        </View>
      )}
      {talks && (
        <Animated.Text
          style={[styles.quip, { color: quipColor, opacity: quipOpacity }]}
          numberOfLines={2}
        >
          {t(QUIP_KEYS[quipIndex])}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  shadow: { position: 'absolute' },
  barTrack: {
    marginTop: 14,
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: BAR_WIDTH * BAR_FILL,
    borderRadius: 2,
  },
  quip: {
    marginTop: 14,
    maxWidth: 260,
    textAlign: 'center',
    fontSize: 15,
    ...font.semibold,
  },
});
