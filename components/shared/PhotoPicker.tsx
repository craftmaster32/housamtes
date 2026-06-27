import { useCallback } from 'react';
import { View, Image, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';

interface PhotoPickerProps {
  photos: string[]; // full data URLs
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoPicker({ photos, onChange, maxPhotos = 6 }: PhotoPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const handlePick = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.75,
        base64: true,
        selectionLimit: maxPhotos - photos.length,
      });

      if (result.canceled) return;

      const dataUrls = result.assets
        .filter((a) => a.base64)
        .map((a) => `data:image/jpeg;base64,${a.base64 ?? ''}`);

      onChange([...photos, ...dataUrls]);
    } catch {
      Alert.alert(t('common.error'), t('photos.pick_failed'));
    }
  }, [photos, onChange, maxPhotos, t]);

  const removePhoto = useCallback((idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  }, [photos, onChange]);

  return (
    <View style={styles.container}>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
          {photos.map((src, i) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: src }} style={styles.thumb} />
              <Pressable style={styles.removeBtn} onPress={() => removePhoto(i)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {photos.length < maxPhotos && (
        <Pressable style={styles.addBtn} onPress={handlePick}>
          <Text style={styles.addBtnText}>{t('photos.add_photo')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: sizes.sm },
  thumbnailRow: { flexDirection: 'row' },
  thumbWrap: { position: 'relative', marginEnd: sizes.sm },
  thumb: { width: 80, height: 80, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border },
  removeBtn: {
    position: 'absolute', top: -6, end: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: sizes.xs,
    paddingHorizontal: sizes.md, paddingVertical: sizes.sm,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: sizes.borderRadius, alignSelf: 'flex-start',
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: sizes.fontSm },
});
