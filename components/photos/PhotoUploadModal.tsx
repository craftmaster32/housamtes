import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PHOTO_CATEGORIES, type PhotoCategory } from '@stores/photoStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export interface PhotoUploadModalProps {
  visible: boolean;
  assets: ImagePickerAsset[];
  isUploading: boolean;
  progress: { current: number; total: number };
  onClose: () => void;
  onUpload: (caption: string, category: PhotoCategory) => Promise<void>;
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: sizes.lg,
      gap: sizes.md,
      paddingBottom: sizes.xxl,
    },
    title: { fontSize: 18, ...font.bold, color: C.textPrimary },
    singlePreview: { width: '100%', height: 180, borderRadius: 12 },
    thumbStrip: { gap: sizes.xs },
    thumb: {
      width: 76,
      height: 76,
      borderRadius: 10,
      overflow: 'hidden',
      borderCurve: 'continuous',
    } as never,
    thumbImg: { width: 76, height: 76 },
    input: { backgroundColor: C.surface },
    label: {
      color: C.textPrimary,
      ...font.semibold,
      fontSize: sizes.fontSm,
      marginBottom: -sizes.xs,
    },
    catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    catChip: {
      paddingVertical: 4,
      paddingHorizontal: sizes.sm,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    catChipText: { fontSize: 13, ...font.medium, color: C.textPrimary },
    catChipTextActive: { color: '#fff' },
    progressText: {
      color: C.textSecondary,
      fontSize: 13,
      ...font.regular,
      textAlign: 'center',
    },
    actions: { flexDirection: 'row', gap: sizes.sm, alignItems: 'center' },
    uploadBtn: { borderRadius: 14, flex: 1 },
  });

const uploadCategories = PHOTO_CATEGORIES.filter((c) => c.key !== 'general');

export function PhotoUploadModal({
  visible,
  assets,
  isUploading,
  progress,
  onClose,
  onUpload,
}: PhotoUploadModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<PhotoCategory>('general');

  const reset = useCallback((): void => {
    setCaption('');
    setCategory('general');
  }, []);

  const handleUpload = useCallback(async (): Promise<void> => {
    await onUpload(caption, category);
    reset();
  }, [caption, category, onUpload, reset]);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  const title =
    assets.length > 1
      ? t('photos.add_photos_count', { count: assets.length })
      : t('photos.add_photo');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {assets.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbStrip}
            >
              {assets.map((asset, i) => (
                <View key={i} style={styles.thumb}>
                  <Image source={{ uri: asset.uri }} style={styles.thumbImg} contentFit="cover" />
                </View>
              ))}
            </ScrollView>
          ) : assets.length === 1 ? (
            <Image
              source={{ uri: assets[0].uri }}
              style={styles.singlePreview}
              contentFit="cover"
            />
          ) : null}

          <TextInput
            label={t('photos.caption_placeholder')}
            value={caption}
            onChangeText={setCaption}
            mode="outlined"
            style={styles.input}
          />

          <Text style={styles.label}>{t('photos.category')}</Text>
          <View style={styles.catRow}>
            {uploadCategories.map((cat) => (
              <Pressable
                key={cat.key}
                style={[styles.catChip, category === cat.key && styles.catChipActive]}
                onPress={() => setCategory(cat.key)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t(cat.labelKey)}
              >
                <Text style={[styles.catChipText, category === cat.key && styles.catChipTextActive]}>
                  {cat.icon} {t(cat.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {isUploading && progress.total > 1 && (
            <Text style={styles.progressText}>
              {t('photos.uploading_progress', {
                current: progress.current,
                total: progress.total,
              })}
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleUpload}
              loading={isUploading}
              disabled={isUploading || assets.length === 0}
              style={styles.uploadBtn}
            >
              {t('photos.upload')}
            </Button>
            <Button mode="text" onPress={handleClose} disabled={isUploading}>
              {t('common.cancel')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
