/* src/stores/preferencesStore.ts */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getAutoShareFacesKey = (userId: string) => `autoShareFaces_${userId}`;
const getAutoSyncToDeviceKey = (userId: string) => `autoSyncToDevice_${userId}`;

interface PreferencesState {
  autoShareFaces: boolean;
  autoSyncToDevice: boolean;
  isLoaded: boolean;
  currentUserId: string | null;
  setAutoShareFaces: (value: boolean, userId: string) => Promise<void>;
  setAutoSyncToDevice: (value: boolean, userId: string) => Promise<void>;
  loadPreferences: (userId: string) => Promise<void>;
  resetForNewUser: (userId: string) => void;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  autoShareFaces: true,
  autoSyncToDevice: false,
  isLoaded: false,
  currentUserId: null,

  setAutoShareFaces: async (value: boolean, userId: string) => {
    try {
      const { currentUserId } = get();
      
      // If this is a different user, update current user
      if (currentUserId !== userId) {
        set({ currentUserId: userId });
      }
      
      await AsyncStorage.setItem(getAutoShareFacesKey(userId), JSON.stringify(value));
      set({ autoShareFaces: value, currentUserId: userId });
      console.log("Auto share faces updated for user:", userId, "value:", value);
    } catch (error) {
      console.error("Failed to save autoShareFaces to AsyncStorage:", error);
      throw error;
    }
  },

  setAutoSyncToDevice: async (value: boolean, userId: string) => {
    try {
      const { currentUserId } = get();
      
      // If this is a different user, update current user
      if (currentUserId !== userId) {
        set({ currentUserId: userId });
      }
      
      await AsyncStorage.setItem(getAutoSyncToDeviceKey(userId), JSON.stringify(value));
      set({ autoSyncToDevice: value, currentUserId: userId });
      console.log("Auto sync to device updated for user:", userId, "value:", value);
    } catch (error) {
      console.error("Failed to save autoSyncToDevice to AsyncStorage:", error);
      throw error;
    }
  },

  loadPreferences: async (userId: string) => {
    try {
      const { currentUserId } = get();
      
      // If switching users, reset first
      if (currentUserId !== userId) {
        set({ autoShareFaces: true, autoSyncToDevice: false, isLoaded: false, currentUserId: userId });
      }
      
      const autoShareValue = await AsyncStorage.getItem(getAutoShareFacesKey(userId));
      const autoSyncValue = await AsyncStorage.getItem(getAutoSyncToDeviceKey(userId));
      console.log("Preferences loaded from storage for user:", userId, "autoShare:", autoShareValue, "autoSync:", autoSyncValue);
      
      set({ 
        autoShareFaces: autoShareValue !== null ? JSON.parse(autoShareValue) : true,
        autoSyncToDevice: autoSyncValue !== null ? JSON.parse(autoSyncValue) : false,
        isLoaded: true,
        currentUserId: userId
      });
    } catch (error) {
      console.error("Failed to load preferences from AsyncStorage:", error);
      set({ 
        autoShareFaces: true,
        autoSyncToDevice: false,
        isLoaded: true,
        currentUserId: userId
      });
    }
  },

  resetForNewUser: (userId: string) => {
    set({ 
      autoShareFaces: true,
      autoSyncToDevice: false,
      isLoaded: false, 
      currentUserId: userId 
    });
    console.log("Preferences reset for new user:", userId);
  },
}));