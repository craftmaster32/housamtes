import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  Dimensions,
  Alert,
  type SectionListData,
  type ListRenderItemInfo,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { format, isToday, isYesterday } from 'date-fns';
import { enUS, es as dateFnsEs, he as dateFnsHe } from 'date-fns/locale';
import { usePhotoStore, PHOTO_CATEGORIES, type Photo, type PhotoCategory } from '@stores/photoStore';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { PhotoViewer } from '@components/photos/PhotoViewer';
import { PhotoUploadModal } from '@components/photos/PhotoUploadModal';

const { width: SW } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = sizes.xs;
const GRID_ITEM = (SW - sizes.lg * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const MAX_PHOTOS = 50;

const DATE_FNS_LOCALES = { en: enUS, es: dateFnsEs, he: dateFnsHe } as const;

type PhotoRow = Photo[];
interface PhotoSection { title: string; data: PhotoRow[] }

const chunkRows = (photos: Photo[]): PhotoRow[] =>
  Array.from({ length: Math.ceil(photos.length / GRID_COLS) }, (_, i) =>
    photos.slice(i * GRID_COLS, i * GRID_COLS + GRID_COLS)
  );

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.md,
      paddingBottom: sizes.sm,
    },
    heading: { fontSize: 26, ...font.extrabold, letterSpacing: -0.5, color: C.textPrimary },
    headerActions: { flexDirection: 'row', gap: sizes.sm },
    headerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.primary + '15',
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
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    catChipText: { fontSize: 13, ...font.medium, color: C.textPrimary },
    catChipTextActive: { color: '#fff' },
    error: {
      color: C.danger,
      fontSize: sizes.fontSm,
      ...font.regular,
      paddingHorizontal: sizes.lg,
      marginBottom: sizes.xs,
    },
    listContent: { paddingHorizontal: sizes.lg, paddingBottom: 40 },
    sectionHeader: { paddingTop: sizes.sm, paddingBottom: sizes.xs },
    sectionTitle: {
      fontSize: 12,
      ...font.semibold,
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    gridRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
    gridItem: {
      width: GRID_ITEM,
      height: GRID_ITEM,
      borderRadius: 10,
      overflow: 'hidden',
      borderCurve: 'continuous',
    } as never,
    gridImg: { width: '100%', height: '100%' },
    emptyState: { alignItems: 'center', paddingTop: sizes.xxl, gap: sizes.sm },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { fontSize: 17, ...font.bold, color: C.textPrimary },
    emptyText: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingHorizontal: sizes.lg,
    },
  });

