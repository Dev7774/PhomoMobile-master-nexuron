/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const enrollUserFace = /* GraphQL */ `mutation EnrollUserFace($userId: ID!, $s3Key: String!) {
  enrollUserFace(userId: $userId, s3Key: $s3Key)
}
` as GeneratedMutation<
  APITypes.EnrollUserFaceMutationVariables,
  APITypes.EnrollUserFaceMutation
>;
export const updateUserFace = /* GraphQL */ `mutation UpdateUserFace($userId: ID!, $s3Key: String!) {
  updateUserFace(userId: $userId, s3Key: $s3Key) {
    success
    faceId
    newFaceCount
    message
    error
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateUserFaceMutationVariables,
  APITypes.UpdateUserFaceMutation
>;
export const processPhotoFaces = /* GraphQL */ `mutation ProcessPhotoFaces(
  $photoId: ID!
  $s3Key: String!
  $ownerId: ID!
  $sharedCameraId: ID
) {
  processPhotoFaces(
    photoId: $photoId
    s3Key: $s3Key
    ownerId: $ownerId
    sharedCameraId: $sharedCameraId
  ) {
    facesDetected
    friendsMatched
    matches {
      userId
      confidence
      __typename
    }
    __typename
  }
}
` as GeneratedMutation<
  APITypes.ProcessPhotoFacesMutationVariables,
  APITypes.ProcessPhotoFacesMutation
>;
export const deleteUserFace = /* GraphQL */ `mutation DeleteUserFace($userId: ID!, $identityId: String!) {
  deleteUserFace(userId: $userId, identityId: $identityId) {
    success
    message
    error
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserFaceMutationVariables,
  APITypes.DeleteUserFaceMutation
>;
export const createUser = /* GraphQL */ `mutation CreateUser(
  $input: CreateUserInput!
  $condition: ModelUserConditionInput
) {
  createUser(input: $input, condition: $condition) {
    id
    displayName
    faceCount
    primaryFaceId
    profilePhotoKey
    expoPushToken
    photos {
      nextToken
      startedAt
      __typename
    }
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateUserMutationVariables,
  APITypes.CreateUserMutation
>;
export const updateUser = /* GraphQL */ `mutation UpdateUser(
  $input: UpdateUserInput!
  $condition: ModelUserConditionInput
) {
  updateUser(input: $input, condition: $condition) {
    id
    displayName
    faceCount
    primaryFaceId
    profilePhotoKey
    expoPushToken
    photos {
      nextToken
      startedAt
      __typename
    }
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateUserMutationVariables,
  APITypes.UpdateUserMutation
>;
export const deleteUser = /* GraphQL */ `mutation DeleteUser(
  $input: DeleteUserInput!
  $condition: ModelUserConditionInput
) {
  deleteUser(input: $input, condition: $condition) {
    id
    displayName
    faceCount
    primaryFaceId
    profilePhotoKey
    expoPushToken
    photos {
      nextToken
      startedAt
      __typename
    }
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserMutationVariables,
  APITypes.DeleteUserMutation
>;
export const createFriendship = /* GraphQL */ `mutation CreateFriendship(
  $input: CreateFriendshipInput!
  $condition: ModelFriendshipConditionInput
) {
  createFriendship(input: $input, condition: $condition) {
    id
    ownerId
    friendId
    status
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateFriendshipMutationVariables,
  APITypes.CreateFriendshipMutation
>;
export const updateFriendship = /* GraphQL */ `mutation UpdateFriendship(
  $input: UpdateFriendshipInput!
  $condition: ModelFriendshipConditionInput
) {
  updateFriendship(input: $input, condition: $condition) {
    id
    ownerId
    friendId
    status
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateFriendshipMutationVariables,
  APITypes.UpdateFriendshipMutation
>;
export const deleteFriendship = /* GraphQL */ `mutation DeleteFriendship(
  $input: DeleteFriendshipInput!
  $condition: ModelFriendshipConditionInput
) {
  deleteFriendship(input: $input, condition: $condition) {
    id
    ownerId
    friendId
    status
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteFriendshipMutationVariables,
  APITypes.DeleteFriendshipMutation
>;
export const createSharedCamera = /* GraphQL */ `mutation CreateSharedCamera(
  $input: CreateSharedCameraInput!
  $condition: ModelSharedCameraConditionInput
) {
  createSharedCamera(input: $input, condition: $condition) {
    id
    name
    ownerId
    memberIds
    createdAt
    photos {
      nextToken
      startedAt
      __typename
    }
    members {
      nextToken
      startedAt
      __typename
    }
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateSharedCameraMutationVariables,
  APITypes.CreateSharedCameraMutation
>;
export const updateSharedCamera = /* GraphQL */ `mutation UpdateSharedCamera(
  $input: UpdateSharedCameraInput!
  $condition: ModelSharedCameraConditionInput
) {
  updateSharedCamera(input: $input, condition: $condition) {
    id
    name
    ownerId
    memberIds
    createdAt
    photos {
      nextToken
      startedAt
      __typename
    }
    members {
      nextToken
      startedAt
      __typename
    }
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateSharedCameraMutationVariables,
  APITypes.UpdateSharedCameraMutation
>;
export const deleteSharedCamera = /* GraphQL */ `mutation DeleteSharedCamera(
  $input: DeleteSharedCameraInput!
  $condition: ModelSharedCameraConditionInput
) {
  deleteSharedCamera(input: $input, condition: $condition) {
    id
    name
    ownerId
    memberIds
    createdAt
    photos {
      nextToken
      startedAt
      __typename
    }
    members {
      nextToken
      startedAt
      __typename
    }
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteSharedCameraMutationVariables,
  APITypes.DeleteSharedCameraMutation
>;
export const createSharedCameraMember = /* GraphQL */ `mutation CreateSharedCameraMember(
  $input: CreateSharedCameraMemberInput!
  $condition: ModelSharedCameraMemberConditionInput
) {
  createSharedCameraMember(input: $input, condition: $condition) {
    id
    cameraId
    userId
    role
    addedAt
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateSharedCameraMemberMutationVariables,
  APITypes.CreateSharedCameraMemberMutation
>;
export const updateSharedCameraMember = /* GraphQL */ `mutation UpdateSharedCameraMember(
  $input: UpdateSharedCameraMemberInput!
  $condition: ModelSharedCameraMemberConditionInput
) {
  updateSharedCameraMember(input: $input, condition: $condition) {
    id
    cameraId
    userId
    role
    addedAt
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateSharedCameraMemberMutationVariables,
  APITypes.UpdateSharedCameraMemberMutation
>;
export const deleteSharedCameraMember = /* GraphQL */ `mutation DeleteSharedCameraMember(
  $input: DeleteSharedCameraMemberInput!
  $condition: ModelSharedCameraMemberConditionInput
) {
  deleteSharedCameraMember(input: $input, condition: $condition) {
    id
    cameraId
    userId
    role
    addedAt
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteSharedCameraMemberMutationVariables,
  APITypes.DeleteSharedCameraMemberMutation
>;
export const createPhoto = /* GraphQL */ `mutation CreatePhoto(
  $input: CreatePhotoInput!
  $condition: ModelPhotoConditionInput
) {
  createPhoto(input: $input, condition: $condition) {
    id
    ownerId
    ownerIdentityId
    sharedCameraId
    s3Key
    thumbKey
    createdAt
    recipients {
      nextToken
      startedAt
      __typename
    }
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreatePhotoMutationVariables,
  APITypes.CreatePhotoMutation
>;
export const updatePhoto = /* GraphQL */ `mutation UpdatePhoto(
  $input: UpdatePhotoInput!
  $condition: ModelPhotoConditionInput
) {
  updatePhoto(input: $input, condition: $condition) {
    id
    ownerId
    ownerIdentityId
    sharedCameraId
    s3Key
    thumbKey
    createdAt
    recipients {
      nextToken
      startedAt
      __typename
    }
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdatePhotoMutationVariables,
  APITypes.UpdatePhotoMutation
>;
export const deletePhoto = /* GraphQL */ `mutation DeletePhoto(
  $input: DeletePhotoInput!
  $condition: ModelPhotoConditionInput
) {
  deletePhoto(input: $input, condition: $condition) {
    id
    ownerId
    ownerIdentityId
    sharedCameraId
    s3Key
    thumbKey
    createdAt
    recipients {
      nextToken
      startedAt
      __typename
    }
    updatedAt
    _version
    _deleted
    _lastChangedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeletePhotoMutationVariables,
  APITypes.DeletePhotoMutation
>;
export const createPhotoRecipient = /* GraphQL */ `mutation CreatePhotoRecipient(
  $input: CreatePhotoRecipientInput!
  $condition: ModelPhotoRecipientConditionInput
) {
  createPhotoRecipient(input: $input, condition: $condition) {
    id
    photoId
    recipientId
    ownerId
    confidence
    method
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreatePhotoRecipientMutationVariables,
  APITypes.CreatePhotoRecipientMutation
>;
export const updatePhotoRecipient = /* GraphQL */ `mutation UpdatePhotoRecipient(
  $input: UpdatePhotoRecipientInput!
  $condition: ModelPhotoRecipientConditionInput
) {
  updatePhotoRecipient(input: $input, condition: $condition) {
    id
    photoId
    recipientId
    ownerId
    confidence
    method
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdatePhotoRecipientMutationVariables,
  APITypes.UpdatePhotoRecipientMutation
>;
export const deletePhotoRecipient = /* GraphQL */ `mutation DeletePhotoRecipient(
  $input: DeletePhotoRecipientInput!
  $condition: ModelPhotoRecipientConditionInput
) {
  deletePhotoRecipient(input: $input, condition: $condition) {
    id
    photoId
    recipientId
    ownerId
    confidence
    method
    createdAt
    updatedAt
    _version
    _deleted
    _lastChangedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeletePhotoRecipientMutationVariables,
  APITypes.DeletePhotoRecipientMutation
>;
export const generateCameraInvite = /* GraphQL */ `mutation GenerateCameraInvite(
  $cameraId: ID!
  $cameraName: String!
  $inviterUserId: ID!
  $inviterName: String!
) {
  generateCameraInvite(
    cameraId: $cameraId
    cameraName: $cameraName
    inviterUserId: $inviterUserId
    inviterName: $inviterName
  )
}
` as GeneratedMutation<
  APITypes.GenerateCameraInviteMutationVariables,
  APITypes.GenerateCameraInviteMutation
>;
export const acceptCameraInvite = /* GraphQL */ `mutation AcceptCameraInvite($token: String!, $userId: ID!) {
  acceptCameraInvite(token: $token, userId: $userId) {
    success
    message
    cameraId
    cameraName
    role
    inviterName
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AcceptCameraInviteMutationVariables,
  APITypes.AcceptCameraInviteMutation
>;
