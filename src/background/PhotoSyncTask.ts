import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as MediaLibrary from "expo-media-library";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { v4 as uuidv4 } from "uuid";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUser } from "../graphql/queries";
import { STORAGE_KEYS } from "../utils/icloudsync/photoAlbumConstants";
import { PendingSyncedPhoto, PendingSyncedPhotosBatch } from "../utils/icloudsync/photoAlbumTypes";
import { pushNotificationService } from "../utils/pushNotifications/pushNotificationService";

const TASK_NAME = "PHOTO_SYNC_TASK";
const client = generateClient();

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    console.log("🔄 Background photo sync task started");

    // Check media library permissions (without prompting)
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== "granted") {
      console.log("❌ Media library permission not granted - skipping sync");
      return;
    }

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      console.log("❌ No authenticated user");
      return;
    }

    // Get last sync time to only process new photos
    const lastSyncTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_BACKGROUND_SYNC);
    // If no previous sync, default to 3 days ago instead of epoch
    const lastSync = lastSyncTime ? new Date(lastSyncTime) : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Get the PhomoCam album to exclude its photos from sync
    let phomoAlbumAssetIds: Set<string> = new Set();
    try {
      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: false });
      const phomoAlbum = albums.find(album => album.title === "PhomoCam");
      if (phomoAlbum) {
        const phomoAssets = await MediaLibrary.getAssetsAsync({
          album: phomoAlbum,
          mediaType: "photo",
        });
        phomoAlbumAssetIds = new Set(phomoAssets.assets.map(asset => asset.id));
        console.log(`📱 [BACKGROUND_SYNC] Found ${phomoAlbumAssetIds.size} photos in PhomoCam album to exclude from sync`);
      }
    } catch (albumError) {
      console.warn("⚠️ [BACKGROUND_SYNC] Failed to get PhomoCam album for filtering:", albumError);
    }

    // Get ALL photos created after last sync using pagination
    let allAssets: MediaLibrary.Asset[] = [];
    let hasNextPage = true;
    let endCursor: string | undefined;
    const BATCH_SIZE = 50; // Process in batches to avoid memory issues

    while (hasNextPage) {
      const { assets, hasNextPage: hasMore, endCursor: nextCursor, totalCount } = await MediaLibrary.getAssetsAsync({
        mediaType: "photo",
        sortBy: [["creationTime", false]],
        createdAfter: lastSync.getTime(),
        first: BATCH_SIZE,
        after: endCursor,
      });

      // Filter out photos from PhomoCam album
      const filteredAssets = assets.filter(photo => {
        if (phomoAlbumAssetIds.has(photo.id)) {
          console.log(`📱 [BACKGROUND_SYNC] Skipping ${photo.filename} - from PhomoCam album`);
          return false;
        }
        return true;
      });

      allAssets = allAssets.concat(filteredAssets);
      hasNextPage = hasMore;
      endCursor = nextCursor;

      console.log(`📷 Fetched batch: ${assets.length} photos, ${filteredAssets.length} after PhomoCam filtering (total so far: ${allAssets.length}/${totalCount || 'unknown'})`);
      
      // Safety break to prevent infinite loops
      if (allAssets.length > 500) {
        console.warn("⚠️ Background sync reached 500 photo limit");
        break;
      }
    }

    console.log(`📷 Found ${allAssets.length} total new photos since last sync`);
    const assets = allAssets;

    // If no new photos, just update timestamp and exit
    if (assets.length === 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKGROUND_SYNC, new Date().toISOString());
      console.log("✅ No new photos to process, updated sync timestamp");
      return;
    }

    // Filter out already collected photos and collect new ones for user review
    const pendingSyncedPhotos: PendingSyncedPhoto[] = [];
    
    for (const photo of assets) {
      const processedKey = `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${photo.id}`;
      const processed = await AsyncStorage.getItem(processedKey);

      if (processed) {
        const processedData = JSON.parse(processed);
        console.log(`⏭️ Skipping ${photo.filename} - already processed as ${processedData.source} at ${processedData.processedAt}`);
        continue; // Skip already processed photos
      }

      try {
        console.log(`📸 Collecting photo for review: ${photo.filename} (asset ID: ${photo.id})`);

        // Get photo info for URI
        const assetInfo = await MediaLibrary.getAssetInfoAsync(photo);
        let uri = assetInfo.localUri;

        if (!uri) {
          console.error("❌ No local URI available for asset");
          continue;
        }

        // NOTE: We'll need this HEIC conversion logic later when user chooses to process photos:
        // if (uri && (uri.endsWith(".heic") || uri.endsWith(".HEIC"))) {
        //   const manipResult = await ImageManipulator.manipulateAsync(
        //     uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        //   );
        //   uri = manipResult.uri;
        // }
        
        // NOTE: We'll also need this blob creation logic later:
        // Handle different URI schemes for blob creation:
        // if (uri.startsWith("file://")) {
        //   const response = await fetch(uri);
        //   blob = await response.blob();
        // } else if (uri.startsWith("ph://")) {
        //   const base64 = await FileSystem.readAsStringAsync(uri, {
        //     encoding: FileSystem.EncodingType.Base64,
        //   });
        //   const response = await fetch(`data:image/jpeg;base64,${base64}`);
        //   blob = await response.blob();
        // }

        // Add to pending photos collection
        const pendingPhoto: PendingSyncedPhoto = {
          id: photo.id,
          filename: photo.filename,
          creationTime: photo.creationTime,
          uri: uri,
          detectedAt: new Date().toISOString(),
        };

        pendingSyncedPhotos.push(pendingPhoto);

        // Mark as collected (not processed)
        await AsyncStorage.setItem(
          processedKey,
          JSON.stringify({
            processedAt: new Date().toISOString(),
            source: 'collected_for_review',
            status: 'pending_user_review',
          })
        );
        
        console.log(`📋 Collected photo ${photo.filename} (asset: ${photo.id}) for user review`);
      } catch (error) {
        console.error(`❌ Error collecting photo ${photo.filename}:`, error);
      }
    }

    // If we collected new photos, create a batch and store it
    if (pendingSyncedPhotos.length > 0) {
      const batch: PendingSyncedPhotosBatch = {
        batchId: uuidv4(),
        createdAt: new Date().toISOString(),
        photos: pendingSyncedPhotos,
        notified: false,
        reviewed: false,
      };

      // Get existing pending batches
      const existingBatchesJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS);
      const existingBatches: PendingSyncedPhotosBatch[] = existingBatchesJson 
        ? JSON.parse(existingBatchesJson) 
        : [];

      // Add new batch
      existingBatches.push(batch);

      // Calculate total unreviewed photos across all batches
      const totalUnreviewedPhotos = existingBatches
        .filter(batch => !batch.reviewed)
        .reduce((total, batch) => total + batch.photos.length, 0);

      const unreviewedBatchIds = existingBatches
        .filter(batch => !batch.reviewed)
        .map(batch => batch.batchId);

      // Store updated batches
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_SYNCED_PHOTOS, 
        JSON.stringify(existingBatches)
      );

      console.log(`✅ Created batch ${batch.batchId} with ${pendingSyncedPhotos.length} photos for user review`);
      
      // Send push notification to self about ALL unreviewed photos
      try {
        const userResult = await client.graphql({
          query: getUser,
          variables: { id: user.username },
          authMode: "userPool",
        });
        
        const userData = userResult.data.getUser;
        if (userData?.expoPushToken) {
          const notificationResult = await pushNotificationService.sendNotification(
            userData.expoPushToken,
            {
              type: 'synced_photos_review',
              photoCount: totalUnreviewedPhotos,
              batchIds: unreviewedBatchIds,
            }
          );
          
          if (notificationResult.success) {
            console.log(`🔔 Push notification sent successfully for ${totalUnreviewedPhotos} total unreviewed synced photos`);
          } else {
            console.error(`❌ Failed to send push notification: ${notificationResult.error}`);
          }
        } else {
          console.warn(`⚠️ User ${user.username} has no push token registered`);
        }
      } catch (error) {
        console.error(`❌ Failed to send notification:`, error);
      }
    }

    // Update last sync timestamp
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKGROUND_SYNC, new Date().toISOString());

    console.log(
      `✅ Background sync completed: ${assets.length} photos checked, batches updated`
    );
  } catch (error) {
    console.error("❌ Background task error:", error);
  }
});

export async function registerPhotoSyncTask() {
  try {
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 15, // iOS minimum is 15 minutes
    });

    console.log("✅ Background photo sync task registered");
    return true;
  } catch (error) {
    console.error("❌ Failed to register background task:", error);
    return false;
  }
}

export async function unregisterPhotoSyncTask() {
  try {
    await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    console.log("✅ Background photo sync task unregistered");
  } catch (error) {
    console.error("❌ Failed to unregister background task:", error);
  }
}
