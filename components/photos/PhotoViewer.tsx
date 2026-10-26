import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  Modal,
  Animated,
  PanResponder,
  Easing,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday } from 'date-fns';
import { enUS, es as dateFnsEs, he as dateFnsHe } from 'date-fns/locale';
import { captureError } from '@lib/errorTracking';
import { Alert } from '@lib/alert';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { downloadPhotoToLibrary } from '@utils/downloadPhoto';
import { ZoomableImage } from '@components/photos/ZoomableImage';
import { ViewerTopBar } from '@components/photos/ViewerTopBar';
import { ViewerBottomBar } from '@components/photos/ViewerBottomBar';
import type { Photo } from '@stores/photoStore';
import { ms } from '@utils/responsive';

const { width: SW, height: SH } = Dimensions.get('window');
// First-frame height so the photo shows immediately; corrected to the list's real
// height on layout. A percentage height doesn't resolve inside the horizontal
// pager and renders as a black, zero-height page — so it's always a pixel value.
const FALLBACK_IMAGE_H = SH;
// Drag distance at which the dismiss gesture has fully shrunk + faded the photo.
const FADE_DISTANCE = SH * 0.5;
// Warm near-black, like a darkroom, rather than flat #000.
const STAGE = '#0B0B0C';

const TOP_SCRIM = ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.35)', 'transparent'] as const;
const BOTTOM_SCRIM = ['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)'] as const;
const DATE_FNS_LOCALES = { en: enUS, es: dateFnsEs, he: dateFnsHe } as const;

export interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  currentUserId: string | undefined;
  houseId: string | null;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
}

const styles = StyleSheet.create({
  // Edge-to-edge stage — the photo fills it and the controls float over soft
  // dark scrims, like a phone's own gallery.
  overlay: { flex: 1, backgroundColor: STAGE },
  list: { flex: 1 },
  slide: { width: SW, justifyContent: 'center', alignItems: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0 },
  topScrim: { top: 0 },
  bottomScrim: { bottom: 0 },
});

