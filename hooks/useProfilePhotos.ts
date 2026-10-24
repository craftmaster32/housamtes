import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { Alert } from '@lib/alert';
import { getErrorMessage } from '@utils/errors';
import type { CropSource } from '@components/profile/CropEditor';

export interface ProfilePhotos {
  uploading: boolean;
  uploadingCover: boolean;
  cropSource: CropSource | null;
  cancelCrop: () => void;
  handleCropConfirm: (originX: number, originY: number, cropSz: number) => Promise<void>;
  handleAvatarPress: () => void;
  handleCoverPress: () => void;
}

/**
 * Picking, cropping, uploading and removing the profile photo and the cover
 * photo. Native uses the system square crop; web opens our crop editor.
 */
export function useProfilePhotos(): ProfilePhotos {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const removeAvatar = useAuthStore((s) => s.removeAvatar);
  const uploadCover = useAuthStore((s) => s.uploadCover);
  const removeCover = useAuthStore((s) => s.removeCover);
  const loadHousemates = useHousematesStore((s) => s.load);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const cancelCrop = useCallback((): void => setCropSource(null), []);

  const handleCropConfirm = useCallback(
    async (originX: number, originY: number, cropSz: number): Promise<void> => {
      if (!cropSource) return;
      const src = cropSource;
      setCropSource(null);
      setUploading(true);
      try {
        const ops: ImageManipulator.Action[] = [];
        if (cropSz > 0 && src.imgW > 0 && src.imgH > 0) {
          ops.push({ crop: { originX, originY, width: cropSz, height: cropSz } });
        }
        ops.push({ resize: { width: 512, height: 512 } });
        const result = await ImageManipulator.manipulateAsync(src.uri, ops, {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        await uploadAvatar(result.uri, 'image/jpeg', result.base64 ?? undefined);
        // Refresh housemates so the new avatar appears everywhere (stack, members screen, drawer)
        if (houseId) loadHousemates(houseId).catch(() => {});
      } catch (err) {
        Alert.alert(
          t('profile.upload_failed'),
          getErrorMessage(err, t('profile.upload_failed_body'))
        );
      } finally {
        setUploading(false);
      }
    },
    [cropSource, uploadAvatar, houseId, loadHousemates, t]
  );

  const pickImage = useCallback(
    async (source: 'camera' | 'library'): Promise<void> => {
      // Web browsers don't support allowsEditing — open the crop editor instead.
      if (Platform.OS === 'web') {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'] as ImagePicker.MediaType[],
          quality: 1,
        });
        if (res.canceled || !res.assets[0]) return;
        const a = res.assets[0];
        setCropSource({ uri: a.uri, imgW: a.width ?? 0, imgH: a.height ?? 0 });
        return;
      }

      // Native iOS/Android: allowsEditing shows the built-in square crop UI.
      const opts = {
        mediaTypes: ['images'] as ImagePicker.MediaType[],
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.8,
        base64: true,
      };
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('profile.permission_needed'), t('profile.camera_permission_body'));
          return;
        }
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('profile.permission_needed'), t('profile.library_permission_body'));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      try {
        await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg', asset.base64 ?? undefined);
      } catch (err) {
        Alert.alert(
          t('profile.upload_failed'),
          getErrorMessage(err, t('profile.upload_failed_body'))
        );
      } finally {
        setUploading(false);
      }
    },
    [uploadAvatar, t]
  );

  const pickCover = useCallback(async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.permission_needed'), t('profile.cover_permission_body'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingCover(true);
    try {
      await uploadCover(asset.uri, asset.mimeType ?? 'image/jpeg', asset.base64 ?? undefined);
    } catch (err) {
      Alert.alert(
        t('profile.upload_failed'),
        getErrorMessage(err, t('profile.upload_cover_failed'))
      );
    } finally {
      setUploadingCover(false);
    }
  }, [uploadCover, t]);

  const handleCoverPress = useCallback((): void => {
    const options: Parameters<typeof Alert.alert>[2] = [
      { text: t('profile.choose_cover_photo'), onPress: pickCover },
    ];
    if (profile?.coverUrl) {
      options.push({
        text: t('profile.remove_cover_photo'),
        style: 'destructive',
        onPress: async () => {
          setUploadingCover(true);
          await removeCover().catch((err: unknown) => {
            Alert.alert(t('common.error'), getErrorMessage(err, t('profile.remove_cover_failed')));
          });
          setUploadingCover(false);
        },
      });
    }
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('profile.cover_photo'), t('profile.choose_option'), options);
  }, [pickCover, removeCover, profile?.coverUrl, t]);

  const handleAvatarPress = useCallback((): void => {
    // On web, file pickers must be opened synchronously from a user gesture —
    // calling them inside an Alert callback breaks the browser security model.
    if (Platform.OS === 'web') {
      pickImage('library');
      return;
    }
    const options: Parameters<typeof Alert.alert>[2] = [
      {
        text: t('photos.take_photo'),
        onPress: (): void => {
          pickImage('camera');
        },
      },
      {
        text: t('photos.choose_from_library'),
        onPress: (): void => {
          pickImage('library');
        },
      },
    ];
    if (profile?.avatarUrl) {
      options.push({
        text: t('profile.remove_photo'),
        style: 'destructive',
        onPress: async () => {
          setUploading(true);
          await removeAvatar().catch((err: unknown) => {
            Alert.alert(t('common.error'), getErrorMessage(err, t('profile.remove_photo_failed')));
          });
          setUploading(false);
        },
      });
    }
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('profile.profile_photo'), t('profile.choose_option'), options);
  }, [pickImage, removeAvatar, profile?.avatarUrl, t]);

  return {
    uploading,
    uploadingCover,
    cropSource,
    cancelCrop,
    handleCropConfirm,
    handleAvatarPress,
    handleCoverPress,
  };
}
