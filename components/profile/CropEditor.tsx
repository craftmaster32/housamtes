import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

// ── Interactive crop editor ────────────────────────────────────────────────────
export interface CropSource {
  uri: string;
  imgW: number;
  imgH: number;
}

const CROP_FRAME = ms(260);

export function CropEditor({
  source,
  onConfirm,
  onCancel,
}: {
  source: CropSource;
  onConfirm: (originX: number, originY: number, cropSize: number) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const accumulated = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  // Track touch gesture state via ref (avoids stale closure issues)
  const touch = useRef<{
    mode: 'idle' | 'drag' | 'pinch';
    dragStart: { accX: number; accY: number; px: number; py: number };
    pinchStart: { dist: number; scale: number };
  }>({
    mode: 'idle',
    dragStart: { accX: 0, accY: 0, px: 0, py: 0 },
    pinchStart: { dist: 1, scale: 1 },
  });

  const frameRef = useRef<View>(null);

  // Prevent Safari from intercepting the pinch as a page-zoom gesture.
  // onTouchMove alone won't block it — we need a non-passive DOM listener
  // that calls preventDefault() for multi-touch events.
  useEffect((): (() => void) | undefined => {
    if (Platform.OS !== 'web') return undefined;
    try {
      const el = frameRef.current as unknown as HTMLElement | null;
      if (!el?.addEventListener) return undefined;
      const prevent = (e: Event): void => {
        if ((e as TouchEvent).touches?.length >= 2) e.preventDefault();
      };
      el.addEventListener('touchstart', prevent, { passive: false });
      el.addEventListener('touchmove', prevent, { passive: false });
      return (): void => {
        el.removeEventListener('touchstart', prevent);
        el.removeEventListener('touchmove', prevent);
      };
    } catch {
      return undefined;
    }
  }, []);

  const imgW = source.imgW > 0 ? source.imgW : CROP_FRAME;
  const imgH = source.imgH > 0 ? source.imgH : CROP_FRAME;
  const minDim = Math.min(imgW, imgH);
  const dispFactor = (CROP_FRAME * scale) / minDim;
  const dispW = imgW * dispFactor;
  const dispH = imgH * dispFactor;
  const maxDx = Math.max(0, (dispW - CROP_FRAME) / 2);
  const maxDy = Math.max(0, (dispH - CROP_FRAME) / 2);

  const layoutRef = useRef({ maxDx, maxDy });
  layoutRef.current = { maxDx, maxDy };

  // Re-clamp offset when scale changes
  useEffect(() => {
    const { maxDx: mx, maxDy: my } = layoutRef.current;
    const newX = Math.min(mx, Math.max(-mx, accumulated.current.x));
    const newY = Math.min(my, Math.max(-my, accumulated.current.y));
    accumulated.current = { x: newX, y: newY };
    setOffset({ x: newX, y: newY });
  }, [scale]);

  const pinchDist = (t: GestureResponderEvent['nativeEvent']['touches']): number => {
    const dx = t[0].pageX - t[1].pageX;
    const dy = t[0].pageY - t[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: GestureResponderEvent): void => {
    const t = e.nativeEvent.touches;
    if (t.length >= 2) {
      touch.current = {
        ...touch.current,
        mode: 'pinch',
        pinchStart: { dist: pinchDist(t), scale: scaleRef.current },
      };
    } else {
      touch.current = {
        ...touch.current,
        mode: 'drag',
        dragStart: {
          accX: accumulated.current.x,
          accY: accumulated.current.y,
          px: t[0].pageX,
          py: t[0].pageY,
        },
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent): void => {
    const t = e.nativeEvent.touches;
    const state = touch.current;
    if (t.length >= 2 && state.mode === 'pinch') {
      const newScale = Math.max(1, (state.pinchStart.scale * pinchDist(t)) / state.pinchStart.dist);
      setScale(parseFloat(newScale.toFixed(2)));
    } else if (t.length === 1 && state.mode === 'drag') {
      const { maxDx: mx, maxDy: my } = layoutRef.current;
      const newX = Math.min(
        mx,
        Math.max(-mx, state.dragStart.accX + t[0].pageX - state.dragStart.px)
      );
      const newY = Math.min(
        my,
        Math.max(-my, state.dragStart.accY + t[0].pageY - state.dragStart.py)
      );
      accumulated.current = { x: newX, y: newY };
      setOffset({ x: newX, y: newY });
    }
  }, []);

  const handleTouchEnd = useCallback((e: GestureResponderEvent): void => {
    const t = e.nativeEvent.touches;
    if (t.length === 0) {
      touch.current = { ...touch.current, mode: 'idle' };
    } else if (t.length === 1) {
      // One finger lifted during pinch — switch back to drag
      touch.current = {
        ...touch.current,
        mode: 'drag',
        dragStart: {
          accX: accumulated.current.x,
          accY: accumulated.current.y,
          px: t[0].pageX,
          py: t[0].pageY,
        },
      };
    }
  }, []);

  const imgLeft = (CROP_FRAME - dispW) / 2 + offset.x;
  const imgTop = (CROP_FRAME - dispH) / 2 + offset.y;

  const handleConfirm = useCallback((): void => {
    const originX = Math.max(0, Math.round(-imgLeft / dispFactor));
    const originY = Math.max(0, Math.round(-imgTop / dispFactor));
    const cropSz = Math.min(imgW, imgH, Math.max(1, Math.round(CROP_FRAME / dispFactor)));
    onConfirm(originX, originY, cropSz);
  }, [imgLeft, imgTop, dispFactor, imgW, imgH, onConfirm]);

  const cedStyles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: { alignItems: 'center', gap: sizes.md },
        hint: { fontSize: mf(13), ...font.regular, color: C.textSecondary },
        frame: {
          width: CROP_FRAME,
          height: CROP_FRAME,
          borderRadius: CROP_FRAME / 2,
          overflow: 'hidden',
          borderWidth: 3,
          borderColor: C.primary,
        },
        zoomRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.xl },
        zoomBtn: {
          width: ms(44),
          height: ms(44),
          borderRadius: ms(22),
          backgroundColor: C.primary + '15',
          justifyContent: 'center',
          alignItems: 'center',
        },
        zoomBtnText: { fontSize: mf(26), color: C.primary, lineHeight: mf(30) },
        zoomLabel: { fontSize: mf(14), ...font.bold, color: C.textSecondary },
        btnRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.lg },
        confirmBtn: {
          backgroundColor: C.primary,
          paddingVertical: ms(12),
          paddingHorizontal: sizes.xl,
          borderRadius: ms(10),
        },
        confirmText: { color: '#fff', ...font.semibold, fontSize: mf(15) },
        cancelText: { color: C.textSecondary, fontSize: mf(14), ...font.regular },
      }),
    [C]
  );

  return (
    <View style={cedStyles.wrapper}>
      <Text style={cedStyles.hint}>Drag · pinch to zoom</Text>
      <View
        ref={frameRef}
        style={cedStyles.frame}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Image
          source={{ uri: source.uri }}
          style={{ position: 'absolute', width: dispW, height: dispH, left: imgLeft, top: imgTop }}
          contentFit="fill"
        />
      </View>
      <View style={cedStyles.zoomRow}>
        <Pressable
          style={cedStyles.zoomBtn}
          onPress={() => setScale((ss) => Math.max(1, parseFloat((ss - 0.2).toFixed(1))))}
          accessibilityRole="button"
          accessibilityLabel={t('profile.zoom_out')}
        >
          <Text style={cedStyles.zoomBtnText}>−</Text>
        </Pressable>
        <Text style={cedStyles.zoomLabel}>{t('profile.zoom_label')}</Text>
        <Pressable
          style={cedStyles.zoomBtn}
          onPress={() => setScale((ss) => parseFloat((ss + 0.2).toFixed(1)))}
          accessibilityRole="button"
          accessibilityLabel={t('profile.zoom_in')}
        >
          <Text style={cedStyles.zoomBtnText}>+</Text>
        </Pressable>
      </View>
      <View style={cedStyles.btnRow}>
        <Pressable style={cedStyles.confirmBtn} onPress={handleConfirm} accessibilityRole="button">
          <Text style={cedStyles.confirmText}>{t('profile.use_photo')}</Text>
        </Pressable>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={cedStyles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
