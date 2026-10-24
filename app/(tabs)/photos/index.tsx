import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  useWindowDimensions,
  type SectionListData,
  type ListRenderItemInfo,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
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
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { downloadPhotoToLibrary } from '@utils/downloadPhoto';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { BackLink } from '@components/shared/BackLink';
import { Mate } from '@components/shared/Mate';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { PhotoViewer } from '@components/photos/PhotoViewer';
import { PolaroidTile } from '@components/photos/PolaroidTile';
import { TapeLabel } from '@components/photos/TapeLabel';
import { SelectionBar } from '@components/photos/SelectionBar';
import { getErrorMessage } from '@utils/errors';
import { mf, ms } from '@utils/responsive';

const GRID_COLS = 3;
const PAGE_PAD = ms(20);
const TILE_GAP = ms(12);

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
    top: { paddingHorizontal: PAGE_PAD, paddingTop: ms(8) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    headerActions: { flexDirection: 'row', gap: ms(10) },
    headerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pressed: { opacity: 0.7 },
    filters: { marginTop: ms(2), marginBottom: ms(4) },
    error: { color: C.danger, fontSize: mf(13), ...font.regular, marginTop: ms(6) },
    upsell: { marginTop: ms(10) },
    listContent: { paddingHorizontal: PAGE_PAD, paddingBottom: ms(110) },
    sectionHeader: { paddingTop: ms(18), paddingBottom: ms(14) },
    gridRow: { flexDirection: 'row', gap: TILE_GAP, marginBottom: TILE_GAP + ms(4) },
    empty: { alignItems: 'center', paddingTop: ms(48), gap: ms(10) },
    emptyTitle: {
      fontSize: mf(17),
      ...font.semibold,
      color: C.textPrimary,
      textAlign: 'center',
      paddingHorizontal: ms(16),
    },
    emptyText: {
      fontSize: mf(14),
      lineHeight: mf(20),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingHorizontal: ms(24),
    },
    uploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(34,32,29,0.42)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(12),
      backgroundColor: C.background,
      paddingVertical: ms(16),
      paddingHorizontal: ms(22),
      borderRadius: ms(22),
    },
    uploadText: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
  });

