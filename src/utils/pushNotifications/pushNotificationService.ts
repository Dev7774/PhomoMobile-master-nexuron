import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PushNotificationResult, NotificationPermissionStatus, NotificationData, NotificationPayload } from './pushNotificationTypes';

export class PushNotificationService {
  private static instance: PushNotificationService;

  private constructor() {
    this.configure().catch(error => 
      console.error('Failed to configure push notifications:', error)
    );
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private async configure() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // Increment badge count when notification arrives
        const currentBadgeCount = await Notifications.getBadgeCountAsync();
        await Notifications.setBadgeCountAsync(currentBadgeCount + 1);
        
        return {
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  }

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    const permissions = await Notifications.getPermissionsAsync();
    return {
      status: permissions.status,
      canAskAgain: permissions.canAskAgain ?? true,
    };
  }

  async requestPermissions(): Promise<NotificationPermissionStatus> {
    const permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
        provideAppNotificationSettings: false,
        allowProvisional: false,
      },
    });

    return {
      status: permissions.status,
      canAskAgain: permissions.canAskAgain ?? true,
    };
  }


  async registerForPushNotifications(): Promise<PushNotificationResult> {
    try {
      if (!Device.isDevice) {
        return {
          token: null,
          error: 'Push notifications only work on physical devices',
        };
      }

      const permissionStatus = await this.getPermissionStatus();
      let finalStatus = permissionStatus.status;

      if (finalStatus !== 'granted') {
        const requestResult = await this.requestPermissions();
        finalStatus = requestResult.status;
      }

      if (finalStatus !== 'granted') {
        return {
          token: null,
          error: 'Permission not granted for push notifications',
        };
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        return {
          token: null,
          error: 'EAS project ID not found in configuration',
        };
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      
      return {
        token: tokenData.data,
      };
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return {
        token: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  createNotificationRoute(data: NotificationData): string {
    const { type } = data;
    
    switch (type) {
      case 'face_matched_photo':
        const { photoId: facePhotoId, fromUsername: faceFromUsername } = data as Extract<NotificationData, { type: 'face_matched_photo' }>;
        return `/photo/${facePhotoId}?friendId=${faceFromUsername}`;
        
      case 'face_matched_photos_batch':
        const { fromUsername: batchFromUsername } = data as Extract<NotificationData, { type: 'face_matched_photos_batch' }>;
        return `/(tabs)/album?friendId=${batchFromUsername}`;
        
      case 'shared_camera_photo':
        const { photoId, cameraId } = data as Extract<NotificationData, { type: 'shared_camera_photo' }>;
        return `/photo/${photoId}${cameraId ? `?cameraId=${cameraId}` : ''}`;
        
      case 'shared_camera_photos_batch':
        const { cameraId: batchCameraId } = data as Extract<NotificationData, { type: 'shared_camera_photos_batch' }>;
        return `/(tabs)/album?cameraId=${batchCameraId}`;
        
      case 'friend_request':
      case 'friend_accepted':
      case 'camera_invitation':
        // All social activity notifications now route to me.tsx activity section
        return '/(tabs)/me';
        
      case 'camera_joined':
        const { cameraId: joinedCameraId } = data as Extract<NotificationData, { type: 'camera_joined' }>;
        return `/(tabs)/album?cameraId=${joinedCameraId}`;
        
      case 'synced_photos_review':
        const { batchIds } = data as Extract<NotificationData, { type: 'synced_photos_review' }>;
        return `/syncedPhotosReview?batches=${batchIds.join(',')}&source=notification`;
        
      default:
        return '/';
    }
  }


  public setupNotificationListeners(onNotificationTapped: (response: any, isFromKilledState?: boolean) => void): void {
    console.log('🔔 [PUSH_SERVICE] Setting up notification listeners');

    // Check for notification that opened the app from killed state
    this.checkKilledStateNotification(onNotificationTapped);

    // Listen for notification taps (when user taps on notification)
    Notifications.addNotificationResponseReceivedListener((response) => {
      onNotificationTapped(response, false);
    });
  }

  private async checkKilledStateNotification(onNotificationTapped: (response: any, isFromKilledState?: boolean) => void): Promise<void> {
    try {
      const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastNotificationResponse) {
        console.log('🔔 [PUSH_SERVICE] Found notification that opened app from killed state');
        onNotificationTapped(lastNotificationResponse, true);
      }
    } catch (error) {
      console.error('🔔 [PUSH_SERVICE] Error checking killed state notification:', error);
    }
  }


  private createNotificationPayload(data: NotificationData): NotificationPayload {
    const { type } = data;
    const fromUsername = data.fromUsername;
    
    switch (type) {
      case 'face_matched_photo':
        const { cameraName: faceCameraName, cameraId: faceCameraId } = data as Extract<NotificationData, { type: 'face_matched_photo' }>;
        // Check if this is a shared camera face match vs regular face match
        if (faceCameraId && faceCameraName) {
          return {
            title: '📸 You\'re in a Photo!',
            body: `${fromUsername} took a photo of you in "${faceCameraName}"`,
            data,
          };
        } else {
          return {
            title: '📸 Photo Match Found!',
            body: `${fromUsername} shared a photo with your face in it`,
            data,
          };
        }
        
      case 'face_matched_photos_batch':
        const { photoCount: facePhotoCount } = data as Extract<NotificationData, { type: 'face_matched_photos_batch' }>;
        return {
          title: '📸 Photos Shared with You!',
          body: `${fromUsername} shared ${facePhotoCount} photo${facePhotoCount === 1 ? '' : 's'} with you`,
          data,
        };
        
      case 'shared_camera_photo':
        const { cameraName: photoCameraName } = data as Extract<NotificationData, { type: 'shared_camera_photo' }>;
        return {
          title: '📷 New Photo Shared',
          body: `${fromUsername} added a new photo to ${photoCameraName || 'the shared event'}`,
          data,
        };
        
      case 'shared_camera_photos_batch':
        const { photoCount: sharedPhotoCount, cameraName: batchCameraName } = data as Extract<NotificationData, { type: 'shared_camera_photos_batch' }>;
        return {
          title: '📷 Photos Shared',
          body: `${fromUsername} shared ${sharedPhotoCount} photo${sharedPhotoCount === 1 ? '' : 's'} with ${batchCameraName || 'the shared event'}`,
          data,
        };
        
      case 'friend_request':
        return {
          title: '👋 Friend Request',
          body: `${fromUsername} sent you a friend request`,
          data,
        };
        
      case 'friend_accepted':
        return {
          title: '🎉 Friend Request Accepted',
          body: `${fromUsername} accepted your friend request`,
          data,
        };
        
      case 'camera_invitation':
        const { cameraName } = data as Extract<NotificationData, { type: 'camera_invitation' }>;
        return {
          title: '📸 Event Invitation',
          body: `${fromUsername} invited you to join ${cameraName || 'a shared event'}`,
          data,
        };
        
      case 'camera_joined':
        const { cameraName: joinedCameraName } = data as Extract<NotificationData, { type: 'camera_joined' }>;
        return {
          title: '📷 Someone Joined Event',
          body: `${fromUsername} joined ${joinedCameraName || 'the shared event'}`,
          data,
        };
        
      case 'synced_photos_review':
        const { photoCount: syncedPhotoCount } = data as Extract<NotificationData, { type: 'synced_photos_review' }>;
        return {
          title: '📸 Photos Synced',
          body: `${syncedPhotoCount} photo${syncedPhotoCount === 1 ? '' : 's'} synced from iCloud. Tap to review and share.`,
          data,
        };
        
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  async clearBadgeCount(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log('🔔 [PUSH_SERVICE] Badge count cleared');
    } catch (error) {
      console.error('❌ [PUSH_SERVICE] Failed to clear badge count:', error);
    }
  }

  async getBadgeCount(): Promise<number> {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
    } catch (error) {
      console.error('❌ [PUSH_SERVICE] Failed to get badge count:', error);
      return 0;
    }
  }

  async sendNotification(recipientToken: string, data: NotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      if (!Device.isDevice) {
        console.log('🔔 [SEND_NOTIFICATION] Skipping - not on physical device');
        return { success: true };
      }

      const payload = this.createNotificationPayload(data);
      
      console.log('🔔 [SEND_NOTIFICATION] Sending notification:', {
        type: data.type,
        to: recipientToken.substring(0, 20) + '...',
        title: payload.title,
      });

      const message = {
        to: recipientToken,
        sound: 'default' as const,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        priority: 'high' as const,
        channelId: 'default',
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseData.message || 'Unknown error'}`);
      }

      if (responseData.data?.status === 'error') {
        throw new Error(responseData.data.message || 'Expo push service error');
      }

      console.log('✅ [SEND_NOTIFICATION] Notification sent successfully');
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ [SEND_NOTIFICATION] Failed to send notification:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();