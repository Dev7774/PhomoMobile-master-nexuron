import { useQuery } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import {
  getUser,
  friendshipsByOwnerIdAndFriendId,
  friendshipsByFriendIdAndOwnerId,
} from "@/src/graphql/queries";

const client = generateClient();

export const USER_QUERY_KEYS = {
  USER_PROFILE: (userId: string) => ["userProfile", userId],
  FRIENDSHIP_STATUS: (currentUserId: string, otherUserId: string) => [
    "friendshipStatus", 
    currentUserId, 
    otherUserId
  ],
} as const;

type FriendshipStatus = "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "ACCEPTED";

interface UserProfile {
  id: string;
  displayName?: string | null;
  profilePhotoKey?: string | null;
  profilePhotoUrl?: string | null;
  _deleted?: boolean;
}

interface FriendshipData {
  status: FriendshipStatus;
  rowId?: string | null;
  rowVersion?: number | null;
  isSelf: boolean;
}

/**
 * Hook to fetch user profile with profile photo
 * Used in user/[userId].tsx
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.USER_PROFILE(userId),
    queryFn: async (): Promise<UserProfile | null> => {
      console.log(`🔍 [USER_PROFILE] Fetching profile for: ${userId}`);

      const { data: uData }: any = await client.graphql({
        query: getUser,
        variables: { id: userId },
      });

      const user = uData.getUser;
      if (!user || user._deleted) {
        console.log(`❌ [USER_PROFILE] User not found or deleted: ${userId}`);
        return null;
      }

      let profilePhotoUrl: string | null = null;

      // Load profile photo if exists
      if (user.profilePhotoKey) {
        try {
          const result = await getUrl({ 
            key: user.profilePhotoKey,
            options: { accessLevel: "guest" }
          });
          profilePhotoUrl = result.url.toString();
        } catch (photoError) {
          console.warn(`⚠️ Failed to load profile photo for ${user.displayName}:`, photoError);
        }
      }

      const profile: UserProfile = {
        id: user.id,
        displayName: user.displayName,
        profilePhotoKey: user.profilePhotoKey,
        profilePhotoUrl,
        _deleted: user._deleted,
      };

      console.log(`✅ [USER_PROFILE] Profile loaded: ${profile.displayName}`);
      return profile;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to fetch friendship status between current user and another user
 * Used in user/[userId].tsx for friend request functionality
 */