export function PhotoViewer({
  photos,
  initialIndex,
  currentUserId,
  houseId,
  onClose,
  onDelete,
}: PhotoViewerProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageH, setImageH] = useState(FALLBACK_IMAGE_H);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const chromeAnim = useRef(new Animated.Value(1)).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  // 0 → 1 as the photo opens (grows out of the grid and the stage darkens).
  const openAnim = useRef(new Animated.Value(0)).current;
  const isZoomedRef = useRef(false);
  const closingRef = useRef(false);
  const listRef = useRef<FlatList<Photo>>(null);

  const photo = photos[currentIndex];

  useEffect(() => {
    Animated.timing(openAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [openAnim, reduceMotion]);

  // Close the same way it opened: the photo shrinks a little as the stage fades.
  const close = useCallback((): void => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(openAnim, {
      toValue: 0,
      duration: reduceMotion ? 0 : 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  }, [openAnim, reduceMotion, onClose]);

  const onListLayout = useCallback((e: LayoutChangeEvent): void => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setImageH(h);
  }, []);

  const handleZoomChange = useCallback((zoomed: boolean): void => {
    isZoomedRef.current = zoomed;
    setIsZoomed(zoomed);
  }, []);

  // Swipe the photo up or down to dismiss (only while unzoomed and only for a
  // clearly-vertical drag, so horizontal paging and pinch-pan are untouched). The
  // photo shrinks and the backdrop fades as you drag, then animates the rest of
  // the way out on release.
  const dismissResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          !isZoomedRef.current && Math.abs(g.dy) > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.25,
        onPanResponderMove: (_e, g) => {
          dismissY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dy) > 120 || Math.abs(g.vy) > 0.6) {
            // Carry the motion off-screen (shrinking + fading) before closing.
            closingRef.current = true;
            Animated.timing(dismissY, {
              toValue: g.dy >= 0 ? FADE_DISTANCE : -FADE_DISTANCE,
              duration: 200,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => onClose());
            return;
          }
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 16,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 16,
          }).start();
        },
      }),
    [dismissY, onClose]
  );

  const dragOpacity = dismissY.interpolate({
    inputRange: [-FADE_DISTANCE, 0, FADE_DISTANCE],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const dragScale = dismissY.interpolate({
    inputRange: [-FADE_DISTANCE, 0, FADE_DISTANCE],
    outputRange: [0.6, 1, 0.6],
    extrapolate: 'clamp',
  });
  const openScale = openAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const stageOpacity = Animated.multiply(dragOpacity, openAnim);
  const photoScale = Animated.multiply(dragScale, openScale);
  const chromeOpacity = Animated.multiply(chromeAnim, openAnim);

  // Tap the photo to toggle the controls in/out for an immersive full-photo view.
  const toggleChrome = useCallback((): void => {
    setChromeVisible((visible) => {
      const next = !visible;
      Animated.timing(chromeAnim, {
        toValue: next ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return next;
    });
  }, [chromeAnim]);

  const labelFor = useCallback(
    (p: Photo): string => p.caption || t('photos.photo_by', { name: p.uploadedBy }),
    [t]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Photo>) => (
      <View style={[styles.slide, { height: imageH }]}>
        <ZoomableImage
          uri={item.url}
          cacheKey={item.id}
          width={SW}
          height={imageH}
          accessibilityLabel={labelFor(item)}
          onSingleTap={toggleChrome}
          onZoomChange={handleZoomChange}
        />
      </View>
    ),
    [imageH, labelFor, toggleChrome, handleZoomChange]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Photo> | null | undefined, index: number) => ({
      length: SW,
      offset: SW * index,
      index,
    }),
    []
  );

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    setCurrentIndex(idx);
    isZoomedRef.current = false;
    setIsZoomed(false);
  }, []);

  // Tap a thumbnail to jump straight to that photo.
  const jumpTo = useCallback((index: number): void => {
    listRef.current?.scrollToIndex({ index, animated: false });
    setCurrentIndex(index);
    isZoomedRef.current = false;
    setIsZoomed(false);
  }, []);

  const handleDownload = useCallback(async (): Promise<void> => {
    if (!photo || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadPhotoToLibrary(photo.url);
      Alert.alert(t('photos.download_success_title'), t('photos.download_success'));
    } catch (err) {
      const isPermission = err instanceof Error && err.name === 'permission_denied';
      Alert.alert(
        t('common.error', 'Error'),
        isPermission ? t('photos.download_permission_denied') : t('photos.download_error')
      );
    } finally {
      setIsDownloading(false);
    }
  }, [photo, isDownloading, t]);

  const handleReport = useCallback((): void => {
    if (!photo) return;
    Alert.alert(t('photos.report_title'), t('photos.report_message', { name: photo.uploadedBy }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('photos.report_action'),
        style: 'destructive',
        onPress: (): void => {
          captureError(new Error('User photo report'), {
            type: 'photo_report',
            reportedPhotoId: photo.id,
            reportedUploaderId: photo.userId,
            reporterUserId: currentUserId ?? '',
            houseId: houseId ?? '',
          });
          Alert.alert(t('photos.report_submitted_title'), t('photos.report_submitted_message'), [
            { text: t('common.ok') },
          ]);
        },
      },
    ]);
  }, [photo, currentUserId, houseId, t]);

  const handleDelete = useCallback((): void => {
    if (photo) onDelete(photo);
  }, [onDelete, photo]);

  // "Today" / "Yesterday" / "12 Oct 2026" over "Maya · 14:48".
  const { title, subtitle } = useMemo(() => {
    if (!photo) return { title: '', subtitle: '' };
    const locale = DATE_FNS_LOCALES[i18n.language as keyof typeof DATE_FNS_LOCALES] ?? enUS;
    const d = new Date(photo.createdAt);
    const day = isToday(d)
      ? t('photos.today')
      : isYesterday(d)
        ? t('photos.yesterday')
        : format(d, 'd MMM yyyy', { locale });
    return { title: day, subtitle: `${photo.uploadedBy} · ${format(d, 'HH:mm', { locale })}` };
  }, [photo, i18n.language, t]);

  // box-none lets taps on the empty scrim area fall through to the photo (so they
  // still toggle the chrome); only the buttons themselves capture touches.
  const chromePointer = chromeVisible ? 'box-none' : 'none';

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: stageOpacity }]}>
        <Animated.View
          style={[styles.list, { transform: [{ translateY: dismissY }, { scale: photoScale }] }]}
          {...dismissResponder.panHandlers}
        >
          <FlatList
            ref={listRef}
            data={photos}
            renderItem={renderItem}
            keyExtractor={(p) => p.id}
            horizontal
            pagingEnabled
            scrollEnabled={!isZoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onLayout={onListLayout}
            style={styles.list}
          />
        </Animated.View>

        <Animated.View
          style={[styles.scrim, styles.topScrim, { opacity: chromeOpacity }]}
          pointerEvents={chromePointer}
        >
          <LinearGradient colors={TOP_SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <ViewerTopBar
            title={title}
            subtitle={subtitle}
            topInset={Math.max(insets.top, ms(12)) + ms(6)}
            onClose={close}
          />
        </Animated.View>

        {!!photo && (
          <Animated.View
            style={[styles.scrim, styles.bottomScrim, { opacity: chromeOpacity }]}
            pointerEvents={chromePointer}
          >
            <LinearGradient
              colors={BOTTOM_SCRIM}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <ViewerBottomBar
              photos={photos}
              current={currentIndex}
              caption={photo.caption}
              isMine={photo.userId === currentUserId}
              isDownloading={isDownloading}
              bottomInset={Math.max(insets.bottom, ms(12)) + ms(4)}
              labelFor={labelFor}
              onPick={jumpTo}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onReport={handleReport}
            />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}
