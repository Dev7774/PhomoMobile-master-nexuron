import { useQuery } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { getUser } from "@/src/graphql/queries";

const client = generateClient();

/**
 * Query keys for profile-related queries
 */
export const PROFILE_QUERY_KEYS = {
  USER_PROFILE: (userId: string) => ["userProfile", userId] as const,
  MY_PROFILE: () => ["myProfile"] as const,
  PROFILE_PHOTO: (photoKey: string) => ["profilePhoto", photoKey] as const,
} as const;

/**
 * Hook to get the current user's profile
 */
export function useMyProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.MY_PROFILE(),
    queryFn: async () => {
      console.log("🔍 [PROFILE] Fetching my profile");

      // Get current user
      const user = await getCurrentUser();
      const username = user.username;

      // Fetch profile data
      const { data }: any = await client.graphql({
        query: getUser,
        variables: { id: username },
        authMode: "userPool",
      });

      if (!data.getUser || data.getUser._deleted) {
        throw new Error("Profile not found or deleted");
      }

      const profile = data.getUser;
      console.log("✅ [PROFILE] Profile loaded:", profile.displayName);

      // Get profile photo URL if exists
      let profilePhotoUrl = null;
      if (profile.profilePhotoKey) {
        try {
          const urlResult = await getUrl({
            key: profile.profilePhotoKey,
            options: { accessLevel: "guest" },
          });
          profilePhotoUrl = urlResult.url.toString();
          console.log("✅ [PROFILE] Profile photo URL loaded");
        } catch (error) {
          console.warn("⚠️ [PROFILE] Failed to load profile photo URL:", error);
        }
      }

      return {
        ...profile,
        profilePhotoUrl,
        currentUsername: username,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: (failureCount, error) => {
      console.log(`🔄 [PROFILE] Retry attempt ${failureCount}:`, error);
      return failureCount < 2; // Retry up to 2 times
    },
  });
}

/**
 * Hook to get any user's profile by ID
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.USER_PROFILE(userId),
    queryFn: async () => {
      console.log(`🔍 [PROFILE] Fetching profile for user: ${userId}`);

      // Fetch profile data
      const { data }: any = await client.graphql({
        query: getUser,
        variables: { id: userId },
        authMode: "userPool",
      });

      if (!data.getUser || data.getUser._deleted) {
        throw new Error(`Profile not found or deleted for user: ${userId}`);
      }

      const profile = data.getUser;
      console.log(
        `✅ [PROFILE] Profile loaded for ${userId}:`,
        profile.displayName
      );

      // Get profile photo URL if exists
      let profilePhotoUrl = null;
      if (profile.profilePhotoKey) {
        try {
          const urlResult = await getUrl({
            key: profile.profilePhotoKey,
            options: { accessLevel: "guest" },
          });
          profilePhotoUrl = urlResult.url.toString();
          console.log(`✅ [PROFILE] Profile photo URL loaded for ${userId}`);
        } catch (error) {
          console.warn(
            `⚠️ [PROFILE] Failed to load profile photo URL for ${userId}:`,
            error
          );
        }
      }

      return {
        ...profile,
        profilePhotoUrl,
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes (other users' profiles change less frequently)
    gcTime: 1000 * 60 * 60, // 1 hour
    enabled: !!userId, // Only run if userId is provided
    retry: (failureCount, error) => {
      console.log(
        `🔄 [PROFILE] Retry attempt ${failureCount} for ${userId}:`,
        error
      );
      return failureCount < 2;
    },
  });
}

/**
 * Hook to prefetch a user's profile (useful for hover states, etc.)
 */
export function usePrefetchUserProfile() {
  // This could be expanded later for prefetching logic
  return null;
}
