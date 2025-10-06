/**
 * Photo Sync Manager
 * Handles manual sync of photos from device to app for review
 * Supports full access and limited access permission scenarios
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { v4 as uuidv4 } from 'uuid';
import { showMessage } from 'react-native-flash-message';
import { 
  ManualSyncResult, 
  PendingSyncedPhoto, 
  PendingSyncedPhotosBatch 
} from './photoAlbumTypes';
import { STORAGE_KEYS } from './photoAlbumConstants';

/**
 * Check for existing unreviewed batches
 * @returns Array of batch IDs that haven't been reviewed
 */
export async function checkExistingBatches(): Promise<string[]> {
  try {
    const existingBatchesJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS);
    if (!existingBatchesJson) return [];
    
    const existingBatches: PendingSyncedPhotosBatch[] = JSON.parse(existingBatchesJson);
    const unreviewedBatches = existingBatches.filter(batch => !batch.reviewed);
    
    return unreviewedBatches.map(batch => batch.batchId);
  } catch (error) {
    console.error('Error checking existing batches:', error);
    return [];
  }
}

/**
 * Filter out photos that have already been processed
 * @param photos Array of MediaLibrary assets to check
 * @returns Array of unprocessed photos only
 */
async function filterProcessedPhotos(photos: MediaLibrary.Asset[]): Promise<MediaLibrary.Asset[]> {
  try {
    // Check which photos are already processed
    const processedKeys = photos.map(photo => `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${photo.id}`);
    const processedData = await AsyncStorage.multiGet(processedKeys);
    const processedMap = new Map(processedData.map(([key, value]) => [key, value]));
    
    // Return only unprocessed photos
    return photos.filter((photo, index) => {
      const processedKey = processedKeys[index];
      const isProcessed = processedMap.get(processedKey);
      if (isProcessed) {
        console.log(`⏭️ Skipping ${photo.filename} - already processed`);
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error('Error filtering processed photos:', error);
    return photos; // If error, return all photos to be safe
  }
}

/**
 * Create a batch of photos for user review
 * @param photos Array of MediaLibrary assets to include in batch
 * @returns The created batch
 */
export async function createPhotoBatch(photos: MediaLibrary.Asset[]): Promise<PendingSyncedPhotosBatch> {
  const pendingSyncedPhotos: PendingSyncedPhoto[] = [];
  const batchStorageOps: [string, string][] = [];
  
  // Process each photo in parallel
  const results = await Promise.allSettled(
    photos.map(async (photo) => {
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(photo);
        if (!assetInfo.localUri) {
          throw new Error('No local URI available');
        }
        
        return {
          photo,
          uri: assetInfo.localUri,
          success: true
        };
      } catch (error) {
        console.error(`❌ Error processing ${photo.filename}:`, error);
        return { photo, error, success: false };
      }
    })
  );
  
  // Collect successful results
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      const { photo, uri } = result.value;
      
      pendingSyncedPhotos.push({
        id: photo.id,
        filename: photo.filename,
        creationTime: photo.creationTime,
        uri: uri!,
        detectedAt: new Date().toISOString(),
      });
      
      // Mark as processed
      const processedKey = `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${photo.id}`;
      batchStorageOps.push([
        processedKey,
        JSON.stringify({
          processedAt: new Date().toISOString(),
          source: 'manual_sync',
          status: 'pending_user_review',
        })
      ]);
    }
  }
  
  // Batch write to storage
  if (batchStorageOps.length > 0) {
    await AsyncStorage.multiSet(batchStorageOps);
  }
  
  // Create the batch
  const batch: PendingSyncedPhotosBatch = {
    batchId: uuidv4(),
    createdAt: new Date().toISOString(),
    photos: pendingSyncedPhotos,
    notified: false,
    reviewed: false,
  };
  
  // Store the batch
  const existingBatchesJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS);
  const existingBatches: PendingSyncedPhotosBatch[] = existingBatchesJson 
    ? JSON.parse(existingBatchesJson) 
    : [];
  
  existingBatches.push(batch);
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS, JSON.stringify(existingBatches));
  
  console.log(`✅ Created batch ${batch.batchId} with ${pendingSyncedPhotos.length} photos`);
  
  return batch;
}

/**
 * Sync photos with full access permission (timestamp-based)
 * @param userId Current user ID for logging
 * @returns Sync result with batch ID if photos were found
 */
