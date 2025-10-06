import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { uploadData, getUrl, remove } from "aws-amplify/storage";
import * as ImageManipulator from 'expo-image-manipulator';
import {
  createPhoto,
  processPhotoFaces,
  createSharedCamera,
  createSharedCameraMember,
  createPhotoRecipient,
  deletePhoto,
  deletePhotoRecipient,
} from "@/src/graphql/mutations";
import { sharedCameraMembersByCameraIdAndUserId, getSharedCamera, photoRecipientsByPhotoIdAndRecipientId, getPhoto } from "@/src/graphql/queries";
import { v4 as uuid } from "uuid";
import { QUERY_KEYS } from "./usePhotoQueries";
import { useSendNotification } from "./usePushNotifications";
import { showMessage } from "react-native-flash-message";
import { useRecentPhotosStore } from "@/src/stores/recentPhotosStore";
import { photoCacheDB } from "@/src/utils/services/PhotoCacheDB";

const client = generateClient();

// Types
interface PhotoUploadParams {
  photoUri: string;
  selectedCam: string | null;
  isBackgroundUpload?: boolean;
}

interface PhotoUploadResult {
  photo: any;
  uploadResult: any;
  selectedCam: string | null;
  faceProcessingResult?: {
    facesDetected: number;
    friendsMatched: number;
    matches: Array<{ userId: string; confidence: number }>;
    processingFailed?: boolean;
  } | null;
  userId: string;
  isBackgroundUpload?: boolean;
}

interface SharePhotoParams {
  photoId: string;
  selectedTargets: string[];
  matches: Array<{ userId: string; confidence: number }>;
  isBackgroundShare?: boolean;
}

interface SharePhotoResult {
  photoId: string;
  sharedCount: number;
  recipients: any[];
  userId: string;
  isBackgroundShare?: boolean;
}

/**
 * Mutation hook for uploading photos with optimistic updates and background processing support
 * This provides instant feedback when taking photos and supports background queue processing
 */
