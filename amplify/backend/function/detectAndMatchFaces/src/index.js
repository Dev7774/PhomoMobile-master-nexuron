/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	API_PHOMOAPI_GRAPHQLAPIIDOUTPUT
	API_PHOMOAPI_GRAPHQLAPIENDPOINTOUTPUT
	API_PHOMOAPI_GRAPHQLAPIKEYOUTPUT
	STORAGE_PHOMOPHOTOS_BUCKETNAME
	FACE_COLLECTION
Amplify Params - DO NOT EDIT */

import {
  RekognitionClient,
  IndexFacesCommand,
  SearchUsersCommand,
  DeleteFacesCommand,
} from "@aws-sdk/client-rekognition";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import fetch, { Request as FetchRequest } from "node-fetch";
import crypto from "@aws-crypto/sha256-js";

const REGION = process.env.REGION || "us-east-1";
const GRAPHQL = process.env.API_PHOMOAPI_GRAPHQLAPIENDPOINTOUTPUT;
const BUCKET = process.env.STORAGE_PHOMOPHOTOS_BUCKETNAME;
const COLL_ID = process.env.FACE_COLLECTION;

const rekog = new RekognitionClient({ region: REGION });

/* helper to call AppSync with SigV4 */
async function callGraphQL({ query, variables }) {
  const { Sha256 } = crypto;
  const endpoint = new URL(GRAPHQL);

  /* sign request */
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: "appsync",
    sha256: Sha256,
  });

  const reqToSign = new HttpRequest({
    method: "POST",
    headers: { "content-type": "application/json", host: endpoint.host },
    hostname: endpoint.host,
    path: endpoint.pathname,
    body: JSON.stringify({ query, variables }),
  });

  const signed = await signer.sign(reqToSign);
  const res = await fetch(new FetchRequest(endpoint, signed));
  const json = await res.json();

  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

/* get shared camera members list - includes ALL members (even INVITED) for face matching */
async function getCameraMemberIds(sharedCameraId) {
  const GET_CAMERA_MEMBERS = /* GraphQL */ `
    query GetCameraMembers($cameraId: ID!) {
      sharedCameraMembersByCameraIdAndUserId(cameraId: $cameraId) {
        items {
          userId
          role
          _deleted
        }
      }
    }
  `;

  const { sharedCameraMembersByCameraIdAndUserId } = await callGraphQL({
    query: GET_CAMERA_MEMBERS,
    variables: { cameraId: sharedCameraId },
  });

  /* include ALL members (including INVITED) but filter out deleted ones */
  const members = sharedCameraMembersByCameraIdAndUserId.items
    .filter(member => !member._deleted)
    .map(member => member.userId);

  return [...new Set(members)]; // remove duplicates
}

/* get user's friends list */
async function getFriendUserIds(ownerId) {
  const GET_FRIENDS = /* GraphQL */ `
    query GetFriends($ownerId: ID!) {
      friendshipsByOwnerIdAndFriendId(
        ownerId: $ownerId
        filter: { status: { eq: "ACCEPTED" } }
      ) {
        items {
          friendId
        }
      }
      friendshipsByFriendIdAndOwnerId(
        friendId: $ownerId
        filter: { status: { eq: "ACCEPTED" } }
      ) {
        items {
          ownerId
        }
      }
    }
  `;

  const {
    friendshipsByOwnerIdAndFriendId,
    friendshipsByFriendIdAndOwnerId,
  } = await callGraphQL({
    query: GET_FRIENDS,
    variables: { ownerId },
  });

  /* combine both directions of friendships */
  const friends = [
    ...friendshipsByOwnerIdAndFriendId.items.map((f) => f.friendId),
    ...friendshipsByFriendIdAndOwnerId.items.map((f) => f.ownerId),
  ];

  return [...new Set(friends)]; // remove duplicates
}

