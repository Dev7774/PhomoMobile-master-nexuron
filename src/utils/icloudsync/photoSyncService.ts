import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sharedCameraMembersByUserIdAndCameraId,
  photosBySharedCameraIdAndCreatedAt,
  photoRecipientsByRecipientIdAndPhotoId,
  getPhoto,
} from "@/src/graphql/queries";
import { photoAlbumService } from "./photoAlbumService";
import { STORAGE_KEYS } from "./photoAlbumConstants";

const client = generateClient();

export interface PhotoSyncService {
  syncReceivedPhotosToAlbum: () => Promise<SyncResult>;
}

export interface SyncResult {
  newPhotosSynced: number;
  totalPhotosProcessed: number;
  errors: string[];
}

class PhotoSyncServiceImpl implements PhotoSyncService {
  // Download queue management
  private downloadQueue = new Set<string>();
  private syncLocks = new Set<string>();
  private readonly maxConcurrentDownloads = 3;
  private readonly syncTimeoutMs = 300000; // 5 minutes
  private readonly PAGE_SIZE = 50; // Standardized page size for all pagination
  
  // AsyncStorage operation locks to prevent race conditions
  private syncedPhotosLock = false;
  private syncingPhotosLock = false;
  
  // Global sync lock to prevent multiple auto-sync sessions
  private globalSyncLock = false;
  
