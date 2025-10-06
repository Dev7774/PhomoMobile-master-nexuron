import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import {
  updateSharedCameraMember,
  deleteSharedCameraMember,
  createSharedCameraMember,
  createSharedCamera,
  generateCameraInvite,
} from "@/src/graphql/mutations";
import {
  listSharedCameraMembers,
  getSharedCamera,
} from "@/src/graphql/queries";
import { CAMERA_QUERY_KEYS } from "./useCameraQueries";
import { QUERY_KEYS } from "./usePhotoQueries";
import { useSendNotification } from "./usePushNotifications";
import { v4 as uuid } from "uuid";
import { Share, Alert } from "react-native";
import { GraphQLQuery } from "@aws-amplify/api";
import {
  GenerateCameraInviteMutation,
  GenerateCameraInviteMutationVariables,
} from "../API";

const client = generateClient();

/**
 * Mutation hook for accepting camera invitations
 * Used in cameraModal.tsx with optimistic updates
 */
export function useAcceptCameraInvite() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation({
    mutationFn: async ({
      membershipId,
      version,
    }: {
      membershipId: string;
      version: number;
    }) => {
      const { username } = await getCurrentUser();
      console.log(`✅ [ACCEPT_INVITE] Accepting invite: ${membershipId}`);

      const result = await client.graphql({
        query: updateSharedCameraMember,
        variables: {
          input: { id: membershipId, _version: version, role: "MEMBER" },
        },
      });

      console.log(`✅ [ACCEPT_INVITE] Invite accepted successfully`);

      // Send notifications to all camera members about the new joiner
      const membership = result.data.updateSharedCameraMember;
      if (membership?.cameraId) {
        try {
          console.log(
            `🔔 [ACCEPT_INVITE] Fetching camera info and members to send notifications`
          );

          // Get camera name
          const cameraResult = await client.graphql({
            query: getSharedCamera,
            variables: { id: membership.cameraId },
            authMode: "userPool",
          });

          const cameraName = cameraResult.data.getSharedCamera?.name;

          // Get all camera members
          const membersResult = await client.graphql({
            query: listSharedCameraMembers,
            variables: {
              filter: {
                cameraId: { eq: membership.cameraId },
                role: { ne: "INVITED" }, // Only notify actual members, not pending invites
              },
            },
            authMode: "userPool",
          });

          const members =
            membersResult.data.listSharedCameraMembers?.items || [];
          const otherMembers = members.filter(
            (member) => member?.userId && member.userId !== username
          );

          console.log(
            `🔔 [ACCEPT_INVITE] Sending notifications to ${otherMembers.length} camera members`
          );

          otherMembers.forEach((member) => {
            if (member?.userId) {
              sendNotification.mutate({
                recipientUsername: member.userId,
                notificationData: {
                  type: "camera_joined",
                  fromUsername: username,
                  cameraId: membership.cameraId,
                  cameraName,
                },
              });
            }
          });
        } catch (notifError) {
          console.warn(
            `⚠️ [ACCEPT_INVITE] Failed to send notifications (non-critical):`,
            notifError
          );
        }
      }

      return {
        member: result.data.updateSharedCameraMember,
        userId: username,
      };
    },

    // Optimistic update: Move invite from invites to myCams
    onMutate: async ({ membershipId }) => {
      const { username } = await getCurrentUser();
      console.log(`⚡ [ACCEPT_INVITE] Optimistic update for: ${membershipId}`);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(username),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(
        CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(username)
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(username),
        (old: any) => {
          if (!old) return old;

          // Find the invite being accepted
          const inviteToAccept = old.invites.find(
            (invite: any) => invite.id === membershipId
          );
          if (!inviteToAccept) return old;

          // Move from invites to myCams with updated role
          const updatedInvite = { ...inviteToAccept, role: "MEMBER" };

          return {
            ...old,
            invites: old.invites.filter(
              (invite: any) => invite.id !== membershipId
            ),
            myCams: [...old.myCams, updatedInvite],
          };
        }
      );

      return { previousData, membershipId, userId: username };
    },

    // On success: Invalidate related queries to sync other screens
    onSuccess: (data) => {
      console.log(`🔄 [ACCEPT_INVITE] Invalidating related caches`);

      // Invalidate album.tsx query - new camera should appear
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.USER_CAMERAS(data.userId),
      });

      // Invalidate camera.tsx query - new camera should appear in picker
      queryClient.invalidateQueries({
        queryKey: CAMERA_QUERY_KEYS.USER_CAMERA_MEMBERSHIPS(data.userId),
      });
    },

    // On error: Revert optimistic update
    onError: (err, variables, context) => {
      console.error(`❌ [ACCEPT_INVITE] Failed:`, err);

      if (context?.previousData && context?.userId) {
        console.log(`🔄 [ACCEPT_INVITE] Reverting optimistic update`);
        queryClient.setQueryData(
          CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(context.userId),
          context.previousData
        );
      }
    },
  });
}