function PhotosScreen(): React.JSX.Element {
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
  const headingFont = useHeadingFont('semibold');
  const { width: screenW } = useWindowDimensions();
  // Three prints a row inside the page margins (capped for tablets / web).
  const tile = (Math.min(screenW, 560) - PAGE_PAD * 2 - TILE_GAP * (GRID_COLS - 1)) / GRID_COLS;

  useEffect(() => {
    if (houseId) load(houseId);
    return (): void => {
      usePhotoStore.getState().unsubscribe();
    };
  }, [houseId, load]);

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory | 'general'>('general');
  const [viewIndex, setViewIndex] = useState(-1);
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

  // Straight-to-upload: whatever the user picks in the system gallery (single
  // or multi-select) is uploaded immediately. Captions/albums come later.
  const uploadPicked = useCallback(
    async (assets: ImagePickerAsset[]): Promise<void> => {
      if (!assets.length || !user || !houseId || !profile) return;
      // Fail closed while entitlements are still rehydrating — otherwise a
      // free user could upload past the cap in the brief window before
      // AsyncStorage confirms they aren't premium.
      if (PREMIUM_ENABLED && entitlementsLoading) {
        setError(t('common.loading'));
        return;
      }
      // Premium parked — don't enforce the free-tier photo cap while there's
      // no way to upgrade. See constants/featureFlags.ts.
      if (PREMIUM_ENABLED && !canAddPhotos(photos.length, assets.length)) {
        setError(t('photos.limit_title'));
        return;
      }
      setIsUploading(true);
      setUploadProgress({ current: 0, total: assets.length });
      try {
        for (let i = 0; i < assets.length; i++) {
          setUploadProgress({ current: i + 1, total: assets.length });
          const asset = assets[i];
          await upload({
            localUri: asset.uri,
            fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
            mimeType: asset.mimeType ?? 'image/jpeg',
            caption: '',
            category: 'general',
            uploadedBy: profile.name,
            userId: user.id,
            houseId,
          });
        }
      } catch (err) {
        setError(getErrorMessage(err, t('photos.upload_failed')));
      } finally {
        // A failed refresh must not leave the blocking overlay stuck on screen,
        // so reset the upload state even if load() rejects.
        try {
          await load(houseId);
        } catch {
          /* keep going — the overlay must always clear */
        } finally {
          setIsUploading(false);
          setUploadProgress({ current: 0, total: 0 });
        }
      }
    },
    [user, houseId, profile, photos.length, canAddPhotos, entitlementsLoading, upload, load, t]
  );

  const pickFromCamera = useCallback(async (): Promise<void> => {
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        setError(t('photos.permission_denied'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        await uploadPicked([result.assets[0]]);
      }
    } catch {
      setError(t('photos.camera_error'));
    }
  }, [t, uploadPicked]);

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
        await uploadPicked(result.assets);
      }
    } catch {
      setError(t('photos.library_error'));
    }
  }, [t, uploadPicked]);

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

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<PhotoRow, PhotoSection> }) => (
      <View style={styles.sectionHeader}>
        <TapeLabel label={section.title} />
      </View>
    ),
    [styles]
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<PhotoRow>) => (
      <View style={styles.gridRow}>
        {item.map((photo, i) => {
          const label = photo.caption || t('photos.photo_by', { name: photo.uploadedBy });
          return (
            <PolaroidTile
              key={photo.id}
              photo={photo}
              size={tile}
              index={i + (photo.id.charCodeAt(0) % 2)}
              selectMode={isSelectMode}
              selected={selectedIds.has(photo.id)}
              label={label}
              onPress={handlePhotoPress}
              onLongPress={handlePhotoLongPress}
            />
          );
        })}
      </View>
    ),
    [styles, tile, selectedIds, isSelectMode, handlePhotoPress, handlePhotoLongPress, t]
  );

  const filterWords = useMemo<ChoiceWord<PhotoCategory | 'general'>[]>(
    () =>
      PHOTO_CATEGORIES.map((cat) => ({
        value: cat.key,
        label: `${t(cat.labelKey)}${counts[cat.key] > 0 ? ` ${counts[cat.key]}` : ''}`,
      })),
    [counts, t]
  );

  const EmptyComponent = useMemo(
    () => (
      <View style={styles.empty}>
        <Mate size={ms(80)} />
        <Text style={styles.emptyTitle}>{t('photos.no_photos')}</Text>
        <Text style={styles.emptyText}>{t('photos.no_photos_hint')}</Text>
      </View>
    ),
    [styles, t]
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
          <LoadingSpinner size={140} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.flex}>
        <View style={styles.top}>
          <BackLink label={t('common.home')} />
          <View style={styles.header}>
            <Text style={[styles.title, headingFont]}>{t('photos.title')}</Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={pickFromCamera}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('photos.take_photo')}
              >
                <Ionicons name="camera-outline" size={22} color={C.primary} />
              </Pressable>
              <Pressable
                onPress={pickFromLibrary}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('photos.choose_from_library')}
              >
                <Ionicons name="images-outline" size={22} color={C.primary} />
              </Pressable>
            </View>
          </View>
          <View style={styles.filters}>
            <ChoiceWords
              options={filterWords}
              selected={selectedCategory}
              onSelect={onSelectCategory}
              groupLabel={t('photos.category')}
            />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {atPhotoLimit && (
            <View style={styles.upsell}>
              <PremiumUpsell
                title={t('premium.photo_limit_title')}
                body={t('premium.photo_limit_body', { count: limit ?? 0 })}
              />
            </View>
          )}
        </View>

        <SectionList<PhotoRow, PhotoSection>
          sections={sections}
          keyExtractor={(row, i) => `${row[0]?.id ?? 'empty'}-${i}`}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={EmptyComponent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={6}
          windowSize={7}
          updateCellsBatchingPeriod={50}
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

        {isUploading && (
          <View style={styles.uploadOverlay} pointerEvents="auto">
            <View style={styles.uploadCard}>
              <LoadingSpinner />
              <Text style={styles.uploadText}>
                {uploadProgress.total > 1
                  ? t('photos.uploading_progress', {
                      current: uploadProgress.current,
                      total: uploadProgress.total,
                    })
                  : t('photos.uploading')}
              </Text>
            </View>
          </View>
        )}

        {isSelectMode && (
          <SelectionBar
            count={selectedCount}
            label={selectionLabel}
            busy={isBulkDownloading}
            onCancel={exitSelectMode}
            onSave={handleBulkDownload}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default withFeatureGuard('photos', PhotosScreen);
