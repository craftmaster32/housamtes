import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, Pressable, Modal, Dimensions, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { usePhotoStore, PHOTO_CATEGORIES, type Photo, type PhotoCategory } from '@stores/photoStore';
import { useAuthStore } from '@stores/authStore';
import { captureError } from '@lib/errorTracking';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_COLS = 3;
const GRID_ITEM = (SCREEN_WIDTH - sizes.lg * 2 - sizes.xs * (GRID_COLS - 1)) / GRID_COLS;

const MAX_PHOTOS = 50;

export default function PhotosScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const photos = usePhotoStore((s) => s.photos);
  const isLoading = usePhotoStore((s) => s.isLoading);
  const upload = usePhotoStore((s) => s.upload);
  const remove = usePhotoStore((s) => s.remove);
  const load = usePhotoStore((s) => s.load);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);

  // Lazy-load: photos are not loaded at startup, load when this screen opens
  useEffect(() => {
    if (houseId) load(houseId);
    return (): void => { usePhotoStore.getState().unsubscribe(); };
  }, [houseId, load]);

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory | 'general'>('general');
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>('general');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedFileName, setPickedFileName] = useState('');
  const [pickedMime, setPickedMime] = useState('image/jpeg');
  const [error, setError] = useState('');

  const filtered = selectedCategory === 'general'
    ? photos
    : photos.filter((p) => p.category === selectedCategory);

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const permFn = fromCamera ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { granted } = await permFn();
    if (!granted) { setError(t('photos.permission_denied')); return; }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedUri(asset.uri);
      setPickedFileName(asset.fileName ?? `photo_${Date.now()}.jpg`);
      setPickedMime(asset.mimeType ?? 'image/jpeg');
      setShowUploadModal(true);
    }
  }, [t]);

  const handleUpload = useCallback(async () => {
    if (!pickedUri || !user || !houseId || !profile) return;
    if (photos.length >= MAX_PHOTOS) {
      setError(t('photos.limit_title'));
      return;
    }
    try {
      setIsUploading(true);
      await upload({
        localUri: pickedUri,
        fileName: pickedFileName,
        mimeType: pickedMime,
        caption,
        category: uploadCategory,
        uploadedBy: profile.name,
        userId: user.id,
        houseId,
      });
      setShowUploadModal(false);
      setCaption('');
      setPickedUri(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('photos.upload_failed'));
    } finally {
      setIsUploading(false);
    }
  }, [pickedUri, pickedFileName, pickedMime, caption, uploadCategory, user, houseId, profile, photos.length, upload, t]);

  const handleReport = useCallback((photo: Photo): void => {
    Alert.alert(
      'Report Photo',
      `Report this photo by ${photo.uploadedBy} as inappropriate, harmful, or illegal content?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: (): void => {
            captureError(new Error('User photo report'), {
              type: 'photo_report',
              reportedPhotoId: photo.id,
              reportedUploader: photo.uploadedBy,
              reporterUserId: user?.id ?? '',
              houseId: houseId ?? '',
            });
            Alert.alert(
              'Report Submitted',
              'Thank you. Your report has been recorded. Our team will review it within 48 hours.\n\nFor urgent safety concerns, email safety@housemates.app.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  }, [user?.id, houseId]);

  const handleDelete = useCallback((photo: Photo) => {
    Alert.alert(t('photos.delete_photo'), t('photos.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async (): Promise<void> => {
          const url = photo.url;
          const match = url.match(/house-photos\/(.+)$/);
          const path = match ? decodeURIComponent(match[1]) : '';
          await remove(photo.id, path);
          setViewPhoto(null);
        },
      },
    ]);
  }, [remove, t]);

  const renderPhoto = useCallback(
    ({ item }: { item: Photo }) => (
      <Pressable onPress={() => setViewPhoto(item)} style={styles.gridItem}>
        <Image source={{ uri: item.url }} style={styles.gridImage} contentFit="cover" />
      </Pressable>
    ),
    []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.heading}>{t('photos.title')}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => pickImage(true)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>📷</Text>
          </Pressable>
          <Pressable onPress={() => pickImage(false)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>🖼️</Text>
          </Pressable>
        </View>
      </View>

      {/* Category filter */}
      <View style={styles.categoryRow}>
        {PHOTO_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={[styles.catChip, selectedCategory === cat.key && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Text style={[styles.catChipText, selectedCategory === cat.key && styles.catChipTextActive]}>
              {cat.icon} {t(cat.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {!!error && (
        <Text style={styles.error}>{error}</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderPhoto}
        numColumns={GRID_COLS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyTitle}>{t('photos.no_photos')}</Text>
            <Text style={styles.emptyText}>{t('photos.no_photos_hint')}</Text>
          </View>
        }
      />

      {/* Upload modal */}
      <Modal visible={showUploadModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('photos.add_photo')}</Text>
            {!!pickedUri && (
              <Image source={{ uri: pickedUri }} style={styles.previewImage} contentFit="cover" />
            )}
            <TextInput
              label={t('photos.caption_placeholder')}
              value={caption}
              onChangeText={setCaption}
              mode="outlined"
              style={styles.input}
            />
            <Text style={styles.label}>{t('photos.category')}</Text>
            <View style={styles.catRow}>
              {PHOTO_CATEGORIES.filter((c) => c.key !== 'general').map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[styles.catChip, uploadCategory === cat.key && styles.catChipActive]}
                  onPress={() => setUploadCategory(cat.key)}
                >
                  <Text style={[styles.catChipText, uploadCategory === cat.key && styles.catChipTextActive]}>
                    {cat.icon} {t(cat.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleUpload}
                loading={isUploading}
                disabled={isUploading}
                style={styles.uploadBtn}
              >
                {t('photos.upload')}
              </Button>
              <Button mode="text" onPress={() => { setShowUploadModal(false); setCaption(''); setPickedUri(null); }}>
                {t('common.cancel')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen viewer */}
      <Modal visible={!!viewPhoto} transparent animationType="fade">
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.viewerClose} onPress={() => setViewPhoto(null)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>
          {viewPhoto && (
            <>
              <Image source={{ uri: viewPhoto.url }} style={styles.viewerImage} contentFit="contain" />
              <View style={styles.viewerMeta}>
                {viewPhoto.caption ? (
                  <Text style={styles.viewerCaption}>{viewPhoto.caption}</Text>
                ) : null}
                <Text style={styles.viewerInfo}>
                  {viewPhoto.uploadedBy} · {new Date(viewPhoto.createdAt).toLocaleDateString()}
                </Text>
                {viewPhoto.userId === user?.id ? (
                  <Pressable onPress={() => handleDelete(viewPhoto)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>{t('photos.delete_photo')}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => handleReport(viewPhoto)} style={styles.reportBtn}>
                    <Text style={styles.reportBtnText}>Report photo</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sizes.lg,
    paddingTop: sizes.md,
    paddingBottom: sizes.sm,
  },
  heading: { fontSize: 26, ...font.extrabold, letterSpacing: -0.5, color: colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: sizes.sm },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: { fontSize: 20 },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: sizes.lg,
    gap: sizes.xs,
    marginBottom: sizes.sm,
  },
  catChip: {
    paddingVertical: 4,
    paddingHorizontal: sizes.sm,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 13, ...font.medium, color: colors.textPrimary },
  catChipTextActive: { color: colors.white },
  error: { color: colors.danger, fontSize: sizes.fontSm, ...font.regular, paddingHorizontal: sizes.lg, marginBottom: sizes.xs },
  grid: { paddingHorizontal: sizes.lg, paddingBottom: 40 },
  gridRow: { gap: sizes.xs, marginBottom: sizes.xs },
  gridItem: { width: GRID_ITEM, height: GRID_ITEM, borderRadius: 10, overflow: 'hidden', borderCurve: 'continuous' } as never,
  gridImage: { width: '100%', height: '100%' },
  emptyState: { alignItems: 'center', paddingTop: sizes.xxl, gap: sizes.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: sizes.lg },
  // Upload modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: sizes.lg,
    gap: sizes.md,
    paddingBottom: sizes.xxl,
  },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  previewImage: { width: '100%', height: 200, borderRadius: 12 },
  input: { backgroundColor: colors.white },
  label: { color: colors.textPrimary, ...font.semibold, fontSize: sizes.fontSm, marginBottom: -sizes.xs },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  modalActions: { flexDirection: 'row', gap: sizes.sm, alignItems: 'center' },
  uploadBtn: { borderRadius: 14 },
  // Viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerClose: {
    position: 'absolute',
    top: 60,
    right: sizes.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewerCloseText: { color: colors.white, fontSize: 18, ...font.bold },
  viewerImage: { width: '100%', height: '70%' },
  viewerMeta: { padding: sizes.lg, gap: sizes.sm, alignItems: 'center' },
  viewerCaption: { color: colors.white, fontSize: 15, ...font.medium, textAlign: 'center' },
  viewerInfo: { color: 'rgba(255,255,255,0.6)', fontSize: 13, ...font.regular },
  deleteBtn: { marginTop: sizes.sm, padding: sizes.sm },
  deleteBtnText: { color: colors.danger, fontSize: 14, ...font.semibold },
  reportBtn: { marginTop: sizes.sm, padding: sizes.sm },
  reportBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, ...font.regular, textDecorationLine: 'underline' },
});
