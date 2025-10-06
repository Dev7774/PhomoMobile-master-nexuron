/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateUser = /* GraphQL */ `subscription OnCreateUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onCreateUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserSubscriptionVariables,
  APITypes.OnCreateUserSubscription
>;
export const onUpdateUser = /* GraphQL */ `subscription OnUpdateUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onUpdateUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserSubscriptionVariables,
  APITypes.OnUpdateUserSubscription
>;
export const onDeleteUser = /* GraphQL */ `subscription OnDeleteUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onDeleteUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserSubscriptionVariables,
  APITypes.OnDeleteUserSubscription
>;
export const onCreateFriendship = /* GraphQL */ `subscription OnCreateFriendship(
  $filter: ModelSubscriptionFriendshipFilterInput
  $owner: String
  $friendId: String
) {
  onCreateFriendship(filter: $filter, owner: $owner, friendId: $friendId) {
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
` as GeneratedSubscription<
  APITypes.OnCreateFriendshipSubscriptionVariables,
  APITypes.OnCreateFriendshipSubscription
>;
export const onUpdateFriendship = /* GraphQL */ `subscription OnUpdateFriendship(
  $filter: ModelSubscriptionFriendshipFilterInput
  $owner: String
  $friendId: String
) {
  onUpdateFriendship(filter: $filter, owner: $owner, friendId: $friendId) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateFriendshipSubscriptionVariables,
  APITypes.OnUpdateFriendshipSubscription
>;
export const onDeleteFriendship = /* GraphQL */ `subscription OnDeleteFriendship(
  $filter: ModelSubscriptionFriendshipFilterInput
  $owner: String
  $friendId: String
) {
  onDeleteFriendship(filter: $filter, owner: $owner, friendId: $friendId) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteFriendshipSubscriptionVariables,
  APITypes.OnDeleteFriendshipSubscription
>;
export const onCreateSharedCamera = /* GraphQL */ `subscription OnCreateSharedCamera(
  $filter: ModelSubscriptionSharedCameraFilterInput
  $owner: String
) {
  onCreateSharedCamera(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateSharedCameraSubscriptionVariables,
  APITypes.OnCreateSharedCameraSubscription
>;
export const onUpdateSharedCamera = /* GraphQL */ `subscription OnUpdateSharedCamera(
  $filter: ModelSubscriptionSharedCameraFilterInput
  $owner: String
) {
  onUpdateSharedCamera(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateSharedCameraSubscriptionVariables,
  APITypes.OnUpdateSharedCameraSubscription
>;
export const onDeleteSharedCamera = /* GraphQL */ `subscription OnDeleteSharedCamera(
  $filter: ModelSubscriptionSharedCameraFilterInput
  $owner: String
) {
  onDeleteSharedCamera(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteSharedCameraSubscriptionVariables,
  APITypes.OnDeleteSharedCameraSubscription
>;
export const onCreateSharedCameraMember = /* GraphQL */ `subscription OnCreateSharedCameraMember(
  $filter: ModelSubscriptionSharedCameraMemberFilterInput
  $owner: String
  $userId: String
) {
  onCreateSharedCameraMember(filter: $filter, owner: $owner, userId: $userId) {
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
` as GeneratedSubscription<
  APITypes.OnCreateSharedCameraMemberSubscriptionVariables,
  APITypes.OnCreateSharedCameraMemberSubscription
>;
export const onUpdateSharedCameraMember = /* GraphQL */ `subscription OnUpdateSharedCameraMember(
  $filter: ModelSubscriptionSharedCameraMemberFilterInput
  $owner: String
  $userId: String
) {
  onUpdateSharedCameraMember(filter: $filter, owner: $owner, userId: $userId) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateSharedCameraMemberSubscriptionVariables,
  APITypes.OnUpdateSharedCameraMemberSubscription
>;
export const onDeleteSharedCameraMember = /* GraphQL */ `subscription OnDeleteSharedCameraMember(
  $filter: ModelSubscriptionSharedCameraMemberFilterInput
  $owner: String
  $userId: String
) {
  onDeleteSharedCameraMember(filter: $filter, owner: $owner, userId: $userId) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteSharedCameraMemberSubscriptionVariables,
  APITypes.OnDeleteSharedCameraMemberSubscription
>;
export const onCreatePhoto = /* GraphQL */ `subscription OnCreatePhoto(
  $filter: ModelSubscriptionPhotoFilterInput
  $owner: String
) {
  onCreatePhoto(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreatePhotoSubscriptionVariables,
  APITypes.OnCreatePhotoSubscription
>;
export const onUpdatePhoto = /* GraphQL */ `subscription OnUpdatePhoto(
  $filter: ModelSubscriptionPhotoFilterInput
  $owner: String
) {
  onUpdatePhoto(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdatePhotoSubscriptionVariables,
  APITypes.OnUpdatePhotoSubscription
>;
export const onDeletePhoto = /* GraphQL */ `subscription OnDeletePhoto(
  $filter: ModelSubscriptionPhotoFilterInput
  $owner: String
) {
  onDeletePhoto(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeletePhotoSubscriptionVariables,
  APITypes.OnDeletePhotoSubscription
>;
export const onCreatePhotoRecipient = /* GraphQL */ `subscription OnCreatePhotoRecipient(
  $filter: ModelSubscriptionPhotoRecipientFilterInput
  $recipientId: String
  $ownerId: String
) {
  onCreatePhotoRecipient(
    filter: $filter
    recipientId: $recipientId
    ownerId: $ownerId
  ) {
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
` as GeneratedSubscription<
  APITypes.OnCreatePhotoRecipientSubscriptionVariables,
  APITypes.OnCreatePhotoRecipientSubscription
>;
export const onUpdatePhotoRecipient = /* GraphQL */ `subscription OnUpdatePhotoRecipient(
  $filter: ModelSubscriptionPhotoRecipientFilterInput
  $recipientId: String
  $ownerId: String
) {
  onUpdatePhotoRecipient(
    filter: $filter
    recipientId: $recipientId
    ownerId: $ownerId
  ) {
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
` as GeneratedSubscription<
  APITypes.OnUpdatePhotoRecipientSubscriptionVariables,
  APITypes.OnUpdatePhotoRecipientSubscription
>;
export const onDeletePhotoRecipient = /* GraphQL */ `subscription OnDeletePhotoRecipient(
  $filter: ModelSubscriptionPhotoRecipientFilterInput
  $recipientId: String
  $ownerId: String
) {
  onDeletePhotoRecipient(
    filter: $filter
    recipientId: $recipientId
    ownerId: $ownerId
  ) {
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
` as GeneratedSubscription<
  APITypes.OnDeletePhotoRecipientSubscriptionVariables,
  APITypes.OnDeletePhotoRecipientSubscription
>;
