/* Amplify Params - DO NOT EDIT
	API_PHOMOAPI_GRAPHQLAPIENDPOINTOUTPUT
	API_PHOMOAPI_GRAPHQLAPIIDOUTPUT
	API_PHOMOAPI_GRAPHQLAPIKEYOUTPUT
	ENV
	REGION
	STORAGE_PHOMOPHOTOS_BUCKETNAME
	FACE_COLLECTION
Amplify Params - DO NOT EDIT */

import {
  RekognitionClient,
  DeleteUserCommand,
  ListFacesCommand,
  DeleteFacesCommand,
  DisassociateFacesCommand,
} from "@aws-sdk/client-rekognition";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import {
  CognitoIdentityProviderClient,
  AdminDisableUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import fetch, { Request as FetchRequest } from "node-fetch";
import crypto from "@aws-crypto/sha256-js";

const REGION = process.env.REGION || "us-east-1";
const GRAPHQL = process.env.API_PHOMOAPI_GRAPHQLAPIENDPOINTOUTPUT;
const BUCKET = process.env.STORAGE_PHOMOPHOTOS_BUCKETNAME;
const COLL_ID = process.env.FACE_COLLECTION;
const USER_POOL_ID = process.env.AUTH_PHOMOAUTH_USERPOOLID;

const rekog = new RekognitionClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const cognitoProvider = new CognitoIdentityProviderClient({ region: REGION });

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

/* delete all objects in S3 folder */
async function deleteS3Folder(folderPrefix) {
  console.log(`Deleting S3 folder: ${folderPrefix}`);
  
  try {
    // List all objects in the folder
    const listParams = {
      Bucket: BUCKET,
      Prefix: folderPrefix,
    };

    const listedObjects = await s3.send(new ListObjectsV2Command(listParams));
    
    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      console.log(`No objects found in ${folderPrefix}`);
      return;
    }

    // Delete all objects
    const deleteParams = {
      Bucket: BUCKET,
      Delete: {
        Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
        Quiet: true,
      },
    };

    console.log(`📁 [S3] Deleting objects:`);
    listedObjects.Contents.forEach(obj => console.log(`  - ${obj.Key}`));

    const deleteResult = await s3.send(new DeleteObjectsCommand(deleteParams));
    console.log(`✅ [S3] Deleted ${listedObjects.Contents.length} objects from ${folderPrefix}`);

    if (deleteResult.Errors && deleteResult.Errors.length > 0) {
      console.warn("❌ [S3] Some objects failed to delete:", deleteResult.Errors);
    }
  } catch (error) {
    console.error(`Error deleting S3 folder ${folderPrefix}:`, error);
    throw error;
  }
}

/* delete a single S3 object (used for profile photo) */
async function deleteS3Object(key) {
  if (!key) return;

  console.log(`Deleting S3 object: ${key}`);

  try {
    const deleteParams = {
      Bucket: BUCKET,
      Delete: {
        Objects: [{ Key: key }],
        Quiet: true,
      },
    };

    await s3.send(new DeleteObjectsCommand(deleteParams));
    console.log(`✅ [S3] Successfully deleted object: ${key}`);
  } catch (error) {
    console.error(`Error deleting S3 object ${key}:`, error);
    // Don't throw - profile photo deletion shouldn't fail the whole operation
  }
}

/**
 * Complete Account Deletion Lambda
 *
 * This function handles complete user account deletion including:
 * 1. Get user data and _version for optimistic locking
 * 2. Disable Cognito user (locks account immediately)
 * 3. Delete Rekognition faces (disassociate, delete faces, delete user)
 * 4. Delete S3 objects (faces, onboard, cameras folders)
 * 5. Delete S3 profile photo
 * 6. Delete Photos and their PhotoRecipients
 * 7. Delete Friendships (as owner and friend)
 * 8. Delete PhotoRecipients where user is recipient
 * 9. Delete SharedCameraMember records
 * 10. Delete SharedCameras owned by user (and remaining members)
 * 11. Delete User record from database
 *
 * Invoked by AppSync @function resolver
 */
