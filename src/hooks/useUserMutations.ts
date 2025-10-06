import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import {
  createFriendship,
  updateFriendship,
  deleteFriendship,
} from "@/src/graphql/mutations";
import { USER_QUERY_KEYS } from "./useUserQueries";
import { useSendNotification } from "./usePushNotifications";

const client = generateClient();

/**
 * Mutation hook for sending friend requests
 * Used in user/[userId].tsx
 */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation({
    mutationFn: async ({ friendId }: { friendId: string }) => {
      const { username: me } = await getCurrentUser();
      
      console.log(`📤 [SEND_FRIEND_REQUEST] Sending request: ${me} → ${friendId}`);

      const result = await client.graphql({
        query: createFriendship,
        variables: {
          input: { ownerId: me, friendId, status: "PENDING" },
        },
      });

      console.log(`✅ [SEND_FRIEND_REQUEST] Request sent successfully`);
      
      // Send push notification to the friend
      console.log(`🔔 [SEND_FRIEND_REQUEST] Sending friend request notification to: ${friendId}`);
      sendNotification.mutate({
        recipientUsername: friendId,
        notificationData: {
          type: 'friend_request',
          fromUsername: me,
        },
      });
      
      return {
        friendship: result.data.createFriendship,
        userId: me,
        friendId,
      };
    },

    // Optimistic update: Set status to PENDING_SENT
    onMutate: async ({ friendId }) => {
      const { username: me } = await getCurrentUser();
      console.log(`⚡ [SEND_FRIEND_REQUEST] Optimistic update for: ${friendId}`);

      const queryKey = USER_QUERY_KEYS.FRIENDSHIP_STATUS(me, friendId);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: "PENDING_SENT",
        };
      });

      return { previousData, friendId, userId: me };
    },

    // On error: Revert optimistic update
    onError: (err, variables, context) => {
      console.error(`❌ [SEND_FRIEND_REQUEST] Failed:`, err);

      if (context?.previousData && context?.userId && context?.friendId) {
        const queryKey = USER_QUERY_KEYS.FRIENDSHIP_STATUS(context.userId, context.friendId);
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    // On success: Update with real data including rowId and rowVersion
    onSuccess: (data, { friendId }) => {
      console.log(`📊 [SEND_FRIEND_REQUEST] Friendship object:`, data.friendship);
      
      const queryKey = USER_QUERY_KEYS.FRIENDSHIP_STATUS(data.userId, friendId);
      
      // Update the query data with the actual response including rowId and rowVersion
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: "PENDING_SENT",
          rowId: data.friendship?.id,
          rowVersion: data.friendship?._version,
        };
      });

      queryClient.invalidateQueries({
        queryKey: [...USER_QUERY_KEYS.FRIENDSHIP_STATUS(data.userId, ""), "allWithProfiles"],
        refetchType: "active"
      });
      
      console.log(`✅ [SEND_FRIEND_REQUEST] Updated friendship data with rowId: ${data.friendship?.id}, version: ${data.friendship?._version}`);
    },
  });
}
/**
 * Mutation hook for canceling outgoing friend requests
 * Used in user/[userId].tsx when user wants to cancel a PENDING_SENT request
 */
export function useCancelFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      rowId, 
      rowVersion,
      friendId 
    }: { 
      rowId: string; 
      rowVersion: number;
      friendId: string;
    }) => {
      const { username: me } = await getCurrentUser();
      console.log(`❌ [CANCEL_FRIEND_REQUEST] Canceling request: ${me} → ${friendId}`);

      const result = await client.graphql({
        query: deleteFriendship,
        variables: { input: { id: rowId, _version: rowVersion } },
      });

      console.log(`✅ [CANCEL_FRIEND_REQUEST] Request canceled successfully`);
      return {
        friendship: result.data.deleteFriendship,
        userId: me,
        friendId,
      };
    },

    // Optimistic update: Set status back to NONE
    onMutate: async ({ friendId }) => {
      const { username: me } = await getCurrentUser();
      console.log(`⚡ [CANCEL_FRIEND_REQUEST] Optimistic update for: ${friendId}`);

      const queryKey = USER_QUERY_KEYS.FRIENDSHIP_STATUS(me, friendId);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update to NONE state
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: "NONE",
          rowId: null,
          rowVersion: null,
        };
      });

      return { previousData, friendId, userId: me };
    },

    // On error: Revert optimistic update
    onError: (err, variables, context) => {
      console.error(`❌ [CANCEL_FRIEND_REQUEST] Failed:`, err);

      if (context?.previousData && context?.userId && context?.friendId) {
        const queryKey = USER_QUERY_KEYS.FRIENDSHIP_STATUS(context.userId, context.friendId);
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    // On success: Data is already optimistically updated
    onSuccess: (data, { friendId }) => {
      console.log(`🔄 [CANCEL_FRIEND_REQUEST] Friend request canceled for: ${friendId}`);

      queryClient.invalidateQueries({
        queryKey: [...USER_QUERY_KEYS.FRIENDSHIP_STATUS(data.userId, ""), "allWithProfiles"],
        refetchType: "active"
      });
    },
  });
}

