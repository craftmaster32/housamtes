import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export const downloadPhotoToLibrary = async (url: string): Promise<void> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('permission_denied');
  }
  const file = await File.downloadFileAsync(url, Paths.cache);
  await MediaLibrary.saveToLibraryAsync(file.uri);
};