export function useUploadPhoto() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation<PhotoUploadResult, Error, PhotoUploadParams>({
    mutationFn: async ({
      photoUri,
      selectedCam,
      isBackgroundUpload = false,
    }: PhotoUploadParams): Promise<PhotoUploadResult> => {
      // Match the exact logic from camera.tsx
      const { username: me } = await getCurrentUser();
      const { identityId } = await fetchAuthSession();
      const fileId = uuid() + ".jpg";
      const key = selectedCam
        ? `cameras/${selectedCam}/original/${fileId}`
        : `faces/${me}/original/${fileId}`;

      console.log(`📸 [UPLOAD] Starting photo upload with key: ${key} (background: ${isBackgroundUpload})`);

      // 1. Process both full-size and thumbnail from original photo
      const imageProcessStart = Date.now();
      console.log(`🖼️ [UPLOAD] Starting parallel image processing from original photo`);
      const [fullSizeResult, thumbnailResult] = await Promise.all([
        ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
        ),
        ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        )
      ]);

      const imageProcessEnd = Date.now();
      console.log(`✅ [UPLOAD] Image processing completed in ${imageProcessEnd - imageProcessStart}ms`);
      console.log(`📊 [UPLOAD] Full-size: ${Math.round(fullSizeResult.width)}x${Math.round(fullSizeResult.height)}, Thumbnail: ${Math.round(thumbnailResult.width)}x${Math.round(thumbnailResult.height)}`);

      // 2. Upload both processed images to S3
      const [originalBlob, thumbnailBlob] = await Promise.all([
        fetch(fullSizeResult.uri).then((r) => r.blob()),
        fetch(thumbnailResult.uri).then((r) => r.blob()),
      ]);

      const thumbKey = key.replace('/original/', '/thumb/').replace('.jpg', '_thumb.jpg');

      const [uploadResult, thumbUploadResult] = await Promise.all([
        // Upload original
        uploadData({
          key,
          data: originalBlob,
          options: { accessLevel: "protected", contentType: "image/jpeg" },
        }).result,
        // Upload thumbnail
        uploadData({
          key: thumbKey,
          data: thumbnailBlob,
          options: { accessLevel: "protected", contentType: "image/jpeg" },
        }).result,
      ]);

      console.log(`✅ [UPLOAD] Photo and thumbnail uploaded to S3: ${key}`);

      // 3. Create photo record in DynamoDB with thumbKey
      const photoResult = await client.graphql({
        query: createPhoto,
        variables: {
          input: {
            ownerId: me,
            ownerIdentityId: identityId!,
            sharedCameraId: selectedCam ?? null, // null for face-match
            s3Key: key,
            thumbKey: thumbKey, // 🎯 Now we have real thumbnails!
            createdAt: new Date().toISOString(),
          },
        },
        authMode: "userPool",
      });

      const photo = photoResult.data.createPhoto;
      if (!photo) {
        throw new Error("Failed to create photo record");
      }

      console.log(`✅ [UPLOAD] Photo record created: ${photo.id}`);

      // 4. Skip notifications here for shared camera photos - will be handled in useShareEventMatchedPhoto
      if (selectedCam) {
        console.log(`📋 [UPLOAD] Shared camera photo uploaded, notifications will be sent after face processing`);
      }

      // 5. Process faces for ALL photos (face-match and shared camera)
      let faceProcessingResult = null;
      try {
        console.log(
          `🔍 [UPLOAD] Processing faces for photo: ${photo.id} (${selectedCam ? 'shared camera' : 'face-match'})`
        );

        const s3Key = `protected/${identityId}/${key}`;
        const faceResult = await client.graphql({
          query: processPhotoFaces,
          variables: {
            photoId: photo.id,
            s3Key: s3Key,
            ownerId: me,
            sharedCameraId: selectedCam, // Pass sharedCameraId for camera photos, null for face-match
          },
          authMode: "userPool",
        });

        faceProcessingResult = faceResult.data.processPhotoFaces;
        console.log(
          `✅ [UPLOAD] Face processing completed for ${selectedCam ? 'shared camera' : 'face-match'} photo:`,
          faceProcessingResult
        );
      } catch (faceError) {
        console.warn(
          `⚠️ [UPLOAD] Face processing failed (non-critical):`,
          faceError
        );
        // Continue - face processing failure shouldn't fail the upload
      }

      return {
        photo,
        uploadResult,
        selectedCam,
        faceProcessingResult,
        userId: me, // Include userId for cache invalidation in callbacks
        isBackgroundUpload,
      };
    },

    // Optimistic update: immediately add photo to cache (only for shared cameras in foreground)
    onMutate: async (variables: PhotoUploadParams) => {
      const { photoUri, selectedCam, isBackgroundUpload = false } = variables;
      // Only do optimistic updates for foreground shared camera photos
      if (!selectedCam || isBackgroundUpload) {
        console.log(
          `⚡ [OPTIMISTIC] Skipping cache update for ${!selectedCam ? 'face-match' : 'background'} photo`
        );
        return {};
      }

      console.log(
        `⚡ [OPTIMISTIC] Adding photo to cache for camera: ${selectedCam}`
      );

      const { username: me } = await getCurrentUser();

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.USER_CAMERAS(me),
      });

      // Snapshot the previous value
      const previousCameras = queryClient.getQueryData(
        QUERY_KEYS.USER_CAMERAS(me)
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        QUERY_KEYS.USER_CAMERAS(me),
        (old: any) => {
          if (!old) return old;

          return old.map((camera: any) => {
            if (camera.cameraId === selectedCam) {
              // Add optimistic photo to the beginning of the photos array
              const optimisticPhoto = {
                id: `temp-${Date.now()}`, // Temporary ID
                url: photoUri, // Use local URI for immediate display
                createdAt: new Date().toISOString(),
                isOptimistic: true, // Flag to identify optimistic updates
              };

              return {
                ...camera,
                photos: [optimisticPhoto, ...camera.photos],
              };
            }
            return camera;
          });
        }
      );

      return { previousCameras, selectedCam };
    },

    // On success: replace optimistic update with real data or handle background upload
    onSuccess: async (data: PhotoUploadResult, variables: PhotoUploadParams) => {
      console.log(`✅ [SUCCESS] Photo upload completed (background: ${data.isBackgroundUpload})`);

      // Update SQLite cache with real S3 URLs (replace local URI with signed URLs)
      try {
        // Generate URLs for both thumbnail and full image
        const promises: Promise<any>[] = [];

        // Get thumbnail URL if photo has thumbKey
        if (data.photo.thumbKey) {
          promises.push(
            getUrl({
              key: data.photo.thumbKey,
              options: {
                accessLevel: 'protected',
                targetIdentityId: data.photo.ownerIdentityId,
              },
            }).then(result => ({ type: 'thumb', url: result.url.toString() }))
          );
        }

        // Get full image URL
        promises.push(
          getUrl({
            key: data.photo.s3Key,
            options: {
              accessLevel: 'protected',
              targetIdentityId: data.photo.ownerIdentityId,
            },
          }).then(result => ({ type: 'full', url: result.url.toString() }))
        );

        const urlResults = await Promise.all(promises);
        const thumbResult = urlResults.find(r => r.type === 'thumb');
        const fullResult = urlResults.find(r => r.type === 'full');

        // Update cache with real URLs
        await photoCacheDB.savePhoto({
          id: data.photo.id,
          thumbUrl: thumbResult?.url || null,
          fullUrl: fullResult?.url || null,
          cameraId: data.selectedCam,
          ownerId: data.userId,
          ownerIdentityId: data.photo.ownerIdentityId,
          s3Key: data.photo.s3Key,
          thumbKey: data.photo.thumbKey,
          localUri: null, // Clear local URI now that we have S3 URLs
        });

        console.log(`💾 [UPLOAD_SUCCESS] SQLite cache updated with S3 URLs for ${data.photo.id}`);
      } catch (cacheError) {
        console.warn('⚠️ [UPLOAD_SUCCESS] Failed to update cache (non-critical):', cacheError);
      }

      // Handle cache updates based on upload type
      if (data.isBackgroundUpload) {
        // Background upload - invalidate relevant queries to refresh data
        console.log(`🔄 [BACKGROUND_SUCCESS] Invalidating cache for background upload`);
        
        // Throttled invalidation to prevent too many network requests
        const invalidationPromises = [];
        
        // Invalidate cameras for shared camera uploads
        if (variables.selectedCam) {
          invalidationPromises.push(
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.USER_CAMERAS(data.userId),
              refetchType: "none", // Don't auto-refetch, just mark stale
            })
          );

          // Invalidate infinite camera photos for this specific camera
          invalidationPromises.push(
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.INFINITE_SINGLE_SHARED_CAMERA_PHOTOS(variables.selectedCam),
              refetchType: "none",
            })
          );
        }

        // Always invalidate my photos for background uploads
        invalidationPromises.push(
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
            refetchType: "none",
          })
        );

        // Invalidate infinite shared camera photos for me.tsx
        invalidationPromises.push(
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(data.userId),
            refetchType: "none",
          })
        );

        // For face recognition photos with matches, add additional invalidation
        if (data.faceProcessingResult && 
            data.faceProcessingResult.friendsMatched > 0 &&
            data.faceProcessingResult.matches &&
            data.faceProcessingResult.matches.length > 0) {
          
          invalidationPromises.push(
            queryClient.invalidateQueries({
              queryKey: ["sharedPhotos", data.userId],
              refetchType: "none",
            })
          );
        }

        // For face-match photos (when selectedCam is null), invalidate face-matched photos cache
        if (!variables.selectedCam) {
          invalidationPromises.push(
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS_ALL(data.userId),
              refetchType: "none",
            })
          );
        }

        // Execute all invalidations without waiting
        Promise.allSettled(invalidationPromises).catch(err => {
          console.warn(`⚠️ [BACKGROUND_SUCCESS] Some cache invalidations failed:`, err);
        });

        // Show flash messages for background uploads
        if (variables.selectedCam) {
          // Shared camera upload completion
          showMessage({
            message: "📷 Photo uploaded!",
            description: "Successfully shared with event",
            type: "success",
            duration: 2000,
          });
        }
        
        // Face-match scenarios with no faces/friends detected or processing failed
        if (!variables.selectedCam && data.faceProcessingResult) {
          const { facesDetected, friendsMatched, processingFailed } = data.faceProcessingResult;
          
          if (processingFailed) {
            showMessage({
              message: "⚠️ Face recognition failed",
              description: "Photo saved but face processing failed",
              type: "warning",
              duration: 2000,
            });
          } else if (facesDetected === 0) {
            showMessage({
              message: "📸 No faces detected",
              description: "Photo saved to your library",
              type: "info",
              duration: 2000,
            });
          } else if (friendsMatched === 0) {
            showMessage({
              message: "📸 No friends matched",
              description: "Photo saved to your library",
              type: "info",
              duration: 2000,
            });
          }
        }

        return; // Exit early for background uploads
      }

      // Foreground upload processing (original logic)
      if (!variables.selectedCam) {
        console.log(
          `✅ [SUCCESS] Face-match photo uploaded, no cache update needed`
        );
        return;
      }

      console.log(
        `✅ [SUCCESS] Updating cache with real S3 URL for shared camera: ${variables.selectedCam}`
      );

      try {
        // Get the signed S3 URL immediately
        const urlResult = await getUrl({
          key: data.photo.s3Key,
          options: { accessLevel: "protected" },
        });

        const realPhotoUrl = urlResult.url.toString();
        console.log(`🔗 [SUCCESS] Got S3 URL: ${realPhotoUrl}`);

        // Update the cache to replace optimistic photo with real photo data
        queryClient.setQueryData(
          QUERY_KEYS.USER_CAMERAS(data.userId),
          (old: any) => {
            if (!old) return old;

            return old.map((camera: any) => {
              if (camera.cameraId === variables.selectedCam) {
                // Replace the optimistic photo with real photo data
                const updatedPhotos = camera.photos.map((photo: any) => {
                  if (photo.isOptimistic && photo.url === variables.photoUri) {
                    return {
                      id: data.photo.id, // Real photo ID
                      url: realPhotoUrl, // Real S3 URL
                      createdAt: data.photo.createdAt,
                      s3Key: data.photo.s3Key,
                      ownerIdentityId: data.photo.ownerIdentityId,
                      sharedCameraId: data.photo.sharedCameraId,
                      isOptimistic: false, // No longer optimistic
                    };
                  }
                  return photo;
                });

                return {
                  ...camera,
                  photos: updatedPhotos,
                };
              }
              return camera;
            });
          }
        );
      } catch (error) {
        console.warn(
          `⚠️ [SUCCESS] Failed to get S3 URL, falling back to refetch:`,
          error
        );

        // Fallback to invalidating queries if getting S3 URL fails
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USER_CAMERAS(data.userId),
          refetchType: "active",
        });
      }

      // Standard cache invalidation for foreground uploads
      if (variables.selectedCam) {
        console.log(`🔄 [UPLOAD_SUCCESS] Invalidating infinite query cache for camera: ${variables.selectedCam}`);
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.INFINITE_SINGLE_SHARED_CAMERA_PHOTOS(variables.selectedCam),
          refetchType: "active",
        });
      }

      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
        refetchType: "active",
      });

      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(data.userId),
        refetchType: "active",
      });
      
      queryClient.invalidateQueries({
        queryKey: ["sharedPhotos", data.userId],
        refetchType: "none",
      });

      // For face-match photos (when selectedCam is null), invalidate face-matched photos cache
      if (!variables.selectedCam) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS_ALL(data.userId),
          refetchType: "active",
        });
      }

      // For face recognition photos with matches, add delayed invalidation 
      if (data.faceProcessingResult && 
          data.faceProcessingResult.friendsMatched > 0 &&
          data.faceProcessingResult.matches &&
          data.faceProcessingResult.matches.length > 0) {
        console.log(`🎯 [UPLOAD] Face matches found (${data.faceProcessingResult.friendsMatched}), scheduling additional refresh`);
        
        setTimeout(() => {
          console.log(`🔄 [UPLOAD] Delayed refresh for face recognition matches`);
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
            refetchType: "active",
          });
          
          queryClient.invalidateQueries({
            queryKey: ["sharedPhotos", data.userId],
            refetchType: "none",
          });
        }, 2000);
      }
    },

    // On error: revert optimistic update or handle background error
    onError: async (err: Error, variables: PhotoUploadParams, context: any) => {
      console.error(`❌ [ERROR] Photo upload failed (background: ${variables.isBackgroundUpload}):`, err);

      // Only revert optimistic updates for foreground shared camera photos
      if (!variables.isBackgroundUpload && variables.selectedCam && context?.previousCameras) {
        console.log(
          `🔄 [ERROR] Reverting optimistic update for camera: ${variables.selectedCam}`
        );
        
        const { username: me } = await getCurrentUser();
        queryClient.setQueryData(
          QUERY_KEYS.USER_CAMERAS(me),
          context.previousCameras
        );
      }

      // For background uploads, show error flash message
      if (variables.isBackgroundUpload) {
        console.error(`❌ [BACKGROUND_ERROR] Background upload failed, will not retry automatically`);
        
        if (variables.selectedCam) {
          showMessage({
            message: "❌ Upload failed",
            description: "Could not upload to shared event",
            type: "danger",
            duration: 3000,
          });
        } else {
          showMessage({
            message: "❌ Upload failed", 
            description: "Could not process photo",
            type: "danger",
            duration: 3000,
          });
        }
      }
    },

    // Always run: cleanup
    onSettled: (data: PhotoUploadResult | undefined, error: Error | null, variables: PhotoUploadParams) => {
      console.log(`🏁 [SETTLED] Photo upload mutation completed (background: ${variables.isBackgroundUpload})`);
    },

    // Retry configuration - more aggressive for background uploads
    retry: (failureCount: number, error: Error) => {
      // We can't access context in the retry function, so we'll be more conservative
      // Background uploads should have been marked in a different way if needed
      return failureCount < 2; // Allow retries for most uploads
    },

    retryDelay: (attemptIndex: number) => {
      // Exponential backoff
      return Math.min(1000 * 2 ** attemptIndex, 30000);
    },
  });
}

