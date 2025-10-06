import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { uploadData, getUrl } from "aws-amplify/storage";
import { updateUser } from "@/src/graphql/mutations";
import { PROFILE_QUERY_KEYS } from "./useProfileQueries";

const client = generateClient();

/**
 * Mutation hook for updating profile photo with optimistic updates
 */
export function useUpdateProfilePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageUri }: { imageUri: string }) => {
      console.log("📸 [PROFILE_PHOTO] Starting profile photo update");

      // Get current user and profile
      const user = await getCurrentUser();
      const username = user.username;

      // Get current profile to get _version
      const currentProfile = queryClient.getQueryData(
        PROFILE_QUERY_KEYS.MY_PROFILE()
      );
      if (!currentProfile) {
        throw new Error("Profile not loaded - cannot update photo");
      }

      // Process image extension
      const fileExt = imageUri.split(".").pop() || "jpg";

      // Create unique S3 key under public/
      const s3Key = `public/profilePhotos/${username}_${Date.now()}.${fileExt}`;

      console.log(`📸 [PROFILE_PHOTO] Uploading to S3: ${s3Key}`);

      // Upload image to S3
      const response = await fetch(imageUri);
      const blob = await response.blob();

      await uploadData({
        key: s3Key,
        data: blob,
        options: {
          accessLevel: "guest",
          contentType: blob.type,
        },
      }).result;

      console.log("✅ [PROFILE_PHOTO] Image uploaded to S3");

      // Update user profile with new profilePhotoKey
      const updateResult = await client.graphql({
        query: updateUser,
        variables: {
          input: {
            id: username,
            profilePhotoKey: s3Key,
            _version: (currentProfile as any)._version,
          },
        },
        authMode: "userPool",
      });

      console.log("✅ [PROFILE_PHOTO] User profile updated");

      // Get the public URL of uploaded image
      const newPhotoUrl = await getUrl({
        key: s3Key,
        options: { accessLevel: "guest" },
      });

      console.log("✅ [PROFILE_PHOTO] Got new photo URL");

      return {
        updatedUser: updateResult.data.updateUser,
        s3Key,
        newPhotoUrl: newPhotoUrl.url.toString(),
      };
    },

    // Optimistic update: immediately show the new photo
    onMutate: async ({ imageUri }) => {
      console.log("⚡ [PROFILE_PHOTO] Applying optimistic update");

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: PROFILE_QUERY_KEYS.MY_PROFILE(),
      });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData(
        PROFILE_QUERY_KEYS.MY_PROFILE()
      );

      // Optimistically update the profile photo
      queryClient.setQueryData(PROFILE_QUERY_KEYS.MY_PROFILE(), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          profilePhotoUrl: imageUri, // Use local URI for immediate display
          isOptimistic: true, // Flag to identify optimistic updates
        };
      });

      return { previousProfile };
    },

    // On success: replace optimistic update with real data
    onSuccess: (data, variables) => {
      console.log(
        "✅ [PROFILE_PHOTO] Update successful, updating cache with real data"
      );

      // Update cache with real photo URL and version
      queryClient.setQueryData(PROFILE_QUERY_KEYS.MY_PROFILE(), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          profilePhotoKey: data.s3Key,
          profilePhotoUrl: data.newPhotoUrl, // Real S3 URL
          _version: data.updatedUser._version,
          isOptimistic: false, // No longer optimistic
        };
      });

      console.log("✅ [PROFILE_PHOTO] Cache updated with real data");
    },

    // On error: revert optimistic update
    onError: (err, variables, context) => {
      console.error("❌ [PROFILE_PHOTO] Update failed:", err);

      // Restore previous data
      if (context?.previousProfile) {
        queryClient.setQueryData(
          PROFILE_QUERY_KEYS.MY_PROFILE(),
          context.previousProfile
        );
      }
    },

    // Always run: cleanup
    onSettled: () => {
      console.log("🏁 [PROFILE_PHOTO] Profile photo update completed");
    },
  });
}

/**
 * Mutation hook for updating profile information (name, etc.)
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      displayName,
      ...otherFields
    }: {
      displayName?: string;
      [key: string]: any;
    }) => {
      console.log("👤 [PROFILE] Starting profile update");

      const user = await getCurrentUser();
      const username = user.username;

      // Get current profile to get _version
      const currentProfile = queryClient.getQueryData(
        PROFILE_QUERY_KEYS.MY_PROFILE()
      );
      if (!currentProfile) {
        throw new Error("Profile not loaded - cannot update");
      }

      // Update user profile
      const updateResult = await client.graphql({
        query: updateUser,
        variables: {
          input: {
            id: username,
            displayName,
            ...otherFields,
            _version: (currentProfile as any)._version,
          },
        },
        authMode: "userPool",
      });

      console.log("✅ [PROFILE] Profile updated");

      return updateResult.data.updateUser;
    },

    // Optimistic update
    onMutate: async (variables) => {
      console.log("⚡ [PROFILE] Applying optimistic profile update");

      await queryClient.cancelQueries({
        queryKey: PROFILE_QUERY_KEYS.MY_PROFILE(),
      });

      const previousProfile = queryClient.getQueryData(
        PROFILE_QUERY_KEYS.MY_PROFILE()
      );

      queryClient.setQueryData(PROFILE_QUERY_KEYS.MY_PROFILE(), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          ...variables,
          isOptimistic: true,
        };
      });

      return { previousProfile };
    },

    // On success: update with real data
    onSuccess: (data) => {
      console.log("✅ [PROFILE] Profile update successful");

      queryClient.setQueryData(PROFILE_QUERY_KEYS.MY_PROFILE(), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          ...data,
          isOptimistic: false,
        };
      });
    },

    // On error: revert
    onError: (err, variables, context) => {
      console.error("❌ [PROFILE] Profile update failed:", err);

      if (context?.previousProfile) {
        queryClient.setQueryData(
          PROFILE_QUERY_KEYS.MY_PROFILE(),
          context.previousProfile
        );
      }
    },
  });
}

/**
 * Cache invalidation helpers
 */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();

  return {
    invalidateMyProfile: () => {
      queryClient.invalidateQueries({
        queryKey: PROFILE_QUERY_KEYS.MY_PROFILE(),
      });
    },

    invalidateUserProfile: (userId: string) => {
      queryClient.invalidateQueries({
        queryKey: PROFILE_QUERY_KEYS.USER_PROFILE(userId),
      });
    },

    invalidateAllProfiles: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
    },
  };
}
