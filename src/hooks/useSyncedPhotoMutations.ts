import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { uploadData, getUrl } from "aws-amplify/storage";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import {
  createPhoto,
  processPhotoFaces,
  createPhotoRecipient,
} from "@/src/graphql/mutations";
import { listSharedCameraMembers, getSharedCamera } from "@/src/graphql/queries";
import { v4 as uuid } from "uuid";
import { QUERY_KEYS } from "./usePhotoQueries";
import { useSendNotification } from "./usePushNotifications";
import { PendingSyncedPhoto } from "../utils/icloudsync/photoAlbumTypes";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from "../utils/icloudsync/photoAlbumConstants";
import { photoCacheDB } from "@/src/utils/services/PhotoCacheDB";

const client = generateClient();

interface ProcessSyncedPhotosParams {
  selectedPhotos: PendingSyncedPhoto[];
  selectedCam: string | null; // null = face-match, string = shared camera ID
  batchIds: string[]; // For marking batches as reviewed after processing
}

interface ProcessSyncedPhotosResult {
  processedPhotos: Array<{
    originalPhoto: PendingSyncedPhoto;
    photoId: string;
    success: boolean;
    error?: string;
    faceProcessingResult?: {
      facesDetected: number;
      friendsMatched: number;
      matches: Array<{ userId: string; confidence: number }>;
    };
  }>;
  selectedCam: string | null;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
}

/**
 * Hook for processing and uploading selected synced photos
 * Handles HEIC conversion, photo upload, and face processing/camera sharing
 */
