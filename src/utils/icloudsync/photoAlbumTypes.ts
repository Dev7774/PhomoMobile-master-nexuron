/**
 * Type definitions for photo album functionality
 */

/**
 * Metadata associated with a photo when saving to album
 */
export interface PhotoMetadata {
  /** Display title for the photo */
  title?: string;
  /** Description or caption for the photo */
  description?: string;
  /** Tags associated with the photo */
  tags?: string[];
}

/**
 * Result of a photo sync operation
 */
export interface SyncResult {
  /** Number of photos successfully synced to album */
  newPhotosSynced: number;
  /** Total number of photos processed in this sync */
  totalPhotosProcessed: number;
  /** Array of error messages for failed operations */
  errors: string[];
}

/**
 * Photo data structure used internally for sync operations
 */
export interface SyncPhoto {
  /** Unique photo ID */
  id: string;
  /** S3 key for the photo */
  s3Key: string;
  /** Username of photo owner */
  ownerUsername: string;
  /** AWS Cognito Identity ID of photo owner */
  ownerIdentityId: string;
  /** Source camera name or 'Face-matched' */
  cameraName: string;
  /** Source type of the photo */
  source: 'shared_camera' | 'face_match';
}

/**
 * GraphQL response types (replacing any types)
 */
export interface GraphQLPhoto {
  id: string;
  ownerId: string;
  ownerIdentityId: string;
  sharedCameraId?: string;
  s3Key: string;
  thumbKey?: string;
  createdAt: string;
  updatedAt: string;
  _version: number;
  _deleted?: boolean;
  _lastChangedAt: number;
}

export interface GraphQLSharedCameraMember {
  id: string;
  cameraId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'INVITED';
  addedAt: string;
  createdAt: string;
  updatedAt: string;
  _version: number;
  _deleted?: boolean;
  _lastChangedAt: number;
}

export interface GraphQLPhotoRecipient {
  id: string;
  photoId: string;
  recipientId: string;
  confidence?: number;
  method?: string;
  seenAt?: string;
  createdAt: string;
  updatedAt: string;
  _version: number;
  _deleted?: boolean;
  _lastChangedAt: number;
}

/**
 * Custom error types for better error handling
 */
export class PhotoAlbumError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PhotoAlbumError';
  }
}

export class PhotoSyncError extends Error {
  constructor(
    message: string,
    public readonly photoId: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PhotoSyncError';
  }
}

export class PermissionError extends PhotoAlbumError {
  constructor(message: string = 'Photo library permission denied') {
    super(message, 'PERMISSION_DENIED');
    this.name = 'PermissionError';
  }
}

export class DownloadError extends PhotoAlbumError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    originalError?: Error
  ) {
    super(message, 'DOWNLOAD_FAILED', originalError);
    this.name = 'DownloadError';
  }
}

/**
 * Types for pending synced photos feature
 */
export interface PendingSyncedPhoto {
  /** MediaLibrary asset ID */
  id: string;
  /** Photo filename */
  filename: string;
  /** Creation timestamp */
  creationTime: number;
  /** Local URI for preview */
  uri: string;
  /** When this photo was detected during sync */
  detectedAt: string;
}

export interface PendingSyncedPhotosBatch {
  /** Unique batch ID */
  batchId: string;
  /** When this batch was created */
  createdAt: string;
  /** Array of photos in this batch */
  photos: PendingSyncedPhoto[];
  /** Whether user has been notified about this batch */
  notified: boolean;
  /** Whether user has reviewed this batch */
  reviewed: boolean;
}

/**
 * Result of collecting device photos for manual upload review
 * Used by photoSyncManager for the manual sync button flow
 */
export interface ManualSyncResult {
  /** Batch ID if new photos were collected, null if no new photos */
  batchId: string | null;
  /** Number of photos collected for review */
  photosCollected: number;
  /** Whether sync was skipped due to existing unreviewed batches */
  skippedDueToExisting?: boolean;
}