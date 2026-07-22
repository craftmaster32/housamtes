import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  Dimensions,
  type SectionListData,
  type ListRenderItemInfo,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { format, isToday, isYesterday } from 'date-fns';
import { enUS, es as dateFnsEs, he as dateFnsHe } from 'date-fns/locale';
import {
  usePhotoStore,
  PHOTO_CATEGORIES,
  type Photo,
  type PhotoCategory,
} from '@stores/photoStore';
import { useAuthStore } from '@stores/authStore';
import { useEntitlementsStore } from '@stores/entitlementsStore';
import { PremiumUpsell } from '@components/premium/PremiumUpsell';
import { PREMIUM_ENABLED } from '@constants/featureFlags';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { downloadPhotoToLibrary } from '@utils/downloadPhoto';
import { PhotoViewer } from '@components/photos/PhotoViewer';
import { PhotoUploadModal } from '@components/photos/PhotoUploadModal';
import { getErrorMessage } from '@utils/errors';

const { width: SW } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = sizes.xs;
const GRID_ITEM = (SW - sizes.lg * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const DATE_FNS_LOCALES = { en: enUS, es: dateFnsEs, he: dateFnsHe } as const;

type PhotoRow = Photo[];
interface PhotoSection {
  title: string;
  data: PhotoRow[];
}

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
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: sizes.lg,
      gap: sizes.xs,
      marginBottom: sizes.sm,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
    listContent: { paddingHorizontal: sizes.lg, paddingBottom: 100 },
    upsellWrap: { paddingHorizontal: sizes.lg, marginBottom: sizes.sm },
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
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(99,102,241,0.35)',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: 5,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    unselectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    unselectedCircle: {
      position: 'absolute',
      bottom: 5,
      end: 5,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.7)',
    },
    selectionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: C.surface,
      borderTopWidth: 1,
      borderTopColor: C.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.sm,
      paddingBottom: sizes.xl,
    },
    selectionBarText: { fontSize: 15, ...font.semibold, color: C.textPrimary },
    selectionCancelBtn: { padding: sizes.sm },
    selectionCancelTxt: { fontSize: 15, ...font.regular, color: C.textSecondary },
    selectionDownloadBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: sizes.borderRadiusLg,
      minWidth: 100,
      alignItems: 'center',
    },
    selectionDownloadBtnDisabled: { opacity: 0.45 },
    selectionDownloadTxt: { fontSize: 15, ...font.semibold, color: '#fff' },
    emptyState: { alignItems: 'center', paddingTop: sizes.xxl, gap: sizes.sm },
    emptyIcon: { marginBottom: sizes.sm },
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
  const isPremium = useEntitlementsStore((s) => s.isPremium);
  const canAddPhotos = useEntitlementsStore((s) => s.canAddPhotos);
  const photoLimit = useEntitlementsStore((s) => s.photoLimit);
  const entitlementsIsLoading = useEntitlementsStore((s) => s.isLoading);
  const entitlementsError = useEntitlementsStore((s) => s.error);
  // Entitlements are still rehydrating, or the read failed outright — either
  // way isPremium can't be trusted, so don't enforce the free-tier cap or
  // block uploads until a confirmed read comes back.
  const entitlementsLoading = entitlementsIsLoading || !!entitlementsError;

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    if (houseId) load(houseId);
    return (): void => {
      usePhotoStore.getState().unsubscribe();
    };
  }, [houseId, load]);

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory | 'general'>('general');
  const [viewIndex, setViewIndex] = useState(-1);
  const [pickedAssets, setPickedAssets] = useState<ImagePickerAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  // keep a stable ref to selectedIds for use in callbacks
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const filtered = useMemo(
    () =>
      selectedCategory === 'general'
        ? photos
        : photos.filter((p) => p.category === selectedCategory),
    [photos, selectedCategory]
  );

  const sections = useMemo<PhotoSection[]>(() => {
    const dateFnsLocale = DATE_FNS_LOCALES[i18n.language as keyof typeof DATE_FNS_LOCALES] ?? enUS;
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

  const exitSelectMode = useCallback((): void => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((photoId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const enterSelectMode = useCallback((photoId: string): void => {
    setIsSelectMode(true);
    setSelectedIds(new Set([photoId]));
  }, []);

  const handleBulkDownload = useCallback(async (): Promise<void> => {
    const ids = selectedIdsRef.current;
    if (ids.size === 0 || isBulkDownloading) return;
    const toDownload = photos.filter((p) => ids.has(p.id));
    setIsBulkDownloading(true);
    try {
      for (const photo of toDownload) {
        await downloadPhotoToLibrary(photo.url);
      }
      exitSelectMode();
      const count = toDownload.length;
      Alert.alert(
        t('photos.download_success_title'),
        count === 1
          ? t('photos.download_all_success_one')
          : t('photos.download_all_success_other', { count })
      );
    } catch (err) {
      const isPermission = err instanceof Error && err.name === 'permission_denied';
      Alert.alert(
        t('common.error', 'Error'),
        isPermission ? t('photos.download_permission_denied') : t('photos.download_error')
      );
    } finally {
      setIsBulkDownloading(false);
    }
  }, [isBulkDownloading, photos, exitSelectMode, t]);

  const pickFromCamera = useCallback(async (): Promise<void> => {
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        setError(t('photos.permission_denied'));
        return;
      }
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
      if (!granted) {
        setError(t('photos.permission_denied'));
        return;
      }
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
      // Fail closed while entitlements are still rehydrating — otherwise a
      // free user could upload past the cap in the brief window before
      // AsyncStorage confirms they aren't premium.
      if (PREMIUM_ENABLED && entitlementsLoading) {
        setError(t('common.loading'));
        return;
      }
      // Premium parked — don't enforce the free-tier photo cap while there's
      // no way to upgrade. See constants/featureFlags.ts.
      if (PREMIUM_ENABLED && !canAddPhotos(photos.length, pickedAssets.length)) {
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
      } catch (err) {
        setError(getErrorMessage(err, t('photos.upload_failed')));
      } finally {
        setPickedAssets([]);
        await load(houseId);
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0 });
      }
    },
    [
      pickedAssets,
      user,
      houseId,
      profile,
      photos.length,
      canAddPhotos,
      entitlementsLoading,
      upload,
      load,
      t,
    ]
  );

  const limit = photoLimit();
  // The upsell card only appears once premium is live (constants/featureFlags.ts).
  const atPhotoLimit =
    PREMIUM_ENABLED &&
    !entitlementsLoading &&
    !isPremium &&
    limit !== null &&
    photos.length >= limit;

  const handleDelete = useCallback(
    (photo: Photo): void => {
      Alert.alert(t('photos.delete_photo'), t('photos.delete_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async (): Promise<void> => {
            try {
              await remove(photo.id, photo.storagePath);
              setViewIndex(-1);
            } catch (err) {
              Alert.alert(t('common.error'), getErrorMessage(err, t('photos.delete_error')));
            }
          },
        },
      ]);
    },
    [remove, t]
  );

  const handlePhotoPress = useCallback(
    (photo: Photo): void => {
      if (isSelectMode) {
        toggleSelect(photo.id);
        return;
      }
      const idx = filtered.findIndex((p) => p.id === photo.id);
      setViewIndex(idx);
    },
    [filtered, isSelectMode, toggleSelect]
  );

  const handlePhotoLongPress = useCallback(
    (photo: Photo): void => {
      if (!isSelectMode) {
        enterSelectMode(photo.id);
      }
    },
    [isSelectMode, enterSelectMode]
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
        {item.map((photo) => {
          const isSelected = selectedIds.has(photo.id);
          return (
            <Pressable
              key={photo.id}
              style={styles.gridItem}
              onPress={() => handlePhotoPress(photo)}
              onLongPress={() => handlePhotoLongPress(photo)}
              delayLongPress={350}
              accessible
              accessibilityRole="imagebutton"
              accessibilityLabel={photo.caption ?? `Photo by ${photo.uploadedBy}`}
              accessibilityState={{ selected: isSelectMode ? isSelected : undefined }}
            >
              <Image
                source={{ uri: photo.url, cacheKey: photo.id }}
                style={styles.gridImg}
                contentFit="cover"
                accessibilityLabel={photo.caption ?? `Photo by ${photo.uploadedBy}`}
              />
              {isSelectMode && isSelected && (
                <View style={styles.selectedOverlay}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </View>
                </View>
              )}
              {isSelectMode && !isSelected && (
                <>
                  <View style={styles.unselectedOverlay} />
                  <View style={styles.unselectedCircle} />
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    ),
    [styles, selectedIds, isSelectMode, handlePhotoPress, handlePhotoLongPress]
  );

  const EmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="camera-outline" size={48} color={C.textTertiary} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>{t('photos.no_photos')}</Text>
        <Text style={styles.emptyText}>{t('photos.no_photos_hint')}</Text>
      </View>
    ),
    [styles, t, C]
  );

  const selectedCount = selectedIds.size;
  const selectionLabel =
    selectedCount === 1
      ? t('photos.photos_selected_one')
      : t('photos.photos_selected_other', { count: selectedCount });

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
              <Ionicons name="camera-outline" size={22} color={C.primary} />
            </Pressable>
            <Pressable
              onPress={pickFromLibrary}
              style={styles.headerBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
            >
              <Ionicons name="images-outline" size={22} color={C.primary} />
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
                <Ionicons
                  name={cat.icon}
                  size={13}
                  color={selectedCategory === cat.key ? '#fff' : C.textSecondary}
                />
                <Text
                  style={[
                    styles.catChipText,
                    selectedCategory === cat.key && styles.catChipTextActive,
                  ]}
                >
                  {t(cat.labelKey)}
                  {count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {atPhotoLimit && (
          <View style={styles.upsellWrap}>
            <PremiumUpsell
              title={t('premium.photo_limit_title')}
              body={t('premium.photo_limit_body', { count: limit ?? 0 })}
            />
          </View>
        )}

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

        {isSelectMode && (
          <View style={styles.selectionBar}>
            <Pressable
              onPress={exitSelectMode}
              style={styles.selectionCancelBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.selectionCancelTxt}>{t('common.cancel')}</Text>
            </Pressable>

            <Text style={styles.selectionBarText}>{selectionLabel}</Text>

            <Pressable
              onPress={handleBulkDownload}
              style={[
                styles.selectionDownloadBtn,
                (selectedCount === 0 || isBulkDownloading) && styles.selectionDownloadBtnDisabled,
              ]}
              disabled={selectedCount === 0 || isBulkDownloading}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('photos.download_photo')}
              accessibilityState={{
                busy: isBulkDownloading,
                disabled: selectedCount === 0 || isBulkDownloading,
              }}
            >
              {isBulkDownloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.selectionDownloadTxt}>{t('photos.download_photo')}</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
