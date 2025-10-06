/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	JWT_SECRET
	INVITE_EXPIRY_DAYS
Amplify Params - DO NOT EDIT */

import jwt from 'jsonwebtoken';

/**
 * Handler for AppSync GraphQL resolver
 * Called via @function directive in GraphQL schema
 */
export const handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  
  // Extract arguments passed from the GraphQL mutation
  const { cameraId, cameraName, inviterUserId, inviterName } = event.arguments;
  
  // Validate required fields
  if (!cameraId || !cameraName || !inviterUserId || !inviterName) {
    throw new Error('Missing required fields: cameraId, cameraName, inviterUserId, inviterName');
  }
  
  // Get environment variables
  const jwtSecret = process.env.JWT_SECRET;
  const expiryDays = parseInt(process.env.INVITE_EXPIRY_DAYS || '7');
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  
  // Create JWT payload with all necessary invite information
  const payload = {
    cameraId,
    cameraName,
    inviterUserId,
    inviterName,
    type: 'camera_invite'  // To distinguish from other JWT types in the future
  };
  
  // Sign the token with expiry
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: `${expiryDays}d`,
    issuer: 'phomo-app'
  });
  
  // Generate the invite URL
  // This will be handled by the web app or deep linked to the mobile app
  const inviteUrl = `https://phomo.camera?token=${token}`;
  
  console.log('Generated invite for camera:', cameraId);
  console.log('Token expires in days:', expiryDays);
  
  // Return the complete invite URL
  return inviteUrl;
};