/**
 * Mutation hook for sharing photos with camera members who were detected via face recognition
 * Used for shared camera photos where faces are matched against camera members
 */
export function useShareEventMatchedPhoto() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation<SharePhotoResult, Error, SharePhotoParams & { sharedCameraId: string }>({
    mutationFn: async ({
      photoId,
      selectedTargets, // These are camera members for event photos
      matches,
      isBackgroundShare = false,
      sharedCameraId,
    }: SharePhotoParams & { sharedCameraId: string }): Promise<SharePhotoResult> => {
      const { username: me } = await getCurrentUser();
      console.log(`📤 [SHARE_EVENT_PHOTO] Processing photo ${photoId} for camera ${sharedCameraId} (background: ${isBackgroundShare})`);

      // 1. Get camera details and members
      const [cameraResult, membersResult] = await Promise.all([
        client.graphql({
          query: getSharedCamera,
          variables: {
            id: sharedCameraId,
          },
          authMode: "userPool",
        }),
        client.graphql({
          query: sharedCameraMembersByCameraIdAndUserId,
          variables: {
            cameraId: sharedCameraId,
          },
          authMode: "userPool",
        })
      ]);

      const camera = cameraResult.data.getSharedCamera;
      const cameraName = camera?.name || 'Event';
      const allMembers = membersResult.data.sharedCameraMembersByCameraIdAndUserId?.items || [];
      
      // Separate members by role for different notification logic
      const activeMembers = allMembers.filter(member => 
        member?.userId && 
        member.userId !== me &&
        !member._deleted &&
        member.role !== 'INVITED' // Active members (MEMBER/ADMIN) get all notifications
      );
      
      const invitedMembers = allMembers.filter(member => 
        member?.userId && 
        member.userId !== me &&
        !member._deleted &&
        member.role === 'INVITED' // Invited members only get face-match notifications
      );

      console.log(`👥 [SHARE_EVENT_PHOTO] Found ${activeMembers.length} active members, ${invitedMembers.length} invited members`);
      console.log(`🎯 [SHARE_EVENT_PHOTO] Face matches: ${matches.length} users`);

      // 2. Create PhotoRecipient records ONLY for detected faces (selectedTargets)
      // Filter out the owner - they already have access to their own photos
      const sharePromises = selectedTargets
        .filter(userId => userId !== me)
        .map(async (userId) => {
          const match = matches.find((m) => m.userId === userId);
        
        const input = {
          photoId,
          recipientId: userId,
          ownerId: me,
          confidence: match?.confidence || 0,
          method: "EVENT_REKOGNITION", // Different method for camera face matches
          createdAt: new Date().toISOString(),
        };
        
        console.log(`🔄 [SHARE_EVENT_PHOTO] Creating PhotoRecipient with input:`, input);
        
        const result = await client.graphql({
          query: createPhotoRecipient,
          variables: { input },
          authMode: "userPool",
        });

        const createdRecord = result.data?.createPhotoRecipient;
        console.log(`✅ [SHARE_EVENT_PHOTO] Created PhotoRecipient:`, createdRecord);
        return createdRecord;
      });

      const results = await Promise.all(sharePromises);
      console.log(`✅ [SHARE_EVENT_PHOTO] Successfully created ${results.length} PhotoRecipient records`);
      
      // 3. Send smart notifications based on member type and face matches
      const matchedUserIds = new Set(matches.map(m => m.userId));
      
      // Send notifications to all active members (MEMBER/ADMIN)
      console.log(`🔔 [SHARE_EVENT_PHOTO] Sending notifications to ${activeMembers.length} active members`);
      activeMembers.forEach(member => {
        if (member?.userId) {
          const isMatched = matchedUserIds.has(member.userId);
          
          sendNotification.mutate({
            recipientUsername: member.userId,
            notificationData: {
              type: isMatched ? 'face_matched_photo' : 'shared_camera_photo',
              fromUsername: me,
              photoId,
              cameraId: sharedCameraId,
              cameraName: cameraName,
            },
          });
          
          console.log(`📬 [SHARE_EVENT_PHOTO] Sent ${isMatched ? 'face-matched' : 'regular'} notification to active member ${member.userId}`);
        }
      });
      
      // Send notifications ONLY to invited members who appear in the photo
      const matchedInvitedMembers = invitedMembers.filter(member => 
        member?.userId && matchedUserIds.has(member.userId)
      );
      
      console.log(`🔔 [SHARE_EVENT_PHOTO] Sending face-match notifications to ${matchedInvitedMembers.length} invited members`);
      matchedInvitedMembers.forEach(member => {
        if (member?.userId) {
          sendNotification.mutate({
            recipientUsername: member.userId,
            notificationData: {
              type: 'face_matched_photo',
              fromUsername: me,
              photoId,
              cameraId: sharedCameraId,
              cameraName: cameraName,
            },
          });
          
          console.log(`📬 [SHARE_EVENT_PHOTO] Sent face-matched notification to invited member ${member.userId}`);
        }
      });

      return {
        photoId,
        sharedCount: results.length,
        recipients: results,
        userId: me,
        isBackgroundShare,
      };
    },

    onSuccess: (data: SharePhotoResult) => {
      console.log(`✅ [SHARE_EVENT_PHOTO] Successfully shared with ${data.sharedCount} camera members (background: ${data.isBackgroundShare})`);
      
      if (data.isBackgroundShare) {
        // Background share - use throttled cache invalidation
        console.log(`🔄 [BACKGROUND_SHARE] Invalidating cache for background event share`);
        
        const invalidationPromises = [
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
            refetchType: "none",
          }),
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS_ALL(data.userId),
            refetchType: "none",
          }),
        ];

        Promise.allSettled(invalidationPromises).catch((err) => {
          console.warn(`⚠️ [BACKGROUND_SHARE] Cache invalidation failed:`, err);
        });

        // Show success message for background shares
        if (data.sharedCount > 0) {
          showMessage({
            message: `📸 Shared with ${data.sharedCount} camera member${data.sharedCount === 1 ? '' : 's'}`,
            description: "Event face matching completed",
            type: "success",
            duration: 2000,
          });
        }
      } else {
        // Foreground share - immediate cache invalidation
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS_ALL(data.userId),
        });
      }
    },

    onError: (err: Error, variables: SharePhotoParams) => {
      console.error(`❌ [SHARE_EVENT_PHOTO] Failed to share event photo (background: ${variables.isBackgroundShare}):`, err);
      
      // Show flash message for background share failures
      if (variables.isBackgroundShare) {
        showMessage({
          message: "❌ Event face matching failed",
          description: "Could not share photo with matched camera members",
          type: "danger",
          duration: 2000,
        });
      }
    },
  });
}

