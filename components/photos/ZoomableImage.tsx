import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  type PanResponderInstance,
} from 'react-native';
import { Image } from 'expo-image';

const ZOOM = 2.5;
const DOUBLE_TAP_MS = 280;
const TAP_SLOP = 6;

export interface ZoomableImageProps {
  uri: string;
  cacheKey: string;
  width: number;
  height: number;
  accessibilityLabel: string;
  // Fired on a deliberate single tap (not part of a double tap) while unzoomed —
  // used by the viewer to toggle its chrome.
  onSingleTap: () => void;
  // Reports zoom state up so the pager can disable horizontal paging while zoomed.
  onZoomChange: (zoomed: boolean) => void;
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});

/**
 * A single pannable/zoomable photo for the gallery pager. Double-tap zooms in,
 * a tap zooms back out, and dragging pans while zoomed. Uses the core Animated +
 * PanResponder APIs so it behaves the same on native and web without extra deps.
 */
export function ZoomableImage({
  uri,
  cacheKey,
  width,
  height,
  accessibilityLabel,
  onSingleTap,
  onZoomChange,
}: ZoomableImageProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panValue = useRef({ x: 0, y: 0 });
  const zoomedRef = useRef(false);
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = pan.addListener((v) => {
      panValue.current = v;
    });
    return (): void => {
      pan.removeListener(id);
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    };
  }, [pan]);

  const setZoom = useCallback(
    (on: boolean): void => {
      zoomedRef.current = on;
      onZoomChange(on);
      Animated.parallel([
        Animated.timing(scale, { toValue: on ? ZOOM : 1, duration: 180, useNativeDriver: false }),
        Animated.timing(pan.x, { toValue: 0, duration: 180, useNativeDriver: false }),
        Animated.timing(pan.y, { toValue: 0, duration: 180, useNativeDriver: false }),
      ]).start();
    },
    [onZoomChange, pan, scale]
  );

  const handleTap = useCallback((): void => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      // Double tap → zoom in (only meaningful while unzoomed; a zoomed tap is
      // handled by the pan responder below).
      lastTapRef.current = 0;
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      setZoom(true);
      return;
    }
    lastTapRef.current = now;
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      lastTapRef.current = 0;
      onSingleTap();
    }, DOUBLE_TAP_MS + 20);
  }, [onSingleTap, setZoom]);

  const panResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        // Only intercept touches while zoomed; unzoomed, taps fall through to the
        // Pressable and horizontal swipes drive the pager.
        onStartShouldSetPanResponder: () => zoomedRef.current,
        onMoveShouldSetPanResponder: (_e, g) =>
          zoomedRef.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderGrant: () => {
          pan.setOffset({ x: panValue.current.x, y: panValue.current.y });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          pan.flattenOffset();
          // A tap (barely any movement) while zoomed → zoom back out.
          if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
            setZoom(false);
            return;
          }
          // Rubber-band back into bounds so the photo can't be flung off-screen.
          const maxX = (width * (ZOOM - 1)) / 2;
          const maxY = (height * (ZOOM - 1)) / 2;
          const clampedX = Math.max(-maxX, Math.min(maxX, panValue.current.x));
          const clampedY = Math.max(-maxY, Math.min(maxY, panValue.current.y));
          Animated.parallel([
            Animated.spring(pan.x, { toValue: clampedX, useNativeDriver: false }),
            Animated.spring(pan.y, { toValue: clampedY, useNativeDriver: false }),
          ]).start();
        },
      }),
    [pan, width, height, setZoom]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        width,
        height,
        transform: [{ scale }, { translateX: pan.x }, { translateY: pan.y }],
      }}
    >
      <Pressable style={styles.fill} onPress={handleTap} accessible={false}>
        <Image
          source={{ uri, cacheKey }}
          style={styles.fill}
          contentFit="contain"
          accessibilityLabel={accessibilityLabel}
        />
      </Pressable>
    </Animated.View>
  );
}
