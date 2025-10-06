import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { getUrl } from 'aws-amplify/storage';
import { ALBUM_CONFIG, ERROR_MESSAGES, HTTP_STATUS } from './photoAlbumConstants';
import { PhotoMetadata, DownloadError } from './photoAlbumTypes';
import { logger } from './photoAlbumLogger';

class PhotoAlbumServiceImpl {
  // No longer need album management for Camera Roll saving

  // Uses MediaLibrary.saveToLibraryAsync to save directly to Camera Roll
  // Note: Permission validation handled by calling context (setting system)
  async savePhotoToAlbum(fileUri: string, metadata?: PhotoMetadata): Promise<string> {
    try {
      // Save directly to Camera Roll using write-only permission compatible API
      const assetUri = await MediaLibrary.saveToLibraryAsync(fileUri);
      logger.debug(`Photo saved to Camera Roll with asset URI: ${assetUri}`);
      
      // Generate unique ID for duplicate prevention tracking
      // Use the asset URI returned by saveToLibraryAsync + timestamp
      const uniqueId = `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.success(`Photo saved to Camera Roll with tracking ID: ${uniqueId}`);
      
      // Return unique ID for duplicate prevention tracking
      return uniqueId;
    } catch (error) {
      logger.error('Failed to save photo to Camera Roll:', error);
      throw error;
    }
  }

  // Modified to return MediaLibrary asset ID for duplicate prevention
  async saveS3PhotoToAlbum(s3Key: string, ownerIdentityId: string, metadata?: PhotoMetadata): Promise<string> {
    try {
      logger.info(`Downloading photo from S3: ${s3Key} (owner: ${ownerIdentityId})`);

      const urlResult = await getUrl({
        key: s3Key,
        options: {
          accessLevel: 'protected',
          targetIdentityId: ownerIdentityId,
        },
      });

      const downloadUrl = urlResult.url.toString();
      logger.debug(`Got download URL: ${downloadUrl.substring(0, 100)}...`);

      const fileExtension = s3Key.split('.').pop() || ALBUM_CONFIG.DEFAULT_EXTENSION;
      const tempFileName = `${ALBUM_CONFIG.TEMP_FILE_PREFIX}${Date.now()}.${fileExtension}`;
      const tempFileUri = `${FileSystem.documentDirectory}${tempFileName}`;

      logger.debug(`Downloading to: ${tempFileUri}`);
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempFileUri);

      if (downloadResult.status !== HTTP_STATUS.OK) {
        throw new DownloadError(ERROR_MESSAGES.DOWNLOAD_FAILED, downloadResult.status);
      }

      logger.debug(`Downloaded file: ${downloadResult.uri}`);

      try {
        // Save photo to album and get the MediaLibrary asset ID
        const assetId = await this.savePhotoToAlbum(downloadResult.uri, metadata);
        logger.info(`Downloaded photo saved with MediaLibrary asset ID: ${assetId}`);
        
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        logger.debug(`Cleaned up temp file: ${tempFileUri}`);
        
        // Return asset ID for duplicate prevention in PhotoSyncTask
        return assetId;
      } catch (saveError) {
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        throw saveError;
      }
    } catch (error) {
      logger.error('Failed to save S3 photo to album:', error);
      throw error;
    }
  }
}

export const photoAlbumService = new PhotoAlbumServiceImpl();