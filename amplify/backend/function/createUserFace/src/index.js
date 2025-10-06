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
  CreateUserCommand,
  IndexFacesCommand,
  AssociateFacesCommand,
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
  console.log("EVENT:", JSON.stringify(event));
  const { userId, s3Key } = event.arguments;

  console.log({ REGION, BUCKET, s3Key, COLL_ID });
  console.log(userId, typeof userId);

  /* ── 1. ensure Rekognition User exists ─────────────────────── */
  console.log("About to create user with params:", {
    CollectionId: COLL_ID,
    UserId: userId,
  });
  try {
    await rekog.send(
      new CreateUserCommand({ CollectionId: COLL_ID, UserId: userId })
    );
  } catch (err) {
    throw err;
  }

  console.log("HERE");

  /* ── 2. index the face from S3 ─────────────────────────────── */
  const { FaceRecords } = await rekog.send(
    new IndexFacesCommand({
      CollectionId: COLL_ID,
      Image: { S3Object: { Bucket: BUCKET, Name: s3Key } },
      QualityFilter: "AUTO",
    })
  );
  const faceId = FaceRecords?.[0]?.Face?.FaceId;
  if (!faceId) throw new Error("No face detected in onboarding image");

  /* ── 3. associate the face with the user vector ────────────── */
  await rekog.send(
    new AssociateFacesCommand({
      CollectionId: COLL_ID,
      UserId: userId,
      FaceIds: [faceId],
    })
  );

  const GET_VERSION = /* GraphQL */ `
    query GetUser($id: ID!) {
      getUser(id: $id) {
        id
        _version
        faceCount
      }
    }
  `;

  const { getUser } = await callGraphQL({
    query: GET_VERSION,
    variables: { id: userId },
  });

  const nextVersion = getUser ? getUser._version : 1;
  const nextCount = (getUser?.faceCount ?? 0) + 1;

  /* 2️⃣ full update mutation – now includes _version */
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

  await callGraphQL({
    query: UPDATE_USER,
    variables: {
      input: {
        id: userId,
        _version: nextVersion, // ✅ required
        faceCount: nextCount, // ✅ incremented
        primaryFaceId: faceId,
      },
    },
  });

  /* return object must satisfy the User type so the resolver works */
  return true;
};
