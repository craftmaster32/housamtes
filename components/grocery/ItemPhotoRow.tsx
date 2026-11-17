import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  type ImageStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface ItemPhotoRowProps {
  /** Item name — the photo is remembered for every item with this name. */
  name: string;
  photoUrl?: string;
  onSetPhoto: (name: string, localUri: string) => Promise<void>;
  onRemovePhoto: (name: string) => Promise<void>;
}

/** Photo of the product in the item popup: take one, pick one, or remove it. */
export function ItemPhotoRow({
  name,
  photoUrl,
  onSetPhoto,
  onRemovePhoto,
}: ItemPhotoRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(), []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const pickPhotoFrom = useCallback(
    async (source: 'camera' | 'library'): Promise<void> => {
      if (photoBusy) return;
      setPhotoError(null);
      try {
        if (source === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            setPhotoError(t('grocery.shop.camera_denied'));
            return;
          }
        }
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
        const asset = result.canceled ? undefined : result.assets[0];
        if (!asset) return;
        setPhotoBusy(true);
        await onSetPhoto(name, asset.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        setPhotoError(t('grocery.photo_save_failed'));
      } finally {
        setPhotoBusy(false);
      }
    },
    [name, photoBusy, onSetPhoto, t]
  );
  const takePhoto = useCallback((): void => void pickPhotoFrom('camera'), [pickPhotoFrom]);
  const choosePhoto = useCallback((): void => void pickPhotoFrom('library'), [pickPhotoFrom]);
  const removePhoto = useCallback(async (): Promise<void> => {
    if (photoBusy) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await onRemovePhoto(name);
    } catch {
      setPhotoError(t('grocery.photo_remove_failed'));
    } finally {
      setPhotoBusy(false);
    }
  }, [name, photoBusy, onRemovePhoto, t]);

  return (
    <View style={s.photoRow}>
      <View style={[s.photoTile, { backgroundColor: C.surfaceSecondary, borderColor: C.border }]}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={s.photoImg as ImageStyle}
            accessible
            accessibilityLabel={t('grocery.photo_of', { name: name })}
          />
        ) : (
          <Ionicons name="image-outline" size={26} color={C.textTertiary} />
        )}
        {photoBusy && (
          <View style={s.photoBusy}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={s.photoSide}>
        <View style={s.photoBtns}>
          <Pressable
            onPress={takePhoto}
            disabled={photoBusy}
            style={({ pressed }) => [
              s.photoBtn,
              { borderColor: C.border },
              (pressed || photoBusy) && s.dim,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: photoBusy }}
            accessibilityLabel={t('grocery.shop.take_photo')}
          >
            <Ionicons name="camera-outline" size={18} color={C.textPrimary} />
            <Text style={[s.photoBtnText, { color: C.textPrimary }]}>
              {t('grocery.photo_take')}
            </Text>
          </Pressable>
          <Pressable
            onPress={choosePhoto}
            disabled={photoBusy}
            style={({ pressed }) => [
              s.photoBtn,
              { borderColor: C.border },
              (pressed || photoBusy) && s.dim,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: photoBusy }}
            accessibilityLabel={t('grocery.shop.choose_photo')}
          >
            <Ionicons name="images-outline" size={18} color={C.textPrimary} />
            <Text style={[s.photoBtnText, { color: C.textPrimary }]}>
              {t('grocery.photo_choose')}
            </Text>
          </Pressable>
          {!!photoUrl && (
            <Pressable
              onPress={removePhoto}
              disabled={photoBusy}
              style={({ pressed }) => [s.photoIconBtn, (pressed || photoBusy) && s.dim]}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.photo_remove')}
            >
              <Ionicons name="trash-outline" size={18} color={C.textSecondary} />
            </Pressable>
          )}
        </View>
        <Text style={[s.photoHint, { color: photoError ? C.danger : C.textSecondary }]}>
          {photoError ?? t('grocery.photo_hint', { name: name })}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
    photoTile: {
      width: ms(72),
      height: ms(72),
      borderRadius: ms(12),
      borderWidth: 1,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoImg: { width: '100%', height: '100%' },
    photoBusy: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoSide: { flex: 1, minWidth: 0, gap: ms(6) },
    photoBtns: { flexDirection: 'row', alignItems: 'center', gap: ms(8), flexWrap: 'wrap' },
    photoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      minHeight: 44,
      paddingHorizontal: ms(12),
      borderRadius: ms(12),
      borderWidth: 1,
    },
    photoBtnText: { fontSize: mf(14), ...font.semibold },
    photoIconBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
    photoHint: { fontSize: mf(12), ...font.medium },
    dim: { opacity: 0.5 },
  });
}
