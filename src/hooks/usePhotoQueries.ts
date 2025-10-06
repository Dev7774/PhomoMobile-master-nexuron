import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { photoCacheDB } from "@/src/utils/services/PhotoCacheDB";
import {
  getSharedCamera,
  photosBySharedCameraIdAndCreatedAt,
  getUser,
  searchUsers,
  getPhoto,
  sharedCameraMembersByUserIdAndCameraId,
  photosByOwnerIdAndCreatedAt,
  photoRecipientsByRecipientIdAndPhotoId,
  photoRecipientsByPhotoIdAndRecipientId,
} from "@/src/graphql/queries";
import {
  batchGetUsers,
  getAllUserPhotos,
  batchGetCameras,
  getAllUserFriendships,
  getSharedPhotosOptimized,
} from "@/src/graphql/optimizedQueries";

const client = generateClient();

// Request deduplication for concurrent photo URL requests
const pendingRequests = new Map<string, Promise<string>>();

// Query keys for consistent cache management
export const QUERY_KEYS = {
  USER_CAMERAS: (userId: string) => ["userCameras", userId],
  CAMERA_PHOTOS: (cameraId: string) => ["cameraPhotos", cameraId],
  INFINITE_SINGLE_SHARED_CAMERA_PHOTOS: (cameraId: string) => ["infiniteSingleSharedCameraPhotos", cameraId],
  USER_FRIENDS: (userId: string) => ["userFriends", userId],
  SHARED_PHOTOS: (userId: string, friendId: string) => [
    "sharedPhotos",
    userId,
    friendId,
  ],
  SHARED_PHOTOS_GROUP: (userId: string, friendGroupKey: string) => [
    "sharedPhotosGroup",
    userId,
    friendGroupKey,
  ],
  USER_PROFILE: (userId: string) => ["userProfile", userId],
  SEARCH_USERS: (query: string) => ["searchUsers", query],
  PHOTO: (photoId: string) => ["photo", photoId],
  MY_PHOTOS: (userId: string) => ["myPhotos", userId],
  INFINITE_MULTI_SHARED_CAMERA_PHOTOS: (userId: string) => ["infiniteMultiSharedCameraPhotos", userId],
  INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND: (userId: string, friendId: string) => ["infiniteSharedCameraPhotosWithFriend", userId, friendId],
  INFINITE_FACE_MATCHED_PHOTOS: (userId: string, friendId: string) => ["infiniteFaceMatchedPhotos", userId, friendId],
  INFINITE_FACE_MATCHED_PHOTOS_ALL: (userId: string) => ["infiniteFaceMatchedPhotosAll", userId],
} as const;

// Types matching existing album.tsx types
type Photo = {
  id: string;
  url: string;
  createdAt: string;
};

// Extended Photo type for photo detail screens
export type DetailedPhoto = {
  id: string;
  url: string;
  createdAt: string;
  s3Key: string;
  ownerIdentityId: string;
  sharedCameraId?: string;
  _version: number;
};

// Cache access result types
export type CachedCameraData = {
  cameraId: string;
  name: string;
  photos: Photo[];
} | null;

export type PhotoAlbumContext = {
  currentPhoto: DetailedPhoto | null;
  albumPhotos: DetailedPhoto[];
  currentIndex: number;
  cameraName: string;
  albumSource: 'cache' | 'fresh' | 'none';
  isLoadingAlbum: boolean;
};

// Types for me.tsx screen
export type MyPhoto = {
  id: string;
  url: string;
  createdAt: string;
  source: "owned" | "shared" | "received";
  cameraName?: string;
  cameraId?: string;
  friendIds?: string[]; // For face-matched photos - all friends this photo is shared with
  friendGroupKey?: string; // Unique key for grouping photos shared with the same set of friends
  badges?: string[];
};

type CamBlock = {
  cameraId: string;
  name: string;
  photos: Photo[];
};

type Friend = {
  id: string;
  displayName: string;
  profilePhotoUrl: string | null;
};

interface UserItem {
  id: string;
  displayName?: string | null;
  profilePhotoKey?: string | null;
  profilePhotoUrl?: string | null;
}

/**
 * Helper function to get photo URL with cache support
 * Returns cached URL if valid, otherwise fetches fresh and caches
 */
export async function getCachedPhotoUrl(
  photoId: string,
  ownerIdentityId: string,
  s3Key: string,
  thumbKey?: string | null,
  preferFull: boolean = false,
  cameraId?: string | null,
  ownerId?: string | null
): Promise<string> {
  const cacheKey = `${photoId}-${preferFull}`;

  // Return existing promise if already in flight
  if (pendingRequests.has(cacheKey)) {
    console.log(`🔄 [PHOTO_CACHE] Deduplicating request for photo: ${photoId} (${preferFull ? 'full' : 'thumb'})`);
    return pendingRequests.get(cacheKey)!;
  }

  const promise = (async (): Promise<string> => {
    // Check cache first
    const cached = await photoCacheDB.getPhoto(photoId);
    const now = Date.now();

    if (cached) {
      const wantedUrl = preferFull ? cached.fullUrl : cached.thumbUrl;
      const urlExpires = preferFull ? cached.fullUrlExpires : cached.thumbUrlExpires;

      if (wantedUrl && urlExpires && urlExpires > now) {
        const hoursUntilExpiry = Math.round((urlExpires - now) / (60 * 60 * 1000) * 10) / 10;
        console.log(`📸 [PHOTO_CACHE] Cache hit for photo: ${photoId} (${preferFull ? 'full' : 'thumb'}) - expires in ${hoursUntilExpiry}h`);
        // Update access time
        await photoCacheDB.savePhoto({
          id: photoId,
          lastAccessed: now
        });
        return wantedUrl;
      }

      // Log if URL was expired
      if (wantedUrl && urlExpires && urlExpires <= now) {
        const hoursExpired = Math.round((now - urlExpires) / (60 * 60 * 1000) * 10) / 10;
        console.log(`🔄 [PHOTO_CACHE] URL expired ${hoursExpired}h ago for photo: ${photoId}, generating fresh URL`);
      }

      // Use local URI if available (optimistic update) - but only if no URL exists yet
      if (cached.localUri && !wantedUrl) {
        console.log(`📸 [PHOTO_CACHE] Using local URI for photo: ${photoId}`);
        return cached.localUri;
      }
    }

    console.log(`📸 [PHOTO_CACHE] Cache miss, generating URL for photo: ${photoId} (${preferFull ? 'full' : 'thumb'})`);

    // Fetch fresh URL with error handling
    const key = preferFull ? s3Key : (thumbKey ?? s3Key);
    let urlString: string;

    try {
      const { url } = await getUrl({
        key,
        options: {
          accessLevel: "protected",
          targetIdentityId: ownerIdentityId,
        },
      });
      urlString = url.toString();
    } catch (error) {
      console.error(`❌ [PHOTO_CACHE] Failed to generate URL for photo ${photoId}:`, error);

      // If we have a cached (even expired) URL, return it as fallback
      if (cached?.fullUrl || cached?.thumbUrl) {
        const fallbackUrl = preferFull ? cached.fullUrl : cached.thumbUrl;
        if (fallbackUrl) {
          console.log(`⚠️ [PHOTO_CACHE] Using expired URL as fallback for photo: ${photoId}`);
          return fallbackUrl;
        }
      }

      // Re-throw error if no fallback available
      throw error;
    }

    // Cache the new URL
    await photoCacheDB.savePhoto({
      id: photoId,
      [preferFull ? 'fullUrl' : 'thumbUrl']: urlString,
      cameraId,
      ownerId,
      ownerIdentityId,
      s3Key,
      thumbKey,
    });

    return urlString;
  })();

  // Store the promise to deduplicate concurrent requests
  pendingRequests.set(cacheKey, promise);

  // Clean up when done (success or failure)
  promise.finally(() => {
    pendingRequests.delete(cacheKey);
  });

  return promise;
}

/**
 * Get full image URL for photo detail views
 * Returns both thumb and full URLs for progressive loading
 */
export async function getPhotoUrls(photoId: string, photoData: {
  ownerIdentityId: string;
  s3Key: string;
  thumbKey?: string | null;
  cameraId?: string | null;
  ownerId?: string | null;
}): Promise<{ thumbUrl?: string; fullUrl: string; isFromCache: boolean }> {
  const cached = await photoCacheDB.getPhoto(photoId);
  const now = Date.now();

  // Check if we have valid cached URLs
  if (cached) {
    const fullValid = cached.fullUrl && cached.fullUrlExpires && cached.fullUrlExpires > now;
    const thumbValid = cached.thumbUrl && cached.thumbUrlExpires && cached.thumbUrlExpires > now;

    if (fullValid) {
      return {
        thumbUrl: thumbValid ? cached.thumbUrl || undefined : undefined,
        fullUrl: cached.fullUrl!,
        isFromCache: true
      };
    }

    // If we have local URI (optimistic update), use it
    if (cached.localUri) {
      return {
        fullUrl: cached.localUri,
        isFromCache: true
      };
    }
  }

  // Fetch fresh URLs
  const promises: Promise<any>[] = [];

  // Get thumbnail URL if we have thumbKey
  if (photoData.thumbKey) {
    promises.push(
      getCachedPhotoUrl(photoId, photoData.ownerIdentityId, photoData.s3Key, photoData.thumbKey, false, photoData.cameraId, photoData.ownerId)
        .then(url => ({ type: 'thumb', url }))
    );
  }

  // Get full URL
  promises.push(
    getCachedPhotoUrl(photoId, photoData.ownerIdentityId, photoData.s3Key, photoData.thumbKey, true, photoData.cameraId, photoData.ownerId)
      .then(url => ({ type: 'full', url }))
  );

  const results = await Promise.all(promises);
  const thumbResult = results.find(r => r.type === 'thumb');
  const fullResult = results.find(r => r.type === 'full');

  return {
    thumbUrl: thumbResult?.url,
    fullUrl: fullResult?.url || results[0]?.url, // Fallback to first URL
    isFromCache: false
  };
}

