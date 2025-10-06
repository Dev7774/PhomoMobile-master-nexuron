import { useEffect } from 'react';
import { router } from 'expo-router';
import { pushNotificationService } from '../utils/pushNotifications/pushNotificationService';

// Global flag to prevent URL clearing during single photo navigation
let isSinglePhotoNavigation = false;

export const setSinglePhotoNavigation = (value: boolean) => {
  isSinglePhotoNavigation = value;
};

export const getSinglePhotoNavigation = () => {
  return isSinglePhotoNavigation;
};

/**
 * Hook to set up notification tap handlers
 * Should be called once when the app starts and user is authenticated
 */
export function useNotificationHandler(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('🔔 [NOTIFICATION_HANDLER] Setting up notification listeners');

    const handleNotificationTap = (response: any, isFromKilledState = false) => {
      console.log('🔔 [NOTIFICATION_TAP] Notification tapped:', response, 'Killed state:', isFromKilledState);
      
      try {
        const notificationData = response.notification?.request?.content?.data;
        if (notificationData && notificationData.type) {
          const route = pushNotificationService.createNotificationRoute(notificationData);
          console.log('🔔 [NOTIFICATION_TAP] Navigating to:', route);

          if (notificationData.type === 'synced_photos_review') {
            router.dismissAll()
            router.replace(route as any);
          } else {
            // Build proper navigation stack directly
            buildProperNavigationStack(notificationData, route, isFromKilledState);
          }
        } else {
          console.log('🔔 [NOTIFICATION_TAP] No routing data found in notification');
        }
      } catch (error) {
        console.error('❌ [NOTIFICATION_TAP] Failed to handle notification tap:', error);
      }
    };

    const buildProperNavigationStack = (notificationData: any, targetRoute: string, isFromKilledState: boolean) => {
      const { type } = notificationData;
      console.log('🔔 [NAVIGATION_STACK] Building proper stack for:', type);

      const navigateMethod = isFromKilledState ? 'push' : 'navigate';

      switch (type) {
        case 'face_matched_photo': {
          // face_matched_photo: /photo/{id}?friendId={username}
          // NEW: Route to album with friendId context to ensure proper face-match section focus
          // Expected stack: album (face-match section) -> photo
          console.log('🔔 [NAVIGATION_STACK] Face matched photo - building album -> photo stack with friend context');
          
          // Set flag to prevent URL clearing in album.tsx
          setSinglePhotoNavigation(true);
          
          // Extract friendId from target route to pass to album
          const { fromUsername } = notificationData;
          const albumWithFriendRoute = `/(tabs)/album?friendId=${fromUsername}`;
          
          router[navigateMethod](albumWithFriendRoute as any);
          setTimeout(() => {
            router.push(targetRoute as any);
            
            // Clear flag after delay
            setTimeout(() => {
              console.log('🔔 [NAVIGATION_STACK] Clearing single photo navigation flag after safe delay');
              setSinglePhotoNavigation(false);
            }, 2000);
          }, 50);
          break;
        }

        case 'face_matched_photos_batch': {
          // face_matched_photos_batch: Routes to album face-match section (index 0)
          // NEW: Route to album instead of me.tsx for unified experience
          console.log('🔔 [NAVIGATION_STACK] Face matched photos batch - going to album face-match section');
          router[navigateMethod](targetRoute as any);
          break;
        }

        case 'shared_camera_photo': {
          // shared_camera_photo: /photo/{id}?cameraId={id}
          // Normal flow: album.tsx?cameraId=X → router.push(/photo/[id])
          // Expected stack: album (with camera context) -> photo
          console.log('🔔 [NAVIGATION_STACK] Shared camera photo - building album -> photo stack with camera context');
          
          // Set flag to prevent URL clearing in album.tsx
          setSinglePhotoNavigation(true);
          
          const { cameraId } = notificationData;
          const albumRoute = `/(tabs)/album${cameraId ? `?cameraId=${cameraId}` : ''}`;
          
          router[navigateMethod](albumRoute as any);
          console.log('🔔 [NAVIGATION_STACK] Navigated to album, waiting before photo navigation...');
          
          setTimeout(() => {
            console.log('🔔 [NAVIGATION_STACK] Now navigating to photo:', targetRoute);
            router.push(targetRoute as any);
            
            // Clear flag after much longer delay to allow focus effect to complete
            setTimeout(() => {
              console.log('🔔 [NAVIGATION_STACK] Clearing single photo navigation flag after safe delay');
              setSinglePhotoNavigation(false);
            }, 2000);
          }, 150);
          break;
        }

        case 'shared_camera_photos_batch': {
          // shared_camera_photos_batch: /(tabs)/album?cameraId={id}
          // Goes directly to album with camera context to view photos
          console.log('🔔 [NAVIGATION_STACK] Shared camera photos batch - going to album with camera context');
          
          const { cameraId } = notificationData;
          const albumRoute = `/(tabs)/album${cameraId ? `?cameraId=${cameraId}` : ''}`;
          router[navigateMethod](albumRoute as any);
          break;
        }

        case 'friend_request':
        case 'friend_accepted': {
          // friend_request/friend_accepted: Route directly to me.tsx tab since it now has the activity section
          console.log('🔔 [NAVIGATION_STACK] Friend notification - going directly to me.tsx activity section');
          
          router[navigateMethod]('/(tabs)/me' as any);
          break;
        }

        case 'camera_invitation': {
          // camera_invitation: Route directly to me.tsx tab since it now has the activity section
          console.log('🔔 [NAVIGATION_STACK] Camera invitation - going directly to me.tsx activity section');
          
          router[navigateMethod]('/(tabs)/me' as any);
          break;
        }

        case 'camera_joined': {
          // camera_joined: /(tabs)/album?cameraId={id}
          // Goes directly to album with camera context
          console.log('🔔 [NAVIGATION_STACK] Camera joined - going directly to album');
          router[navigateMethod](targetRoute as any);
          break;
        }

        default:
          console.log('🔔 [NAVIGATION_STACK] Unknown notification type - using fallback');
          router[navigateMethod](targetRoute as any);
          break;
      }
    };

    pushNotificationService.setupNotificationListeners(handleNotificationTap);
    
  }, [isAuthenticated]);
}