  async getSyncedPhotoIds(): Promise<Set<string>> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_PHOTOS);
      if (stored) {
        const photoIds = JSON.parse(stored);
        return new Set(photoIds);
      }
    } catch (error) {
      console.warn('Failed to load synced photo IDs:', error);
    }
    return new Set();
  }

  private async setSyncedPhotoIds(photoIds: Set<string>): Promise<void> {
    try {
      const photoIdArray = Array.from(photoIds);
      await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_PHOTOS, JSON.stringify(photoIdArray));
    } catch (error) {
      console.warn('Failed to save synced photo IDs:', error);
    }
  }

  private async markPhotoAsSynced(photoId: string): Promise<void> {
    // Atomic operation with lock to prevent race conditions
    while (this.syncedPhotosLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.syncedPhotosLock = true;
    try {
      const syncedPhotos = await this.getSyncedPhotoIds();
      syncedPhotos.add(photoId);
      await this.setSyncedPhotoIds(syncedPhotos);
    } finally {
      this.syncedPhotosLock = false;
    }
  }

  private async removePhotoFromSyncedList(photoId: string): Promise<void> {
    // Atomic operation with lock to prevent race conditions
    while (this.syncedPhotosLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.syncedPhotosLock = true;
    try {
      const syncedPhotos = await this.getSyncedPhotoIds();
      syncedPhotos.delete(photoId);
      await this.setSyncedPhotoIds(syncedPhotos);
    } finally {
      this.syncedPhotosLock = false;
    }
  }

  async getSyncingPhotoIds(): Promise<Set<string>> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNCING_PHOTOS);
      if (stored) {
        const photoIds = JSON.parse(stored);
        return new Set(photoIds);
      }
    } catch (error) {
      console.warn('Failed to get syncing photo IDs:', error);
    }
    return new Set();
  }

  private async setSyncingPhotoIds(photoIds: Set<string>): Promise<void> {
    try {
      const photoIdArray = Array.from(photoIds);
      await AsyncStorage.setItem(STORAGE_KEYS.SYNCING_PHOTOS, JSON.stringify(photoIdArray));
    } catch (error) {
      console.warn('Failed to save syncing photo IDs:', error);
    }
  }

  async getSyncingTimestamps(): Promise<Record<string, number>> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNCING_TIMESTAMPS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to get syncing timestamps:', error);
    }
    return {};
  }

  private async setSyncingTimestamps(timestamps: Record<string, number>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNCING_TIMESTAMPS, JSON.stringify(timestamps));
    } catch (error) {
      console.warn('Failed to save syncing timestamps:', error);
    }
  }

  async markPhotoAsSyncing(photoId: string): Promise<void> {
    // Atomic operation with lock to prevent race conditions
    while (this.syncingPhotosLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.syncingPhotosLock = true;
    try {
      const [syncingPhotos, timestamps] = await Promise.all([
        this.getSyncingPhotoIds(),
        this.getSyncingTimestamps()
      ]);
      
      syncingPhotos.add(photoId);
      timestamps[photoId] = Date.now();
      
      await Promise.all([
        this.setSyncingPhotoIds(syncingPhotos),
        this.setSyncingTimestamps(timestamps)
      ]);
    } finally {
      this.syncingPhotosLock = false;
    }
  }

  async unmarkPhotoAsSyncing(photoId: string): Promise<void> {
    // Atomic operation with lock to prevent race conditions
    while (this.syncingPhotosLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.syncingPhotosLock = true;
    try {
      const [syncingPhotos, timestamps] = await Promise.all([
        this.getSyncingPhotoIds(),
        this.getSyncingTimestamps()
      ]);
      
      syncingPhotos.delete(photoId);
      delete timestamps[photoId];
      
      await Promise.all([
        this.setSyncingPhotoIds(syncingPhotos),
        this.setSyncingTimestamps(timestamps)
      ]);
    } finally {
      this.syncingPhotosLock = false;
    }
  }

  async cleanupStaleSyncingPhotos(timeoutMs: number = 60000): Promise<string[]> {
    const [syncingPhotos, timestamps] = await Promise.all([
      this.getSyncingPhotoIds(),
      this.getSyncingTimestamps()
    ]);

    const now = Date.now();
    const stalePhotoIds: string[] = [];
    
    for (const photoId of syncingPhotos) {
      const timestamp = timestamps[photoId];
      if (!timestamp || (now - timestamp) > timeoutMs) {
        stalePhotoIds.push(photoId);
        syncingPhotos.delete(photoId);
        delete timestamps[photoId];
      }
    }

    if (stalePhotoIds.length > 0) {
      await Promise.all([
        this.setSyncingPhotoIds(syncingPhotos),
        this.setSyncingTimestamps(timestamps)
      ]);
    }

    return stalePhotoIds;
  }

  async removePhotoFromSyncState(photoId: string): Promise<void> {
    const [syncedPhotos, syncingPhotos, timestamps] = await Promise.all([
      this.getSyncedPhotoIds(),
      this.getSyncingPhotoIds(),
      this.getSyncingTimestamps()
    ]);

    syncedPhotos.delete(photoId);
    syncingPhotos.delete(photoId);
    delete timestamps[photoId];

    await Promise.all([
      this.setSyncedPhotoIds(syncedPhotos),
      this.setSyncingPhotoIds(syncingPhotos),
      this.setSyncingTimestamps(timestamps)
    ]);

    // Also clean up in-memory locks and queue
    this.syncLocks.delete(photoId);
    this.downloadQueue.delete(photoId);
  }

  // Queue management methods
  getQueueStatus(): { active: number; max: number; locked: number } {
    return {
      active: this.downloadQueue.size,
      max: this.maxConcurrentDownloads,
      locked: this.syncLocks.size
    };
  }

  isPhotoSyncInProgress(photoId: string): boolean {
    return this.syncLocks.has(photoId) || this.downloadQueue.has(photoId);
  }

  async isPhotoAlreadySynced(photoId: string): Promise<boolean> {
    const syncedPhotos = await this.getSyncedPhotoIds();
    return syncedPhotos.has(photoId);
  }

  async savePhotoToAlbumWithTracking(
    photoId: string,
    s3Key: string, 
    ownerIdentityId: string,
    metadata?: { title?: string; description?: string }
  ): Promise<string> {
    // Check download queue limit
    if (this.downloadQueue.size >= this.maxConcurrentDownloads) {
      throw new Error(`Download queue full (${this.downloadQueue.size}/${this.maxConcurrentDownloads}). Please wait and try again.`);
    }

    // Atomic lock acquisition - check and set in one operation
    if (this.syncLocks.has(photoId)) {
      throw new Error('Photo sync already in progress');
    }
    
    // Immediately acquire lock before any async operations
    this.syncLocks.add(photoId);
    
    try {
      // Now safely check persistent state with lock held
      const syncingPhotos = await this.getSyncingPhotoIds();
      if (syncingPhotos.has(photoId)) {
        // Release lock and throw
        this.syncLocks.delete(photoId);
        throw new Error('Photo is already being synced');
      }
      
      // Add to queue only after all checks pass
      this.downloadQueue.add(photoId);
      
      // Mark as syncing
      await this.markPhotoAsSyncing(photoId);

      // Save to album with timeout
      // Mark as synced BEFORE download to prevent duplicates if app is killed mid-sync
      await this.markPhotoAsSynced(photoId);

      const downloadPromise = photoAlbumService.saveS3PhotoToAlbum(
        s3Key,
        ownerIdentityId,
        metadata
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Photo download timeout')), this.syncTimeoutMs);
      });

      const assetId = await Promise.race([downloadPromise, timeoutPromise]);

      // Clean up syncing state
      await this.unmarkPhotoAsSyncing(photoId);

      // Save processing metadata
      const processedKey = `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${assetId}`;
      await AsyncStorage.setItem(
        processedKey,
        JSON.stringify({
          processedAt: new Date().toISOString(),
          photoId: photoId,
          source: 'downloaded_photo',
          assetId: assetId
        })
      );

      return assetId;
    } catch (error) {
      // Clean up syncing state on error and remove from synced list since download failed
      await Promise.all([
        this.unmarkPhotoAsSyncing(photoId),
        this.removePhotoFromSyncedList(photoId)
      ]);
      throw error;
    } finally {
      // Always clean up locks and queue
      this.syncLocks.delete(photoId);
      this.downloadQueue.delete(photoId);
    }
  }

  async syncReceivedPhotosToAlbum(checkSyncEnabled?: () => boolean): Promise<SyncResult> {
    // Prevent multiple simultaneous sync sessions
    if (this.globalSyncLock) {
      console.log('🛑 Sync already in progress, skipping duplicate request');
      return {
        newPhotosSynced: 0,
        totalPhotosProcessed: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.globalSyncLock = true;
    const result: SyncResult = {
      newPhotosSynced: 0,
      totalPhotosProcessed: 0,
      errors: [],
    };

    try {
      // Clean up any stale syncing photos from previous crashed sessions
      const stalePhotos = await this.cleanupStaleSyncingPhotos(this.syncTimeoutMs);
      if (stalePhotos.length > 0) {
        console.log(`🧹 Cleaned up ${stalePhotos.length} stale syncing photos from previous session`);
      }
      
      const { username: me } = await getCurrentUser();
      
      // Get already synced photo IDs - ONLY for auto-sync deduplication
      const syncedPhotoIds = await this.getSyncedPhotoIds();

      // Get photos from shared cameras
      const sharedCameraPhotos = await this.getSharedCameraPhotos(me, checkSyncEnabled);
      
      // Get photos shared via face recognition
      const faceMatchPhotos = await this.getFaceMatchPhotos(me, checkSyncEnabled);

      const allPhotos = [...sharedCameraPhotos, ...faceMatchPhotos];
      
      // Filter out already synced photos - ONLY for auto-sync
      const newPhotos = allPhotos.filter(photo => !syncedPhotoIds.has(photo.id));
      
      result.totalPhotosProcessed = newPhotos.length;
      const totalPhotosFound = allPhotos.length; // Save count before clearing
      
      // Free memory by clearing arrays we no longer need
      sharedCameraPhotos.length = 0;
      faceMatchPhotos.length = 0;
      allPhotos.length = 0;

      console.log(`📥 Found ${newPhotos.length} new photos to sync to album (${totalPhotosFound} total, ${syncedPhotoIds.size} already synced)`);

      // Process each new photo with queue management
      for (const photo of newPhotos) {
        // Check if sync is still enabled before processing each photo
        if (checkSyncEnabled && !checkSyncEnabled()) {
          console.log('🛑 Auto-sync disabled during processing, stopping sync');
          break;
        }

        // Skip if already being synced or queue is full
        if (this.isPhotoSyncInProgress(photo.id)) {
          console.log(`⏭️ Skipping photo ${photo.id} - sync already in progress`);
          continue;
        }

        if (this.downloadQueue.size >= this.maxConcurrentDownloads) {
          console.log(`⏭️ Queue full (${this.downloadQueue.size}/${this.maxConcurrentDownloads}), processing remaining photos later`);
          break;
        }

        // Acquire sync lock
        this.syncLocks.add(photo.id);
        this.downloadQueue.add(photo.id);
        
        try {
          console.log(`📥 Starting download for photo ${photo.id} from ${photo.ownerUsername}`);
          
          // Mark as syncing in AsyncStorage
          await this.markPhotoAsSyncing(photo.id);
          
          // Save photo to album with timeout
          const downloadPromise = photoAlbumService.saveS3PhotoToAlbum(
            photo.s3Key, 
            photo.ownerIdentityId,
            {
              title: photo.source === 'shared_camera' ? `Shared Event: ${photo.cameraName}` : 'Face-matched Photo',
              description: `Photo from ${photo.ownerUsername} via PhomoCam`,
            }
          );

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Photo download timeout')), this.syncTimeoutMs);
          });

          const assetId = await Promise.race([downloadPromise, timeoutPromise]);
          
          console.log(`📱 Photo ${photo.id} saved to album with MediaLibrary asset ID: ${assetId}`);
          
          // CRITICAL: Mark as processed in PhotoSyncTask format to prevent duplicate upload
          const processedKey = `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${assetId}`;
          await AsyncStorage.setItem(
            processedKey,
            JSON.stringify({
              processedAt: new Date().toISOString(),
              photoId: photo.id, // PhomoCam photo ID
              source: 'downloaded_photo',
              ownerUsername: photo.ownerUsername,
              assetId: assetId // MediaLibrary asset ID
            })
          );
          
          console.log(`🔒 Marked asset ${assetId} as processed to prevent duplicate upload`);
          
          // Mark as synced in auto-sync tracking and clean up syncing state
          await Promise.all([
            this.markPhotoAsSynced(photo.id),
            this.unmarkPhotoAsSyncing(photo.id)
          ]);
          
          result.newPhotosSynced++;
          console.log(`✅ Successfully synced photo ${photo.id} to album (asset: ${assetId})`);
        } catch (error) {
          const errorMsg = `Failed to sync photo ${photo.id}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          
          // Clean up syncing state on error
          await this.unmarkPhotoAsSyncing(photo.id).catch(cleanupError => {
            console.warn(`Failed to cleanup syncing state for photo ${photo.id}:`, cleanupError);
          });
        } finally {
          // Always clean up locks and queue
          this.syncLocks.delete(photo.id);
          this.downloadQueue.delete(photo.id);
        }
      }

      console.log(`📱 Album sync complete: ${result.newPhotosSynced}/${result.totalPhotosProcessed} photos synced`);
      
      return result;
    } catch (error) {
      const errorMsg = `Photo sync failed: ${error}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
      return result;
    } finally {
      // Always release the global sync lock
      this.globalSyncLock = false;
    }
  }

  private async getSharedCameraPhotos(userId: string, checkSyncEnabled?: () => boolean) {
    const photos: Array<{
      id: string;
      s3Key: string;
      ownerUsername: string;
      ownerIdentityId: string;
      cameraName: string;
      source: 'shared_camera';
    }> = [];

    try {
      // First, get ALL camera memberships with pagination
      const allCameraIds: string[] = [];
      let membershipNextToken: string | null | undefined = undefined;
      
      do {
        // Check if sync is still enabled before fetching next page
        if (checkSyncEnabled && !checkSyncEnabled()) {
          console.log('🛑 Auto-sync disabled during camera membership pagination');
          break;
        }
        
        const memRes: any = await client.graphql({
          query: sharedCameraMembersByUserIdAndCameraId,
          variables: {
            userId,
            filter: { role: { ne: "INVITED" } },
            limit: this.PAGE_SIZE, // Fetch PAGE_SIZE memberships at a time
            ...(membershipNextToken && { nextToken: membershipNextToken }),
          },
          authMode: "userPool",
        });

        const memberships = memRes.data.sharedCameraMembersByUserIdAndCameraId;
        allCameraIds.push(...memberships.items.map((item: any) => item.cameraId));
        membershipNextToken = memberships.nextToken;
      } while (membershipNextToken);

      console.log(`📷 Found ${allCameraIds.length} shared cameras`);

      // Get ALL photos from each camera with pagination
      for (const cameraId of allCameraIds) {
        const photoFilter: any = { 
          _deleted: { ne: true },
          ownerId: { ne: userId }, // Exclude photos taken by the user themselves
        };

        let photoNextToken: string | null | undefined = undefined;
        let cameraPhotoCount = 0;
        
        do {
          // Check if sync is still enabled before fetching next page
          if (checkSyncEnabled && !checkSyncEnabled()) {
            console.log('🛑 Auto-sync disabled during photo pagination');
            break;
          }
          
          const photoRes: any = await client.graphql({
            query: photosBySharedCameraIdAndCreatedAt,
            variables: {
              sharedCameraId: cameraId,
              limit: this.PAGE_SIZE, // Fetch PAGE_SIZE photos at a time
              filter: photoFilter,
              ...(photoNextToken && { nextToken: photoNextToken }),
            },
            authMode: "userPool",
          });

          const photoData = photoRes.data.photosBySharedCameraIdAndCreatedAt;
          const cameraPhotos = photoData.items;
          cameraPhotoCount += cameraPhotos.length;
          
          for (const photo of cameraPhotos) {
            photos.push({
              id: photo.id,
              s3Key: photo.s3Key,
              ownerUsername: photo.ownerId,
              ownerIdentityId: photo.ownerIdentityId,
              cameraName: cameraId,
              source: 'shared_camera',
            });
          }
          
          photoNextToken = photoData.nextToken;
        } while (photoNextToken);
        
        if (cameraPhotoCount > 0) {
          console.log(`  └─ Camera ${cameraId}: ${cameraPhotoCount} photos`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch shared camera photos:', error);
    }

    return photos;
  }

  private async getFaceMatchPhotos(userId: string, checkSyncEnabled?: () => boolean) {
    const photos: Array<{
      id: string;
      s3Key: string;
      ownerUsername: string;
      ownerIdentityId: string;
      cameraName: string;
      source: 'face_match';
    }> = [];

    try {
      // Get ALL photos shared to user via face recognition with pagination
      const filter: any = {};
      let recipientNextToken: string | null | undefined = undefined;
      
      do {
        // Check if sync is still enabled before fetching next page
        if (checkSyncEnabled && !checkSyncEnabled()) {
          console.log('🛑 Auto-sync disabled during face match pagination');
          break;
        }
        
        const recipientRes: any = await client.graphql({
          query: photoRecipientsByRecipientIdAndPhotoId,
          variables: {
            recipientId: userId,
            limit: this.PAGE_SIZE, // Fetch PAGE_SIZE recipients at a time
            filter,
            ...(recipientNextToken && { nextToken: recipientNextToken }),
          },
          authMode: "userPool",
        });

        const recipientData = recipientRes.data.photoRecipientsByRecipientIdAndPhotoId;
        const recipients = recipientData.items;
        
        // Fetch photo details for each recipient
        for (const recipient of recipients) {
          try {
            // Fetch the actual photo details
            const photoRes: any = await client.graphql({
              query: getPhoto,
              variables: { id: recipient.photoId },
              authMode: "userPool",
            });

            const photo = photoRes.data.getPhoto;
            if (photo && !photo._deleted) {
              photos.push({
                id: photo.id,
                s3Key: photo.s3Key,
                ownerUsername: photo.ownerId,
                ownerIdentityId: photo.ownerIdentityId,
                cameraName: 'Face-matched',
                source: 'face_match',
              });
            }
          } catch (photoError) {
            console.error(`Failed to fetch photo ${recipient.photoId}:`, photoError);
          }
        }
        
        recipientNextToken = recipientData.nextToken;
      } while (recipientNextToken);
      
      console.log(`🤳 Found ${photos.length} face-matched photos`);
    } catch (error) {
      console.error('Failed to fetch face-matched photos:', error);
    }

    return photos;
  }
}

export const photoSyncService = new PhotoSyncServiceImpl();