/**
 * Mutation hook for accepting friend requests
 * Used in user/[userId].tsx
 */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation({
    mutationFn: async ({ 
      rowId, 
      rowVersion 
    }: { 
      rowId: string; 
      rowVersion: number; 
    }) => {
      const { username: me } = await getCurrentUser();
      console.log(`✅ [ACCEPT_FRIEND_REQUEST] Accepting request: ${rowId}`);

      const result = await client.graphql({
        query: updateFriendship,
        variables: {
          input: { id: rowId, status: "ACCEPTED", _version: rowVersion },
        },
      });

      console.log(`✅ [ACCEPT_FRIEND_REQUEST] Request accepted successfully`);
      
      // Send push notification to the original requester (ownerId from the friendship)
      const friendship = result.data.updateFriendship;
      if (friendship?.ownerId) {
        console.log(`🔔 [ACCEPT_FRIEND_REQUEST] Sending acceptance notification to: ${friendship.ownerId}`);
        sendNotification.mutate({
          recipientUsername: friendship.ownerId,
          notificationData: {
            type: 'friend_accepted',
            fromUsername: me,
          },
        });
      }
      
      return {
        friendship: result.data.updateFriendship,
        userId: me,
      };
    },

    // Optimistic update: Set status to ACCEPTED
    onMutate: async ({ rowId }) => {
      console.log(`⚡ [ACCEPT_FRIEND_REQUEST] Optimistic update for: ${rowId}`);

      // We need to find which friendship status query this affects
      // Since we don't have the friendId directly, we'll invalidate all friendship queries
      await queryClient.cancelQueries({ 
        queryKey: ["friendshipStatus"] 
      });

      // Store previous data for all friendship queries
      const previousQueries = queryClient.getQueriesData({ 
        queryKey: ["friendshipStatus"] 
      });

      // Optimistically update all relevant queries
      queryClient.setQueriesData(
        { queryKey: ["friendshipStatus"] },
        (old: any) => {
          if (!old || old.rowId !== rowId) return old;
          return {
            ...old,
            status: "ACCEPTED",
          };
        }
      );

      return { previousQueries };
    },

    // On error: Revert optimistic updates
    onError: (err, variables, context) => {
      console.error(`❌ [ACCEPT_FRIEND_REQUEST] Failed:`, err);

      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // On success: Data is already optimistically updated
    onSuccess: (data) => {
      console.log(`🔄 [ACCEPT_FRIEND_REQUEST] Friend request accepted`);

      queryClient.invalidateQueries({
        queryKey: [...USER_QUERY_KEYS.FRIENDSHIP_STATUS(data.userId, ""), "allWithProfiles"],
        refetchType: "active"
      });
    },
  });
}

/**
 * Mutation hook for declining friend requests
 * Used in user/[userId].tsx
 */
export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      rowId, 
      rowVersion 
    }: { 
      rowId: string; 
      rowVersion: number; 
    }) => {
      const { username: me } = await getCurrentUser();
      console.log(`❌ [DECLINE_FRIEND_REQUEST] Declining request: ${rowId}`);

      const result = await client.graphql({
        query: deleteFriendship,
        variables: { input: { id: rowId, _version: rowVersion } },
      });

      console.log(`✅ [DECLINE_FRIEND_REQUEST] Request declined successfully`);
      return {
        friendship: result.data.deleteFriendship,
        userId: me,
      };
    },

    // Optimistic update: Set status back to NONE
    onMutate: async ({ rowId }) => {
      console.log(`⚡ [DECLINE_FRIEND_REQUEST] Optimistic update for: ${rowId}`);

      // Cancel queries and store previous data
      await queryClient.cancelQueries({ 
        queryKey: ["friendshipStatus"] 
      });

      const previousQueries = queryClient.getQueriesData({ 
        queryKey: ["friendshipStatus"] 
      });

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: ["friendshipStatus"] },
        (old: any) => {
          if (!old || old.rowId !== rowId) return old;
          return {
            ...old,
            status: "NONE",
            rowId: null,
            rowVersion: null,
          };
        }
      );

      return { previousQueries };
    },

    // On error: Revert optimistic updates
    onError: (err, variables, context) => {
      console.error(`❌ [DECLINE_FRIEND_REQUEST] Failed:`, err);

      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // On success: Data is already optimistically updated
    onSuccess: (data) => {
      console.log(`🔄 [DECLINE_FRIEND_REQUEST] Friend request declined`);

      queryClient.invalidateQueries({
        queryKey: [...USER_QUERY_KEYS.FRIENDSHIP_STATUS(data.userId, ""), "allWithProfiles"],
        refetchType: "active"
      });
    },
  });
}

/**
 * Cache invalidation helpers for manual refresh
 */
export function useInvalidateUserQueries() {
  const queryClient = useQueryClient();

  return {
    // Invalidate all user-related queries
    invalidateAll: () => {
      console.log(`🔄 [USER_INVALIDATE] Refreshing all user data`);
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["friendshipStatus"] });
    },

    // Invalidate specific user profile
    invalidateUserProfile: (userId: string) => {
      queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.USER_PROFILE(userId),
      });
    },

    // Invalidate friendship status - requires both userIds
    invalidateFriendshipStatus: (currentUserId: string, otherUserId: string) => {
      queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.FRIENDSHIP_STATUS(currentUserId, otherUserId),
      });
    },
  };
}