export const handler = async (event) => {
  console.log("🚀 [START] Account deletion initiated");
  const { userId, identityId } = event.arguments;

  console.log("📋 [CONFIG] Environment:", { REGION, BUCKET, COLL_ID, USER_POOL_ID });
  console.log("👤 [USER] Deleting account:", userId);

  try {
    /* ── 1. get user data for profile photo and version ─────────── */
    const GET_USER = /* GraphQL */ `
      query GetUser($id: ID!) {
        getUser(id: $id) {
          id
          _version
          primaryFaceId
          profilePhotoKey
        }
      }
    `;

    const { getUser } = await callGraphQL({
      query: GET_USER,
      variables: { id: userId },
    });

    if (!getUser) {
      console.log(`User with id ${userId} not found`);
      return {
        success: false,
        error: `User with id ${userId} not found`,
      };
    }

    const { _version, primaryFaceId, profilePhotoKey } = getUser;
    console.log("Current user data:", { _version, primaryFaceId, profilePhotoKey });

    /* ── 2. disable Cognito user (locks account immediately, prevents re-login) ──── */
    if (!USER_POOL_ID) {
      console.warn("USER_POOL_ID not found in environment variables - skipping Cognito disable");
    } else {
      console.log(`🔒 [COGNITO] Disabling user: ${userId}`);
      try {
        await cognitoProvider.send(
          new AdminDisableUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: userId,
          })
        );
        console.log(`✅ [COGNITO] Successfully disabled user: ${userId}`);
      } catch (cognitoError) {
        console.warn(`Failed to disable Cognito user ${userId}:`, cognitoError.message);
        // Continue even if disable fails - user might already be deleted/disabled
      }
    }

    /* ── 3. delete Rekognition faces ──── */
    try {
      console.log(`Attempting to delete user ${userId} from Rekognition`);
      
      // First, try to list faces for this user to see what exists
      try {
        const listFacesResult = await rekog.send(
          new ListFacesCommand({
            CollectionId: COLL_ID,
            UserId: userId,
          })
        );
        
        console.log(`Found ${listFacesResult.Faces?.length || 0} faces for user ${userId}`);
        
        // If user has faces, disassociate and delete them
        if (listFacesResult.Faces && listFacesResult.Faces.length > 0) {
          const faceIds = listFacesResult.Faces.map(face => face.FaceId);
          console.log(`Processing face IDs: ${faceIds.join(', ')}`);
          
          // First disassociate faces from user
          console.log(`🔓 [REKOGNITION] Disassociating ${faceIds.length} faces from user ${userId}`);
          console.log(`  Face IDs: ${faceIds.join(', ')}`);
          await rekog.send(
            new DisassociateFacesCommand({
              CollectionId: COLL_ID,
              UserId: userId,
              FaceIds: faceIds,
            })
          );
          console.log(`✅ [REKOGNITION] Successfully disassociated ${faceIds.length} faces`);
          
          // Then delete the faces from collection
          console.log(`🗑️ [REKOGNITION] Deleting ${faceIds.length} faces from collection`);
          await rekog.send(
            new DeleteFacesCommand({
              CollectionId: COLL_ID,
              FaceIds: faceIds,
            })
          );
          console.log(`✅ [REKOGNITION] Successfully deleted ${faceIds.length} faces`);
        }
      } catch (listError) {
        console.log(`Could not list faces for user ${userId}:`, listError.message);
      }

      // Then delete the user from collection
      console.log(`🗑️ [REKOGNITION] Deleting user: ${userId}`);
      await rekog.send(
        new DeleteUserCommand({
          CollectionId: COLL_ID,
          UserId: userId,
        })
      );
      console.log(`✅ [REKOGNITION] Successfully deleted user ${userId} from Rekognition`);
    } catch (rekogError) {
      console.warn(`Rekognition deletion failed for user ${userId}:`, rekogError.message);
      // Continue with S3 cleanup even if Rekognition fails
    }

    /* ── 4. delete S3 folders (faces, onboard, cameras) ──── */
    await deleteS3Folder(`protected/${identityId}/faces/`);
    await deleteS3Folder(`protected/${identityId}/onboard/`);
    await deleteS3Folder(`protected/${identityId}/cameras/`);

    /* ── 5. delete S3 profile photo ──── */
    if (profilePhotoKey) {
      console.log(`Profile photo key from database: ${profilePhotoKey}`);
      
      // Try the original key first
      await deleteS3Object(profilePhotoKey);
      
      // Also try with double public prefix (AWS Amplify guest upload adds extra public/)
      if (profilePhotoKey.startsWith('public/')) {
        const doublePublicKey = `public/${profilePhotoKey}`;
        console.log(`Also trying with double public prefix: ${doublePublicKey}`);
        await deleteS3Object(doublePublicKey);
      }
    }

    /* ── 6. delete Photos and their PhotoRecipients ──── */
    console.log("Deleting photo records from DynamoDB...");

    // Query all photos owned by this user
    const PHOTOS_BY_OWNER = /* GraphQL */ `
      query PhotosByOwnerIdAndCreatedAt(
        $ownerId: ID!
        $limit: Int
        $nextToken: String
      ) {
        photosByOwnerIdAndCreatedAt(
          ownerId: $ownerId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const PHOTO_RECIPIENTS_BY_PHOTO = /* GraphQL */ `
      query PhotoRecipientsByPhotoIdAndRecipientId(
        $photoId: ID!
        $limit: Int
        $nextToken: String
      ) {
        photoRecipientsByPhotoIdAndRecipientId(
          photoId: $photoId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const DELETE_PHOTO = /* GraphQL */ `
      mutation DeletePhoto($input: DeletePhotoInput!) {
        deletePhoto(input: $input) {
          id
        }
      }
    `;

    const DELETE_PHOTO_RECIPIENT = /* GraphQL */ `
      mutation DeletePhotoRecipient($input: DeletePhotoRecipientInput!) {
        deletePhotoRecipient(input: $input) {
          id
        }
      }
    `;

    try {
      let photoNextToken = null;
      let totalPhotosDeleted = 0;
      let totalRecipientsDeleted = 0;

      do {
        const photosResult = await callGraphQL({
          query: PHOTOS_BY_OWNER,
          variables: {
            ownerId: userId,
            limit: 50,
            nextToken: photoNextToken,
          },
        });

        const photos = photosResult.photosByOwnerIdAndCreatedAt?.items || [];
        console.log(`Found ${photos.length} photos in this batch`);

        // For each photo, delete its recipients first, then the photo
        for (const photo of photos) {
          // Delete all PhotoRecipient records for this photo
          let recipientNextToken = null;
          do {
            const recipientsResult = await callGraphQL({
              query: PHOTO_RECIPIENTS_BY_PHOTO,
              variables: {
                photoId: photo.id,
                limit: 50,
                nextToken: recipientNextToken,
              },
            });

            const recipients = recipientsResult.photoRecipientsByPhotoIdAndRecipientId?.items || [];

            for (const recipient of recipients) {
              try {
                console.log(`  🗑️ [PHOTO_RECIPIENT] Deleting recipient: ${recipient.id} for photo: ${photo.id}`);
                await callGraphQL({
                  query: DELETE_PHOTO_RECIPIENT,
                  variables: {
                    input: {
                      id: recipient.id,
                      _version: recipient._version,
                    },
                  },
                });
                totalRecipientsDeleted++;
              } catch (recipientDeleteError) {
                console.warn(`Failed to delete photo recipient ${recipient.id}:`, recipientDeleteError.message);
              }
            }

            recipientNextToken = recipientsResult.photoRecipientsByPhotoIdAndRecipientId?.nextToken;
          } while (recipientNextToken);

          // Now delete the photo itself
          try {
            console.log(`🗑️ [PHOTO] Deleting photo: ${photo.id} owned by: ${userId}`);
            await callGraphQL({
              query: DELETE_PHOTO,
              variables: {
                input: {
                  id: photo.id,
                  _version: photo._version,
                },
              },
            });
            totalPhotosDeleted++;
          } catch (photoDeleteError) {
            console.warn(`Failed to delete photo ${photo.id}:`, photoDeleteError.message);
          }
        }

        photoNextToken = photosResult.photosByOwnerIdAndCreatedAt?.nextToken;
      } while (photoNextToken);

      console.log(`✅ [SUMMARY] Deleted ${totalPhotosDeleted} photos and ${totalRecipientsDeleted} recipient records`);
    } catch (photoQueryError) {
      console.warn("Error querying/deleting photos:", photoQueryError.message);
    }

    /* ── 7. delete Friendships (as owner and friend) ──── */
    console.log("Deleting friendship records from DynamoDB...");

    const FRIENDSHIPS_BY_OWNER = /* GraphQL */ `
      query FriendshipsByOwnerIdAndFriendId(
        $ownerId: ID!
        $limit: Int
        $nextToken: String
      ) {
        friendshipsByOwnerIdAndFriendId(
          ownerId: $ownerId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const FRIENDSHIPS_BY_FRIEND = /* GraphQL */ `
      query FriendshipsByFriendIdAndOwnerId(
        $friendId: ID!
        $limit: Int
        $nextToken: String
      ) {
        friendshipsByFriendIdAndOwnerId(
          friendId: $friendId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const DELETE_FRIENDSHIP = /* GraphQL */ `
      mutation DeleteFriendship($input: DeleteFriendshipInput!) {
        deleteFriendship(input: $input) {
          id
        }
      }
    `;

    try {
      let totalFriendshipsDeleted = 0;

      // Delete friendships where user is the owner
      let ownerNextToken = null;
      do {
        const ownerResult = await callGraphQL({
          query: FRIENDSHIPS_BY_OWNER,
          variables: {
            ownerId: userId,
            limit: 50,
            nextToken: ownerNextToken,
          },
        });

        const ownerFriendships = ownerResult.friendshipsByOwnerIdAndFriendId?.items || [];
        console.log(`Found ${ownerFriendships.length} friendships as owner`);

        for (const friendship of ownerFriendships) {
          try {
            console.log(`🗑️ [FRIENDSHIP] Deleting friendship (as owner): ${friendship.id}`);
            await callGraphQL({
              query: DELETE_FRIENDSHIP,
              variables: {
                input: {
                  id: friendship.id,
                  _version: friendship._version,
                },
              },
            });
            totalFriendshipsDeleted++;
          } catch (friendshipDeleteError) {
            console.warn(`Failed to delete friendship ${friendship.id}:`, friendshipDeleteError.message);
          }
        }

        ownerNextToken = ownerResult.friendshipsByOwnerIdAndFriendId?.nextToken;
      } while (ownerNextToken);

      // Delete friendships where user is the friend
      let friendNextToken = null;
      do {
        const friendResult = await callGraphQL({
          query: FRIENDSHIPS_BY_FRIEND,
          variables: {
            friendId: userId,
            limit: 50,
            nextToken: friendNextToken,
          },
        });

        const friendFriendships = friendResult.friendshipsByFriendIdAndOwnerId?.items || [];
        console.log(`Found ${friendFriendships.length} friendships as friend`);

        for (const friendship of friendFriendships) {
          try {
            console.log(`🗑️ [FRIENDSHIP] Deleting friendship (as friend): ${friendship.id}`);
            await callGraphQL({
              query: DELETE_FRIENDSHIP,
              variables: {
                input: {
                  id: friendship.id,
                  _version: friendship._version,
                },
              },
            });
            totalFriendshipsDeleted++;
          } catch (friendshipDeleteError) {
            console.warn(`Failed to delete friendship ${friendship.id}:`, friendshipDeleteError.message);
          }
        }

        friendNextToken = friendResult.friendshipsByFriendIdAndOwnerId?.nextToken;
      } while (friendNextToken);

      console.log(`✅ [SUMMARY] Deleted ${totalFriendshipsDeleted} friendship records`);
    } catch (friendshipQueryError) {
      console.warn("Error querying/deleting friendships:", friendshipQueryError.message);
    }

    /* ── 8. delete PhotoRecipients (user as recipient) ──── */
    console.log("Deleting photo recipient records where user is the recipient...");

    const PHOTO_RECIPIENTS_BY_RECIPIENT = /* GraphQL */ `
      query PhotoRecipientsByRecipientIdAndPhotoId(
        $recipientId: ID!
        $limit: Int
        $nextToken: String
      ) {
        photoRecipientsByRecipientIdAndPhotoId(
          recipientId: $recipientId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
            photoId
          }
          nextToken
        }
      }
    `;

    try {
      let recipientNextToken = null;
      let totalRecipientRecordsDeleted = 0;

      do {
        const recipientResult = await callGraphQL({
          query: PHOTO_RECIPIENTS_BY_RECIPIENT,
          variables: {
            recipientId: userId,
            limit: 50,
            nextToken: recipientNextToken,
          },
        });

        const recipients = recipientResult.photoRecipientsByRecipientIdAndPhotoId?.items || [];
        console.log(`Found ${recipients.length} recipient records where user is the recipient`);

        for (const recipient of recipients) {
          try {
            console.log(`🗑️ [PHOTO_RECIPIENT] Deleting recipient record: ${recipient.id} (user as recipient of photo: ${recipient.photoId})`);
            await callGraphQL({
              query: DELETE_PHOTO_RECIPIENT,
              variables: {
                input: {
                  id: recipient.id,
                  _version: recipient._version,
                },
              },
            });
            totalRecipientRecordsDeleted++;
          } catch (recipientDeleteError) {
            console.warn(`Failed to delete photo recipient ${recipient.id}:`, recipientDeleteError.message);
          }
        }

        recipientNextToken = recipientResult.photoRecipientsByRecipientIdAndPhotoId?.nextToken;
      } while (recipientNextToken);

      console.log(`✅ [SUMMARY] Deleted ${totalRecipientRecordsDeleted} recipient records where user was the recipient`);
    } catch (recipientQueryError) {
      console.warn("Error querying/deleting photo recipients by recipient:", recipientQueryError.message);
    }

    /* ── 9. delete SharedCameraMember records (user's memberships) ──── */
    console.log("Deleting shared camera member records from DynamoDB...");

    const CAMERA_MEMBERS_BY_USER = /* GraphQL */ `
      query SharedCameraMembersByUserIdAndCameraId(
        $userId: ID!
        $limit: Int
        $nextToken: String
      ) {
        sharedCameraMembersByUserIdAndCameraId(
          userId: $userId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const DELETE_CAMERA_MEMBER = /* GraphQL */ `
      mutation DeleteSharedCameraMember($input: DeleteSharedCameraMemberInput!) {
        deleteSharedCameraMember(input: $input) {
          id
        }
      }
    `;

    try {
      let memberNextToken = null;
      let totalMembersDeleted = 0;

      do {
        const memberResult = await callGraphQL({
          query: CAMERA_MEMBERS_BY_USER,
          variables: {
            userId: userId,
            limit: 50,
            nextToken: memberNextToken,
          },
        });

        const members = memberResult.sharedCameraMembersByUserIdAndCameraId?.items || [];
        console.log(`Found ${members.length} camera memberships`);

        for (const member of members) {
          try {
            console.log(`🗑️ [CAMERA_MEMBER] Deleting membership: ${member.id} for user: ${userId}`);
            await callGraphQL({
              query: DELETE_CAMERA_MEMBER,
              variables: {
                input: {
                  id: member.id,
                  _version: member._version,
                },
              },
            });
            totalMembersDeleted++;
          } catch (memberDeleteError) {
            console.warn(`Failed to delete camera member ${member.id}:`, memberDeleteError.message);
          }
        }

        memberNextToken = memberResult.sharedCameraMembersByUserIdAndCameraId?.nextToken;
      } while (memberNextToken);

      console.log(`✅ [SUMMARY] Deleted ${totalMembersDeleted} camera member records`);
    } catch (memberQueryError) {
      console.warn("Error querying/deleting camera members:", memberQueryError.message);
    }

    /* ── 10. delete SharedCameras (owned by user, including remaining members) ──── */
    console.log("Deleting shared cameras owned by user...");

    const CAMERAS_BY_OWNER = /* GraphQL */ `
      query SharedCamerasByOwnerIdAndCreatedAt(
        $ownerId: ID!
        $limit: Int
        $nextToken: String
      ) {
        sharedCamerasByOwnerIdAndCreatedAt(
          ownerId: $ownerId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const DELETE_SHARED_CAMERA = /* GraphQL */ `
      mutation DeleteSharedCamera($input: DeleteSharedCameraInput!) {
        deleteSharedCamera(input: $input) {
          id
        }
      }
    `;

    const PHOTOS_BY_CAMERA = /* GraphQL */ `
      query PhotosBySharedCameraIdAndCreatedAt(
        $sharedCameraId: ID!
        $limit: Int
        $nextToken: String
      ) {
        photosBySharedCameraIdAndCreatedAt(
          sharedCameraId: $sharedCameraId
          limit: $limit
          nextToken: $nextToken
        ) {
          items {
            id
            _version
          }
          nextToken
        }
      }
    `;

    const UPDATE_PHOTO = /* GraphQL */ `
      mutation UpdatePhoto($input: UpdatePhotoInput!) {
        updatePhoto(input: $input) {
          id
          sharedCameraId
        }
      }
    `;

    try {
      let cameraNextToken = null;
      let totalCamerasDeleted = 0;
      let totalPhotosUpdated = 0;

      do {
        const cameraResult = await callGraphQL({
          query: CAMERAS_BY_OWNER,
          variables: {
            ownerId: userId,
            limit: 50,
            nextToken: cameraNextToken,
          },
        });

        const cameras = cameraResult.sharedCamerasByOwnerIdAndCreatedAt?.items || [];
        console.log(`Found ${cameras.length} owned cameras`);

        for (const camera of cameras) {
          // Delete all remaining SharedCameraMember records for this camera
          // (owner's membership already deleted in Step 9, this removes other members)
          console.log(`Deleting remaining members for camera ${camera.id}...`);

          const CAMERA_MEMBERS_BY_CAMERA = /* GraphQL */ `
            query SharedCameraMembersByCameraIdAndUserId(
              $cameraId: ID!
              $limit: Int
              $nextToken: String
            ) {
              sharedCameraMembersByCameraIdAndUserId(
                cameraId: $cameraId
                limit: $limit
                nextToken: $nextToken
              ) {
                items {
                  id
                  _version
                  userId
                }
                nextToken
              }
            }
          `;

          let cameraMemberToken = null;
          let membersDeletedForCamera = 0;
          do {
            const membersResult = await callGraphQL({
              query: CAMERA_MEMBERS_BY_CAMERA,
              variables: {
                cameraId: camera.id,
                limit: 50,
                nextToken: cameraMemberToken,
              },
            });

            const cameraMembers = membersResult.sharedCameraMembersByCameraIdAndUserId?.items || [];

            for (const member of cameraMembers) {
              try {
                console.log(`  🗑️ [CAMERA_MEMBER] Deleting member: ${member.id} (userId: ${member.userId})`);
                await callGraphQL({
                  query: DELETE_CAMERA_MEMBER,
                  variables: {
                    input: {
                      id: member.id,
                      _version: member._version,
                    },
                  },
                });
                membersDeletedForCamera++;
              } catch (memberDeleteError) {
                console.warn(`Failed to delete camera member ${member.id}:`, memberDeleteError.message);
              }
            }

            cameraMemberToken = membersResult.sharedCameraMembersByCameraIdAndUserId?.nextToken;
          } while (cameraMemberToken);

          if (membersDeletedForCamera > 0) {
            console.log(`  ✅ Deleted ${membersDeletedForCamera} other members from camera ${camera.id}`);
          }

          // Then, update all photos that reference this camera to set sharedCameraId to null
          console.log(`Updating photos for camera ${camera.id} before deletion...`);

          let photoNextToken = null;
          do {
            const photosResult = await callGraphQL({
              query: PHOTOS_BY_CAMERA,
              variables: {
                sharedCameraId: camera.id,
                limit: 50,
                nextToken: photoNextToken,
              },
            });

            const photos = photosResult.photosBySharedCameraIdAndCreatedAt?.items || [];
            console.log(`Found ${photos.length} photos in camera ${camera.id}`);

            for (const photo of photos) {
              try {
                console.log(`  📝 [PHOTO] Updating photo: ${photo.id} - setting sharedCameraId to null`);
                await callGraphQL({
                  query: UPDATE_PHOTO,
                  variables: {
                    input: {
                      id: photo.id,
                      _version: photo._version,
                      sharedCameraId: null,
                    },
                  },
                });
                totalPhotosUpdated++;
              } catch (photoUpdateError) {
                console.warn(`Failed to update photo ${photo.id}:`, photoUpdateError.message);
              }
            }

            photoNextToken = photosResult.photosBySharedCameraIdAndCreatedAt?.nextToken;
          } while (photoNextToken);

          // Now delete the camera itself
          try {
            console.log(`🗑️ [SHARED_CAMERA] Deleting camera: ${camera.id} owned by: ${userId}`);
            await callGraphQL({
              query: DELETE_SHARED_CAMERA,
              variables: {
                input: {
                  id: camera.id,
                  _version: camera._version,
                },
              },
            });
            totalCamerasDeleted++;
            console.log(`✅ [SHARED_CAMERA] Successfully deleted camera ${camera.id}`);
          } catch (cameraDeleteError) {
            console.warn(`Failed to delete camera ${camera.id}:`, cameraDeleteError.message);
          }
        }

        cameraNextToken = cameraResult.sharedCamerasByOwnerIdAndCreatedAt?.nextToken;
      } while (cameraNextToken);

      console.log(`✅ [SUMMARY] Deleted ${totalCamerasDeleted} shared cameras and updated ${totalPhotosUpdated} photos`);
    } catch (cameraQueryError) {
      console.warn("Error querying/deleting shared cameras:", cameraQueryError.message);
    }

    /* ── 11. delete User record ──── */
    const DELETE_USER = /* GraphQL */ `
      mutation DeleteUser($input: DeleteUserInput!) {
        deleteUser(input: $input) {
          id
        }
      }
    `;

    const deleteResult = await callGraphQL({
      query: DELETE_USER,
      variables: {
        input: {
          id: userId,
          _version: _version,
        },
      },
    });

    console.log(`✅ [USER] User ${userId} deleted successfully from database:`, deleteResult);

    console.log(`\n✅ [COMPLETE] Account deletion successful for userId: ${userId}`);
    console.log("================================================\n");
    return {
      success: true,
      message: "Account deleted successfully",
    };
  } catch (error) {
    console.error("❌ [ERROR] Failed to delete user data:", error);
    console.log("================================================\n");

    return {
      success: false,
      error: error.message,
    };
  }
};