export function useFriendshipStatus(currentUserId: string | null | undefined, otherUserId: string) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.FRIENDSHIP_STATUS(currentUserId || "", otherUserId),
    enabled: !!currentUserId && !!otherUserId,
    queryFn: async (): Promise<FriendshipData> => {
      if (!currentUserId) throw new Error("Current user ID is required");
      
      console.log(`🔍 [FRIENDSHIP_STATUS] Checking friendship: ${currentUserId} <-> ${otherUserId}`);

      // Check if viewing own profile
      if (currentUserId === otherUserId) {
        return {
          status: "NONE",
          isSelf: true,
        };
      }

      // Fetch outgoing friendship: currentUserId → otherUserId
      const outRes: any = await client.graphql({
        query: friendshipsByOwnerIdAndFriendId,
        variables: {
          ownerId: currentUserId,
          filter: { _deleted: { ne: true } },
          limit: 100,
        },
      });
      const outgoing = outRes.data.friendshipsByOwnerIdAndFriendId.items.find(
        (f: any) => f.friendId === otherUserId
      );

      // Fetch incoming friendship: otherUserId → currentUserId
      const inRes: any = await client.graphql({
        query: friendshipsByFriendIdAndOwnerId,
        variables: {
          friendId: currentUserId,
          filter: { _deleted: { ne: true } },
          limit: 100,
        },
      });
      const incoming = inRes.data.friendshipsByFriendIdAndOwnerId.items.find(
        (f: any) => f.ownerId === otherUserId
      );

      // Determine status
      let status: FriendshipStatus = "NONE";
      let rowId: string | null = null;
      let rowVersion: number | null = null;

      if (outgoing?.status === "ACCEPTED" || incoming?.status === "ACCEPTED") {
        status = "ACCEPTED";
      } else if (outgoing?.status === "PENDING") {
        status = "PENDING_SENT";
        // Store rowId and rowVersion for outgoing requests so we can cancel them
        rowId = outgoing.id;
        rowVersion = outgoing._version;
      } else if (incoming?.status === "PENDING") {
        status = "PENDING_RECEIVED";
        rowId = incoming.id;
        rowVersion = incoming._version;
      }

      console.log(`✅ [FRIENDSHIP_STATUS] Status: ${status}`);

      return {
        status,
        rowId,
        rowVersion,
        isSelf: false,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - friendship status should be fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch all friendships with profile data for friends modal
 * Used in friendsModal.tsx - combines friendship status with profile data
 */
export function useAllFriendshipsWithProfiles(currentUserId: string | null | undefined) {
  return useQuery({
    queryKey: [...USER_QUERY_KEYS.FRIENDSHIP_STATUS(currentUserId || "", ""), "allWithProfiles"],
    enabled: !!currentUserId,
    queryFn: async () => {
      if (!currentUserId) throw new Error("Current user ID is required");
      
      console.log(`🔍 [ALL_FRIENDSHIPS_WITH_PROFILES] Fetching friendships for: ${currentUserId}`);

      // Fetch incoming friendships (where current user is friendId)
      const inRes: any = await client.graphql({
        query: friendshipsByFriendIdAndOwnerId,
        variables: {
          friendId: currentUserId,
          filter: { _deleted: { ne: true } },
          limit: 100,
        },
      });
      const incoming = inRes.data.friendshipsByFriendIdAndOwnerId.items;

      // Fetch outgoing friendships (where current user is ownerId)
      const outRes: any = await client.graphql({
        query: friendshipsByOwnerIdAndFriendId,
        variables: {
          ownerId: currentUserId,
          filter: { _deleted: { ne: true } },
          limit: 100,
        },
      });
      const outgoing = outRes.data.friendshipsByOwnerIdAndFriendId.items;

      // Merge and deduplicate friendships
      const all = [...incoming, ...outgoing];
      const unique = new Map<string, any>();
      for (const f of all) unique.set(f.id, f);
      const friendships = Array.from(unique.values());

      console.log(`✅ [ALL_FRIENDSHIPS_WITH_PROFILES] Found ${friendships.length} friendships`);

      // Fetch profile data for all friends
      const friendshipsWithProfiles = await Promise.all(
        friendships.map(async (friendship) => {
          const isIncoming = friendship.friendId === currentUserId;
          const isOutgoing = friendship.ownerId === currentUserId;
          const otherUserId = isOutgoing ? friendship.friendId : friendship.ownerId;

          let friendProfile = null;
          try {
            // Fetch friend's profile
            const { data: profileData }: any = await client.graphql({
              query: getUser,
              variables: { id: otherUserId },
            });
            
            const profile = profileData.getUser;
            
            // If user is deleted or doesn't exist, exclude from results
            if (!profile || profile._deleted) {
              console.log(`❌ [FRIENDSHIP] User ${otherUserId} deleted or not found, excluding from friends list`);
              return null; // Exclude deleted users
            }
            
            let photoUrl: string | null = null;
            
            // Load profile photo URL if exists
            if (profile.profilePhotoKey) {
              try {
                const result = await getUrl({ 
                  key: profile.profilePhotoKey,
                  options: { accessLevel: "guest" }
                });
                photoUrl = result.url.toString();
              } catch (e) {
                console.warn(`⚠️ Failed to load profile photo URL for ${otherUserId}:`, e);
              }
            }
            
            friendProfile = {
              id: otherUserId,
              displayName: profile.displayName || "Unnamed",
              photoUrl
            };
          } catch (err) {
            console.warn(`⚠️ Failed to fetch friend profile for ${otherUserId}:`, err);
            // Keep fallback for network/other errors (don't exclude)
            friendProfile = {
              id: otherUserId,
              displayName: otherUserId,
              photoUrl: null
            };
          }

          return {
            friendship,
            friendProfile,
            isIncoming,
            isOutgoing,
            otherUserId,
          };
        })
      );

      // Filter out null results (deleted users)
      const validFriendshipsWithProfiles = friendshipsWithProfiles.filter(item => item !== null);
      
      console.log(`✅ [ALL_FRIENDSHIPS_WITH_PROFILES] Enriched ${validFriendshipsWithProfiles.length} friendships with profiles (${friendshipsWithProfiles.length - validFriendshipsWithProfiles.length} deleted users excluded)`);
      return validFriendshipsWithProfiles;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - friendship data should be fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}