export function useProcessSyncedPhotos() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation<ProcessSyncedPhotosResult, Error, ProcessSyncedPhotosParams>({
    mutationFn: async ({
      selectedPhotos,
      selectedCam,
      batchIds,
    }: ProcessSyncedPhotosParams): Promise<ProcessSyncedPhotosResult> => {
      const { username: me } = await getCurrentUser();
      const { identityId } = await fetchAuthSession();
      
      console.log(`📸 [PROCESS_SYNCED] Processing ${selectedPhotos.length} synced photos for ${selectedCam ? 'shared camera' : 'face-match'}`);

      const processedPhotos: ProcessSyncedPhotosResult['processedPhotos'] = [];
      
      // Collect notification data instead of sending immediately
      const notificationData = {
        sharedCamera: {
          members: new Set<string>(),
          photoCount: 0,
          cameraName: '',
        },
        faceMatched: new Map<string, number>(), // userId -> photo count
      };

      // Process each photo individually
      for (const photo of selectedPhotos) {
        try {
          console.log(`📷 [PROCESS_SYNCED] Processing photo: ${photo.filename}`);
          
          // Step 1: Handle HEIC conversion if needed
          let processedUri = photo.uri;
          if (photo.filename.toLowerCase().endsWith('.heic') || photo.uri.toLowerCase().includes('.heic')) {
            console.log(`🔄 [PROCESS_SYNCED] Converting HEIC to JPEG: ${photo.filename}`);
            
            const manipResult = await ImageManipulator.manipulateAsync(
              photo.uri, 
              [], 
              { 
                compress: 0.9, 
                format: ImageManipulator.SaveFormat.JPEG 
              }
            );
            processedUri = manipResult.uri;
            console.log(`✅ [PROCESS_SYNCED] HEIC converted to JPEG`);
          }

          // Step 2: Generate thumbnail (200px max dimension for fast loading)
          console.log(`🖼️ [PROCESS_SYNCED] Generating thumbnail for ${photo.filename}`);
          const thumbnailResult = await ImageManipulator.manipulateAsync(
            processedUri,
            [{ resize: { width: 200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );

          // Step 3: Create blobs for upload
          let blob: Blob;
          let thumbnailBlob: Blob;

          if (processedUri.startsWith("file://")) {
            const [originalResponse, thumbResponse] = await Promise.all([
              fetch(processedUri),
              fetch(thumbnailResult.uri),
            ]);
            blob = await originalResponse.blob();
            thumbnailBlob = await thumbResponse.blob();
          } else if (processedUri.startsWith("ph://")) {
            const base64 = await FileSystem.readAsStringAsync(processedUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const response = await fetch(`data:image/jpeg;base64,${base64}`);
            blob = await response.blob();

            // Thumbnail is always a file:// URI after manipulation
            const thumbResponse = await fetch(thumbnailResult.uri);
            thumbnailBlob = await thumbResponse.blob();
          } else {
            // Fallback
            const [originalResponse, thumbResponse] = await Promise.all([
              fetch(processedUri),
              fetch(thumbnailResult.uri),
            ]);
            blob = await originalResponse.blob();
            thumbnailBlob = await thumbResponse.blob();
          }

          // Step 4: Upload to S3 (both original and thumbnail)
          const fileId = uuid() + ".jpg";
          const key = selectedCam
            ? `cameras/${selectedCam}/original/${fileId}`
            : `faces/${me}/original/${fileId}`;

          const thumbKey = key.replace('/original/', '/thumb/').replace('.jpg', '_thumb.jpg');

          console.log(`⬆️ [PROCESS_SYNCED] Uploading to S3: ${key} and thumbnail`);

          const [uploadResult, thumbUploadResult] = await Promise.all([
            // Upload original
            uploadData({
              key,
              data: blob,
              options: { accessLevel: "protected", contentType: "image/jpeg" },
            }).result,
            // Upload thumbnail
            uploadData({
              key: thumbKey,
              data: thumbnailBlob,
              options: { accessLevel: "protected", contentType: "image/jpeg" },
            }).result,
          ]);

          console.log(`✅ [PROCESS_SYNCED] Photo and thumbnail uploaded to S3`);

          // Step 5: Create photo record in DynamoDB with thumbKey
          const photoResult = await client.graphql({
            query: createPhoto,
            variables: {
              input: {
                ownerId: me,
                ownerIdentityId: identityId!,
                sharedCameraId: selectedCam ?? null,
                s3Key: key,
                thumbKey: thumbKey, // 🎯 Now synced photos have thumbnails too!
                createdAt: new Date().toISOString(),
              },
            },
            authMode: "userPool",
          });

          const createdPhoto = photoResult.data.createPhoto;
          if (!createdPhoto) {
            throw new Error("Failed to create photo record");
          }

          console.log(`✅ [PROCESS_SYNCED] Photo uploaded and created: ${createdPhoto.id}`);

          // Step 6: Update SQLite cache with S3 URLs
          try {
            // Generate URLs for both thumbnail and full image
            const promises: Promise<any>[] = [];

            // Get thumbnail URL
            promises.push(
              getUrl({
                key: thumbKey,
                options: {
                  accessLevel: 'protected',
                  targetIdentityId: identityId!,
                },
              }).then(result => ({ type: 'thumb', url: result.url.toString() }))
            );

            // Get full image URL
            promises.push(
              getUrl({
                key: key,
                options: {
                  accessLevel: 'protected',
                  targetIdentityId: identityId!,
                },
              }).then(result => ({ type: 'full', url: result.url.toString() }))
            );

            const urlResults = await Promise.all(promises);
            const thumbResult = urlResults.find(r => r.type === 'thumb');
            const fullResult = urlResults.find(r => r.type === 'full');

            // Save to cache
            await photoCacheDB.savePhoto({
              id: createdPhoto.id,
              thumbUrl: thumbResult?.url || null,
              fullUrl: fullResult?.url || null,
              cameraId: selectedCam,
              ownerId: me,
              ownerIdentityId: identityId!,
              s3Key: key,
              thumbKey: thumbKey,
              localUri: null,
            });

            console.log(`💾 [PROCESS_SYNCED] SQLite cache updated for ${createdPhoto.id}`);
          } catch (cacheError) {
            console.warn('⚠️ [PROCESS_SYNCED] Failed to update cache (non-critical):', cacheError);
          }

          // Step 7: Handle notification/processing based on destination
          let faceProcessingResult = undefined;

          if (selectedCam) {
            // Shared camera photo - collect notification data
            try {
              // Only fetch members once for the first photo
              if (notificationData.sharedCamera.photoCount === 0) {
                const membersResult = await client.graphql({
                  query: listSharedCameraMembers,
                  variables: {
                    filter: {
                      cameraId: { eq: selectedCam },
                    },
                  },
                  authMode: "userPool",
                });

                const members = membersResult.data.listSharedCameraMembers?.items || [];
                const otherMembers = members.filter(member => member?.userId && member.userId !== me);
                
                // Store camera members for batch notification
                otherMembers.forEach(member => {
                  if (member?.userId) {
                    notificationData.sharedCamera.members.add(member.userId);
                  }
                });
                
                // Get camera name for notification
                try {
                  const cameraResult = await client.graphql({
                    query: getSharedCamera,
                    variables: { id: selectedCam },
                    authMode: "userPool",
                  });
                  
                  if (cameraResult.data.getSharedCamera?.name) {
                    notificationData.sharedCamera.cameraName = cameraResult.data.getSharedCamera.name;
                  }
                } catch (error) {
                  console.warn(`⚠️ [PROCESS_SYNCED] Failed to fetch camera name:`, error);
                }
                
                console.log(`📊 [PROCESS_SYNCED] Collected ${notificationData.sharedCamera.members.size} camera members for batch notification`);
              }
              
              // Increment photo count for shared camera
              notificationData.sharedCamera.photoCount++;
            } catch (error) {
              console.warn(`⚠️ [PROCESS_SYNCED] Failed to collect camera notification data:`, error);
            }
          } else {
            // Face-match photo - process faces
            try {
              console.log(`🔍 [PROCESS_SYNCED] Processing faces for photo: ${createdPhoto.id}`);

              const s3Key = `protected/${identityId}/${key}`;
              const faceResult = await client.graphql({
                query: processPhotoFaces,
                variables: {
                  photoId: createdPhoto.id,
                  s3Key: s3Key,
                  ownerId: me,
                },
                authMode: "userPool",
              });

              faceProcessingResult = faceResult.data.processPhotoFaces;
              console.log(`✅ [PROCESS_SYNCED] Face processing completed:`, faceProcessingResult);

              // If faces were matched, create PhotoRecipient records and collect notification data
              if (faceProcessingResult && faceProcessingResult.matches && faceProcessingResult.matches.length > 0) {
                console.log(`🎯 [PROCESS_SYNCED] Creating photo recipients and collecting notification data for ${faceProcessingResult.matches.length} matches`);
                
                const sharePromises = faceProcessingResult.matches.map(async (match) => {
                  // Create PhotoRecipient record
                  await client.graphql({
                    query: createPhotoRecipient,
                    variables: {
                      input: {
                        photoId: createdPhoto.id,
                        recipientId: match.userId,
                        ownerId: me,
                        confidence: match.confidence,
                        method: "FACE_RECOGNITION",
                      },
                    },
                  });

                  // Collect notification data instead of sending immediately
                  const currentCount = notificationData.faceMatched.get(match.userId) || 0;
                  notificationData.faceMatched.set(match.userId, currentCount + 1);
                });

                await Promise.all(sharePromises);
                console.log(`✅ [PROCESS_SYNCED] Photo shared with ${faceProcessingResult.matches.length} friends, notification data collected`);
              }
            } catch (faceError) {
              console.warn(`⚠️ [PROCESS_SYNCED] Face processing failed:`, faceError);
              // Continue - face processing failure shouldn't fail the entire operation
            }
          }

          // Mark individual photo as successfully processed
          const processedKey = `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${photo.id}`;
          await AsyncStorage.setItem(
            processedKey,
            JSON.stringify({
              processedAt: new Date().toISOString(),
              source: selectedCam ? 'shared_camera' : 'face_match',
              status: 'processed_successfully',
              photoId: createdPhoto.id,
            })
          );

          processedPhotos.push({
            originalPhoto: photo,
            photoId: createdPhoto.id,
            success: true,
            faceProcessingResult,
          });

        } catch (error) {
          console.error(`❌ [PROCESS_SYNCED] Failed to process photo ${photo.filename}:`, error);
          
          processedPhotos.push({
            originalPhoto: photo,
            photoId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Mark all batches as reviewed
      if (batchIds.length > 0) {
        try {
          const batchesJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS);
          if (batchesJson) {
            const allBatches = JSON.parse(batchesJson);
            const updatedBatches = allBatches.map((batch: any) => 
              batchIds.includes(batch.batchId) 
                ? { ...batch, reviewed: true }
                : batch
            );
            
            await AsyncStorage.setItem(
              STORAGE_KEYS.PENDING_SYNCED_PHOTOS,
              JSON.stringify(updatedBatches)
            );
            console.log(`✅ [PROCESS_SYNCED] Marked ${batchIds.length} batches as reviewed`);
          }
        } catch (error) {
          console.warn(`⚠️ [PROCESS_SYNCED] Failed to mark batches as reviewed:`, error);
        }
      }

      const totalProcessed = processedPhotos.length;
      const totalSuccessful = processedPhotos.filter(p => p.success).length;
      const totalFailed = processedPhotos.filter(p => !p.success).length;

      console.log(`📊 [PROCESS_SYNCED] Processing complete: ${totalSuccessful}/${totalProcessed} successful`);

      // Send grouped notifications after all photos are processed
      try {
        if (selectedCam && notificationData.sharedCamera.photoCount > 0 && notificationData.sharedCamera.members.size > 0) {
          // Send grouped notification for shared camera
          console.log(`🔔 [PROCESS_SYNCED] Sending grouped notification to ${notificationData.sharedCamera.members.size} camera members for ${notificationData.sharedCamera.photoCount} photos`);
          
          const cameraNotificationPromises = Array.from(notificationData.sharedCamera.members).map(memberId =>
            sendNotification.mutateAsync({
              recipientUsername: memberId,
              notificationData: {
                type: 'shared_camera_photos_batch',
                fromUsername: me,
                photoCount: notificationData.sharedCamera.photoCount,
                cameraId: selectedCam,
                cameraName: notificationData.sharedCamera.cameraName,
              },
            }).catch(err => {
              console.warn(`⚠️ [PROCESS_SYNCED] Failed to send grouped camera notification to ${memberId}:`, err);
              return null;
            })
          );

          await Promise.allSettled(cameraNotificationPromises);
          console.log(`✅ [PROCESS_SYNCED] Sent grouped camera notifications`);
        }

        if (notificationData.faceMatched.size > 0) {
          // Send grouped notifications for face-matched photos
          console.log(`🔔 [PROCESS_SYNCED] Sending grouped face-match notifications to ${notificationData.faceMatched.size} users`);
          
          const faceNotificationPromises = Array.from(notificationData.faceMatched.entries()).map(([userId, photoCount]) =>
            sendNotification.mutateAsync({
              recipientUsername: userId,
              notificationData: {
                type: 'face_matched_photos_batch',
                fromUsername: me,
                photoCount: photoCount,
              },
            }).catch(err => {
              console.warn(`⚠️ [PROCESS_SYNCED] Failed to send grouped face-match notification to ${userId}:`, err);
              return null;
            })
          );

          await Promise.allSettled(faceNotificationPromises);
          console.log(`✅ [PROCESS_SYNCED] Sent grouped face-match notifications`);
        }
      } catch (groupedNotificationError) {
        console.warn(`⚠️ [PROCESS_SYNCED] Failed to send grouped notifications:`, groupedNotificationError);
        // Don't fail the entire operation if notifications fail
      }

      return {
        processedPhotos,
        selectedCam,
        totalProcessed,
        totalSuccessful,
        totalFailed,
      };
    },

    onSuccess: async (data: ProcessSyncedPhotosResult) => {
      console.log(`✅ [PROCESS_SYNCED] Successfully processed ${data.totalSuccessful}/${data.totalProcessed} photos`);

      // Invalidate relevant caches
      const { username: userId } = await getCurrentUser();
      
      const invalidationPromises = [
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.MY_PHOTOS(userId),
          refetchType: "active",
        }),
      ];

      if (data.selectedCam) {
        // Shared camera upload - invalidate camera-specific data
        invalidationPromises.push(
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.USER_CAMERAS(userId),
            refetchType: "active",
          }),
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.INFINITE_SINGLE_SHARED_CAMERA_PHOTOS(data.selectedCam),
            refetchType: "active",
          })
        );
      } else {
        // Face-match photos - invalidate shared photos
        invalidationPromises.push(
          queryClient.invalidateQueries({
            queryKey: ["sharedPhotos", userId],
            refetchType: "active",
          })
        );
      }

      // Multi-camera photos for me.tsx
      invalidationPromises.push(
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(userId),
          refetchType: "active",
        })
      );

      Promise.allSettled(invalidationPromises).catch(err => {
        console.warn(`⚠️ [PROCESS_SYNCED] Some cache invalidations failed:`, err);
      });
    },

    onError: (err: Error) => {
      console.error(`❌ [PROCESS_SYNCED] Failed to process synced photos:`, err);
    },

    retry: () => {
      // Don't retry as individual photo failures are handled in the mutation
      return false;
    },
  });
}