import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import { Image } from 'expo-image';

const DOUBLE_TAP_ZOOM = 2.5;
const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 280;
const TAP_SLOP = 6;
const UNZOOM_THRESHOLD = 1.05;

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

function distanceBetweenTouches(e: GestureResponderEvent): number {
  const touches = e.nativeEvent.touches;
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/**
 * A single pannable/zoomable photo for the gallery pager. Double-tap zooms in, a
 * tap zooms back out, two-finger pinch scales freely, and dragging pans while
 * zoomed. Uses the core Animated + PanResponder APIs so it behaves the same on
 * native and web without extra deps (pinch needs a real multi-touch screen).
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
  const scaleValue = useRef(1);
  const zoomedRef = useRef(false);
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pinch bookkeeping for the current gesture.
  const pinch = useRef({ active: false, used: false, startDist: 0, startScale: 1 });

  useEffect(() => {
    const panId = pan.addListener((v) => {
      panValue.current = v;
    });
    const scaleId = scale.addListener((v) => {
      scaleValue.current = v.value;
    });
    return (): void => {
      pan.removeListener(panId);
      scale.removeListener(scaleId);
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    };
  }, [pan, scale]);

  const applyZoomState = useCallback(
    (on: boolean): void => {
      if (zoomedRef.current !== on) {
        zoomedRef.current = on;
        onZoomChange(on);
      }
    },
    [onZoomChange]
  );

  // Animated zoom to a target (double-tap in / tap or pinch-collapse out).
  const animateZoom = useCallback(
    (on: boolean): void => {
      applyZoomState(on);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: on ? DOUBLE_TAP_ZOOM : 1,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.timing(pan.x, { toValue: 0, duration: 180, useNativeDriver: false }),
        Animated.timing(pan.y, { toValue: 0, duration: 180, useNativeDriver: false }),
      ]).start();
    },
    [applyZoomState, pan, scale]
  );

  const handleTap = useCallback((): void => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      animateZoom(true);
      return;
    }
    lastTapRef.current = now;
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      lastTapRef.current = 0;
      onSingleTap();
    }, DOUBLE_TAP_MS + 20);
  }, [onSingleTap, animateZoom]);

  const panResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        // Claim touches while zoomed (to pan) or whenever a second finger lands (to
        // pinch). Unzoomed single touches fall through to the Pressable / pager.
        onStartShouldSetPanResponder: (e) => zoomedRef.current || e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (e, g) =>
          e.nativeEvent.touches.length >= 2 ||
          (zoomedRef.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)),
        onPanResponderGrant: () => {
          pan.setOffset({ x: panValue.current.x, y: panValue.current.y });
          pan.setValue({ x: 0, y: 0 });
          pinch.current = {
            active: false,
            used: false,
            startDist: 0,
            startScale: scaleValue.current,
          };
        },
        onPanResponderMove: (e, g) => {
          if (e.nativeEvent.touches.length >= 2) {
            const dist = distanceBetweenTouches(e);
            if (!pinch.current.active) {
              pinch.current.active = true;
              pinch.current.used = true;
              pinch.current.startDist = dist;
              pinch.current.startScale = scaleValue.current;
            } else if (pinch.current.startDist > 0) {
              const next = clamp(
                (pinch.current.startScale * dist) / pinch.current.startDist,
                1,
                MAX_ZOOM
              );
              scale.setValue(next);
            }
            return;
          }
          // Single finger: pan (but not if this gesture was a pinch — avoids a jump
          // when one finger lifts).
          if (pinch.current.used) return;
          pan.x.setValue(g.dx);
          pan.y.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          pan.flattenOffset();

          if (pinch.current.used) {
            if (scaleValue.current <= UNZOOM_THRESHOLD) {
              animateZoom(false);
            } else {
              applyZoomState(true);
              const maxX = (width * (scaleValue.current - 1)) / 2;
              const maxY = (height * (scaleValue.current - 1)) / 2;
              Animated.parallel([
                Animated.spring(pan.x, {
                  toValue: clamp(panValue.current.x, -maxX, maxX),
                  useNativeDriver: false,
                }),
                Animated.spring(pan.y, {
                  toValue: clamp(panValue.current.y, -maxY, maxY),
                  useNativeDriver: false,
                }),
              ]).start();
            }
            return;
          }

          // A tap (barely any movement) while zoomed → zoom back out.
          if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
            animateZoom(false);
            return;
          }
          // Rubber-band the pan back into bounds so the photo can't fly off-screen.
          const maxX = (width * (scaleValue.current - 1)) / 2;
          const maxY = (height * (scaleValue.current - 1)) / 2;
          Animated.parallel([
            Animated.spring(pan.x, {
              toValue: clamp(panValue.current.x, -maxX, maxX),
              useNativeDriver: false,
            }),
            Animated.spring(pan.y, {
              toValue: clamp(panValue.current.y, -maxY, maxY),
              useNativeDriver: false,
            }),
          ]).start();
        },
      }),
    [pan, scale, width, height, animateZoom, applyZoomState]
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
