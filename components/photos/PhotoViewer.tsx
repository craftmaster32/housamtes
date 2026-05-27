import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { captureError } from '@lib/errorTracking';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { downloadPhotoToLibrary } from '@utils/downloadPhoto';
import type { Photo } from '@stores/photoStore';

const { width: SW } = Dimensions.get('window');

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
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
    topBar: {
      position: 'absolute',
      top: 60,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sizes.lg,
      zIndex: 10,
    },
    topBarSide: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeTxt: { color: '#fff', fontSize: 18, ...font.bold },
    downloadBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    downloadTxt: { fontSize: 18 },
    counter: { color: 'rgba(255,255,255,0.65)', fontSize: 14, ...font.medium },
    list: { flex: 1 },
    slide: { width: SW, flex: 1, justifyContent: 'center' },
    image: { width: SW, height: SW * 1.25 },
    meta: {
      paddingHorizontal: sizes.lg,
      paddingBottom: sizes.xxl,
      alignItems: 'center',
      gap: sizes.xs,
    },
    caption: { color: '#fff', fontSize: 15, ...font.medium, textAlign: 'center' },
    info: { color: 'rgba(255,255,255,0.55)', fontSize: 13, ...font.regular },
    deleteBtn: { marginTop: sizes.xs, padding: sizes.sm },
    deleteTxt: { color: C.danger, fontSize: 14, ...font.semibold },
    reportBtn: { marginTop: sizes.xs, padding: sizes.sm },
    reportTxt: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 13,
      ...font.regular,
      textDecorationLine: 'underline',
    },
  });

export function PhotoViewer({
  photos,
  initialIndex,
  currentUserId,
  houseId,
  onClose,
  onDelete,
}: PhotoViewerProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const listRef = useRef<FlatList<Photo>>(null);

  const photo = photos[currentIndex];

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Photo>) => (
      <View style={styles.slide}>
        <Image
          source={{ uri: item.url }}
          style={styles.image}
          contentFit="contain"
          accessibilityLabel={item.caption ?? t('photos.photo_by', { name: item.uploadedBy })}
        />
      </View>
    ),
    [styles, t]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Photo> | null | undefined, index: number) => ({
      length: SW,
      offset: SW * index,
      index,
    }),
    []
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
      setCurrentIndex(idx);
    },
    []
  );

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
    Alert.alert(
      t('photos.report_title'),
      t('photos.report_message', { name: photo.uploadedBy }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('photos.report_action'),
          style: 'destructive',
          onPress: (): void => {
            captureError(new Error('User photo report'), {
              type: 'photo_report',
              reportedPhotoId: photo.id,
              reportedUploader: photo.uploadedBy,
              reporterUserId: currentUserId ?? '',
              houseId: houseId ?? '',
            });
            Alert.alert(
              t('photos.report_submitted_title'),
              t('photos.report_submitted_message'),
              [{ text: t('common.ok') }]
            );
          },
        },
      ]
    );
  }, [photo, currentUserId, houseId, t]);

  const handleDelete = useCallback(
    () => { if (photo) onDelete(photo); },
    [onDelete, photo]
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>

          {photos.length > 1 ? (
            <Text style={styles.counter}>
              {currentIndex + 1} / {photos.length}
            </Text>
          ) : (
            <View />
          )}

          <Pressable
            style={styles.downloadBtn}
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
              <Text style={styles.downloadTxt}>⬇️</Text>
            )}
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={photos}
          renderItem={renderItem}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={styles.list}
        />

        {!!photo && (
          <View style={styles.meta}>
            {!!photo.caption && (
              <Text style={styles.caption}>{photo.caption}</Text>
            )}
            <Text style={styles.info}>
              {photo.uploadedBy} · {new Date(photo.createdAt).toLocaleDateString()}
            </Text>
            {photo.userId === currentUserId ? (
              <Pressable
                onPress={handleDelete}
                style={styles.deleteBtn}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('photos.delete_photo')}
              >
                <Text style={styles.deleteTxt}>{t('photos.delete_photo')}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleReport}
                style={styles.reportBtn}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('photos.report_title')}
              >
                <Text style={styles.reportTxt}>{t('photos.report_action')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
