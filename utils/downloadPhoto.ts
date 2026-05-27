import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const downloadPhotoWeb = async (url: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to save photo');
  const blob = await response.blob();
  let blobUrl: string | undefined;
  try {
    blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `housemates_${Date.now()}.jpg`;
    a.click();
  } catch {
    throw new Error('Unable to save photo');
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
};

const downloadPhotoNative = async (url: string): Promise<void> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    const e = new Error('Permission denied to access photo library');
    e.name = 'permission_denied';
    throw e;
  }
  let file: Awaited<ReturnType<typeof File.downloadFileAsync>> | undefined;
  try {
    file = await File.downloadFileAsync(url, Paths.cache);
    await MediaLibrary.saveToLibraryAsync(file.uri);
  } catch (err) {
    if (err instanceof Error && err.name === 'permission_denied') throw err;
    throw new Error('Unable to download or save the photo. Please try again.');
  } finally {
    if (file) {
      try { file.delete(); } catch { /* best-effort cache cleanup */ }
    }
  }
};

export const downloadPhotoToLibrary = async (url: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await downloadPhotoWeb(url);
    } else {
      await downloadPhotoNative(url);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'permission_denied') throw err;
    throw new Error('Failed to save photo');
  }
};
