import { useQuery } from "@tanstack/react-query";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import {
  getSharedCamera,
  sharedCameraMembersByUserIdAndCameraId,
  sharedCameraMembersByCameraIdAndUserId,
  getUser,
} from "@/src/graphql/queries";

const client = generateClient();

// Query keys for consistent cache management
export const CAMERA_QUERY_KEYS = {
  USER_CAMERA_MEMBERSHIPS: (userId: string) => [
    "userCameraMemberships",
    userId,
  ],
  CAMERA_INVITES_AND_MEMBERSHIPS: (userId: string) => [
    "cameraInvitesAndMemberships",
    userId,
  ],
  CAMERA_MEMBERS: (cameraId: string) => ["cameraMembers", cameraId],
} as const;

/**
 * Hook to fetch user's camera memberships for camera picker
 * Used in camera.tsx - returns cameras user can post to (excludes INVITED)
 */
export function useUserCameraMemberships(userId: string | null | undefined) {
  return useQuery({
    queryKey: CAMERA_QUERY_KEYS.USER_CAMERA_MEMBERSHIPS(userId || ""),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      const me = userId;

      console.log(
        `🔍 [CAMERA_MEMBERSHIPS] Fetching camera memberships for: ${me}`
      );

      const res: any = await client.graphql({
        query: sharedCameraMembersByUserIdAndCameraId,
        variables: {
          userId: me,
          filter: {
            role: { ne: "INVITED" },
            _deleted: { ne: true }
          },
          limit: 50,
        },
        authMode: "userPool",
      });

      const rows = res.data.sharedCameraMembersByUserIdAndCameraId.items;

      // Fetch camera names
      const ids = Array.from(new Set<string>(rows.map((r: any) => r.cameraId)));
      const cameras = await Promise.all(
        ids.map((id) =>
          client
            .graphql({
              query: getSharedCamera,
              variables: { id },
            })
            .then((res: any) => res.data.getSharedCamera)
            .catch(() => null)
        )
      );

      const cameraRows = cameras
        .filter((cam) => cam !== null && cam._deleted !== true)
        .map((cam: any) => ({
          cameraId: cam.id,
          name: cam.name,
        }));

      console.log(`✅ [CAMERA_MEMBERSHIPS] Found ${cameraRows.length} cameras`);
      return cameraRows;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to fetch user's camera invites and memberships for cameraModal
 * Used in cameraModal.tsx - returns both invites and accepted cameras
 */
export function useCameraInvitesAndMemberships(userId: string | null | undefined) {
  return useQuery({
    queryKey: CAMERA_QUERY_KEYS.CAMERA_INVITES_AND_MEMBERSHIPS(userId || ""),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      const me = userId;

      console.log(
        `🔍 [CAMERA_INVITES] Fetching invites and memberships for: ${me}`
      );

      // Get membership rows (exclude deleted)
      const mRes: any = await client.graphql({
        query: sharedCameraMembersByUserIdAndCameraId,
        variables: {
          userId: me,
          filter: { _deleted: { ne: true } },
        },
      });

      const rows = mRes.data.sharedCameraMembersByUserIdAndCameraId.items;

      // Fetch all cameras referenced
      const ids = Array.from(new Set<string>(rows.map((r: any) => r.cameraId)));

      const cams = await Promise.all(
        ids.map(async (id) => {
          try {
            const res: any = await client.graphql({
              query: getSharedCamera,
              variables: { id },
            });
            return res.data.getSharedCamera;
          } catch (err) {
            console.warn(`Failed to fetch camera ${id}:`, err);
            return { id, name: `Camera ${id}` }; // Fallback name
          }
        })
      );

      const camMap = Object.fromEntries(
        cams.filter((c) => c && c._deleted !== true).map((c: any) => [c.id, c.name])
      );

      // Attach name to each membership row, but only for cameras that exist and aren't deleted
      const enrichedRows = rows
        .filter((r: any) => camMap[r.cameraId]) // Only include if camera exists and isn't deleted
        .map((r: any) => ({
          ...r,
          name: camMap[r.cameraId],
        }));

      // Split by role
      const invites = enrichedRows.filter((r: any) => r.role === "INVITED");
      const myCamsRaw = enrichedRows.filter((r: any) => r.role !== "INVITED");

      // Deduplicate myCams by cameraId (keep the first/newest membership for each camera)
      const cameraMap = new Map<string, any>();
      myCamsRaw.forEach((cam: any) => {
        // Only add if we haven't seen this camera yet, or if this one is newer
        if (!cameraMap.has(cam.cameraId)) {
          cameraMap.set(cam.cameraId, cam);
        } else {
          // If duplicate, keep the one with newer createdAt or higher version
          const existing = cameraMap.get(cam.cameraId);
          if (cam.createdAt > existing.createdAt || cam._version > existing._version) {
            cameraMap.set(cam.cameraId, cam);
            console.warn(`⚠️ [CAMERA_INVITES] Replaced duplicate membership for camera ${cam.cameraId}`);
          } else {
            console.warn(`⚠️ [CAMERA_INVITES] Skipped duplicate membership for camera ${cam.cameraId}`);
          }
        }
      });

      const myCams = Array.from(cameraMap.values());

      if (myCamsRaw.length !== myCams.length) {
        console.warn(`⚠️ [CAMERA_INVITES] Removed ${myCamsRaw.length - myCams.length} duplicate memberships`);
      }

      console.log(
        `✅ [CAMERA_INVITES] Found ${invites.length} invites, ${myCams.length} cameras`
      );

      return {
        invites,
        myCams,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - invites should be fresh
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch camera members with user details for camera/[camId]/index.tsx
 * Returns detailed member information including names and profile photos
 */
export function useCameraMembers(cameraId: string) {
  return useQuery({
    queryKey: CAMERA_QUERY_KEYS.CAMERA_MEMBERS(cameraId),
    queryFn: async () => {
      console.log(
        `🔍 [CAMERA_MEMBERS] Fetching members for camera: ${cameraId}`
      );

      // Get membership rows
      const memRes: any = await client.graphql({
        query: sharedCameraMembersByCameraIdAndUserId,
        variables: { cameraId, limit: 50 },
      });
      const allRows = memRes.data.sharedCameraMembersByCameraIdAndUserId.items;

      // Filter out deleted and declined members
      const rows = allRows.filter(
        (r: any) => !r._deleted && r.role !== "DECLINED"
      );

      console.log(`Active members: ${rows.length}/${allRows.length}`);

      // Batch fetch user details
      const ids = Array.from(new Set<string>(rows.map((r: any) => r.userId)));
      const membersData = [];

      for (const uid of ids) {
        try {
          const userRes: any = await client.graphql({
            query: getUser,
            variables: { id: uid },
          });

          const user = userRes.data.getUser;
          if (!user) continue;

          let profilePhotoUrl: string | null = null;

          // Load profile photo if exists
          if (user.profilePhotoKey) {
            try {
              const urlResult = await getUrl({
                key: user.profilePhotoKey,
                options: { accessLevel: "guest" },
              });

              profilePhotoUrl = urlResult.url.toString();
            } catch (photoError) {
              console.error(
                `❌ Failed to load profile photo for ${user.displayName}:`,
                photoError
              );
              profilePhotoUrl = null;
            }
          }

          // Find the role for this user
          const membershipRow = rows.find((r: any) => r.userId === uid);
          const role = membershipRow?.role || "MEMBER";

          membersData.push({
            userId: uid,
            role: role,
            name: user.displayName ?? "Unnamed",
            profilePhotoUrl,
          });
        } catch (userError) {
          console.error(`❌ Failed to fetch user ${uid}:`, userError);
        }
      }

      // Sort members: ADMIN first, then MEMBER
      const roleOrder = { ADMIN: 0, MEMBER: 1 };
      membersData.sort((a, b) => {
        const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 2;
        const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });

      console.log(`✅ [CAMERA_MEMBERS] Found ${membersData.length} members`);
      return membersData;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Helper function to get camera name from cached data
 * Used in camera/[camId]/index.tsx to avoid refetching camera details
 */
export function useCachedCameraName(userId: string | null | undefined, cameraId: string): string | null {
  const { data } = useCameraInvitesAndMemberships(userId);

  if (!data) return null;

  // Look in myCams first (most likely location)
  const myCamera = data.myCams.find((cam: any) => cam.cameraId === cameraId);
  if (myCamera) return myCamera.name;

  // Fallback: check invites (edge case)
  const inviteCamera = data.invites.find(
    (invite: any) => invite.cameraId === cameraId
  );
  if (inviteCamera) return inviteCamera.name;

  return null;
}
