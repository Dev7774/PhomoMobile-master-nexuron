/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	API_PHOMOAPI_GRAPHQLAPIIDOUTPUT
	API_PHOMOAPI_GRAPHQLAPIENDPOINTOUTPUT
	API_PHOMOAPI_GRAPHQLAPIKEYOUTPUT
	JWT_SECRET
Amplify Params - DO NOT EDIT */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';

const GRAPHQL_ENDPOINT = process.env.API_PHOMOAPI_GRAPHQLAPIENDPOINTOUTPUT;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const { Sha256 } = crypto;

/**
 * Helper function to call AppSync GraphQL API with SigV4 authentication
 */
async function callGraphQL({ query, variables }) {
  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: AWS_REGION,
    service: 'appsync',
    sha256: Sha256
  });

  const requestToBeSigned = new HttpRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.host
    },
    hostname: endpoint.host,
    body: JSON.stringify({ query, variables }),
    path: endpoint.pathname
  });

  const signed = await signer.sign(requestToBeSigned);
  const request = new Request(endpoint, signed);

  try {
    const response = await fetch(request);
    const body = await response.json();
    
    if (body.errors) {
      console.error('GraphQL errors:', body.errors);
      throw new Error(body.errors[0].message);
    }
    
    return body.data;
  } catch (error) {
    console.error('Error calling GraphQL:', error);
    throw error;
  }
}

/**
 * Handler for accepting camera invites
 * Validates JWT token and adds user to SharedCameraMember table
 */