export default function PhotosScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const photos = usePhotoStore((s) => s.photos);
  const isLoading = usePhotoStore((s) => s.isLoading);
  const upload = usePhotoStore((s) => s.upload);
  const remove = usePhotoStore((s) => s.remove);
  const load = usePhotoStore((s) => s.load);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    if (houseId) load(houseId);
    return (): void => { usePhotoStore.getState().unsubscribe(); };
  }, [houseId, load]);

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory | 'general'>('general');
  const [viewIndex, setViewIndex] = useState(-1);
  const [pickedAssets, setPickedAssets] = useState<ImagePickerAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');

  const filtered = useMemo(
    () =>
      selectedCategory === 'general'
        ? photos
        : photos.filter((p) => p.category === selectedCategory),
    [photos, selectedCategory]
  );

  const sections = useMemo<PhotoSection[]>(() => {
    const dateFnsLocale =
      DATE_FNS_LOCALES[i18n.language as keyof typeof DATE_FNS_LOCALES] ?? enUS;
    const groups = new Map<string, Photo[]>();
    for (const photo of filtered) {
      const d = new Date(photo.createdAt);
      const label = isToday(d)
        ? t('photos.today')
        : isYesterday(d)
        ? t('photos.yesterday')
        : format(d, 'MMMM yyyy', { locale: dateFnsLocale });
      const arr = groups.get(label) ?? [];
      arr.push(photo);
      groups.set(label, arr);
    }
    return Array.from(groups.entries()).map(([title, items]) => ({
      title,
      data: chunkRows(items),
    }));
  }, [filtered, t, i18n.language]);

  const counts = useMemo<Record<PhotoCategory | 'general', number>>(
    () => ({
      general: photos.length,
      receipts: photos.filter((p) => p.category === 'receipts').length,
      damage: photos.filter((p) => p.category === 'damage').length,
      memories: photos.filter((p) => p.category === 'memories').length,
    }),
    [photos]
  );

  const pickFromCamera = useCallback(async (): Promise<void> => {
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) { setError(t('photos.permission_denied')); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        setPickedAssets([result.assets[0]]);
      }
    } catch {
      setError(t('photos.camera_error'));
    }
  }, [t]);

  const pickFromLibrary = useCallback(async (): Promise<void> => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) { setError(t('photos.permission_denied')); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPickedAssets(result.assets);
      }
    } catch {
      setError(t('photos.library_error'));
    }
  }, [t]);

  const handleUpload = useCallback(
    async (caption: string, category: PhotoCategory): Promise<void> => {
      if (!pickedAssets.length || !user || !houseId || !profile) return;
      if (photos.length + pickedAssets.length > MAX_PHOTOS) {
        setError(t('photos.limit_title'));
        return;
      }
      setIsUploading(true);
      setUploadProgress({ current: 0, total: pickedAssets.length });
      try {
        for (let i = 0; i < pickedAssets.length; i++) {
          setUploadProgress({ current: i + 1, total: pickedAssets.length });
          const asset = pickedAssets[i];
          await upload({
            localUri: asset.uri,
            fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
            mimeType: asset.mimeType ?? 'image/jpeg',
            caption,
            category,
            uploadedBy: profile.name,
            userId: user.id,
            houseId,
          });
        }
        setPickedAssets([]);
        await load(houseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('photos.upload_failed'));
      } finally {
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0 });
      }
    },
    [pickedAssets, user, houseId, profile, photos.length, upload, load, t]
  );

  const handleDelete = useCallback(
    (photo: Photo): void => {
      Alert.alert(t('photos.delete_photo'), t('photos.delete_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async (): Promise<void> => {
            const match = photo.url.match(/house-photos\/(.+)$/);
            const path = match ? decodeURIComponent(match[1]) : '';
            await remove(photo.id, path);
            setViewIndex(-1);
          },
        },
      ]);
    },
    [remove, t]
  );

  const handlePhotoPress = useCallback(
    (photo: Photo): void => {
      const idx = filtered.findIndex((p) => p.id === photo.id);
      setViewIndex(idx);
    },
    [filtered]
  );

  const onSelectCategory = useCallback(
    (key: PhotoCategory | 'general') => setSelectedCategory(key),
    []
  );

  const onCloseViewer = useCallback(() => setViewIndex(-1), []);
  const onClearPicked = useCallback(() => setPickedAssets([]), []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<PhotoRow, PhotoSection> }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [styles]
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<PhotoRow>) => (
      <View style={styles.gridRow}>
        {item.map((photo) => (
          <Pressable
            key={photo.id}
            style={styles.gridItem}
            onPress={() => handlePhotoPress(photo)}
            accessible
            accessibilityRole="imagebutton"
            accessibilityLabel={photo.caption ?? `Photo by ${photo.uploadedBy}`}
          >
            <Image source={{ uri: photo.url }} style={styles.gridImg} contentFit="cover" />
          </Pressable>
        ))}
      </View>
    ),
    [styles, handlePhotoPress]
  );

  const EmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📷</Text>
        <Text style={styles.emptyTitle}>{t('photos.no_photos')}</Text>
        <Text style={styles.emptyText}>{t('photos.no_photos_hint')}</Text>
      </View>
    ),
    [styles, t]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t('photos.title')}</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={pickFromCamera}
              style={styles.headerBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <Text style={styles.headerBtnText}>📷</Text>
            </Pressable>
            <Pressable
              onPress={pickFromLibrary}
              style={styles.headerBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
            >
              <Text style={styles.headerBtnText}>🖼️</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.categoryRow}>
          {PHOTO_CATEGORIES.map((cat) => {
            const count = counts[cat.key];
            return (
              <Pressable
                key={cat.key}
                style={[styles.catChip, selectedCategory === cat.key && styles.catChipActive]}
                onPress={() => onSelectCategory(cat.key)}
                accessible
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.catChipText,
                    selectedCategory === cat.key && styles.catChipTextActive,
                  ]}
                >
                  {cat.icon} {t(cat.labelKey)}
                  {count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <SectionList<PhotoRow, PhotoSection>
          sections={sections}
          keyExtractor={(row, i) => `${row[0]?.id ?? 'empty'}-${i}`}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={EmptyComponent}
          showsVerticalScrollIndicator={false}
        />

        {viewIndex >= 0 && (
          <PhotoViewer
            photos={filtered}
            initialIndex={viewIndex}
            currentUserId={user?.id}
            houseId={houseId}
            onClose={onCloseViewer}
            onDelete={handleDelete}
          />
        )}

        <PhotoUploadModal
          visible={pickedAssets.length > 0}
          assets={pickedAssets}
          isUploading={isUploading}
          progress={uploadProgress}
          onClose={onClearPicked}
          onUpload={handleUpload}
        />
      </View>
    </SafeAreaView>
  );
}
