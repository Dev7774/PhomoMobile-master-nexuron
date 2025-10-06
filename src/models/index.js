// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { User, Friendship, SharedCamera, SharedCameraMember, Photo, PhotoRecipient, UpdateUserFaceResult, FaceProcessingResult, FaceMatch, BoundingBox, AcceptInviteResult, DeleteUserFaceResult } = initSchema(schema);

export {
  User,
  Friendship,
  SharedCamera,
  SharedCameraMember,
  Photo,
  PhotoRecipient,
  UpdateUserFaceResult,
  FaceProcessingResult,
  FaceMatch,
  BoundingBox,
  AcceptInviteResult,
  DeleteUserFaceResult
};