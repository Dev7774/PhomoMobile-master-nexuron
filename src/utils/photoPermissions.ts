import { Platform, Linking } from "react-native";
import * as MediaLibrary from 'expo-media-library';

export type PhotoAccessLevel = 'full' | 'limited' | 'denied' | 'undetermined';

/**
 * Enhanced permission detection that distinguishes between full, limited, and denied access
 * Handles iOS 14+ limited photo access properly
 */
export async function getPhotoAccessLevel(): Promise<PhotoAccessLevel> {
  try {
    const permissionResponse = await MediaLibrary.getPermissionsAsync();
    const { status } = permissionResponse;
    
    if (status === 'undetermined') {
      return 'undetermined';
    } else if (status === 'denied') {
      return 'denied';
    } else if (status !== 'granted') {
      // Handle any other non-granted status as denied
      return 'denied';
    }
    
    // Only iOS has granular access controls
    if (Platform.OS !== 'ios') {
      return 'full';
    }
    
    // iOS 14+ has accessPrivileges property to distinguish full vs limited access
    // @ts-ignore - accessPrivileges is not in the types but exists on iOS
    const accessPrivileges = permissionResponse.accessPrivileges;
    
    if (accessPrivileges === 'limited') {
      console.log('📸 [PERMISSION] Detected limited photo access');
      return 'limited';
    } else if (accessPrivileges === 'all') {
      console.log('📸 [PERMISSION] Detected full photo access');
      return 'full';
    }
    
    // If accessPrivileges is undefined on iOS, assume full access
    console.log('📸 [PERMISSION] iOS accessPrivileges undefined, assuming full access');
    return 'full';
  } catch (error) {
    console.error('❌ [PERMISSION] Error detecting photo access level:', error);
    return 'denied';
  }
}

/**
 * Check if we can request photo permissions (user hasn't permanently denied)
 */
export async function canRequestPhotoPermissions(): Promise<boolean> {
  try {
    const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
    
    if (status === 'undetermined') {
      return true; // First time, can always ask
    }
    
    if (status === 'denied') {
      // Check if we can ask again (iOS provides this info)
      return canAskAgain ?? false;
    }
    
    // If granted, we can still ask (to potentially expand limited access)
    return status === 'granted';
  } catch (error) {
    console.error('❌ [PERMISSION] Error checking if can request permissions:', error);
    return false;
  }
}

/**
 * Ask for more photo access - handles both first-time and limited access scenarios
 * Uses the correct API for each situation
 */
export async function askForMorePhotos(): Promise<PhotoAccessLevel> {
  try {
    const current = await MediaLibrary.getPermissionsAsync();

    // If user previously chose Limited → open the native "Select More Photos…" sheet
    if (
      current.status === "granted" &&
      Platform.OS === "ios" &&
      // @ts-ignore - accessPrivileges is not in the types but exists on iOS
      current.accessPrivileges === "limited"
    ) {
      console.log('📸 [PERMISSION] User has limited access, showing "Select More Photos" picker');
      await MediaLibrary.presentPermissionsPickerAsync(); // Expo API for expanding limited access
      return getPhotoAccessLevel();
    }

    // Otherwise (first ask, denied, or Android):
    console.log('📸 [PERMISSION] Requesting permissions for first time or after denial');
    const next = await MediaLibrary.requestPermissionsAsync();

    if (next.status === "granted") {
      if (Platform.OS !== "ios") return "full";
      const checked = await MediaLibrary.getPermissionsAsync();
      // @ts-ignore - accessPrivileges is not in the types but exists on iOS
      return checked.accessPrivileges === "limited" ? "limited" : "full";
    }

    // If denied and we can't prompt again, deep-link to Settings
    if (!next.canAskAgain) {
      console.log('📸 [PERMISSION] Cannot ask again, opening Settings');
      try { 
        await Linking.openSettings(); 
      } catch (settingsError) {
        console.warn('⚠️ [PERMISSION] Failed to open Settings:', settingsError);
      }
    }
    return "denied";
  } catch (error) {
    console.error('❌ [PERMISSION] Error asking for more photos:', error);
    return 'denied';
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use askForMorePhotos() instead
 */
export async function requestPhotoPermissions(): Promise<PhotoAccessLevel> {
  console.warn('⚠️ [PERMISSION] requestPhotoPermissions is deprecated, use askForMorePhotos instead');
  return askForMorePhotos();
}