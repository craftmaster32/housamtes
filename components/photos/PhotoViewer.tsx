import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  Modal,
  ActivityIndicator,
  Animated,
  PanResponder,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { captureError } from '@lib/errorTracking';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { downloadPhotoToLibrary } from '@utils/downloadPhoto';
import { ZoomableImage } from '@components/photos/ZoomableImage';
import type { Photo } from '@stores/photoStore';

const { width: SW, height: SH } = Dimensions.get('window');
// First-frame height so the photo shows immediately; corrected to the list's real
// height on layout. A percentage height doesn't resolve inside the horizontal
// pager and renders as a black, zero-height page — so it's always a pixel value.
const FALLBACK_IMAGE_H = SH;

const TOP_SCRIM = ['rgba(0,0,0,0.6)', 'transparent'] as const;
const BOTTOM_SCRIM = ['transparent', 'rgba(0,0,0,0.8)'] as const;

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-US';
}

export interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  currentUserId: string | undefined;
  houseId: string | null;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    // Pure-black, edge-to-edge stage — the photo fills it and the controls float
    // over gradient scrims, like a native gallery.
    overlay: { flex: 1, backgroundColor: '#000' },
    list: { flex: 1 },
    slide: { width: SW, justifyContent: 'center', alignItems: 'center' },

    scrim: { position: 'absolute', left: 0, right: 0 },
    topScrim: { top: 0 },
    bottomScrim: { bottom: 0 },
    // Fixed paddings clear the status bar / home indicator reliably; SafeAreaView
    // insets are unreliable inside a Modal.
    topGradient: { paddingHorizontal: sizes.md, paddingTop: 52, paddingBottom: sizes.xl },
    bottomGradient: {
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.xxl,
      paddingBottom: sizes.lg,
    },

    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    counter: { color: '#fff', fontSize: 15, ...font.semibold },

    meta: { gap: sizes.xs, paddingBottom: sizes.md },
    caption: { color: '#fff', fontSize: 16, ...font.medium },
    info: { color: 'rgba(255,255,255,0.6)', fontSize: 13, ...font.regular },
    actionRow: { flexDirection: 'row', marginTop: sizes.sm },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.xs,
      paddingVertical: sizes.xs,
      paddingHorizontal: sizes.sm,
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    deleteTxt: { color: C.danger, fontSize: 13, ...font.semibold },
    reportTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 13, ...font.medium },
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
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageH, setImageH] = useState(FALLBACK_IMAGE_H);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const chromeAnim = useRef(new Animated.Value(1)).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  const isZoomedRef = useRef(false);
  const listRef = useRef<FlatList<Photo>>(null);

  const photo = photos[currentIndex];

  const onListLayout = useCallback((e: LayoutChangeEvent): void => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setImageH(h);
  }, []);

  const handleZoomChange = useCallback((zoomed: boolean): void => {
    isZoomedRef.current = zoomed;
    setIsZoomed(zoomed);
  }, []);

  // Swipe the photo up or down to dismiss (only while unzoomed and only for a
  // clearly-vertical drag, so horizontal paging and pinch-pan are untouched).
  const dismissResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          !isZoomedRef.current && Math.abs(g.dy) > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.25,
        onPanResponderMove: (_e, g) => {
          dismissY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dy) > 130 || Math.abs(g.vy) > 0.75) {
            onClose();
            return;
          }
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dismissY, { toValue: 0, useNativeDriver: false }).start();
        },
      }),
    [dismissY, onClose]
  );

  const overlayOpacity = dismissY.interpolate({
    inputRange: [-280, 0, 280],
    outputRange: [0.35, 1, 0.35],
    extrapolate: 'clamp',
  });

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

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Photo>) => (
      <View style={[styles.slide, { height: imageH }]}>
        <ZoomableImage
          uri={item.url}
          cacheKey={item.id}
          width={SW}
          height={imageH}
          accessibilityLabel={item.caption ?? t('photos.photo_by', { name: item.uploadedBy })}
          onSingleTap={toggleChrome}
          onZoomChange={handleZoomChange}
        />
      </View>
    ),
    [styles, t, imageH, toggleChrome, handleZoomChange]
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

  // box-none lets taps on the empty scrim area fall through to the photo (so they
  // still toggle the chrome); only the buttons themselves capture touches.
  const chromePointer = chromeVisible ? 'box-none' : 'none';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Animated.View
          style={[styles.list, { transform: [{ translateY: dismissY }] }]}
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

        {/* Top scrim — close · counter · download, over a fading dark gradient. */}
        <Animated.View
          style={[styles.scrim, styles.topScrim, { opacity: chromeAnim }]}
          pointerEvents={chromePointer}
        >
          <LinearGradient colors={TOP_SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={[styles.topBar, styles.topGradient]}>
            <Pressable
              style={styles.iconBtn}
              onPress={onClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>

            {photos.length > 1 ? (
              <Text style={styles.counter}>
                {currentIndex + 1} / {photos.length}
              </Text>
            ) : (
              <View />
            )}

            <Pressable
              style={styles.iconBtn}
              onPress={handleDownload}
              disabled={isDownloading}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('photos.download_photo')}
              accessibilityState={{ busy: isDownloading, disabled: isDownloading }}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={22} color="#fff" />
              )}
            </Pressable>
          </View>
        </Animated.View>

        {/* Bottom scrim — caption, uploader · date, and the owner/report action. */}
        {!!photo && (
          <Animated.View
            style={[styles.scrim, styles.bottomScrim, { opacity: chromeAnim }]}
            pointerEvents={chromePointer}
          >
            <LinearGradient
              colors={BOTTOM_SCRIM}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.meta, styles.bottomGradient]}>
              {!!photo.caption && <Text style={styles.caption}>{photo.caption}</Text>}
              <Text style={styles.info}>
                {photo.uploadedBy} ·{' '}
                {new Date(photo.createdAt).toLocaleDateString(localeFor(i18n.language), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View style={styles.actionRow}>
                {photo.userId === currentUserId ? (
                  <Pressable
                    onPress={handleDelete}
                    style={styles.actionBtn}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('photos.delete_photo')}
                  >
                    <Ionicons name="trash-outline" size={15} color={C.danger} />
                    <Text style={styles.deleteTxt}>{t('photos.delete_photo')}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleReport}
                    style={styles.actionBtn}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('photos.report_title')}
                  >
                    <Ionicons name="flag-outline" size={15} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.reportTxt}>{t('photos.report_action')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}
