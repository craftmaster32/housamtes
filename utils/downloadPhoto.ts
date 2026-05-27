import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export const downloadPhotoToLibrary = async (url: string): Promise<void> => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('permission_denied');
    }
    const file = await File.downloadFileAsync(url, Paths.cache);
    try {
      await MediaLibrary.saveToLibraryAsync(file.uri);
    } finally {
      try { file.delete(); } catch { /* swallow — cache cleanup is best-effort */ }
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'permission_denied') throw err;
    throw new Error('Failed to save photo');
  }
};