/**
 * Mutation hook for sharing face-matched photos with selected friends
 * Enhanced for background processing support
 */
export function useShareFaceMatchedPhoto() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation<SharePhotoResult, Error, SharePhotoParams>({
    mutationFn: async ({
      photoId,
      selectedTargets
  ,
      matches,
      isBackgroundShare = false,
    }: SharePhotoParams): Promise<SharePhotoResult> => {
      const { username: me } = await getCurrentUser();
      console.log(`📤 [SHARE_FACE_PHOTO] Sharing photo ${photoId} with ${selectedTargets
    .length} friends (background: ${isBackgroundShare})`);

      // Create PhotoRecipient records for selected friends
      const sharePromises = selectedTargets
  .map(async (userId) => {
        const match = matches.find((m) => m.userId === userId);
        
        const result = await client.graphql({
          query: createPhotoRecipient,
          variables: {
            input: {
              photoId,
              recipientId: userId,
              ownerId: me,
              confidence: match?.confidence || 0,
              method: "FACE_RECOGNITION",
              createdAt: new Date().toISOString(),
            },
          },
        });

        console.log(`✅ [SHARE_FACE_PHOTO] Created PhotoRecipient for ${userId}`);
        return result.data?.createPhotoRecipient;
      });

      const results = await Promise.all(sharePromises);
      console.log(`✅ [SHARE_FACE_PHOTO] Successfully shared with ${results.length} friends`);
      
      // Send push notifications to each recipient
      console.log(`🔔 [SHARE_FACE_PHOTO] Sending push notifications to ${selectedTargets
    .length} recipients`);
      selectedTargets
  .forEach((recipientUsername) => {
        sendNotification.mutate({
          recipientUsername,
          notificationData: {
            type: 'face_matched_photo',
            fromUsername: me,
            photoId,
          },
        });
      });
      
      return {
        photoId,
        sharedCount: results.length,
        recipients: results,
        userId: me,
        isBackgroundShare,
      };
    },

    onSuccess: (data: SharePhotoResult) => {
      console.log(`✅ [SHARE_FACE_PHOTO] Successfully shared with ${data.sharedCount} friends (background: ${data.isBackgroundShare})`);

      if (data.isBackgroundShare) {
        // Background share - use throttled cache invalidation
        console.log(`🔄 [BACKGROUND_SHARE] Invalidating cache for background share`);
        
        const invalidationPromises = [
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
            refetchType: "none",
          }),
          queryClient.invalidateQueries({
            queryKey: ["sharedPhotos", data.userId],
            refetchType: "none",
          })
        ];

        // Execute invalidations without waiting
        Promise.allSettled(invalidationPromises).catch(err => {
          console.warn(`⚠️ [BACKGROUND_SHARE] Some cache invalidations failed:`, err);
        });

        // Show flash message for successful auto sharing
        if (data.sharedCount > 0) {
          showMessage({
            message: `📸 Shared with ${data.sharedCount} friend${data.sharedCount === 1 ? '' : 's'}`,
            description: "Auto share faces completed",
            type: "success",
            duration: 2000,
          });
        }

        // Add delayed invalidation for background shares
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
            refetchType: "none",
          });
          
          queryClient.invalidateQueries({
            queryKey: ["photoRecipients"],
            refetchType: "none",
          });
        }, 2000);

        return;
      }

      // Foreground share processing (original logic)
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
        refetchType: "active",
      });

      queryClient.invalidateQueries({
        queryKey: ["sharedPhotos", data.userId],
        refetchType: "none",
      });

      // Add delayed invalidation to ensure database writes are committed
      if (data.sharedCount > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
            refetchType: "active",
          });
          
          queryClient.invalidateQueries({
            queryKey: ["photoRecipients"],
            refetchType: "none",
          });
        }, 2000);
      }
    },

    onError: (err: Error, variables: SharePhotoParams) => {
      console.error(`❌ [SHARE_FACE_PHOTO] Failed to share face-matched photo (background: ${variables.isBackgroundShare}):`, err);
      
      // Show flash message for background share failures
      if (variables.isBackgroundShare) {
        showMessage({
          message: "❌ Auto share failed",
          description: "Could not share photo with matched friends",
          type: "danger",
          duration: 2000,
        });
      }
    },

    // Enhanced retry for background shares
    retry: (failureCount: number, error: Error) => {
      return failureCount < 2; // Allow retries for shares
    },

    retryDelay: (attemptIndex: number) => {
      return Math.min(1000 * 2 ** attemptIndex, 15000);
    },
  });
}