export const handler = async (event) => {
  console.log(`🔗 [LAMBDA] EVENT: ${JSON.stringify(event, null, 2)}`);
  
  const { token, userId } = event.arguments;
  console.log(`🔗 [LAMBDA] Extracted arguments - token: ${token ? 'present' : 'missing'}, userId: ${userId}`);
  
  if (!token || !userId) {
    console.error(`❌ [LAMBDA] Missing required fields - token: ${!!token}, userId: ${!!userId}`);
    throw new Error('Missing required fields: token, userId');
  }
  
  const jwtSecret = process.env.JWT_SECRET;
  console.log(`🔗 [LAMBDA] JWT_SECRET configured: ${!!jwtSecret}`);
  
  if (!jwtSecret) {
    console.error(`❌ [LAMBDA] JWT_SECRET environment variable is not configured`);
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  
  let decoded;
  
  try {
    console.log(`🔗 [LAMBDA] Attempting to verify JWT token`);
    // Verify and decode the JWT token
    decoded = jwt.verify(token, jwtSecret, {
      issuer: 'phomo-app'
    });
    console.log(`✅ [LAMBDA] JWT verified successfully:`, decoded);
  } catch (error) {
    console.error(`❌ [LAMBDA] JWT verification failed:`, error);
    if (error.name === 'TokenExpiredError') {
      throw new Error('Invite link has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid invite link');
    }
    throw error;
  }
  
  const { cameraId, cameraName, inviterUserId, inviterName, type } = decoded;
  console.log(`🔗 [LAMBDA] Decoded invite data - cameraId: ${cameraId}, cameraName: ${cameraName}, inviterUserId: ${inviterUserId}, type: ${type}`);
  
  // Verify this is a camera invite token
  if (type !== 'camera_invite') {
    console.error(`❌ [LAMBDA] Invalid token type: ${type}`);
    throw new Error('Invalid token type');
  }
  
  console.log(`🔗 [LAMBDA] User ${userId} accepting invite to camera ${cameraId} from ${inviterUserId}`);
  
  // First, check if user is already a member using the byCamera index
  const CHECK_MEMBERSHIP = /* GraphQL */ `
    query CheckMembership($cameraId: ID!, $userId: ID!) {
      listSharedCameraMembers(
        filter: {
          and: [
            { cameraId: { eq: $cameraId } }
            { userId: { eq: $userId } }
          ]
        }
        limit: 1
      ) {
        items {
          id
          role
        }
      }
    }
  `;
  
  console.log(`🔍 [LAMBDA] Checking existing membership for user ${userId} in camera ${cameraId}`);
  const membershipCheck = await callGraphQL({
    query: CHECK_MEMBERSHIP,
    variables: { cameraId, userId }
  });
  console.log(`🔍 [LAMBDA] Membership check result:`, membershipCheck);
  
  // If user is already a member, return success with existing status
  if (membershipCheck.listSharedCameraMembers?.items?.length > 0) {
    const existingMember = membershipCheck.listSharedCameraMembers.items[0];
    console.log(`✅ [LAMBDA] User ${userId} is already a member of camera ${cameraId} with role: ${existingMember.role}`);
    
    return {
      success: true,
      message: 'You are already a member of this event',
      cameraId,
      cameraName,
      role: existingMember.role
    };
  }
  
  console.log(`🔗 [LAMBDA] User is not a member, proceeding to add them to camera`);
  
  // Create new SharedCameraMember record
  const CREATE_MEMBER = /* GraphQL */ `
    mutation CreateSharedCameraMember($input: CreateSharedCameraMemberInput!) {
      createSharedCameraMember(input: $input) {
        id
        cameraId
        userId
        role
        addedAt
      }
    }
  `;
  
  const newMemberId = uuidv4();
  const now = new Date().toISOString();
  
  console.log(`➕ [LAMBDA] Creating new member with ID: ${newMemberId}`);
  
  const memberInput = {
    id: newMemberId,
    cameraId,
    userId,
    role: 'MEMBER', // New invites always start as MEMBER role
    addedAt: now
    // Note: No 'owner' field needed - Amplify handles auth automatically
  };
  
  console.log(`➕ [LAMBDA] Member input:`, memberInput);
  
  try {
    const createResult = await callGraphQL({
      query: CREATE_MEMBER,
      variables: {
        input: memberInput
      }
    });
    console.log(`✅ [LAMBDA] Member created successfully:`, createResult);
  } catch (createError) {
    console.error(`❌ [LAMBDA] Failed to create member:`, createError);
    throw createError;
  }
  
  // Also need to update the SharedCamera's memberIds array
  const GET_CAMERA = /* GraphQL */ `
    query GetCamera($id: ID!) {
      getSharedCamera(id: $id) {
        id
        memberIds
        _version
      }
    }
  `;
  
  console.log(`🔍 [LAMBDA] Getting camera data for: ${cameraId}`);
  
  try {
    const cameraData = await callGraphQL({
      query: GET_CAMERA,
      variables: { id: cameraId }
    });
    console.log(`🔍 [LAMBDA] Camera data result:`, cameraData);
    
    if (!cameraData.getSharedCamera) {
      console.error(`❌ [LAMBDA] Camera not found: ${cameraId}`);
      throw new Error('Camera not found');
    }
    
    const camera = cameraData.getSharedCamera;
    const updatedMemberIds = [...(camera.memberIds || []), userId];
    
    console.log(`📝 [LAMBDA] Updating camera memberIds from:`, camera.memberIds, 'to:', updatedMemberIds);
    
    const UPDATE_CAMERA = /* GraphQL */ `
      mutation UpdateCamera($input: UpdateSharedCameraInput!) {
        updateSharedCamera(input: $input) {
          id
          memberIds
        }
      }
    `;
    
    const updateResult = await callGraphQL({
      query: UPDATE_CAMERA,
      variables: {
        input: {
          id: cameraId,
          memberIds: updatedMemberIds,
          _version: camera._version
        }
      }
    });
    console.log(`✅ [LAMBDA] Camera updated successfully:`, updateResult);
    
  } catch (cameraError) {
    console.error(`❌ [LAMBDA] Failed to update camera:`, cameraError);
    throw cameraError;
  }
  
  console.log(`🎉 [LAMBDA] Successfully added user ${userId} to camera ${cameraId}`);
  
  const finalResult = {
    success: true,
    message: 'Successfully joined event',
    cameraId,
    cameraName,
    role: 'MEMBER',
    inviterName
  };
  
  console.log(`🎉 [LAMBDA] Returning success result:`, finalResult);
  
  return finalResult;
};