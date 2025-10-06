import { useMutation } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { updateUser } from "@/src/graphql/mutations";
import { getUser } from "@/src/graphql/queries";
import { pushNotificationService } from "@/src/utils/pushNotifications/pushNotificationService";
import { NotificationData } from "@/src/utils/pushNotifications/pushNotificationTypes";

const client = generateClient();

/**
 * Mutation hook for updating user's Expo push token
 * Simple backend-only update - no UI elements depend on this field
 */
export function useUpdatePushToken() {
  return useMutation({
    mutationFn: async ({ expoPushToken }: { expoPushToken: string | null }) => {
      console.log("🔔 [PUSH_TOKEN] Starting push token update");

      const user = await getCurrentUser();
      const username = user.username;

      // Fetch current user to get latest _version
      const getUserResult = await client.graphql({
        query: getUser,
        variables: { id: username },
        authMode: "userPool",
      });

      const currentUser = getUserResult.data.getUser;
      if (!currentUser) {
        throw new Error("User not found");
      }

      // Update user profile with push token
      const updateResult = await client.graphql({
        query: updateUser,
        variables: {
          input: {
            id: username,
            expoPushToken,
            _version: currentUser._version,
          },
        },
        authMode: "userPool",
      });

      console.log("✅ [PUSH_TOKEN] Push token updated in database");

      return updateResult.data.updateUser;
    },

    onError: (error) => {
      console.error("❌ [PUSH_TOKEN] Push token update failed:", error);
    },
  });
}

/**
 * Hook for registering for push notifications with smart token checking
 * Only updates database when token actually changes
 */
export function useRegisterForPushNotifications() {
  const updatePushToken = useUpdatePushToken();

  return useMutation({
    mutationFn: async ({ profile }: { profile: any }) => {
      console.log("🔔 [REGISTER_PUSH] Starting push notification registration");

      if (!profile) {
        throw new Error("Profile not available for token comparison");
      }

      const currentTokenInDB = profile.expoPushToken;

      // Get device token
      const result = await pushNotificationService.registerForPushNotifications();

      if (!result.token) {
        throw new Error(result.error || "Failed to get push token");
      }

      console.log("✅ [REGISTER_PUSH] Got device token:", result.token.substring(0, 20) + "...");

      // Only update database if token is different
      if (currentTokenInDB === result.token) {
        console.log("🔔 [REGISTER_PUSH] Token unchanged, skipping database update");
        return result.token;
      }

      console.log("🔔 [REGISTER_PUSH] Token changed, updating database");
      console.log(`   Old: ${currentTokenInDB?.substring(0, 20) || 'null'}...`);
      console.log(`   New: ${result.token.substring(0, 20)}...`);
      
      await updatePushToken.mutateAsync({ expoPushToken: result.token });

      return result.token;
    },

    onSuccess: () => {
      console.log("✅ [REGISTER_PUSH] Push notification registration completed");
    },

    onError: (error) => {
      console.error("❌ [REGISTER_PUSH] Push notification registration failed:", error);
    },
  });
}

/**
 * General hook for sending notifications to users
 * Fetches recipient's push token and sends the notification
 */
export function useSendNotification() {
  return useMutation({
    mutationFn: async ({ 
      recipientUsername, 
      notificationData 
    }: { 
      recipientUsername: string;
      notificationData: NotificationData;
    }) => {
      console.log("🔔 [SEND_NOTIFICATION] Starting notification send to:", recipientUsername);

      // Fetch recipient's push token
      const getUserResult = await client.graphql({
        query: getUser,
        variables: { id: recipientUsername },
        authMode: "userPool",
      });

      const recipientUser = getUserResult.data.getUser;
      if (!recipientUser) {
        throw new Error(`Recipient user not found: ${recipientUsername}`);
      }

      if (!recipientUser.expoPushToken) {
        throw new Error(`Recipient has no push token: ${recipientUsername}`);
      }

      console.log("✅ [SEND_NOTIFICATION] Found recipient token, sending notification");

      // Send the notification
      const result = await pushNotificationService.sendNotification(
        recipientUser.expoPushToken,
        notificationData
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send notification');
      }

      console.log("✅ [SEND_NOTIFICATION] Notification sent successfully to:", recipientUsername);
      return result;
    },

    onError: (error, variables) => {
      console.error("❌ [SEND_NOTIFICATION] Failed to send notification to:", variables.recipientUsername, error);
    },
  });
}
