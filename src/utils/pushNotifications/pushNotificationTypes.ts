export interface PushToken {
  data: string;
  type: 'expo';
}

export interface NotificationPermissionStatus {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}

export interface PushNotificationResult {
  token: string | null;
  error?: string;
}

// Notification types and data structures
export type NotificationType = 
  | 'face_matched_photo'
  | 'face_matched_photos_batch'
  | 'shared_camera_photo'
  | 'shared_camera_photos_batch'
  | 'friend_request'
  | 'friend_accepted'
  | 'camera_invitation'
  | 'camera_joined'
  | 'synced_photos_review';

export interface BaseNotificationData {
  type: NotificationType;
  fromUsername: string;
}

export interface PhotoNotificationData extends BaseNotificationData {
  type: 'face_matched_photo' | 'shared_camera_photo';
  photoId: string;
  cameraId?: string; // For shared camera photos
  cameraName?: string; // For shared camera photos
}

export interface SharedCameraPhotoBatchNotificationData extends BaseNotificationData {
  type: 'shared_camera_photos_batch';
  photoCount: number;
  cameraId: string;
  cameraName?: string;
}

export interface FaceMatchedPhotoBatchNotificationData extends BaseNotificationData {
  type: 'face_matched_photos_batch';
  photoCount: number;
}

export interface FriendNotificationData extends BaseNotificationData {
  type: 'friend_request' | 'friend_accepted';
}

export interface CameraNotificationData extends BaseNotificationData {
  type: 'camera_invitation' | 'camera_joined';
  cameraId: string;
  cameraName?: string;
}

export interface SyncedPhotosNotificationData {
  type: 'synced_photos_review';
  photoCount: number;
  batchIds: string[];
  fromUsername?: string; // Optional since this is a system notification
}

export type NotificationData = PhotoNotificationData | SharedCameraPhotoBatchNotificationData | FaceMatchedPhotoBatchNotificationData | FriendNotificationData | CameraNotificationData | SyncedPhotosNotificationData;

export interface NotificationPayload {
  title: string;
  body: string;
  data: NotificationData;
}