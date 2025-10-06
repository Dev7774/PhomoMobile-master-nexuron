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
  AssociateFacesCommand,
  SearchUsersCommand,
} from "@aws-sdk/client-rekognition";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import fetch, { Request as FetchRequest } from "node-fetch";
import crypto from "@aws-crypto/sha256-js";

const REGION = process.env.AWS_REGION || "us-east-1";
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

/**  Lambda entry point – invoked by AppSync @function resolver */
export const handler = async (event) => {
  console.log("UPDATE USER FACE EVENT:", JSON.stringify(event));
  const { userId, s3Key } = event.arguments;

  console.log({ REGION, BUCKET, s3Key, COLL_ID });
  console.log("Updating face for userId:", userId, typeof userId);

  try {
    /* ── 1. index the new face from S3 ─────────────────────────────── */
    console.log("Indexing face from S3 object:", {
      Bucket: BUCKET,
      Name: s3Key,
    });

    /* ── 3. get current user data for version and face count ─────────── */
    const GET_USER = /* GraphQL */ `
      query GetUser($id: ID!) {
        getUser(id: $id) {
          id
          _version
          faceCount
          primaryFaceId
        }
      }
    `;

    const { getUser } = await callGraphQL({
      query: GET_USER,
      variables: { id: userId },
    });

    if (!getUser) {
      throw new Error(`User with id ${userId} not found`);
    }

    const nextVersion = getUser._version;
    const currentCount = getUser.faceCount ?? 0;
    const nextCount = currentCount + 1;
    // Keep existing primaryFaceId, don't overwrite it with new face
    const primaryFaceId = getUser.primaryFaceId;

    console.log("Current user data:", {
      version: nextVersion,
      currentCount,
      nextCount,
      primaryFaceId,
    });

    console.log("Indexing faces from S3 object:", {
      Bucket: BUCKET,
      Name: s3Key,
    });

    const { FaceRecords } = await rekog.send(
      new IndexFacesCommand({
        CollectionId: COLL_ID,
        Image: { S3Object: { Bucket: BUCKET, Name: s3Key } },
        QualityFilter: "AUTO",
      })
    );

    if (!FaceRecords || FaceRecords.length === 0) {
      throw new Error("No faces detected in uploaded image");
    }

    console.log(`Found ${FaceRecords.length} face(s) in the image`);

    let faceIdToAssociate = null;
    const CONFIDENCE_THRESHOLD = 90;
    const MAX_USERS = 10;

    for (const faceRecord of FaceRecords) {
      const detectedFaceId = faceRecord.Face.FaceId;
      console.log(`Searching for user matches for face: ${detectedFaceId}`);

      try {
        const searchUsersResult = await rekog.send(
          new SearchUsersCommand({
            CollectionId: COLL_ID,
            FaceId: detectedFaceId,
            UserMatchThreshold: CONFIDENCE_THRESHOLD,
            MaxUsers: MAX_USERS,
          })
        );

        console.log(`Search result for face ${detectedFaceId}:`, {
          searchedFace: searchUsersResult.SearchedFace?.FaceId,
          userMatches: searchUsersResult.UserMatches?.length || 0,
        });

        if (searchUsersResult.UserMatches) {
          for (const userMatch of searchUsersResult.UserMatches) {
            console.log(
              `Checking match: ${userMatch.User.UserId} (confidence: ${userMatch.Similarity}%)`
            );

            if (userMatch.User.UserId === userId) {
              console.log(
                `✅ Found matching face for user ${userId} with confidence ${userMatch.Similarity}%`
              );
              faceIdToAssociate = detectedFaceId;
              break;
            }
          }
        }

        if (faceIdToAssociate) {
          break;
        }
      } catch (searchError) {
        console.warn(
          `Search failed for face ${detectedFaceId}:`,
          searchError.message
        );
        continue;
      }
    }

    if (!faceIdToAssociate) {
      console.log("⚠️ No matching faces found for this user. This could be:");
      console.log("1. A new angle/lighting condition for the existing user");
      console.log("2. A photo of a different person");
      console.log("3. Poor quality image that doesn't match well");

      throw new Error(
        "No faces in this image match the existing user profile. " +
          "Please ensure the photo clearly shows the same person as your profile."
      );
    }

    console.log(`Associating face ${faceIdToAssociate} with user ${userId}`);

    await rekog.send(
      new AssociateFacesCommand({
        CollectionId: COLL_ID,
        UserId: userId,
        FaceIds: [faceIdToAssociate],
      })
    );

    console.log("Face associated successfully with user");

    console.log("Current user data:", {
      version: nextVersion,
      currentCount: getUser.faceCount,
      nextCount,
      primaryFaceId,
    });

    /* ── 4. update user with incremented face count ──────────────────── */
    const UPDATE_USER = /* GraphQL */ `
      mutation UpdateUser($input: UpdateUserInput!) {
        updateUser(input: $input) {
          id
          faceCount
          primaryFaceId
          _version
        }
      }
    `;

    const updateResult = await callGraphQL({
      query: UPDATE_USER,
      variables: {
        input: {
          id: userId,
          _version: nextVersion,
          faceCount: nextCount,
          // Keep the existing primaryFaceId, don't overwrite
          primaryFaceId: primaryFaceId,
        },
      },
    });

    console.log("User updated successfully:", updateResult);

    /* return success indicator */
    return {
      success: true,
      faceId: faceIdToAssociate,
      newFaceCount: nextCount,
      message: "Face added successfully to existing user",
    };
  } catch (error) {
    console.error("Error in updateUserFace:", error);

    // Return error info for debugging
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
};
