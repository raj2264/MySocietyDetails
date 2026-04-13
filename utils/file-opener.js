import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';

const MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(url) {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function getFileName(url) {
  const name = url.split('/').pop()?.split('?')[0] || `file_${Date.now()}`;
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Opens a remote file locally without exposing the URL in an external browser.
 * Downloads the file to a temp directory, then opens it with the system viewer.
 */
export async function openFileLocally(url, options = {}) {
  const { fileName, mimeType } = options;
  const resolvedName = fileName || getFileName(url);
  const resolvedMime = mimeType || getMimeType(url);
  const isRemoteUrl = /^https?:\/\//i.test(url);
  const localUri = isRemoteUrl ? FileSystem.cacheDirectory + resolvedName : url;
  let openableUri = localUri;

  try {
    if (isRemoteUrl) {
      const downloadResult = await FileSystem.downloadAsync(url, localUri);

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      if (downloadResult.uri) {
        openableUri = downloadResult.uri;
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(openableUri);
    if (!fileInfo.exists) {
      throw new Error('Downloaded file not found');
    }

    if (Platform.OS === 'android') {
      // Use FileSystem to get a content URI for the local file
      const contentUri = await FileSystem.getContentUriAsync(openableUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: resolvedMime,
      });
    } else {
      // iOS opens only local file URIs here, never remote signed URLs.
      const encodedUri = encodeURI(openableUri);
      const canOpenLocal = await Linking.canOpenURL(encodedUri);
      if (canOpenLocal) {
        await Linking.openURL(encodedUri);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(openableUri, {
          mimeType: resolvedMime,
          UTI: 'com.adobe.pdf',
        });
      } else {
        throw new Error('No supported app available to open this file');
      }
    }
  } catch (error) {
    console.error('Error opening file locally:', error);

    // Final fallback: open original URL only if local open/share fails.
    if (isRemoteUrl) {
      try {
        const canOpenRemote = await Linking.canOpenURL(url);
        if (canOpenRemote) {
          await Linking.openURL(url);
          return;
        }
      } catch (fallbackError) {
        console.error('Remote URL fallback failed:', fallbackError);
      }
    }

    Alert.alert('Error', 'Failed to open file. Please try again.');
    throw error;
  }
}