/**
 * Mutation hook for declining camera invitations
 * Used in cameraModal.tsx with optimistic updates
 */
export function useDeclineCameraInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      membershipId,
      version,
    }: {
      membershipId: string;
      version: number;
    }) => {
      const { username } = await getCurrentUser();
      console.log(`❌ [DECLINE_INVITE] Declining invite: ${membershipId}`);

      // Try direct deletion first (matching existing logic)
      try {
        console.log(`🗑️ [DECLINE_INVITE] Attempting direct deletion...`);
        const deleteResult = await client.graphql({
          query: deleteSharedCameraMember,
          variables: { input: { id: membershipId, _version: version } },
        });

        console.log(`✅ [DECLINE_INVITE] Direct deletion successful`);
        return {
          method: "deleted",
          result: deleteResult.data.deleteSharedCameraMember,
          userId: username,
        };
      } catch (deleteErr) {
        console.error(
          `❌ [DECLINE_INVITE] Direct deletion failed, trying update to DECLINED:`,
          deleteErr
        );

        // Fallback to updating role to DECLINED
        const updateResult = await client.graphql({
          query: updateSharedCameraMember,
          variables: {
            input: {
              id: membershipId,
              _version: version,
              role: "DECLINED",
            },
          },
        });

        console.log(
          `✅ [DECLINE_INVITE] Fallback update to DECLINED successful`
        );
        return {
          method: "declined",
          result: updateResult.data.updateSharedCameraMember,
          userId: username,
        };
      }
    },

    // Optimistic update: Remove invite from list
    onMutate: async ({ membershipId }) => {
      const { username } = await getCurrentUser();
      console.log(`⚡ [DECLINE_INVITE] Optimistic update for: ${membershipId}`);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(username),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(
        CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(username)
      );

      // Optimistically remove the invite
      queryClient.setQueryData(
        CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(username),
        (old: any) => {
          if (!old) return old;

          return {
            ...old,
            invites: old.invites.filter(
              (invite: any) => invite.id !== membershipId
            ),
            // myCams stays the same
          };
        }
      );

      return { previousData, membershipId, userId: username };
    },

    // On success: No additional invalidation needed (invite just disappears)
    onSuccess: (data) => {
      console.log(
        `🔄 [DECLINE_INVITE] Invite declined successfully (method: ${data.method})`
      );
    },

    // On error: Revert optimistic update
    onError: (err, variables, context) => {
      console.error(`❌ [DECLINE_INVITE] Failed:`, err);

      if (context?.previousData && context?.userId) {
        console.log(`🔄 [DECLINE_INVITE] Reverting optimistic update`);
        queryClient.setQueryData(
          CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(context.userId),
          context.previousData
        );
      }
    },
  });
}

/**
 * Mutation hook for generating shareable camera invite links
 * Creates a JWT token that can be shared via text/social media
 */
export function useGenerateCameraInviteLink() {
  return useMutation({
    mutationFn: async ({
      cameraId,
      cameraName,
      inviterUserId,
      inviterName,
    }: {
      cameraId: string;
      cameraName: string;
      inviterUserId: string;
      inviterName: string;
    }) => {
      console.log(
        `🔗 [GENERATE_INVITE] Creating invite link for camera: ${cameraId}`
      );

      const result = await client.graphql<
        GraphQLQuery<GenerateCameraInviteMutation>
      >({
        query: generateCameraInvite,
        variables: {
          cameraId,
          cameraName,
          inviterUserId,
          inviterName,
        } as GenerateCameraInviteMutationVariables,
      });

      console.log(`✅ [GENERATE_INVITE] Invite link generated successfully`);
      return result.data.generateCameraInvite;
    },

    onSuccess: async (inviteUrl) => {
      if (inviteUrl) {
        // Automatically open share sheet with the invite URL
        try {
          await Share.share({
            message: `Join my event on PhomoCam!`,
            url: inviteUrl, // iOS specific - will show preview
          });
        } catch (error) {
          console.error("Error sharing invite:", error);
          // Even if share fails, we have the URL
          Alert.alert("Invite Link Generated", "Link copied to share!");
        }
      }
    },

    onError: (error) => {
      console.error(`❌ [GENERATE_INVITE] Failed to generate invite:`, error);
      Alert.alert("Error", "Failed to generate invite link. Please try again.");
    },
  });
}

/**
 * Mutation hook for sending camera invites
 * Used in camera/[camId]/invite.tsx
 */