/**
 * Hook to fetch user's shared cameras with photos
 * Replaces the complex fetchSharedCameras logic in album.tsx
 */
export function useUserCameras(userId: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.USER_CAMERAS(userId || ""),
    enabled: !!userId,
    queryFn: async (): Promise<CamBlock[]> => {
      if (!userId) throw new Error("User ID is required");
      const currentUserId = userId;

      console.log(
        `🔍 [CAMERAS_QUERY] Fetching shared cameras for user: ${currentUserId}`
      );

      // Get camera memberships (exclude invited cameras)
      const memRes = await client.graphql({
        query: sharedCameraMembersByUserIdAndCameraId,
        variables: { 
          userId: currentUserId,
          filter: { role: { ne: "INVITED" } }
        },
        authMode: "userPool",
      });

      const camIds = Array.from(
        new Set<string>(
          (memRes.data?.sharedCameraMembersByUserIdAndCameraId?.items || [])
            .map((r) => r?.cameraId)
            .filter((id): id is string => !!id)
        )
      );

      if (camIds.length === 0) {
        return [];
      }

      console.log(`🔍 [CAMERAS_QUERY] Found ${camIds.length} shared cameras`);

      // Batch fetch cameras and photos in parallel
      let camerasData: any[] = [];

      if (camIds.length <= 20) {
        try {
          const cameraFilters = camIds.map((id) => ({ id: { eq: id } }));
          const camerasRes = await client.graphql({
            query: batchGetCameras,
            variables: { cameraFilters },
            authMode: "userPool",
          });
          camerasData = camerasRes.data?.listSharedCameras?.items || [];
        } catch (batchError) {
          console.warn(
            `⚠️ [CAMERAS_QUERY] Batch fetch failed, using individual calls:`,
            batchError
          );
          // Fallback to individual calls
          const cameraPromises = camIds.map(async (id) => {
            try {
              const res = await client.graphql({
                query: getSharedCamera,
                variables: { id },
                authMode: "userPool",
              });
              return res.data?.getSharedCamera;
            } catch (error) {
              return null;
            }
          });
          const cameras = await Promise.all(cameraPromises);
          camerasData = cameras.filter((camera) => camera !== null);
        }
      }

      // Create camera lookup
      const cameraLookup = new Map();
      camerasData.forEach((camera) => {
        if (camera?.id) {
          cameraLookup.set(camera.id, camera);
        }
      });

      // Fetch photos for all cameras in parallel
      const photoPromises = camIds.map(async (id) => {
        try {
          return await client.graphql({
            query: photosBySharedCameraIdAndCreatedAt,
            variables: {
              sharedCameraId: id,
              filter: { _deleted: { ne: true } },
              sortDirection: "DESC" as any,
            },
            authMode: "userPool",
          });
        } catch (error) {
          return {
            data: { photosBySharedCameraIdAndCreatedAt: { items: [] } },
          };
        }
      });

      const allPhotoResults = await Promise.all(photoPromises);

      // Process results and filter out deleted/null cameras
      const camBlocks: CamBlock[] = (await Promise.all(
        camIds.map(async (cameraId, index) => {
          const camera = cameraLookup.get(cameraId);

          // Skip if camera is null/undefined or deleted
          if (!camera || camera._deleted === true) {
            console.log(`⚠️ [CAMERAS_QUERY] Skipping deleted/null camera: ${cameraId}`);
            return null;
          }

          const photoRes = allPhotoResults[index];

          const signedPhotos: Photo[] = await Promise.all(
            (
              photoRes.data?.photosBySharedCameraIdAndCreatedAt?.items || []
            ).map(async (p) => {
              if (!p) return null;

              const url = await getCachedPhotoUrl(
                p.id,
                p.ownerIdentityId,
                p.s3Key,
                p.thumbKey,
                false, // Use thumbnails for grid view
                cameraId,
                p.ownerId
              );

              return {
                id: p.id,
                url,
                createdAt: p.createdAt,
              };
            })
          ).then((photos) =>
            photos.filter((photo): photo is Photo => photo !== null)
          );

          return {
            cameraId,
            name: camera.name, // camera is guaranteed to exist here
            photos: signedPhotos,
          };
        })
      )).filter((block): block is CamBlock => block !== null);

      console.log(
        `✅ [CAMERAS_QUERY] Successfully loaded ${camBlocks.length} cameras`
      );
      return camBlocks;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Infinite query for individual camera photos
 * Used for pagination within a specific camera - 20 photos per page
 */
export function useInfiniteSingleSharedCameraPhotos(cameraId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.INFINITE_SINGLE_SHARED_CAMERA_PHOTOS(cameraId || ""),
    enabled: !!cameraId,
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      if (!cameraId) throw new Error("Camera ID is required");
      
      console.log(`🔍 [INFINITE_SINGLE_SHARED_CAMERA_PHOTOS] Fetching photos for camera: ${cameraId}, cursor:`, pageParam);

      const photosRes = await client.graphql({
        query: photosBySharedCameraIdAndCreatedAt,
        variables: {
          sharedCameraId: cameraId,
          filter: { _deleted: { ne: true } },
          sortDirection: "DESC" as any,
          limit: 20, // 20 photos per page
          nextToken: pageParam,
        },
        authMode: "userPool",
      });

      const rawPhotos = photosRes.data?.photosBySharedCameraIdAndCreatedAt?.items || [];
      const nextToken = photosRes.data?.photosBySharedCameraIdAndCreatedAt?.nextToken;
      
      console.log(`📊 [INFINITE_SINGLE_SHARED_CAMERA_PHOTOS] Raw fetch results:`, {
        cameraId,
        requestedLimit: 20,
        receivedCount: rawPhotos.length,
        hasNextToken: !!nextToken,
        nextToken: nextToken ? `${nextToken.substring(0, 20)}...` : null
      });

      const photos = await Promise.all(
        rawPhotos.map(async (p, index) => {
            if (!p) {
              console.warn(`⚠️ [INFINITE_SINGLE_SHARED_CAMERA_PHOTOS] Null photo at index ${index}`);
              return null;
            }
            
            try {
              const url = await getCachedPhotoUrl(
                p.id,
                p.ownerIdentityId,
                p.s3Key,
                p.thumbKey,
                false, // Use thumbnails for grid view
                cameraId,
                p.ownerId
              );

              return {
                id: p.id,
                url,
                createdAt: p.createdAt,
              } as Photo;
            } catch (error) {
              console.error(`❌ [INFINITE_SINGLE_SHARED_CAMERA_PHOTOS] Failed to load photo URL for ${p.id}:`, error);
              return null;
            }
          }
        )
      );

      const validPhotos = photos.filter((p): p is Photo => p !== null);
      
      console.log(`✅ [INFINITE_SINGLE_SHARED_CAMERA_PHOTOS] Processing complete:`, {
        cameraId,
        validPhotosCount: validPhotos.length,
        failedPhotosCount: rawPhotos.length - validPhotos.length,
        hasMore: !!nextToken,
        photoIds: validPhotos.slice(0, 3).map(p => p.id), // Show first 3 IDs
      });
      
      return {
        photos: validPhotos,
        nextToken,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextToken || undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes - photos should be fairly fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch user's friends
 * Replaces the fetchFriends logic in album.tsx
 */
export function useUserFriends(userId: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.USER_FRIENDS(userId || ""),
    enabled: !!userId,
    queryFn: async (): Promise<Friend[]> => {
      if (!userId) throw new Error("User ID is required");
      const currentUserId = userId;

      console.log(
        `🔍 [FRIENDS_QUERY] Starting friends fetch for: ${currentUserId}`
      );

      // Get all friendships in one query
      const friendshipsRes = await client.graphql({
        query: getAllUserFriendships,
        variables: { userId: currentUserId },
        authMode: "userPool",
      });

      // Extract unique friend IDs
      const friendIds = new Set<string>();

      (friendshipsRes.data?.outgoing?.items || []).forEach((friendship) => {
        if (friendship?.friendId) {
          friendIds.add(friendship.friendId);
        }
      });

      (friendshipsRes.data?.incoming?.items || []).forEach((friendship) => {
        if (friendship?.ownerId) {
          friendIds.add(friendship.ownerId);
        }
      });

      if (friendIds.size === 0) {
        return [];
      }

      console.log(`✅ [FRIENDS_QUERY] Found ${friendIds.size} unique friends`);

      // Batch fetch friend profiles
      let friendsData: any[] = [];

      if (friendIds.size <= 100) {
        try {
          const userFilters = Array.from(friendIds).map((id) => ({
            id: { eq: id },
          }));

          const friendsRes = await client.graphql({
            query: batchGetUsers,
            variables: { userFilters },
            authMode: "userPool",
          });

          friendsData = friendsRes.data?.listUsers?.items || [];
        } catch (batchError) {
          console.warn(
            `⚠️ [FRIENDS_QUERY] Batch query failed, falling back:`,
            batchError
          );
          // Fallback to individual calls
          const userPromises = Array.from(friendIds).map((friendId) =>
            client
              .graphql({
                query: getUser,
                variables: { id: friendId },
                authMode: "userPool",
              })
              .then((res) => res.data?.getUser)
              .catch(() => null)
          );

          const users = await Promise.all(userPromises);
          friendsData = users.filter((user) => user !== null);
        }
      }

      // Process profile photos in parallel
      const friendProfiles: Friend[] = await Promise.all(
        friendsData.map(async (user) => {
          let profilePhotoUrl: string | null = null;

          if (user?.profilePhotoKey) {
            try {
              const accessLevel = user.profilePhotoKey.startsWith("public/")
                ? "guest"
                : user.profilePhotoKey.startsWith("protected/")
                ? "protected"
                : "guest";

              const urlResult = await getUrl({
                key: user.profilePhotoKey,
                options: { accessLevel },
              });

              profilePhotoUrl = urlResult.url.toString();
            } catch (photoError) {
              console.error(
                `❌ [FRIENDS_QUERY] Failed to load profile photo for ${user?.displayName}:`,
                photoError
              );
            }
          }

          return {
            id: user?.id || "",
            displayName: user?.displayName || "Unnamed",
            profilePhotoUrl,
          };
        })
      );

      console.log(
        `✅ [FRIENDS_QUERY] Successfully loaded ${friendProfiles.length} friends`
      );
      return friendProfiles;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - friends change less frequently
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to fetch shared photos between current user and a friend
 * Replaces the fetchSharedPhotos logic in album.tsx
 */
export function useSharedPhotos(userId: string | null | undefined, friendId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.SHARED_PHOTOS(userId || "", friendId || ""),
    enabled: !!userId && !!friendId,
    queryFn: async (): Promise<DetailedPhoto[]> => {
      if (!userId || !friendId) return [];

      const currentUserId = userId;

      console.log(
        `🔍 [SHARED_PHOTOS_QUERY] Fetching shared photos with ${friendId}`
      );

      // Use the new optimized query that leverages our denormalized PhotoRecipient fields
      // This single query replaces multiple queries and reduces client-side processing
      const sharedRes = await client.graphql({
        query: getSharedPhotosOptimized,
        variables: {
          userA: currentUserId,
          userB: friendId,
          limit: 100, // Reasonable limit for initial load
        },
        authMode: "userPool",
      });

      // Extract the four result sets from our optimized query
      // fromAtoB: Photos that User A took and explicitly shared with User B
      const fromAtoB = sharedRes.data?.fromAtoB?.items || [];

      // fromBtoA: Photos that User B took and explicitly shared with User A
      const fromBtoA = sharedRes.data?.fromBtoA?.items || [];

      // receivedByA: ALL photos that User A has received (for finding third-party intersections)
      const receivedByA = sharedRes.data?.receivedByA?.items || [];

      // receivedByB: ALL photos that User B has received (for finding third-party intersections)
      const receivedByB = sharedRes.data?.receivedByB?.items || [];

      // Calculate shared photos using the formula: (A→B) ∪ (B→A) ∪ (R(A) ∩ R(B))
      const sharedPhotoIds = new Set<string>();

      // PART 1: Add photos that User A took and shared with User B (A→B)
      // Example: User A takes a photo at a party and shares it with User B
      fromAtoB.forEach(item => {
        if (item) {
          sharedPhotoIds.add(item.photoId);
        }
      });

      // PART 2: Add photos that User B took and shared with User A (B→A)
      // Example: User B takes a photo at lunch and shares it with User A
      fromBtoA.forEach(item => {
        if (item) {
          sharedPhotoIds.add(item.photoId);
        }
      });

      // PART 3: Find photos from third parties that BOTH users received (R(A) ∩ R(B))
      // Example: User C takes a photo and shares it with both User A and User B
      // This is the intersection - only photos that appear in both lists

      // First, build a map of all photos User A received from ANY owner
      const receivedByAMap = new Map<string, string>();
      receivedByA.forEach(item => {
        if (item) {
          receivedByAMap.set(item.photoId, item.ownerId);
        }
      });

      // Now check User B's received photos to find the intersection
      // Add photos that User B also received from ANY owner
      receivedByB.forEach(item => {
        if (item && receivedByAMap.has(item.photoId)) {
          sharedPhotoIds.add(item.photoId);
        }
      });

      console.log(`🔍 [SHARED_PHOTOS_QUERY] Photo analysis for ${friendId}:`, {
        fromAtoB: fromAtoB.length,
        fromBtoA: fromBtoA.length,
        receivedByA: receivedByA.length,
        receivedByB: receivedByB.length,
        thirdPartyIntersection: Array.from(sharedPhotoIds).filter(id =>
          !fromAtoB.some(p => p.photoId === id) &&
          !fromBtoA.some(p => p.photoId === id)
        ).length,
        totalSharedPhotos: sharedPhotoIds.size,
        sharedPhotoIds: Array.from(sharedPhotoIds).slice(0, 3), // Show first 3 IDs
      });

      if (sharedPhotoIds.size === 0) {
        return [];
      }

      // Now fetch the actual Photo objects for all the shared photo IDs we found
      // We still need this step because PhotoRecipient only has the photoId reference
      const photoDetailsPromises = Array.from(sharedPhotoIds).map(async (photoId) => {
        try {
          const photoRes = await client.graphql({
            query: getPhoto,
            variables: { id: photoId },
            authMode: "userPool",
          });
          return photoRes.data.getPhoto;
        } catch (error) {
          console.warn(`Failed to fetch photo ${photoId}:`, error);
          return null;
        }
      });

      const allPhotos = (await Promise.all(photoDetailsPromises))
        .filter((photo) => photo && !photo._deleted)
        .sort(
          (a, b) => {
            if (!a || !b) return 0;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        );

      // Generate signed URLs and return complete DetailedPhoto objects
      const validPhotos = await Promise.all(
        allPhotos.map(async (photo) => {
          if (!photo) return null;

          try {
            const { url } = await getUrl({
              key: photo.s3Key,
              options: {
                accessLevel: "protected",
                targetIdentityId: photo.ownerIdentityId,
              },
            });
            return {
              id: photo.id,
              url: url.toString(),
              createdAt: photo.createdAt,
              s3Key: photo.s3Key,
              ownerIdentityId: photo.ownerIdentityId,
              sharedCameraId: photo.sharedCameraId,
              _version: photo._version,
            } as DetailedPhoto;
          } catch (error) {
            return null;
          }
        })
      ).then((photos) => photos.filter((photo): photo is DetailedPhoto => photo !== null));

      console.log(
        `✅ [SHARED_PHOTOS_QUERY] Successfully loaded ${validPhotos.length} shared photos`
      );
      return validPhotos;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - shared photos should be fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch face-matched photos with pagination
 * Used for paginated loading of photos where both users appear (based on face recognition)
 * Replaces useSharedPhotos when pagination is needed
 * 
 * @param userId - The ID of the current user
 * @param friendId - The ID of the friend to find face-matched photos with
 * @returns Paginated photos where both users appear
 */
export function useInfiniteFaceMatchedPhotos(
  userId: string | null | undefined,
  friendId: string | null | undefined
) {
  type PageToken = {
    nextTokenAtoB?: string;
    nextTokenBtoA?: string;
    nextTokenReceivedA?: string;
    nextTokenReceivedB?: string;
  } | undefined;

  // Use the same optimized approach as useSharedPhotos with pagination
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS(userId || "", friendId || ""),
    enabled: !!userId && !!friendId,
    queryFn: async ({ pageParam }: { pageParam: PageToken }) => {
      if (!userId || !friendId) return { photos: [], nextToken: undefined };

      console.log(
        `🔍 [INFINITE_SHARED_PHOTOS] Fetching shared photos between ${userId} and ${friendId}, page: ${pageParam || 'first'}`
      );
      console.log(`🔍 [INFINITE_SHARED_PHOTOS] Query variables:`, {
        userA: userId,
        userB: friendId,
        limit: 20,
        nextTokenAtoB: pageParam?.nextTokenAtoB,
        nextTokenBtoA: pageParam?.nextTokenBtoA,
        nextTokenReceivedA: pageParam?.nextTokenReceivedA,
        nextTokenReceivedB: pageParam?.nextTokenReceivedB,
      });

      // Use the same optimized query as useSharedPhotos with pagination tokens
      let sharedRes;
      try {
        console.log(`🔍 [INFINITE_SHARED_PHOTOS] Starting GraphQL query...`);
        sharedRes = await client.graphql({
          query: getSharedPhotosOptimized,
          variables: {
            userA: userId,
            userB: friendId,
            limit: 20, // Reasonable page size
            nextTokenAtoB: pageParam?.nextTokenAtoB,
            nextTokenBtoA: pageParam?.nextTokenBtoA,
            nextTokenReceivedA: pageParam?.nextTokenReceivedA,
            nextTokenReceivedB: pageParam?.nextTokenReceivedB,
          },
          authMode: "userPool",
        });
        console.log(`✅ [INFINITE_SHARED_PHOTOS] GraphQL query completed successfully`);
      } catch (error) {
        console.error(`❌ [INFINITE_SHARED_PHOTOS] GraphQL query failed:`, error);
        throw error;
      }

      const fromAtoB = sharedRes.data?.fromAtoB?.items || [];
      const fromBtoA = sharedRes.data?.fromBtoA?.items || [];
      const receivedByA = sharedRes.data?.receivedByA?.items || [];
      const receivedByB = sharedRes.data?.receivedByB?.items || [];

      // Calculate shared photos using the same formula: (A→B) ∪ (B→A) ∪ (R(A) ∩ R(B))
      const sharedPhotoIds = new Set<string>();

      // Add A→B photos
      fromAtoB.forEach(item => {
        if (item) {
          sharedPhotoIds.add(item.photoId);
        }
      });

      // Add B→A photos
      fromBtoA.forEach(item => {
        if (item) {
          sharedPhotoIds.add(item.photoId);
        }
      });

      // Add photos that both users have received (intersection) - from ANY owner
      const receivedByAMap = new Map<string, string>();
      receivedByA.forEach(item => {
        if (item) {
          receivedByAMap.set(item.photoId, item.ownerId);
        }
      });

      receivedByB.forEach(item => {
        if (item && receivedByAMap.has(item.photoId)) {
          sharedPhotoIds.add(item.photoId);
        }
      });

      console.log(`🔍 [INFINITE_SHARED_PHOTOS] Found ${sharedPhotoIds.size} shared photos on this page`);
      console.log(`🔍 [INFINITE_SHARED_PHOTOS] Debug - fromAtoB: ${fromAtoB.length}, fromBtoA: ${fromBtoA.length}, receivedByA: ${receivedByA.length}, receivedByB: ${receivedByB.length}`);

      // Debug: Log actual photo IDs to see what's in the intersection
      const receivedByAPhotoIds = receivedByA.map(item => item?.photoId).filter(Boolean);
      const receivedByBPhotoIds = receivedByB.map(item => item?.photoId).filter(Boolean);
      console.log(`🔍 [INFINITE_SHARED_PHOTOS] ReceivedByA photoIds:`, receivedByAPhotoIds.slice(0, 5));
      console.log(`🔍 [INFINITE_SHARED_PHOTOS] ReceivedByB photoIds:`, receivedByBPhotoIds.slice(0, 5));

      // Always check for next page regardless of result count
      // We might get 0 photos this page but still have more data to fetch
      const hasNextPage = !!(
        sharedRes.data?.fromAtoB?.nextToken ||
        sharedRes.data?.fromBtoA?.nextToken ||
        sharedRes.data?.receivedByA?.nextToken ||
        sharedRes.data?.receivedByB?.nextToken
      );

      const nextPageParam: PageToken = hasNextPage ? {
        nextTokenAtoB: sharedRes.data?.fromAtoB?.nextToken || undefined,
        nextTokenBtoA: sharedRes.data?.fromBtoA?.nextToken || undefined,
        nextTokenReceivedA: sharedRes.data?.receivedByA?.nextToken || undefined,
        nextTokenReceivedB: sharedRes.data?.receivedByB?.nextToken || undefined,
      } : undefined;

      if (sharedPhotoIds.size === 0) {
        return {
          photos: [],
          nextToken: nextPageParam // Return next page info even with 0 photos
        };
      }

      // Fetch photo details
      const photoDetailsPromises = Array.from(sharedPhotoIds).map(async (photoId) => {
        try {
          const photoRes = await client.graphql({
            query: getPhoto,
            variables: { id: photoId },
            authMode: "userPool",
          });
          return photoRes.data.getPhoto;
        } catch (error) {
          console.warn(`Failed to fetch photo ${photoId}:`, error);
          return null;
        }
      });

      const allPhotos = (await Promise.all(photoDetailsPromises))
        .filter((photo) => photo && !photo._deleted)
        .sort((a, b) => {
          if (!a || !b) return 0;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      // Generate signed URLs
      const validPhotos = await Promise.all(
        allPhotos.map(async (photo) => {
          if (!photo) return null;

          try {
            const { url } = await getUrl({
              key: photo.s3Key,
              options: {
                accessLevel: "protected",
                targetIdentityId: photo.ownerIdentityId,
              },
            });
            return {
              id: photo.id,
              url: url.toString(),
              createdAt: photo.createdAt,
              s3Key: photo.s3Key,
              ownerIdentityId: photo.ownerIdentityId,
              sharedCameraId: photo.sharedCameraId,
              _version: photo._version,
            } as DetailedPhoto;
          } catch (error) {
            return null;
          }
        })
      ).then((photos) => photos.filter((photo): photo is DetailedPhoto => photo !== null));

      console.log(`✅ [INFINITE_SHARED_PHOTOS] Page loaded with ${validPhotos.length} photos, hasNextPage: ${!!nextPageParam}`);

      return {
        photos: validPhotos,
        nextToken: nextPageParam,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextToken,
    initialPageParam: undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch ALL face-matched photos for a user (both owned and received)
 * Used in me.tsx to show all face-matched photos with pagination and friend context
 * Replaces the face-match section of useMyPhotos with proper pagination
 * 
 * @param userId - The ID of the current user
 * @returns Paginated face-matched photos with friend context and deduplication
 */
export function useInfiniteFaceMatchedPhotosAll(
  userId: string | null | undefined
) {
  const infiniteQuery = useInfiniteQuery({
    queryKey: QUERY_KEYS.INFINITE_FACE_MATCHED_PHOTOS_ALL(userId || ""),
    enabled: !!userId,
    queryFn: async ({ pageParam }: { pageParam?: { ownedToken?: string; receivedToken?: string } }) => {
      if (!userId) throw new Error("User ID is required");
      
      console.log(`🔍 [INFINITE_FACE_MATCHED_ALL] Fetching face-matched photos for ${userId}, page:`, pageParam ? 'continuation' : 'first page');
      
      const recipientFilter = { 
        _deleted: { ne: true },
        or: [
          { method: { eq: "FACE_RECOGNITION" } },
          { method: { eq: "EVENT_REKOGNITION" } }
        ]
      };
      console.log(`🔍 [INFINITE_FACE_MATCHED_ALL] Using recipient filter:`, JSON.stringify(recipientFilter, null, 2));

      const currentUserId = userId;
      const photosPerSource = 15; // Fetch 15 from each source per page (up to 30 total)

      try {
        // Parallel fetch owned and received face-matched photos
        const [ownedRes, receivedRes] = await Promise.all([
          // Fetch owned photos that have PhotoRecipient records (both FACE_RECOGNITION and EVENT_REKOGNITION)
          client.graphql({
            query: photosByOwnerIdAndCreatedAt,
            variables: {
              ownerId: currentUserId,
              filter: { 
                _deleted: { ne: true }
              },
              sortDirection: "DESC" as any,
              limit: photosPerSource,
              nextToken: pageParam?.ownedToken,
            },
            authMode: "userPool",
          }),
          // Fetch received photos through PhotoRecipient
          client.graphql({
            query: photoRecipientsByRecipientIdAndPhotoId,
            variables: {
              recipientId: currentUserId,
              filter: recipientFilter,
              limit: photosPerSource,
              nextToken: pageParam?.receivedToken,
            },
            authMode: "userPool",
          })
        ]);

        const ownedPhotos = ownedRes.data.photosByOwnerIdAndCreatedAt.items || [];
        const receivedRecipients = receivedRes.data.photoRecipientsByRecipientIdAndPhotoId.items || [];

        // Get next tokens
        const ownedNextToken = ownedRes.data.photosByOwnerIdAndCreatedAt.nextToken || undefined;
        const receivedNextToken = receivedRes.data.photoRecipientsByRecipientIdAndPhotoId.nextToken || undefined;

        // Fetch full photo details for received photos
        const receivedPhotoPromises = receivedRecipients.map(async (recipient) => {
          try {
            const photoRes: any = await client.graphql({
              query: getPhoto,
              variables: { id: recipient.photoId },
              authMode: "userPool",
            });
            const photo = photoRes.data.getPhoto;
            
            // Include all face-matched photos (both FACE_RECOGNITION and EVENT_REKOGNITION)
            if (!photo || photo._deleted) return null;
            
            return photo;
          } catch (error) {
            console.warn(`⚠️ [INFINITE_FACE_MATCHED_ALL] Failed to fetch photo: ${recipient.photoId}`);
            return null;
          }
        });

        const receivedPhotos = (await Promise.all(receivedPhotoPromises)).filter(Boolean);

        // Combine all photos for this page
        const pagePhotos = [...ownedPhotos, ...receivedPhotos];

        // Deduplicate by photo ID (same photo can be owned AND received)
        const uniquePagePhotos = pagePhotos.filter((photo, index, arr) => 
          arr.findIndex(p => p.id === photo.id) === index
        );

        console.log(`📊 [INFINITE_FACE_MATCHED_ALL] Page stats - Owned: ${ownedPhotos.length}, Received: ${receivedPhotos.length}, Unique: ${uniquePagePhotos.length}`);

        // Batch fetch URLs for all photos
        const photosWithUrls = await Promise.all(
          uniquePagePhotos.map(async (photo) => {
            try {
              const { url } = await getUrl({
                key: photo.s3Key,
                options: {
                  accessLevel: "protected",
                  targetIdentityId: photo.ownerIdentityId,
                },
              });
              return {
                id: photo.id,
                url: url.toString(),
                createdAt: photo.createdAt,
                ownerId: photo.ownerId,
                source: photo.ownerId === currentUserId ? "owned" as const : "received" as const,
              };
            } catch (error) {
              console.warn(`⚠️ [INFINITE_FACE_MATCHED_ALL] Failed to get URL for photo: ${photo.id}`);
              return null;
            }
          })
        ).then((photos) => photos.filter((photo) => photo !== null));

        // Add friend context in batch
        const photosWithFriendContext = await addFriendContextBatch(photosWithUrls, currentUserId);

        // Sort by creation date (newest first)
        photosWithFriendContext.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Determine if there are more pages
        const hasMorePages = !!(ownedNextToken || receivedNextToken);

        console.log(`✅ [INFINITE_FACE_MATCHED_ALL] Returning ${photosWithFriendContext.length} photos, hasMore: ${hasMorePages}`);

        return {
          photos: photosWithFriendContext,
          nextPageParam: hasMorePages ? {
            ownedToken: ownedNextToken,
            receivedToken: receivedNextToken,
          } : undefined,
        };

      } catch (error) {
        console.error(`❌ [INFINITE_FACE_MATCHED_ALL] Failed to fetch face-matched photos:`, error);
        throw error;
      }
    },
    initialPageParam: undefined as { ownedToken?: string; receivedToken?: string } | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageParam || undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes - face-matched photos should be fairly fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });

  // Add deduplication logic across all pages
  const deduplicatedPhotos = useMemo(() => {
    if (!infiniteQuery.data?.pages) {
      return [];
    }
    
    const allPhotos = infiniteQuery.data.pages.flatMap(page => page.photos);
    
    // Deduplicate by photo ID across all pages
    const uniquePhotos = allPhotos.filter((photo, index, arr) => 
      arr.findIndex(p => p.id === photo.id) === index
    );
    
    // Re-sort all photos chronologically after deduplication to prevent jumping
    uniquePhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`🎯 [INFINITE_FACE_MATCHED_ALL] Cross-page deduplication:`, {
      totalFetched: allPhotos.length,
      uniquePhotos: uniquePhotos.length,
      duplicatesRemoved: allPhotos.length - uniquePhotos.length
    });
    
    return uniquePhotos;
  }, [infiniteQuery.data]);

  // Return extended object with both raw query and deduplicated photos
  return {
    ...infiniteQuery,
    deduplicatedPhotos,
  };
}

/**
 * Batch function to add friend context to photos
 * Efficiently queries PhotoRecipient data for multiple photos at once
 */
async function addFriendContextBatch(
  photos: Array<{ id: string; url: string; createdAt: string; ownerId: string; source: "owned" | "received" }>,
  currentUserId: string
): Promise<MyPhoto[]> {
  console.log(`🔍 [FRIEND_CONTEXT_BATCH] Adding friend context to ${photos.length} photos`);

  // Batch query all photo recipients
  const recipientPromises = photos.map(photo => 
    client.graphql({
      query: photoRecipientsByPhotoIdAndRecipientId,
      variables: { 
        photoId: photo.id,
        limit: 10, // Most photos won't be shared with more than a few friends
        filter: { 
          or: [
            { method: { eq: "FACE_RECOGNITION" } },
            { method: { eq: "EVENT_REKOGNITION" } }
          ], // Face-matched and shared camera face-matched photos
          _deleted: { ne: true }
        }
      },
      authMode: "userPool",
    }).catch(error => {
      console.warn(`⚠️ [FRIEND_CONTEXT_BATCH] Failed to fetch recipients for photo ${photo.id}:`, error);
      return null;
    })
  );

  const allRecipientResults = await Promise.all(recipientPromises);

  // Process each photo with its recipient data
  return photos.map((photo, index) => {
    const recipientResult = allRecipientResults[index];
    
    let friendIds: string[] = [];
    let friendGroupKey: string = "";
    
    if (recipientResult?.data?.photoRecipientsByPhotoIdAndRecipientId?.items) {
      const recipients = recipientResult.data.photoRecipientsByPhotoIdAndRecipientId.items;
      
      if (photo.source === "owned") {
        // For owned photos: recipients are the friends
        friendIds = recipients.map((r: any) => r.recipientId);
      } else {
        // For received photos: include owner + other recipients (excluding current user)
        const recipientIds = recipients.map((r: any) => r.recipientId);
        friendIds = [photo.ownerId, ...recipientIds].filter(
          (friendId, idx, arr) => 
            friendId !== currentUserId && // Exclude current user
            arr.indexOf(friendId) === idx // Remove duplicates
        );
      }
      
      // Create consistent group key
      if (friendIds.length > 0) {
        friendGroupKey = friendIds.sort().join(",");
      }
    }

    return {
      id: photo.id,
      url: photo.url,
      createdAt: photo.createdAt,
      source: photo.source,
      cameraName: "Face-match",
      friendIds,
      friendGroupKey,
    } as MyPhoto;
  });
}

/**
 * Infinite query for photos from cameras shared between two users
 * Used in user/[userId].tsx for paginated loading of shared camera photos
 * Fetches from the INTERSECTION of cameras both users are members of
 * 
 * @param userId - The ID of the current user
 * @param friendId - The ID of the friend to find shared cameras with
 * @returns Paginated photos from cameras both users share
 */
export function useInfiniteSharedCameraPhotosWithFriend(
  userId: string | null | undefined,
  friendId: string | null | undefined
) {
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND(userId || "", friendId || ""),
    enabled: !!userId && !!friendId,
    queryFn: async ({ pageParam }: { pageParam?: { cameraTokens: Record<string, string | undefined>; sharedCameraIds: string[]; cameraInfoMap: Record<string, { id: string; name: string }> } }) => {
      if (!userId || !friendId) throw new Error("User ID and Friend ID are required");
      
      console.log(`🔍 [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Fetching photos between ${userId} and ${friendId}, page:`, pageParam ? 'continuation' : 'first page');

      try {
        const photosPerPage = 20;
        let sharedCameraIds: string[] = [];
        let cameraInfoMap: Record<string, { id: string; name: string }> = {};
        let cameraTokens: Record<string, string | undefined> = {};

        // First page - find shared cameras (intersection)
        if (!pageParam) {
          // Get camera memberships for both users
          const [currentUserMemberships, friendMemberships] = await Promise.all([
            client.graphql({
              query: sharedCameraMembersByUserIdAndCameraId,
              variables: { 
                userId: userId,
                filter: { role: { ne: "INVITED" } }
              },
              authMode: "userPool",
            }),
            client.graphql({
              query: sharedCameraMembersByUserIdAndCameraId,
              variables: { 
                userId: friendId,
                filter: { role: { ne: "INVITED" } }
              },
              authMode: "userPool",
            })
          ]);

          // Extract camera IDs
          const currentUserCameraIds = new Set(
            currentUserMemberships.data.sharedCameraMembersByUserIdAndCameraId.items
              .map(item => item.cameraId)
          );
          
          const friendCameraIds = new Set(
            friendMemberships.data.sharedCameraMembersByUserIdAndCameraId.items
              .map(item => item.cameraId)
          );

          // Find shared cameras (intersection)
          sharedCameraIds = Array.from(currentUserCameraIds)
            .filter(cameraId => friendCameraIds.has(cameraId));

          if (sharedCameraIds.length === 0) {
            console.log(`📷 [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] No shared cameras found`);
            return {
              photos: [],
              nextPageParam: undefined,
            };
          }

          console.log(`📷 [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Found ${sharedCameraIds.length} shared cameras`);

          // Fetch camera info
          const cameraPromises = sharedCameraIds.map(async (cameraId) => {
            try {
              const { data }: any = await client.graphql({
                query: getSharedCamera,
                variables: { id: cameraId },
                authMode: "userPool",
              });
              const camera = data.getSharedCamera;
              return camera ? { id: cameraId, name: camera.name } : { id: cameraId, name: `Camera ${cameraId.substring(0, 8)}` };
            } catch (error) {
              console.warn(`⚠️ [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Failed to fetch camera: ${cameraId}`);
              return { id: cameraId, name: `Camera ${cameraId.substring(0, 8)}` };
            }
          });

          const cameras = await Promise.all(cameraPromises);
          cameras.forEach((camera) => {
            cameraInfoMap[camera.id] = camera;
          });

          // Initialize tokens as undefined for all cameras
          sharedCameraIds.forEach(cameraId => {
            cameraTokens[cameraId] = undefined;
          });
        } else {
          // Subsequent pages - use cached info from pageParam
          sharedCameraIds = pageParam.sharedCameraIds;
          cameraInfoMap = pageParam.cameraInfoMap;
          cameraTokens = pageParam.cameraTokens;
        }

        // Fetch photos from ALL shared cameras in PARALLEL
        const cameraPhotoPromises = sharedCameraIds.map(async (cameraId) => {
          // Skip cameras that have no more photos
          if (cameraTokens[cameraId] === null) {
            return { cameraId, photos: [], nextToken: null };
          }

          try {
            const photosRes: any = await client.graphql({
              query: photosBySharedCameraIdAndCreatedAt,
              variables: {
                sharedCameraId: cameraId,
                filter: { _deleted: { ne: true } },
                sortDirection: "DESC" as any,
                limit: Math.max(5, Math.ceil(photosPerPage / sharedCameraIds.length)), // At least 5 photos per camera
                nextToken: cameraTokens[cameraId],
              },
              authMode: "userPool",
            });

            const cameraInfo = cameraInfoMap[cameraId];
            const cameraName = cameraInfo?.name || `Camera ${cameraId.substring(0, 8)}`;
            const rawPhotos = photosRes.data.photosBySharedCameraIdAndCreatedAt.items || [];
            const nextToken = photosRes.data.photosBySharedCameraIdAndCreatedAt.nextToken;

            // Generate signed URLs
            const photoResults = await Promise.all(
              rawPhotos.map(async (photo: any) => {
                try {
                  const url = await getCachedPhotoUrl(
                    photo.id,
                    photo.ownerIdentityId,
                    photo.s3Key,
                    photo.thumbKey,
                    false, // Use thumbnails for grid view
                    cameraId,
                    photo.ownerId
                  );

                  return {
                    id: photo.id,
                    url,
                    createdAt: photo.createdAt,
                    source: (photo.ownerId === userId ? "owned" : "shared") as MyPhoto["source"],
                    cameraName,
                    cameraId,
                    ownerId: photo.ownerId,
                  } as MyPhoto;
                } catch (error) {
                  console.warn(`⚠️ [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Failed to get URL for photo ${photo.id}:`, error);
                  return null;
                }
              })
            );

            return {
              cameraId,
              photos: photoResults.filter(Boolean) as MyPhoto[],
              nextToken: nextToken || null, // Use null to indicate no more photos
            };
          } catch (cameraError) {
            console.warn(`⚠️ [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Failed to fetch photos for camera ${cameraId}:`, cameraError);
            return {
              cameraId,
              photos: [],
              nextToken: null,
            };
          }
        });

        const cameraResults = await Promise.all(cameraPhotoPromises);
        
        // Combine all photos and sort by date (newest first)
        const allNewPhotos = cameraResults.flatMap(result => result.photos);
        allNewPhotos.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Take only the requested number of photos
        const photosToReturn = allNewPhotos.slice(0, photosPerPage);

        // Update camera tokens for next page
        const updatedCameraTokens: Record<string, string | undefined> = {};
        cameraResults.forEach(result => {
          updatedCameraTokens[result.cameraId] = result.nextToken === null ? null : result.nextToken;
        });

        // Check if any camera has more photos (not null)
        const hasMorePhotos = cameraResults.some(result => result.nextToken !== null);

        const nextPageParam = hasMorePhotos ? {
          cameraTokens: updatedCameraTokens,
          sharedCameraIds,
          cameraInfoMap,
        } : undefined;

        console.log(`✅ [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Successfully loaded ${photosToReturn.length} photos from ${sharedCameraIds.length} shared cameras, hasMore: ${!!nextPageParam}`);

        return {
          photos: photosToReturn,
          nextPageParam,
        };
      } catch (error) {
        console.error(`❌ [INFINITE_SHARED_CAMERA_PHOTOS_WITH_FRIEND] Failed to fetch shared camera photos:`, error);
        return {
          photos: [],
          nextPageParam: undefined,
        };
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageParam,
    staleTime: 1000 * 60 * 2, // 2 minutes - photos should be fairly fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch photos shared with a group of friends (multi-friend virtual album)
 * Uses friendGroupKey to identify photos shared with the same set of friends
 */
export function useSharedPhotosGroup(userId: string | null | undefined, friendGroupKey: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.SHARED_PHOTOS_GROUP(userId || "", friendGroupKey || ""),
    enabled: !!userId && !!friendGroupKey,
    queryFn: async (): Promise<DetailedPhoto[]> => {
      if (!friendGroupKey || !userId) return [];

      const currentUserId = userId;
      
      // Parse friend IDs from friendGroupKey
      const friendIds = friendGroupKey.split(',');

      console.log(
        `🔍 [SHARED_PHOTOS_GROUP_QUERY] Fetching photos shared with group: ${friendIds.join(', ')}`
      );

      // Get all user photos for current user and all friends in the group
      // For shared photos calculation, we need ALL photos, not paginated results
      const userPhotoPromises = [currentUserId, ...friendIds].map(id =>
        client.graphql({
          query: getAllUserPhotos,
          variables: { 
            userId: id,
            limit: 1000, // High limit to get all photos for shared calculation
          },
          authMode: "userPool",
        })
      );

      const userPhotoResults = await Promise.all(userPhotoPromises);

      // Build photo ID sets for each user (owned + received)
      const userPhotoSets = userPhotoResults.map((res) => {
        const owned = res.data?.owned?.items || [];
        const received = res.data?.received?.items || [];
        
        return new Set([
          ...owned.map((photo: any) => photo.id),
          ...received.map((item: any) => item.photoId),
        ]);
      });

      const currentUserPhotoIds = userPhotoSets[0];
      const friendPhotoSets = userPhotoSets.slice(1);

      // Find photos that the current user AND all friends have access to
      const sharedPhotoIds = Array.from(currentUserPhotoIds).filter(photoId =>
        friendPhotoSets.every(friendSet => friendSet.has(photoId))
      );

      if (sharedPhotoIds.length === 0) {
        console.log(`📷 [SHARED_PHOTOS_GROUP_QUERY] No shared photos found with group`);
        return [];
      }

      console.log(`📷 [SHARED_PHOTOS_GROUP_QUERY] Found ${sharedPhotoIds.length} shared photo IDs`);

      // Create photo lookup from owned photos (for metadata)
      const allOwnedPhotos = userPhotoResults.flatMap(res => res.data?.owned?.items || []);
      const photoLookup = new Map(allOwnedPhotos.map((photo: any) => [photo.id, photo]));

      // Generate signed URLs for shared photos
      const photosWithUrls = await Promise.all(
        sharedPhotoIds.map(async (photoId) => {
          const photoData = photoLookup.get(photoId);
          if (!photoData) {
            console.warn(`⚠️ Photo metadata not found for ${photoId}`);
            return null;
          }

          try {
            const { url } = await getUrl({
              key: photoData.s3Key,
              options: {
                accessLevel: "protected",
                targetIdentityId: photoData.ownerIdentityId,
              },
            });

            return {
              id: photoId,
              url: url.toString(),
              createdAt: photoData.createdAt,
              s3Key: photoData.s3Key,
              ownerIdentityId: photoData.ownerIdentityId,
              sharedCameraId: photoData.sharedCameraId,
              _version: photoData._version,
            } as DetailedPhoto;
          } catch (error) {
            console.error(`❌ Failed to get URL for photo ${photoId}:`, error);
            return null;
          }
        })
      );

      const validPhotos = photosWithUrls.filter((photo): photo is DetailedPhoto => photo !== null);

      // Sort by creation date (newest first)
      validPhotos.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      console.log(
        `✅ [SHARED_PHOTOS_GROUP_QUERY] Successfully loaded ${validPhotos.length} photos shared with group`
      );
      
      return validPhotos;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - shared photos should be fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to search users
 * Replaces the search logic in album.tsx
 */
export function useSearchUsers(searchQuery: string) {
  return useQuery({
    queryKey: QUERY_KEYS.SEARCH_USERS(searchQuery),
    queryFn: async (): Promise<UserItem[]> => {
      if (searchQuery.trim().length < 2) {
        return [];
      }

      const { username } = await getCurrentUser();

      const { data }: any = await client.graphql({
        query: searchUsers,
        variables: {
          filter: {
            displayName: { wildcard: `*${searchQuery.toLowerCase()}*` },
          },
        },
        authMode: "userPool",
      });

      const rawItems: UserItem[] = data.searchUsers.items || [];

      // Remove current user
      const withoutSelf = rawItems.filter((u) => u.id !== username);

      // Verify users exist in DynamoDB
      const verifiedUsers: UserItem[] = [];

      for (const user of withoutSelf) {
        try {
          const check = await client.graphql({
            query: getUser,
            variables: { id: user.id },
            authMode: "userPool",
          });

          if (check?.data?.getUser && !check.data.getUser._deleted) {
            const fullUser = check.data.getUser;
            let profilePhotoUrl: string | null = null;

            // Load profile photo if exists
            if (fullUser.profilePhotoKey) {
              try {
                const accessLevel = fullUser.profilePhotoKey.startsWith(
                  "public/"
                )
                  ? "guest"
                  : fullUser.profilePhotoKey.startsWith("protected/")
                  ? "protected"
                  : "guest";

                const urlResult = await getUrl({
                  key: fullUser.profilePhotoKey,
                  options: { accessLevel },
                });

                profilePhotoUrl = urlResult.url.toString();
              } catch (photoError) {
                console.warn(
                  `Failed to load profile photo for ${fullUser.displayName}:`,
                  photoError
                );
              }
            }

            verifiedUsers.push({
              id: user.id,
              displayName: fullUser.displayName,
              profilePhotoKey: fullUser.profilePhotoKey,
              profilePhotoUrl,
            });
          }
        } catch (err) {
          console.warn(`User ${user.id} does not exist in DynamoDB, skipping.`);
        }
      }

      return verifiedUsers;
    },
    enabled: searchQuery.trim().length >= 2, // Only search when query is long enough
    staleTime: 1000 * 60, // 1 minute for search results
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get current user ID consistently
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { username } = await getCurrentUser();
      return username;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - user ID doesn't change
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

/**
 * Cache access layer for photo detail screens
 */

/**
 * Hook to access cached camera data from useUserCameras
 * Used to get instant album context when navigating from album screen
 */
export function useCachedCameraData(userId: string | null | undefined, cameraId: string | null | undefined): CachedCameraData {
  const queryClient = useQueryClient();
  
  if (!cameraId || !userId) return null;
  
  // Get cached data from useUserCameras query
  const cachedCameras = queryClient.getQueryData<CamBlock[]>(
    QUERY_KEYS.USER_CAMERAS(userId)
  );
  
  if (!cachedCameras) return null;
  
  // Find the specific camera in cached data
  const cachedCamera = cachedCameras.find(camera => camera.cameraId === cameraId);
  
  return cachedCamera || null;
}

/**
 * Hook to fetch individual photo details
 * Used as fallback when cache is not available or for non-album photos
 */
export function useIndividualPhoto(photoId: string, thumbnailMode: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.PHOTO(photoId),
    queryFn: async (): Promise<DetailedPhoto | null> => {
      try {
        console.log(`🔍 [INDIVIDUAL_PHOTO] Fetching photo: ${photoId}`);
        
        const photoRes: any = await client.graphql({
          query: getPhoto,
          variables: { id: photoId },
          authMode: "userPool",
        });

        const photo = photoRes.data.getPhoto;
        if (!photo) {
          console.warn(`⚠️ [INDIVIDUAL_PHOTO] Photo not found: ${photoId}`);
          return null;
        }

        // Use cached URL for instant loading (thumbnailMode controls resolution)
        const url = await getCachedPhotoUrl(
          photo.id,
          photo.ownerIdentityId,
          photo.s3Key,
          photo.thumbKey,
          !thumbnailMode, // Use thumbnails when thumbnailMode is true
          photo.sharedCameraId,
          photo.ownerId
        );

        const detailedPhoto: DetailedPhoto = {
          id: photo.id,
          url,
          createdAt: photo.createdAt,
          s3Key: photo.s3Key,
          ownerIdentityId: photo.ownerIdentityId,
          sharedCameraId: photo.sharedCameraId,
          _version: photo._version,
        };

        console.log(`✅ [INDIVIDUAL_PHOTO] Successfully loaded photo: ${photoId}`);
        return detailedPhoto;
      } catch (error) {
        console.error(`❌ [INDIVIDUAL_PHOTO] Failed to fetch photo ${photoId}:`, error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - individual photos don't change often
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to fetch full album photos with proper DetailedPhoto type
 * Used when cache miss occurs or when we need full resolution photos
 */
export function useFullAlbumPhotos(cameraId: string | null | undefined, thumbnailMode: boolean = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CAMERA_PHOTOS(cameraId || ""), "detailed"],
    queryFn: async (): Promise<DetailedPhoto[]> => {
      if (!cameraId) return [];
      
      try {
        console.log(`🔍 [FULL_ALBUM] Fetching album photos for camera: ${cameraId}`);
        
        const photosRes: any = await client.graphql({
          query: photosBySharedCameraIdAndCreatedAt,
          variables: {
            sharedCameraId: cameraId,
            filter: { _deleted: { ne: true } },
            sortDirection: "DESC" as any,
          },
          authMode: "userPool",
        });

        const photos = await Promise.all(
          (photosRes.data.photosBySharedCameraIdAndCreatedAt.items || []).map(
            async (p: any) => {
              if (!p) return null;
              
              try {
                const url = await getCachedPhotoUrl(
                  p.id,
                  p.ownerIdentityId,
                  p.s3Key,
                  p.thumbKey,
                  !thumbnailMode, // thumbnailMode controls resolution
                  p.sharedCameraId,
                  p.ownerId
                );

                return {
                  id: p.id,
                  url,
                  createdAt: p.createdAt,
                  s3Key: p.s3Key,
                  ownerIdentityId: p.ownerIdentityId,
                  sharedCameraId: p.sharedCameraId,
                } as DetailedPhoto;
              } catch (error) {
                console.error(`❌ [FULL_ALBUM] Failed to load photo URL:`, error);
                return null;
              }
            }
          )
        );

        const validPhotos = photos.filter((p): p is DetailedPhoto => p !== null);
        console.log(`✅ [FULL_ALBUM] Successfully loaded ${validPhotos.length} photos`);
        return validPhotos;
      } catch (error) {
        console.error(`❌ [FULL_ALBUM] Failed to fetch album photos:`, error);
        return [];
      }
    },
    enabled: !!cameraId, // Only run if cameraId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Helper function to convert cached Photo to DetailedPhoto
 * Used to transform cache data to match photo detail screen requirements
 */
function convertCachedPhotoToDetailed(
  cachedPhoto: Photo, 
  ownerIdentityId: string, 
  s3Key: string,
  _version: number,
  sharedCameraId?: string
): DetailedPhoto {
  return {
    id: cachedPhoto.id,
    url: cachedPhoto.url,
    createdAt: cachedPhoto.createdAt,
    s3Key: s3Key,
    ownerIdentityId: ownerIdentityId,
    sharedCameraId: sharedCameraId,
    _version: _version,
  };
}

/**
 * Primary hook for photo detail screens
 * Combines cache access with fresh data fetching for optimal UX
 * Supports both shared camera albums and face-matched photo virtual albums
 */
export function usePhotoAlbumData(userId: string | null | undefined, photoId: string, cameraId?: string, friendId?: string, friendGroupKey?: string, thumbnailMode: boolean = false): PhotoAlbumContext {
  // Check cache for album context first
  const cachedCameraData = useCachedCameraData(userId, cameraId);

  // Use shared photos for virtual album when friendId is provided (face-matched photos)
  const { 
    data: sharedPhotosData = [], 
    isLoading: sharedPhotosLoading 
  } = useSharedPhotos(userId, friendId || null);

  // Use shared photos group for multi-friend virtual album when friendGroupKey is provided
  const { 
    data: sharedPhotosGroupData = [], 
    isLoading: sharedPhotosGroupLoading 
  } = useSharedPhotosGroup(userId, friendGroupKey || null);

  // If we have cache, try to avoid individual photo fetch for better performance
  const shouldFetchIndividual = !cachedCameraData || !cachedCameraData.photos.find(p => p.id === photoId);

  // Get individual photo details (only when needed)
  const {
    data: individualPhoto,
    isLoading: photoLoading
  } = useIndividualPhoto(photoId, thumbnailMode);

  // Determine effective camera ID (from param or photo data)
  const effectiveCameraId = cameraId || individualPhoto?.sharedCameraId;

  // Fetch full album if cache miss or no cache (only for shared camera photos)
  const {
    data: freshAlbumPhotos,
    isLoading: albumLoading
  } = useFullAlbumPhotos(!friendId && !friendGroupKey ? effectiveCameraId : null, thumbnailMode); // Skip if this is a friend virtual album

  // Fetch camera name if not in cache
  const { data: cameraInfo } = useQuery({
    queryKey: ["cameraInfo", effectiveCameraId],
    queryFn: async () => {
      if (!effectiveCameraId) return null;
      try {
        const cameraRes: any = await client.graphql({
          query: getSharedCamera,
          variables: { id: effectiveCameraId },
          authMode: "userPool",
        });
        return cameraRes.data.getSharedCamera;
      } catch (error) {
        console.error(`❌ Failed to fetch camera info:`, error);
        return null;
      }
    },
    enabled: !!effectiveCameraId && !cachedCameraData && !friendId && !friendGroupKey, // Skip if this is a friend virtual album
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Fetch friend info for virtual album name
  const { data: friendInfo } = useQuery({
    queryKey: ["friendInfo", friendId],
    queryFn: async () => {
      if (!friendId) return null;
      try {
        const friendRes: any = await client.graphql({
          query: getUser,
          variables: { id: friendId },
          authMode: "userPool",
        });
        return friendRes.data.getUser;
      } catch (error) {
        console.error(`❌ Failed to fetch friend info:`, error);
        return null;
      }
    },
    enabled: !!friendId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Fetch friend group info for multi-friend virtual album name
  const { data: friendGroupInfo } = useQuery({
    queryKey: ["friendGroupInfo", friendGroupKey],
    queryFn: async () => {
      if (!friendGroupKey) return null;
      const friendIds = friendGroupKey.split(',');
      
      try {
        // Fetch all friend names in parallel
        const friendPromises = friendIds.map(async (friendId) => {
          const friendRes: any = await client.graphql({
            query: getUser,
            variables: { id: friendId },
            authMode: "userPool",
          });
          return friendRes.data.getUser?.displayName || 'Friend';
        });
        
        const friendNames = await Promise.all(friendPromises);
        return friendNames;
      } catch (error) {
        console.error(`❌ Failed to fetch friend group info:`, error);
        return null;
      }
    },
    enabled: !!friendGroupKey,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Determine album source and data
  const albumSource: 'cache' | 'fresh' | 'none' = 
    (friendId && sharedPhotosData.length > 0) || (friendGroupKey && sharedPhotosGroupData.length > 0)
      ? 'fresh' // Virtual album from shared photos
      : cachedCameraData 
      ? 'cache' 
      : freshAlbumPhotos?.length 
      ? 'fresh' 
      : 'none';

  // Determine album name based on context
  const cameraName = friendGroupKey && friendGroupInfo
    ? `Photos with ${friendGroupInfo.join(', ')}` // Multi-friend virtual album name
    : friendId 
    ? `Photos with ${friendInfo?.displayName || 'Friend'}` // Single friend virtual album name
    : cachedCameraData?.name || cameraInfo?.name || "";

  // Build album photos array with smart cache utilization
  let albumPhotos: DetailedPhoto[] = [];
  
  if (friendGroupKey && sharedPhotosGroupData.length > 0) {
    // Multi-friend virtual album mode: Convert shared photos group to DetailedPhoto format
    console.log(`👥 [PHOTO_ALBUM_DATA] Building multi-friend virtual album with ${sharedPhotosGroupData.length} shared photos`);
    
    // sharedPhotosGroupData is now DetailedPhoto[] with complete data
    albumPhotos = sharedPhotosGroupData.map((sharedPhoto) => {
      // Use the already fetched individual photo data for current photo if available
      if (sharedPhoto.id === photoId && individualPhoto) {
        return individualPhoto;
      } else {
        // sharedPhoto is already a DetailedPhoto with real ownerIdentityId and s3Key
        return sharedPhoto;
      }
    });
  } else if (friendId && sharedPhotosData.length > 0) {
    // Single friend virtual album mode: Convert shared photos to DetailedPhoto format
    console.log(`👥 [PHOTO_ALBUM_DATA] Building single friend virtual album with ${sharedPhotosData.length} shared photos`);
    
    // sharedPhotosData is now DetailedPhoto[] with complete data
    albumPhotos = sharedPhotosData.map((sharedPhoto) => {
      // Use the already fetched individual photo data for current photo if available
      if (sharedPhoto.id === photoId && individualPhoto) {
        return individualPhoto;
      } else {
        // sharedPhoto is already a DetailedPhoto with real ownerIdentityId and s3Key
        return sharedPhoto;
      }
    });
  } else if (cachedCameraData && (individualPhoto || freshAlbumPhotos)) {
    // Shared camera album mode (existing logic)
    if (freshAlbumPhotos && freshAlbumPhotos.length > 0) {
      albumPhotos = freshAlbumPhotos;
      console.log(`🔄 [PHOTO_ALBUM_DATA] Using fresh album data: ${albumPhotos.length} photos (full details)`);
    } 
    else if (individualPhoto) {
      albumPhotos = cachedCameraData.photos.map(cachedPhoto => {
        if (cachedPhoto.id === individualPhoto.id) {
          return individualPhoto;
        } else {
          return convertCachedPhotoToDetailed(
            cachedPhoto,
            individualPhoto.ownerIdentityId,
            `cameras/${effectiveCameraId}/original/${cachedPhoto.id}.jpg`,
            individualPhoto._version,
            effectiveCameraId
          );
        }
      });
      console.log(`🎯 [PHOTO_ALBUM_DATA] Using cached album data: ${albumPhotos.length} photos (instant swiping enabled)`);
    }
  } else if (freshAlbumPhotos) {
    albumPhotos = freshAlbumPhotos;
    console.log(`🔄 [PHOTO_ALBUM_DATA] Using fresh album data: ${albumPhotos.length} photos`);
  } else if (individualPhoto) {
    // Single photo mode (no album context)
    albumPhotos = [individualPhoto];
    console.log(`📷 [PHOTO_ALBUM_DATA] Single photo mode`);
  }

  // Find current photo index
  const currentIndex = individualPhoto 
    ? albumPhotos.findIndex(photo => photo.id === photoId)
    : 0;

  // Ensure current photo is in album if we have individual photo data
  if (individualPhoto && currentIndex === -1 && albumPhotos.length > 0) {
    // Add current photo at correct position (by date)
    const currentPhotoDate = new Date(individualPhoto.createdAt).getTime();
    let insertIndex = 0;
    
    for (let i = 0; i < albumPhotos.length; i++) {
      const albumPhotoDate = new Date(albumPhotos[i].createdAt).getTime();
      if (currentPhotoDate > albumPhotoDate) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    albumPhotos.splice(insertIndex, 0, individualPhoto);
    console.log(`📍 [PHOTO_ALBUM_DATA] Inserted current photo at index ${insertIndex}`);
  }

  const finalCurrentIndex = individualPhoto 
    ? albumPhotos.findIndex(photo => photo.id === photoId)
    : 0;

  return {
    currentPhoto: individualPhoto || null,
    albumPhotos,
    currentIndex: Math.max(0, finalCurrentIndex),
    cameraName,
    albumSource,
    isLoadingAlbum: photoLoading || albumLoading || sharedPhotosLoading || sharedPhotosGroupLoading,
  };
}

/**
 * Infinite query for shared camera photos in me.tsx
 * Fetches from ALL cameras in parallel and merges results chronologically
 * Uses pagination tokens for each camera to enable true server-side pagination
 */
export function useInfiniteMultiSharedCameraPhotos(userId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.INFINITE_MULTI_SHARED_CAMERA_PHOTOS(userId || ""),
    enabled: !!userId,
    queryFn: async ({ pageParam }: { pageParam?: { cameraTokens: Record<string, string | undefined>; cameraIds: string[]; cameraInfoMap: Record<string, { id: string; name: string }> } }) => {
      if (!userId) throw new Error("User ID is required");
      
      console.log(`🔍 [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Fetching shared camera photos for user: ${userId}, page:`, pageParam ? 'continuation' : 'first page');

      try {
        const photosPerPage = 20;
        let cameraIds: string[] = [];
        let cameraInfoMap: Record<string, { id: string; name: string }> = {};
        let cameraTokens: Record<string, string | undefined> = {};

        // First page - get camera memberships and info
        if (!pageParam) {
          const membershipsRes: any = await client.graphql({
            query: sharedCameraMembersByUserIdAndCameraId,
            variables: {
              userId: userId,
              filter: { role: { ne: "INVITED" } }
            },
            authMode: "userPool",
          });

          cameraIds = Array.from(
            new Set<string>(
              membershipsRes.data.sharedCameraMembersByUserIdAndCameraId.items.map(
                (r: any) => r.cameraId
              )
            )
          );

          if (cameraIds.length === 0) {
            console.log(`📷 [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] No shared cameras found`);
            return {
              photos: [],
              nextPageParam: undefined,
            };
          }

          console.log(`📷 [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Found ${cameraIds.length} shared cameras`);

          // Fetch camera info
          const cameraPromises = cameraIds.map(async (cameraId) => {
            try {
              const { data }: any = await client.graphql({
                query: getSharedCamera,
                variables: { id: cameraId },
                authMode: "userPool",
              });
              const camera = data.getSharedCamera;
              return camera ? { id: cameraId, name: camera.name } : { id: cameraId, name: `Camera ${cameraId.substring(0, 8)}` };
            } catch (error) {
              console.warn(`⚠️ [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Failed to fetch camera: ${cameraId}`);
              return { id: cameraId, name: `Camera ${cameraId.substring(0, 8)}` };
            }
          });

          const cameras = await Promise.all(cameraPromises);
          cameras.forEach((camera) => {
            cameraInfoMap[camera.id] = camera;
          });

          // Initialize tokens as undefined for all cameras
          cameraIds.forEach(cameraId => {
            cameraTokens[cameraId] = undefined;
          });
        } else {
          // Subsequent pages - use cached info from pageParam
          cameraIds = pageParam.cameraIds;
          cameraInfoMap = pageParam.cameraInfoMap;
          cameraTokens = pageParam.cameraTokens;
        }

        // Fetch photos from ALL cameras in PARALLEL
        const cameraPhotoPromises = cameraIds.map(async (cameraId) => {
          // Skip cameras that have no more photos
          if (cameraTokens[cameraId] === null) {
            return { cameraId, photos: [], nextToken: null };
          }

          try {
            const photosRes: any = await client.graphql({
              query: photosBySharedCameraIdAndCreatedAt,
              variables: {
                sharedCameraId: cameraId,
                filter: { _deleted: { ne: true } },
                sortDirection: "DESC" as any,
                limit: Math.max(5, Math.ceil(photosPerPage / cameraIds.length)), // At least 5 photos per camera
                nextToken: cameraTokens[cameraId],
              },
              authMode: "userPool",
            });

            const cameraInfo = cameraInfoMap[cameraId];
            const cameraName = cameraInfo?.name || `Camera ${cameraId.substring(0, 8)}`;
            const rawPhotos = photosRes.data.photosBySharedCameraIdAndCreatedAt.items || [];
            const nextToken = photosRes.data.photosBySharedCameraIdAndCreatedAt.nextToken;

            // Generate cached URLs
            const photoResults = await Promise.all(
              rawPhotos.map(async (photo: any) => {
                try {
                  const url = await getCachedPhotoUrl(
                    photo.id,
                    photo.ownerIdentityId,
                    photo.s3Key,
                    photo.thumbKey,
                    false, // Use thumbnails for grid view
                    cameraId,
                    photo.ownerId
                  );

                  return {
                    id: photo.id,
                    url,
                    createdAt: photo.createdAt,
                    source: (photo.ownerId === userId ? "owned" : "shared") as MyPhoto["source"],
                    cameraName,
                    cameraId,
                  } as MyPhoto;
                } catch (error) {
                  console.warn(`⚠️ [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Failed to get URL for photo ${photo.id}:`, error);
                  return null;
                }
              })
            );

            return {
              cameraId,
              photos: photoResults.filter(Boolean) as MyPhoto[],
              nextToken: nextToken || null, // Use null to indicate no more photos
            };
          } catch (cameraError) {
            console.warn(`⚠️ [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Failed to fetch photos for camera ${cameraId}:`, cameraError);
            return {
              cameraId,
              photos: [],
              nextToken: null,
            };
          }
        });

        const cameraResults = await Promise.all(cameraPhotoPromises);
        
        // Combine all photos and sort by date (newest first)
        const allNewPhotos = cameraResults.flatMap(result => result.photos);
        allNewPhotos.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Take only the requested number of photos
        const photosToReturn = allNewPhotos.slice(0, photosPerPage);

        // Update camera tokens for next page
        const updatedCameraTokens: Record<string, string | undefined> = {};
        cameraResults.forEach(result => {
          updatedCameraTokens[result.cameraId] = result.nextToken === null ? null : result.nextToken;
        });

        // Check if any camera has more photos (not null)
        const hasMorePhotos = cameraResults.some(result => result.nextToken !== null);

        const nextPageParam = hasMorePhotos ? {
          cameraTokens: updatedCameraTokens,
          cameraIds,
          cameraInfoMap,
        } : undefined;

        console.log(`✅ [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Successfully loaded ${photosToReturn.length} photos from ${cameraIds.length} cameras, hasMore: ${!!nextPageParam}`);

        return {
          photos: photosToReturn,
          nextPageParam,
        };
      } catch (error) {
        console.error(`❌ [INFINITE_MULTI_SHARED_CAMERA_PHOTOS] Failed to fetch shared camera photos:`, error);
        return {
          photos: [],
          nextPageParam: undefined,
        };
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageParam,
    staleTime: 1000 * 60 * 2, // 2 minutes - photos should be fairly fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}