import { useEffect } from 'react';
import { useSubscription } from './useSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './usePhotoQueries';
import { CAMERA_QUERY_KEYS } from './useCameraQueries';
import { onCreateSharedCamera, onUpdateSharedCamera, onDeleteSharedCamera, onCreateSharedCameraMember, onUpdateSharedCameraMember, onDeleteSharedCameraMember } from '@/src/graphql/subscriptions';

export function useCameraSubscriptions(enabled: boolean, userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const shouldSubscribe = enabled && !!userId;

  const handleCameraUpdate = (data: any) => {
    console.log(`🎥 [CAMERA_SUBSCRIPTION] Received camera update:`, data);
    // Invalidate camera-related queries to refresh the UI
    if (userId) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_CAMERAS(userId) });
      queryClient.invalidateQueries({ queryKey: ['cameraPhotos'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: ['sharedCameraPhotos'] })
    }
  };

  const handleCameraMemberUpdate = (data: any) => {
    console.log(`🎥 [CAMERA_MEMBER_SUBSCRIPTION] Received camera member update:`, data);
    // Invalidate camera membership and related photo queries
    if (userId) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_CAMERAS(userId) });
      queryClient.invalidateQueries({ queryKey: ['cameraMembers'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(userId) });
      queryClient.invalidateQueries({ queryKey: ['sharedCameraPhotos'] });
      // IMPORTANT: Invalidate camera invites for real-time invite notifications
      queryClient.invalidateQueries({ queryKey: CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(userId) });
    }
  };

  useSubscription(onCreateSharedCamera, {}, { 
    enabled: shouldSubscribe,
    onReceived: handleCameraUpdate
  });
  useSubscription(onUpdateSharedCamera, {}, { 
    enabled: shouldSubscribe,
    onReceived: handleCameraUpdate
  });
  useSubscription(onDeleteSharedCamera, {}, { 
    enabled: shouldSubscribe,
    onReceived: handleCameraUpdate
  });
  useSubscription(onCreateSharedCameraMember, { userId }, { 
    enabled: shouldSubscribe,
    onReceived: handleCameraMemberUpdate
  });
  useSubscription(onUpdateSharedCameraMember, { userId }, { 
    enabled: shouldSubscribe,
    onReceived: handleCameraMemberUpdate
  });
  useSubscription(onDeleteSharedCameraMember, { userId }, { 
    enabled: shouldSubscribe,
    onReceived: handleCameraMemberUpdate
  });

  useEffect(() => {
    if (shouldSubscribe) {
      console.log(`🎥 [CAMERA_SUBSCRIPTIONS] 🔑 ✅ User ID obtained: ${userId}`);
    } else {
      console.log(`🎥 [CAMERA_SUBSCRIPTIONS] 🔑 Subscriptions disabled - skipping user ID fetch`);
    }
  }, [shouldSubscribe, userId]);
}