export function useSendCameraInvites() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation({
    mutationFn: async ({
      cameraId,
      userIds,
    }: {
      cameraId: string;
      userIds: string[];
    }) => {
      const { username: me } = await getCurrentUser();
      console.log(
        `📤 [SEND_INVITES] Sending ${userIds.length} invites for camera: ${cameraId}`
      );

      await Promise.all(
        userIds.map((userId) =>
          client.graphql({
            query: createSharedCameraMember,
            variables: {
              input: {
                cameraId,
                userId,
                role: "INVITED",
                addedAt: new Date().toISOString(),
              },
            },
            authMode: "userPool",
          })
        )
      );

      console.log(
        `✅ [SEND_INVITES] Successfully sent ${userIds.length} invites`
      );

      // Get camera name for notifications
      try {
        console.log(`🔔 [SEND_INVITES] Fetching camera name for notifications`);

        const cameraResult = await client.graphql({
          query: getSharedCamera,
          variables: { id: cameraId },
          authMode: "userPool",
        });

        const cameraName = cameraResult.data.getSharedCamera?.name;

        // Send push notifications to each invited user
        console.log(
          `🔔 [SEND_INVITES] Sending camera invitation notifications to ${userIds.length} users`
        );
        userIds.forEach((recipientUsername) => {
          sendNotification.mutate({
            recipientUsername,
            notificationData: {
              type: "camera_invitation",
              fromUsername: me,
              cameraId,
              cameraName,
            },
          });
        });
      } catch (notifError) {
        console.warn(
          `⚠️ [SEND_INVITES] Failed to send notifications (non-critical):`,
          notifError
        );
      }

      return { invitesSent: userIds.length };
    },

    // On success: Invalidate related queries
    onSuccess: (_, { cameraId }) => {
      console.log(`🔄 [SEND_INVITES] Invalidating camera member caches`);

      // Invalidate camera members cache (for invite screen refresh)
      queryClient.invalidateQueries({
        queryKey: CAMERA_QUERY_KEYS.CAMERA_MEMBERS(cameraId),
      });

      // Invalidate camera invites for potential recipients
      // Note: We don't have access to recipient userIds here, so this is a limitation
      // Recipients will get updates via subscriptions instead
      queryClient.invalidateQueries({
        queryKey: ["cameraInvitesAndMemberships"], // Invalidate all to catch any recipients
      });
    },

    onError: (error) => {
      console.error(`❌ [SEND_INVITES] Failed to send invites:`, error);
    },
  });
}

/**
 * Mutation hook for creating a new shared camera
 * Used in camera/new.tsx
 */
export function useCreateCamera() {
  const queryClient = useQueryClient();
  const sendNotification = useSendNotification();

  return useMutation({
    mutationFn: async ({
      name,
      inviteUserIds = [],
    }: {
      name: string;
      inviteUserIds?: string[];
    }) => {
      const { username: me } = await getCurrentUser();
      const cameraId = uuid();

      console.log(
        `📸 [CREATE_CAMERA] Creating camera: ${name} with ${inviteUserIds.length} invites`
      );

      // 1. Create the camera
      const camRes: any = await client.graphql({
        query: createSharedCamera,
        variables: {
          input: { id: cameraId, name, ownerId: me, memberIds: [me] },
        },
        authMode: "userPool",
      });

      // 2. Create admin membership for creator
      await client.graphql({
        query: createSharedCameraMember,
        variables: {
          input: {
            cameraId,
            userId: me,
            role: "ADMIN",
            addedAt: new Date().toISOString(),
          },
        },
        authMode: "userPool",
      });

      // 3. Create invited memberships
      if (inviteUserIds.length > 0) {
        await Promise.all(
          inviteUserIds.map((userId) =>
            client.graphql({
              query: createSharedCameraMember,
              variables: {
                input: {
                  cameraId,
                  userId,
                  role: "INVITED",
                  addedAt: new Date().toISOString(),
                },
              },
              authMode: "userPool",
            })
          )
        );
      }

      console.log(
        `✅ [CREATE_CAMERA] Camera created successfully: ${cameraId}`
      );

      // Send push notifications to invited users
      if (inviteUserIds.length > 0) {
        console.log(
          `🔔 [CREATE_CAMERA] Sending camera invitation notifications to ${inviteUserIds.length} users`
        );
        inviteUserIds.forEach((recipientUsername) => {
          sendNotification.mutate({
            recipientUsername,
            notificationData: {
              type: "camera_invitation",
              fromUsername: me,
              cameraId,
              cameraName: name,
            },
          });
        });
      }

      return {
        camera: camRes.data.createSharedCamera,
        invitesSent: inviteUserIds.length,
        userId: me,
      };
    },

    // On success: Invalidate relevant caches
    onSuccess: (data) => {
      console.log(`🔄 [CREATE_CAMERA] Invalidating camera caches`);

      // Invalidate user's camera lists
      queryClient.invalidateQueries({
        queryKey: CAMERA_QUERY_KEYS.USER_CAMERA_MEMBERSHIPS(data.userId),
      });

      queryClient.invalidateQueries({
        queryKey: CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(data.userId),
      });

      // Invalidate album query to show new camera
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.USER_CAMERAS(data.userId),
      });
    },

    onError: (error) => {
      console.error(`❌ [CREATE_CAMERA] Failed to create camera:`, error);
    },
  });
}
