import { useEffect } from 'react';
import { useSubscription } from './useSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './usePhotoQueries';
import { USER_QUERY_KEYS } from './useUserQueries';
import { onCreatePhoto, onUpdatePhoto, onDeletePhoto, onCreatePhotoRecipient, onUpdatePhotoRecipient, onDeletePhotoRecipient, onCreateFriendship, onUpdateFriendship, onDeleteFriendship } from '@/src/graphql/subscriptions';
import { photoCacheDB } from '@/src/utils/services/PhotoCacheDB';

export function usePhotoSubscriptions(enabled: boolean, userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const shouldSubscribe = enabled && !!userId;

  const handlePhotoUpdate = async (data: any) => {
    console.log(`📸 [PHOTO_SUBSCRIPTION] Received photo update:`, JSON.stringify(data, null, 2));

    // Extract the photo from the subscription data
    const photo = data?.onCreatePhoto || data?.onUpdatePhoto;
    const deletedPhoto = data?.onDeletePhoto;

    // Save new/updated photos to SQLite cache
    if (photo && photo.id) {
      try {
        console.log(`💾 [PHOTO_SUBSCRIPTION] Saving photo to SQLite cache:`, photo.id);

        await photoCacheDB.savePhoto({
          id: photo.id,
          thumbUrl: null,  // URLs will be generated when needed
          fullUrl: null,
          thumbUrlExpires: null,
          fullUrlExpires: null,
          cameraId: photo.sharedCameraId || null,
          ownerId: photo.ownerId || null,
          ownerIdentityId: photo.ownerIdentityId || null,
          s3Key: photo.s3Key || null,
          thumbKey: photo.thumbKey || null,
          localUri: null,
        });

        console.log(`✅ [PHOTO_SUBSCRIPTION] Photo saved to cache:`, photo.id);
      } catch (error) {
        console.error(`❌ [PHOTO_SUBSCRIPTION] Failed to save photo to cache:`, error);
      }
    }

    // Remove deleted photos from cache
    if (deletedPhoto && deletedPhoto.id) {
      try {
        console.log(`🗑️ [PHOTO_SUBSCRIPTION] Removing deleted photo from cache:`, deletedPhoto.id);
        await photoCacheDB.deletePhoto(deletedPhoto.id);
      } catch (error) {
        console.error(`❌ [PHOTO_SUBSCRIPTION] Failed to delete photo from cache:`, error);
      }
    }

    // Invalidate all photo-related queries to refresh the UI
    if (userId) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_CAMERAS(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(userId) });
      // Invalidate all shared photos queries for this user (partial matching)
      queryClient.invalidateQueries({ queryKey: ['sharedPhotos', userId] });
      queryClient.invalidateQueries({ queryKey: ['sharedCameraPhotos'] });

      // If the photo belongs to a shared camera, invalidate that camera's infinite photos
      if (photo?.sharedCameraId) {
        console.log(`📸 [PHOTO_SUBSCRIPTION] Invalidating infinite camera photos for camera: ${photo.sharedCameraId}`);
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.INFINITE_SINGLE_SHARED_CAMERA_PHOTOS(photo.sharedCameraId),
          refetchType: "all" // Refetch all queries, not just active ones
        });

        // Also invalidate the regular camera photos query
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.CAMERA_PHOTOS(photo.sharedCameraId),
          refetchType: "all"
        });
      }

      // Also invalidate all infinite camera photos as a fallback (partial key matching)
      queryClient.invalidateQueries({
        queryKey: ['infiniteSingleSharedCameraPhotos'],
        refetchType: "all"
      });

      // Add a delayed invalidation as a failsafe for race conditions
      setTimeout(() => {
        console.log(`📸 [PHOTO_SUBSCRIPTION] Delayed failsafe invalidation`);
        if (photo?.sharedCameraId) {
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.INFINITE_SINGLE_SHARED_CAMERA_PHOTOS(photo.sharedCameraId),
            refetchType: "all"
          });
        }
        queryClient.invalidateQueries({
          queryKey: ['infiniteSingleSharedCameraPhotos'],
          refetchType: "all"
        });
      }, 1000); // 1 second delay
    }
  };

  const handlePhotoRecipientUpdate = (data: any) => {
    console.log(`📸 [PHOTO_RECIPIENT_SUBSCRIPTION] Received photo recipient update:`, data);
    // Invalidate photo queries when photo sharing changes
    if (userId) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_CAMERAS(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: ['sharedPhotos', userId] });
    }
  };

  const handleFriendshipUpdate = (data: any) => {
    console.log(`🤝 [FRIENDSHIP_SUBSCRIPTION] Received friendship update:`, data);
    
    if (userId) {
      const friendship = data?.onCreateFriendship || data?.onUpdateFriendship || data?.onDeleteFriendship;
      
      if (friendship && (friendship.ownerId === userId || friendship.friendId === userId)) {
        console.log(`🎯 [FRIENDSHIP_SUBSCRIPTION] Friendship update involves current user: ${userId}`);
        
        queryClient.invalidateQueries({ 
          queryKey: [...USER_QUERY_KEYS.FRIENDSHIP_STATUS(userId, ""), "allWithProfiles"],
          refetchType: "active" 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ["friendshipStatus"], 
          refetchType: "active" 
        });
        
        const otherUserId = friendship.ownerId === userId ? friendship.friendId : friendship.ownerId;
        if (otherUserId) {
          queryClient.invalidateQueries({
            queryKey: USER_QUERY_KEYS.FRIENDSHIP_STATUS(userId, otherUserId),
            refetchType: "active"
          });
        }
      }
    }
  };

  useSubscription(onCreatePhoto, {}, { 
    enabled: shouldSubscribe,
    onReceived: handlePhotoUpdate
  });
  useSubscription(onUpdatePhoto, {}, { 
    enabled: shouldSubscribe,
    onReceived: handlePhotoUpdate
  });
  useSubscription(onDeletePhoto, {}, { 
    enabled: shouldSubscribe,
    onReceived: handlePhotoUpdate
  });
  useSubscription(onCreatePhotoRecipient, { recipientId: userId }, { 
    enabled: shouldSubscribe,
    onReceived: handlePhotoRecipientUpdate
  });
  useSubscription(onUpdatePhotoRecipient, { recipientId: userId }, { 
    enabled: shouldSubscribe,
    onReceived: handlePhotoRecipientUpdate
  });
  useSubscription(onDeletePhotoRecipient, { recipientId: userId }, { 
    enabled: shouldSubscribe,
    onReceived: handlePhotoRecipientUpdate
  });
  useSubscription(onCreateFriendship, {}, { 
    enabled: shouldSubscribe,
    onReceived: handleFriendshipUpdate
  });
  useSubscription(onUpdateFriendship, {}, { 
    enabled: shouldSubscribe,
    onReceived: handleFriendshipUpdate
  });
  useSubscription(onDeleteFriendship, {}, { 
    enabled: shouldSubscribe,
    onReceived: handleFriendshipUpdate
  });

  useEffect(() => {
    if (shouldSubscribe) {
      console.log(`📸 [PHOTO_SUBSCRIPTIONS] 🔑 ✅ User ID obtained: ${userId}`);
    } else {
      console.log(`📸 [PHOTO_SUBSCRIPTIONS] 🔑 Subscriptions disabled - skipping user ID fetch`);
    }
  }, [shouldSubscribe, userId]);
}