export async function syncFullAccess(userId?: string): Promise<ManualSyncResult> {
  try {
    console.log('🔄 Starting full access sync');
    
    // Get last sync time (default to 3 days ago if never synced)
    const lastSyncTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_BACKGROUND_SYNC);
    const lastSync = lastSyncTime 
      ? new Date(lastSyncTime) 
      : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    console.log(`📅 Last sync: ${lastSync.toISOString()}`);
    
    // Collect photos created after last sync
    let allPhotos: MediaLibrary.Asset[] = [];
    let hasMore = true;
    let after: string | undefined;
    const BATCH_SIZE = 50;
    const MAX_PHOTOS = 500;
    
    while (hasMore && allPhotos.length < MAX_PHOTOS) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        createdAfter: lastSync.getTime(),
        first: BATCH_SIZE,
        after,
      });
      
      // Filter out processed photos
      const unprocessed = await filterProcessedPhotos(result.assets);
      allPhotos = [...allPhotos, ...unprocessed];
      
      hasMore = result.hasNextPage;
      after = result.endCursor;
      
      console.log(`📷 Fetched batch: ${result.assets.length} photos, ${unprocessed.length} unprocessed`);
    }
    
    console.log(`📷 Total unprocessed photos found: ${allPhotos.length}`);
    
    // Create batch if photos found
    if (allPhotos.length > 0) {
      const batch = await createPhotoBatch(allPhotos);
      
      // Update last sync timestamp
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKGROUND_SYNC, new Date().toISOString());
      
      return {
        batchId: batch.batchId,
        photosCollected: allPhotos.length,
      };
    }
    
    // Update timestamp even if no photos found
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKGROUND_SYNC, new Date().toISOString());
    
    return {
      batchId: null,
      photosCollected: 0,
    };
  } catch (error) {
    console.error('❌ Full access sync error:', error);
    throw error;
  }
}

/**
 * Sync photos with limited access permission (diff-based)
 * Uses MediaLibrary listener to detect when picker is dismissed
 * @param userId Current user ID
 * @param router Router instance for navigation
 * @param setIsSyncing Function to update syncing state
 * @returns Empty result (actual processing happens in listener)
 */
export async function syncLimitedAccess(
  userId: string | undefined,
  router: any,
  setIsSyncing: (value: boolean) => void
): Promise<ManualSyncResult> {
  try {
    console.log('🔄 Starting limited access sync');
    
    // Get photos before showing picker
    const beforeResult = await MediaLibrary.getAssetsAsync({ 
      first: 1000,
      mediaType: 'photo',
      sortBy: [['creationTime', false]]
    });
    const beforeIds = new Set(beforeResult.assets.map(a => a.id));
    
    console.log(`📷 Currently have access to ${beforeIds.size} photos`);
    
    // Set up listener BEFORE showing picker
    let listenerTriggered = false;
    const subscription = MediaLibrary.addListener(async (event) => {
      console.log('📱 Media library event:', { hasIncrementalChanges: event.hasIncrementalChanges });
      
      if (!event.hasIncrementalChanges) {
        // Permission scope changed - picker was dismissed
        console.log('🔄 Permission scope changed, processing new photos');
        listenerTriggered = true;
        subscription.remove(); // Clean up immediately
        
        try {
          // Get photos after picker dismissed
          const afterResult = await MediaLibrary.getAssetsAsync({ 
            first: 1000,
            mediaType: 'photo',
            sortBy: [['creationTime', false]]
          });
          
          // Find newly accessible photos
          const newPhotos = afterResult.assets.filter(a => !beforeIds.has(a.id));
          
          console.log(`📷 Found ${newPhotos.length} newly accessible photos`);
          
          if (newPhotos.length > 0) {
            // Create batch with new photos
            const batch = await createPhotoBatch(newPhotos);
            
            // Update stored limited photos list
            const newIds = afterResult.assets.map(a => a.id);
            await AsyncStorage.setItem(
              STORAGE_KEYS.LIMITED_ACCESS_PHOTOS,
              JSON.stringify(newIds)
            );
            
            // Navigate to review
            console.log(`🚀 Navigating to review with batch ${batch.batchId}`);
            router.push(`/syncedPhotosReview?batches=${batch.batchId}&source=me`);
            
            showMessage({
              message: `📷 ${newPhotos.length} new photos ready for review`,
              type: 'success',
              duration: 2000,
            });
          } else {
            showMessage({
              message: 'No new photos selected',
              type: 'info',
              duration: 2000,
            });
          }
        } catch (error) {
          console.error('❌ Error processing limited sync:', error);
          showMessage({
            message: '❌ Failed to process photos',
            type: 'danger',
            duration: 2000,
          });
        } finally {
          setIsSyncing(false);
        }
      }
    });
    
    // Show the photo picker - this returns immediately
    console.log('📱 Showing photo selection picker');
    await MediaLibrary.presentPermissionsPickerAsync();
    
    // Add a fallback timeout to reset sync state if listener doesn't fire (user cancelled)
    setTimeout(() => {
      if (!listenerTriggered) {
        console.log('⏱️ Picker dismissed without changes (timeout)');
        subscription.remove();
        setIsSyncing(false);
      }
    }, 1000); // 1 second should be enough for the listener to fire if permissions changed
    
    // Return empty result - actual processing happens in listener
    return {
      batchId: null,
      photosCollected: 0,
    };
  } catch (error) {
    console.error('❌ Limited access sync error:', error);
    setIsSyncing(false);
    throw error;
  }
}