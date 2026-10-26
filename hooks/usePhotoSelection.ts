import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePhotoStore, type Photo } from '@stores/photoStore';
import { Alert } from '@lib/alert';
import { downloadPhotoToLibrary } from '@utils/downloadPhoto';
import { getErrorMessage } from '@utils/errors';

export interface PhotoSelection {
  isSelectMode: boolean;
  selectedIds: Set<string>;
  /** How many of the chosen photos this person added (the only ones they may delete). */
  deletableCount: number;
  allSelected: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  start: (photoId?: string) => void;
  exit: () => void;
  toggle: (photoId: string) => void;
  toggleAll: () => void;
  saveSelected: () => Promise<void>;
  deleteSelected: () => void;
}

/**
 * Select mode for the Photos grid, like a phone's gallery: pick prints, then
 * save them all to the phone or delete them all at once. Only photos you added
 * can be deleted; the confirm note says so when the pick mixes in others'.
 */
export function usePhotoSelection(
  photos: Photo[],
  visible: Photo[],
  currentUserId: string | undefined
): PhotoSelection {
  const { t } = useTranslation();
  const removeMany = usePhotoStore((s) => s.removeMany);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  const chosen = useMemo(() => photos.filter((p) => selectedIds.has(p.id)), [photos, selectedIds]);
  const deletable = useMemo(
    () => chosen.filter((p) => !!currentUserId && p.userId === currentUserId),
    [chosen, currentUserId]
  );
  const allSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

  const exit = useCallback((): void => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const start = useCallback((photoId?: string): void => {
    setIsSelectMode(true);
    setSelectedIds(new Set(photoId ? [photoId] : []));
  }, []);

  const toggle = useCallback((photoId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }, []);

  const toggleAll = useCallback((): void => {
    setSelectedIds(allSelected ? new Set() : new Set(visible.map((p) => p.id)));
  }, [allSelected, visible]);

  const saveSelected = useCallback(async (): Promise<void> => {
    const toSave = photos.filter((p) => selectedRef.current.has(p.id));
    if (toSave.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      for (const photo of toSave) {
        await downloadPhotoToLibrary(photo.url);
      }
      exit();
      const count = toSave.length;
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
      setIsSaving(false);
    }
  }, [photos, isSaving, exit, t]);

  const deleteSelected = useCallback((): void => {
    if (chosen.length === 0 || isDeleting) return;
    if (deletable.length === 0) {
      Alert.alert(t('photos.delete_photo'), t('photos.delete_many_none'));
      return;
    }
    const count = deletable.length;
    const title =
      count === 1
        ? t('photos.delete_many_title_one')
        : t('photos.delete_many_title_other', { count });
    const body =
      count < chosen.length
        ? t('photos.delete_many_partial', { count, total: chosen.length })
        : t('photos.delete_many_confirm');
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async (): Promise<void> => {
          setIsDeleting(true);
          try {
            await removeMany(deletable.map((p) => ({ id: p.id, storagePath: p.storagePath })));
            exit();
          } catch (err) {
            Alert.alert(t('common.error'), getErrorMessage(err, t('photos.delete_error')));
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  }, [chosen, deletable, isDeleting, removeMany, exit, t]);

  return {
    isSelectMode,
    selectedIds,
    deletableCount: deletable.length,
    allSelected,
    isSaving,
    isDeleting,
    start,
    exit,
    toggle,
    toggleAll,
    saveSelected,
    deleteSelected,
  };
}