/**
 * Mutation hook for creating a new shared camera
 */
export function useCreateCamera() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      memberIds,
    }: {
      name: string;
      memberIds: string[];
    }) => {
      const { username } = await getCurrentUser();

      console.log(`📷 [CREATE_CAMERA] Creating camera: ${name}`);

      const result = await client.graphql({
        query: createSharedCamera,
        variables: {
          input: {
            name,
            ownerId: username,
            memberIds: [username, ...memberIds], // Include self
            createdAt: new Date().toISOString(),
          },
        },
        authMode: "userPool",
      });

      return {
        camera: result.data?.createSharedCamera,
        userId: username,
      };
    },

    onSuccess: (data) => {
      console.log(`✅ [CREATE_CAMERA] Camera created: ${data?.camera?.id}`);

      // Invalidate cameras list to show the new camera
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.USER_CAMERAS(data.userId),
        refetchType: "active",
      });
      
      // Also invalidate my photos since creating a camera may add new photos
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.MY_PHOTOS(data.userId),
        refetchType: "active",
      });
    },

    onError: (err) => {
      console.error(`❌ [CREATE_CAMERA] Failed to create camera:`, err);
    },
  });
}

/**
 * Mutation hook for deleting photos
 * Handles both shared camera photos and face-matched photos with different deletion logic
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      s3Key,
      ownerIdentityId,
      sharedCameraId,
      _version,
    }: {
      photoId: string;
      s3Key: string;
      ownerIdentityId: string;
      sharedCameraId?: string;
      _version: number;
    }) => {
      console.log(`🗑️ [DELETE_PHOTO] Starting deletion of photo ${photoId}`);
      
      // Verify ownership before deletion
      const { identityId } = await fetchAuthSession();
      if (identityId !== ownerIdentityId) {
        console.error(`❌ [DELETE_PHOTO] Ownership verification failed!`);
        console.log(`🔍 [DELETE_PHOTO] Ownership check for photo ${photoId}:`);
        console.log(`   - Photo ownerIdentityId: "${ownerIdentityId}"`);
        console.log(`   - Current user identityId: "${identityId}"`);
        console.log(`   - Match: ${identityId === ownerIdentityId}`);
        console.log(`   - Photo type: ${sharedCameraId ? 'shared camera' : 'face-matched'}`);
        throw new Error("You can only delete your own photos");
      }

      console.log(`✅ [DELETE_PHOTO] Ownership verified for photo ${photoId}`);

      try {
        // 1. Delete from S3 storage
        console.log(`🗑️ [DELETE_PHOTO] Deleting S3 object: ${s3Key}`);
        await remove({
          key: s3Key,
          options: {
            accessLevel: "protected",
          },
        });
        console.log(`✅ [DELETE_PHOTO] S3 object deleted: ${s3Key}`);

        // 2. For face-matched photos, delete all PhotoRecipient connections
        if (!sharedCameraId) {
          console.log(`🔗 [DELETE_PHOTO] Deleting PhotoRecipient connections for face-matched photo ${photoId}`);
          
          try {
            // Get all recipients for this photo
            const recipientsRes: any = await client.graphql({
              query: photoRecipientsByPhotoIdAndRecipientId,
              variables: { 
                photoId: photoId,
                limit: 50,
                filter: { _deleted: { ne: true } }
              },
              authMode: "userPool",
            });

            const recipients = recipientsRes.data?.photoRecipientsByPhotoIdAndRecipientId?.items || [];
            console.log(`🔗 [DELETE_PHOTO] Found ${recipients.length} recipients to delete`);

            // Delete each recipient connection
            for (const recipient of recipients) {
              try {
                await client.graphql({
                  query: deletePhotoRecipient,
                  variables: {
                    input: {
                      id: recipient.id,
                      _version: recipient._version,
                    },
                  },
                  authMode: "userPool",
                });
                console.log(`✅ [DELETE_PHOTO] Deleted PhotoRecipient: ${recipient.id}`);
              } catch (recipientError) {
                console.warn(`⚠️ [DELETE_PHOTO] Failed to delete PhotoRecipient ${recipient.id}:`, recipientError);
              }
            }
          } catch (recipientsError) {
            console.warn(`⚠️ [DELETE_PHOTO] Failed to fetch recipients for deletion:`, recipientsError);
          }
        }

        // 3. Fetch latest version and delete the photo record from DynamoDB (soft delete)
        console.log(`🔄 [DELETE_PHOTO] Fetching latest version for photo ${photoId}`);
        
        let latestVersion = _version;
        try {
          // Fetch the latest photo data to get the current _version
          const photoRes: any = await client.graphql({
            query: getPhoto,
            variables: { id: photoId },
            authMode: "userPool",
          });
          
          const latestPhoto = photoRes.data.getPhoto;
          if (latestPhoto && latestPhoto._version) {
            latestVersion = latestPhoto._version;
            console.log(`🔄 [DELETE_PHOTO] Updated version from ${_version} to ${latestVersion}`);
          }
        } catch (versionError) {
          console.warn(`⚠️ [DELETE_PHOTO] Could not fetch latest version, using provided version ${_version}:`, versionError);
        }

        console.log(`🗑️ [DELETE_PHOTO] Soft deleting photo record ${photoId} from DynamoDB with version ${latestVersion}`);
        await client.graphql({
          query: deletePhoto,
          variables: {
            input: {
              id: photoId,
              _version: latestVersion,
            },
          },
          authMode: "userPool",
        });
        console.log(`✅ [DELETE_PHOTO] Photo record deleted: ${photoId}`);

        return { photoId, success: true };
      } catch (error) {
        console.error(`❌ [DELETE_PHOTO] Failed to delete photo ${photoId}:`, error);
        throw error;
      }
    },

    onSuccess: async (data, variables) => {
      console.log(`🎉 [DELETE_PHOTO] Successfully deleted photo ${data.photoId}`);

      // Remove photo from SQLite cache
      try {
        await photoCacheDB.deletePhoto(data.photoId);
        console.log(`💾 [DELETE_PHOTO] Removed photo from SQLite cache: ${data.photoId}`);
      } catch (cacheError) {
        console.warn(`⚠️ [DELETE_PHOTO] Failed to remove from SQLite cache:`, cacheError);
      }

      try {
        // Get current user for proper query invalidation
        const { username: userId } = await getCurrentUser();
        
        // Invalidate all relevant queries to refresh the UI
        const { sharedCameraId } = variables;
        
        // Always invalidate individual photo queries
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.PHOTO(data.photoId),
        });

        if (sharedCameraId) {
          // Shared camera photo - invalidate camera-related queries
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.CAMERA_PHOTOS(sharedCameraId),
          });
          
          // Also invalidate user camera queries
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.USER_CAMERAS(userId),
          });
        } else {
          // Face-matched photo - invalidate ALL shared photo queries
          
          // Invalidate infinite face-matched photos (used in friends modal)
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS_ALL(userId),
          });
          
          // Invalidate specific shared photos queries (with pattern matching)
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && (
                key[0] === "sharedPhotos" ||
                key[0] === "infiniteFaceMatchedPhotos" ||
                key[0] === "sharedPhotosGroup"
              );
            }
          });
        }

        // Invalidate user's photos with correct key
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.MY_PHOTOS(userId),
        });

        // Remove photo from recent photos store (used on camera page)
        try {
          await useRecentPhotosStore.getState().removePhoto(data.photoId, userId);
          console.log(`📱 [DELETE_PHOTO] Removed photo from recent photos store: ${data.photoId}`);
        } catch (storeError) {
          console.warn(`⚠️ [DELETE_PHOTO] Failed to remove from recent photos store:`, storeError);
        }

        console.log(`🔄 [DELETE_PHOTO] Invalidated queries for user ${userId}`);
      } catch (error) {
        console.warn(`⚠️ [DELETE_PHOTO] Failed to invalidate queries:`, error);
      }

      // Show success message
      showMessage({
        message: "Photo deleted successfully",
        type: "success",
        duration: 2000,
      });
    },

    onError: (error) => {
      console.error(`❌ [DELETE_PHOTO] Deletion failed:`, error);
      
      // Show error message
      showMessage({
        message: "Failed to delete photo",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        type: "danger",
        duration: 4000,
      });
    },
  });
}