import React, { createContext, useContext, useState, useEffect } from "react";
import {
  AuthUser,
  getCurrentUser,
  signOut,
  fetchAuthSession,
} from "aws-amplify/auth";
import { Hub } from "@aws-amplify/core";
import { ensureUserRecord } from "../src/utils/userManagement";
import { GetUserQuery } from "@/src/API";
import { queryClient } from "../src/lib/queryClient";
import { usePreferencesStore } from "../src/stores/preferencesStore";
import { useRecentPhotosStore } from "../src/stores/recentPhotosStore";
import { photoCacheDB } from "../src/utils/services/PhotoCacheDB";
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  user: AuthUser | null;
  profile: GetUserQuery["getUser"] | null;
  isLoading: boolean;
  error: unknown;
  customState: string | null;
  signOut: (cleanupPushToken?: () => Promise<void>) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<GetUserQuery["getUser"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [customState, setCustomState] = useState<string | null>(null);
  const [userExplicitlySignedOut, setUserExplicitlySignedOut] = useState(false);

  const refreshUser = async (): Promise<void> => {
    try {
      setIsLoading(true);
      console.log('🔄 [AUTH] Refreshing user session...');
      const session = await fetchAuthSession();

      if (!session?.tokens?.idToken) {
        throw new Error("No valid session found.");
      }

      const currentUser = await getCurrentUser();
      
      // If this is a different user than before, clear the cache and stores
      if (user && user.username !== currentUser.username) {
        console.log("🗑️ [AUTH] Different user detected, clearing query cache and stores");
        queryClient.clear();

        // Reset stores for the new user
        usePreferencesStore.getState().resetForNewUser(currentUser.username);
        useRecentPhotosStore.getState().resetForNewUser(currentUser.username);

        // Clear SQLite photo cache for user switch
        try {
          await photoCacheDB.clear();
          console.log("🗑️ [AUTH] Cleared SQLite photo cache for user switch");
        } catch (error) {
          console.error("❌ [AUTH] Failed to clear SQLite cache for user switch:", error);
        }
      }
      
      setUser(currentUser);
      const record = await ensureUserRecord();
      setProfile(record);
      setError(null);
      setUserExplicitlySignedOut(false); // Reset the flag when successfully signed in
    } catch (error) {
      console.log("🔄 [AUTH] No valid session found, user not authenticated");
      setUser(null);
      setError(null); // Don't set error for unauthenticated state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
          refreshUser();
          break;
        case "signedOut":
          setUser(null);
          setProfile(null);
          setError(null);
          break;
        case "tokenRefresh":
          refreshUser();
          break;
        case "tokenRefresh_failure":
          setError("Failed to refresh authentication token");
          break;
      }
    });

    refreshUser();

    return unsubscribe;
  }, []);


  const handleSignOut = async (cleanupPushToken?: () => Promise<void>) => {
    try {
      setIsLoading(true);
      setUserExplicitlySignedOut(true); // Mark that user explicitly signed out
      
      // Clean up push token before signing out (while we still have auth)
      if (cleanupPushToken) {
        try {
          console.log("🔔 [AUTH] Running push token cleanup before logout");
          await cleanupPushToken();
        } catch (error) {
          console.error("❌ [AUTH] Failed to cleanup push token:", error);
          // Continue with logout even if cleanup fails
        }
      }
      
      setUser(null);
      setProfile(null);
      
      // Set flag to indicate user came from sign out
      await AsyncStorage.setItem('cameFromSignOut', 'true');
      
      // Clear all TanStack Query cache to prevent data leakage between users
      console.log("🗑️ [AUTH] Clearing query cache on logout");
      queryClient.clear();
      
      // Clear user-specific stores
      usePreferencesStore.getState().resetForNewUser('');
      useRecentPhotosStore.getState().resetForNewUser('');
      console.log("🗑️ [AUTH] Cleared user-specific stores");

      // Clear SQLite photo cache
      try {
        await photoCacheDB.clear();
        console.log("🗑️ [AUTH] Cleared SQLite photo cache");
      } catch (error) {
        console.error("❌ [AUTH] Failed to clear SQLite cache:", error);
      }
      
      // Try local sign-out first
      await signOut();
      
      // Then try global sign-out (this may trigger Safari prompt)
      try {
        await signOut({ global: true });
      } catch (globalSignOutError) {
        console.log("Global sign-out failed or was cancelled:", globalSignOutError);
        // Even if global sign-out fails, we've cleared local state
      }
      
    } catch (error) {
      console.error("Error signing out:", error);
      setError(error);
      
      // Even if sign-out fails, clear local state and mark as explicitly signed out
      setUser(null);
      setProfile(null);
      setUserExplicitlySignedOut(true);
      
      // Still clear the cache even if sign-out fails
      console.log("🗑️ [AUTH] Clearing query cache on logout (error case)");
      queryClient.clear();
      
      // Clear user-specific stores even on error
      usePreferencesStore.getState().resetForNewUser('');
      useRecentPhotosStore.getState().resetForNewUser('');
      console.log("🗑️ [AUTH] Cleared user-specific stores (error case)");

      // Clear SQLite photo cache even on error
      try {
        await photoCacheDB.clear();
        console.log("🗑️ [AUTH] Cleared SQLite photo cache (error case)");
      } catch (cacheError) {
        console.error("❌ [AUTH] Failed to clear SQLite cache (error case):", cacheError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        error,
        customState,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
