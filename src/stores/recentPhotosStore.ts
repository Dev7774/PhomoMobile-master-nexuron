/* src/stores/recentPhotosStore.ts */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { photoCacheDB } from '@/src/utils/services/PhotoCacheDB';

const getRecentPhotosKey = (userId: string) => `recentPhotos_${userId}`;
const MAX_RECENT_PHOTOS = 5;

export interface RecentPhoto {
  id: string;
  uri: string;
  timestamp: number;
  cameraId: string | null;
  friendGroupKey?: string;
}

interface RecentPhotosState {
  photos: RecentPhoto[];
  isLoaded: boolean;
  currentUserId: string | null;
  addPhoto: (photo: RecentPhoto, userId: string) => Promise<void>;
  updatePhotoFriendGroup: (photoId: string, friendGroupKey: string | undefined, userId: string) => Promise<void>;
  removePhoto: (photoId: string, userId: string) => Promise<void>;
  loadPhotos: (userId: string) => Promise<void>;
  clearPhotos: (userId?: string) => Promise<void>;
  resetForNewUser: (userId: string) => Promise<void>;
}

export const useRecentPhotosStore = create<RecentPhotosState>((set, get) => ({
  photos: [],
  isLoaded: false,
  currentUserId: null,

  addPhoto: async (photo: RecentPhoto, userId: string) => {
    try {
      const { photos, currentUserId } = get();

      // Save to SQLite cache for instant loading
      try {
        await photoCacheDB.savePhoto({
          id: photo.id,
          localUri: photo.uri,
          cameraId: photo.cameraId,
          ownerId: userId,
          createdAt: photo.timestamp,
        });
        console.log('💾 [RECENT_PHOTOS_STORE] Photo saved to SQLite cache:', photo.id);
      } catch (cacheError) {
        console.warn('⚠️ [RECENT_PHOTOS_STORE] Failed to save to cache (non-critical):', cacheError);
      }

      // If this is a different user, clear photos first
      if (currentUserId !== userId) {
        set({ photos: [], currentUserId: userId });
        const newPhotos = [photo];
        await AsyncStorage.setItem(getRecentPhotosKey(userId), JSON.stringify(newPhotos));
        set({ photos: newPhotos });
        console.log('📱 [RECENT_PHOTOS_STORE] New user, photo added:', photo.id, 'user:', userId);
        return;
      }
      
      // Check if photo already exists
      const existingPhotoIndex = photos.findIndex(p => p.id === photo.id);
      
      let updatedPhotos: RecentPhoto[];
      if (existingPhotoIndex !== -1) {
        // Photo exists - update it
        updatedPhotos = [...photos];
        updatedPhotos[existingPhotoIndex] = photo;
      } else {
        // New photo - add it
        updatedPhotos = [...photos, photo];
      }
      
      // Keep only the most recent photos
      const sortedPhotos = updatedPhotos
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-MAX_RECENT_PHOTOS);
      
      await AsyncStorage.setItem(getRecentPhotosKey(userId), JSON.stringify(sortedPhotos));
      set({ photos: sortedPhotos });
      
      console.log('📱 [RECENT_PHOTOS_STORE] Photo added/updated:', photo.id, 'user:', userId, 'total:', sortedPhotos.length);
    } catch (error) {
      console.error('❌ [RECENT_PHOTOS_STORE] Failed to add photo:', error);
      throw error;
    }
  },

  updatePhotoFriendGroup: async (photoId: string, friendGroupKey: string | undefined, userId: string) => {
    try {
      const { photos, currentUserId } = get();
      
      if (currentUserId !== userId) {
        console.warn('⚠️ [RECENT_PHOTOS_STORE] User mismatch for friend group update:', photoId, 'expected:', userId, 'current:', currentUserId);
        return;
      }
      
      const photoIndex = photos.findIndex(p => p.id === photoId);
      
      if (photoIndex === -1) {
        console.warn('⚠️ [RECENT_PHOTOS_STORE] Photo not found for friend group update:', photoId);
        return;
      }
      
      const updatedPhotos = [...photos];
      updatedPhotos[photoIndex] = {
        ...updatedPhotos[photoIndex],
        friendGroupKey
      };
      
      await AsyncStorage.setItem(getRecentPhotosKey(userId), JSON.stringify(updatedPhotos));
      set({ photos: updatedPhotos });
      
      console.log('📱 [RECENT_PHOTOS_STORE] Friend group updated for photo:', photoId, 'user:', userId, 'friendGroupKey:', friendGroupKey);
    } catch (error) {
      console.error('❌ [RECENT_PHOTOS_STORE] Failed to update friend group:', error);
      throw error;
    }
  },

  removePhoto: async (photoId: string, userId: string) => {
    try {
      const { photos, currentUserId } = get();
      
      console.log('🗑️ [RECENT_PHOTOS_STORE] REMOVE_PHOTO called:', {
        photoId,
        userId,
        currentUserId,
        currentPhotosCount: photos.length,
        photoIds: photos.map(p => p.id)
      });
      
      if (currentUserId !== userId) {
        console.warn('⚠️ [RECENT_PHOTOS_STORE] User mismatch for photo removal:', photoId, 'expected:', userId, 'current:', currentUserId);
        return;
      }
      
      const photoIndex = photos.findIndex(p => p.id === photoId);
      
      if (photoIndex === -1) {
        console.log('📱 [RECENT_PHOTOS_STORE] Photo not found in recent photos:', photoId);
        console.log('📱 [RECENT_PHOTOS_STORE] Available photos:', photos.map(p => ({ id: p.id, uri: p.uri.substring(0, 50) + '...' })));
        return;
      }
      
      console.log('🔍 [RECENT_PHOTOS_STORE] Found photo to remove at index:', photoIndex);
      
      // Remove the photo from the array
      const updatedPhotos = photos.filter(p => p.id !== photoId);
      
      // Update AsyncStorage
      await AsyncStorage.setItem(getRecentPhotosKey(userId), JSON.stringify(updatedPhotos));
      
      // Update state
      set({ photos: updatedPhotos });
      
      console.log('✅ [RECENT_PHOTOS_STORE] Photo removed successfully:', {
        photoId,
        previousCount: photos.length,
        newCount: updatedPhotos.length,
        remainingPhotoIds: updatedPhotos.map(p => p.id)
      });
    } catch (error) {
      console.error('❌ [RECENT_PHOTOS_STORE] Failed to remove photo:', error);
      throw error;
    }
  },

  loadPhotos: async (userId: string) => {
    try {
      const { currentUserId } = get();
      const storageKey = getRecentPhotosKey(userId);
      
      // If switching users, clear current photos first
      if (currentUserId !== userId) {
        set({ photos: [], currentUserId: userId });
      }
      
      const storedPhotos = await AsyncStorage.getItem(storageKey);
      console.log('📱 [RECENT_PHOTOS_STORE] Loading photos from storage for user:', userId);
      
      if (storedPhotos !== null) {
        const parsedPhotos: RecentPhoto[] = JSON.parse(storedPhotos);
        
        // Validate and filter out invalid photos
        const validPhotos = parsedPhotos.filter(photo => 
          photo.id && 
          photo.uri && 
          typeof photo.timestamp === 'number' &&
          photo.cameraId !== undefined // can be null, but should be defined
        );
        
        // Sort by timestamp to ensure correct order
        const sortedPhotos = validPhotos.sort((a, b) => a.timestamp - b.timestamp);
        
        set({ 
          photos: sortedPhotos.slice(-MAX_RECENT_PHOTOS),
          isLoaded: true,
          currentUserId: userId
        });
        
        console.log('📱 [RECENT_PHOTOS_STORE] Loaded', sortedPhotos.length, 'photos from storage for user:', userId);
      } else {
        set({ 
          photos: [],
          isLoaded: true,
          currentUserId: userId
        });
        console.log('📱 [RECENT_PHOTOS_STORE] No stored photos found for user:', userId);
      }
    } catch (error) {
      console.error('❌ [RECENT_PHOTOS_STORE] Failed to load photos from storage:', error);
      set({ 
        photos: [],
        isLoaded: true,
        currentUserId: userId
      });
    }
  },

  clearPhotos: async (userId?: string) => {
    try {
      const { currentUserId } = get();
      const userIdToUse = userId || currentUserId;
      
      if (!userIdToUse) {
        console.warn('⚠️ [RECENT_PHOTOS_STORE] No user ID provided for clearing photos');
        return;
      }
      
      await AsyncStorage.removeItem(getRecentPhotosKey(userIdToUse));
      
      // Only clear in-memory photos if clearing for current user
      if (userIdToUse === currentUserId) {
        set({ photos: [] });
      }
      
      console.log('📱 [RECENT_PHOTOS_STORE] Photos cleared for user:', userIdToUse);
    } catch (error) {
      console.error('❌ [RECENT_PHOTOS_STORE] Failed to clear photos:', error);
      throw error;
    }
  },


  resetForNewUser: async (userId: string) => {
    try {
      set({ 
        photos: [], 
        isLoaded: false, 
        currentUserId: userId 
      });
      console.log('📱 [RECENT_PHOTOS_STORE] Reset for new user:', userId);
    } catch (error) {
      console.error('❌ [RECENT_PHOTOS_STORE] Failed to reset for new user:', error);
      throw error;
    }
  },
}));