/* validate photo exists and belongs to owner */
async function validatePhoto(photoId, ownerId) {
  const GET_PHOTO = /* GraphQL */ `
    query GetPhoto($id: ID!) {
      getPhoto(id: $id) {
        id
        ownerId
        s3Key
      }
    }
  `;

  const { getPhoto } = await callGraphQL({
    query: GET_PHOTO,
    variables: { id: photoId },
  });

  if (!getPhoto) {
    throw new Error(`Photo ${photoId} not found`);
  }

  if (getPhoto.ownerId !== ownerId) {
    throw new Error(`Photo ${photoId} does not belong to user ${ownerId}`);
  }

  return getPhoto;
}

/**  Lambda entry point – invoked by AppSync @function resolver */
export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event));
  const { photoId, s3Key, ownerId, sharedCameraId } = event.arguments;

  console.log({ REGION, BUCKET, s3Key, COLL_ID });
  console.log(ownerId, typeof ownerId);

  try {
    /* ── 1. validate photo ownership ─────────────────────── */
    await validatePhoto(photoId, ownerId);

    /* ── 2. get target users list (friends or camera members) ──────────────────────── */
    let targetUserIds = [];
    let matchingType = '';
    
    if (sharedCameraId) {
      // Shared camera photo - match against camera members (including invited)
      targetUserIds = await getCameraMemberIds(sharedCameraId);
      matchingType = 'camera members';
      console.log(`Found ${targetUserIds.length} camera members for camera ${sharedCameraId}`);
    } else {
      // Face-match photo - match against friends
      targetUserIds = await getFriendUserIds(ownerId);
      matchingType = 'friends';
      console.log(`Found ${targetUserIds.length} friends for user ${ownerId}`);
    }

    if (targetUserIds.length === 0) {
      return {
        facesDetected: 0,
        friendsMatched: 0,
        matches: [],
      };
    }

    /* ── 3. temporarily index all faces in the photo ───── */
    const { FaceRecords } = await rekog.send(
      new IndexFacesCommand({
        CollectionId: COLL_ID,
        Image: { S3Object: { Bucket: BUCKET, Name: s3Key } },
        QualityFilter: "AUTO",
        MaxFaces: 20,
      })
    );

    console.log(`Detected ${FaceRecords.length} faces in photo`);

    const matches = [];
    const tempFaceIds = [];

    try {
      /* ── 4. search users for each detected face ────────── */
      for (const faceRecord of FaceRecords) {
        const faceId = faceRecord.Face.FaceId;
        tempFaceIds.push(faceId);

        const { UserMatches } = await rekog.send(
          new SearchUsersCommand({
            CollectionId: COLL_ID,
            FaceId: faceId,
            UserMatchThreshold: 85.0,
            MaxUsers: 5,
          })
        );

        /* ── 5. filter matches to only include target users (friends or camera members) ─────── */
        for (const match of UserMatches) {
          if (targetUserIds.includes(match.User.UserId)) {
            matches.push({
              userId: match.User.UserId,
              confidence: match.Similarity,
              boundingBox: {
                left: faceRecord.FaceDetail.BoundingBox.Left,
                top: faceRecord.FaceDetail.BoundingBox.Top,
                width: faceRecord.FaceDetail.BoundingBox.Width,
                height: faceRecord.FaceDetail.BoundingBox.Height,
              },
            });
          }
        }
      }

      console.log(`Matched ${matches.length} ${matchingType} in photo`);

      return {
        facesDetected: FaceRecords.length,
        friendsMatched: matches.length,
        matches: matches,
      };
    } finally {
      /* ── 6. clean up: delete temporary face IDs ────────── */
      if (tempFaceIds.length > 0) {
        await rekog.send(
          new DeleteFacesCommand({
            CollectionId: COLL_ID,
            FaceIds: tempFaceIds,
          })
        );
        console.log(`Cleaned up ${tempFaceIds.length} temporary face IDs`);
      }
    }
  } catch (err) {
    console.error("Error processing photo faces:", err);
    throw err;
  }
};
