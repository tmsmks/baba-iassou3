import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export async function openAppSettings() {
  await Linking.openSettings().catch(() => {});
}

/** Télécharge une photo distante et l'enregistre dans la galerie (ou ouvre le partage). */
export async function downloadPhotoToDevice(imageUrl: string): Promise<'saved' | 'shared'> {
  const ext = /\.png(\?|$)/i.test(imageUrl) ? 'png' : 'jpg';
  const localUri = `${FileSystem.cacheDirectory ?? ''}iassou3-photo-${Date.now()}.${ext}`;
  const { uri, status } = await FileSystem.downloadAsync(imageUrl, localUri);
  if (status !== 200) {
    throw new Error('DOWNLOAD_FAILED');
  }

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (permission.granted) {
    await MediaLibrary.saveToLibraryAsync(uri);
    return 'saved';
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: ext === 'png' ? 'image/png' : 'image/jpeg' });
    return 'shared';
  }

  throw new Error('SAVE_PERMISSION_DENIED');
}
