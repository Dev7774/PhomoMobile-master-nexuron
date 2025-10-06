/**
 * Constants and configuration for photo album functionality
 */

export const ALBUM_CONFIG = {
  /** Name of the album created in user's photo library */
  ALBUM_NAME: 'PhomoCam',
  
  /** Default file extension for downloaded photos */
  DEFAULT_EXTENSION: 'jpg',
  
  /** Prefix for temporary photo files */
  TEMP_FILE_PREFIX: 'temp_photo_',
} as const;

export const STORAGE_KEYS = {
  /** AsyncStorage key for tracking downloaded photo IDs (auto-sync only) */
  DOWNLOADED_PHOTOS: 'phomo_downloaded_photos',
  
  /** AsyncStorage key for last background sync timestamp */
  LAST_BACKGROUND_SYNC: 'phomo_last_background_sync',
  
  /** AsyncStorage key prefix for individual photo processing status */
  PHOTO_PROCESSED_PREFIX: 'phomo_processed_',
  
  /** AsyncStorage key for pending synced photos awaiting user review */
  PENDING_SYNCED_PHOTOS: 'phomo_pending_synced_photos',
  
  /** AsyncStorage key for tracking photos accessible with limited permissions (iOS) */
  LIMITED_ACCESS_PHOTOS: 'phomo_limited_access_photos',
  
  /** AsyncStorage key for tracking currently syncing photo IDs */
  SYNCING_PHOTOS: 'phomo_syncing_photos',
  
  /** AsyncStorage key for tracking syncing photo timestamps */
  SYNCING_TIMESTAMPS: 'phomo_syncing_timestamps',
} as const;

export const ERROR_MESSAGES = {
  PERMISSION_DENIED: 'Photo library permission denied',
  ALBUM_CREATION_REQUIRES_ASSET: 'Album creation requires an asset - will be created on first photo save',
  DOWNLOAD_FAILED: 'Failed to download photo',
  SYNC_FAILED: 'Photo sync failed',
  STORAGE_ERROR: 'Failed to access local storage',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
} as const;

/**
 * Configuration for logging behavior
 */
export const LOGGING_CONFIG = {
  /** Enable debug logging in development */
  ENABLE_DEBUG_LOGS: __DEV__,
  
  /** Enable performance monitoring */
  ENABLE_PERFORMANCE_LOGS: __DEV__,
} as const;

/**
 * Limits and constraints for photo operations
 */
export const PHOTO_LIMITS = {
  /** Maximum number of photos to sync in one batch */
  MAX_SYNC_BATCH_SIZE: 50,
  
  /** Timeout for photo downloads in milliseconds */
  DOWNLOAD_TIMEOUT_MS: 30000,
} as const;