/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getUser = /* GraphQL */ `query GetUser($id: ID!) {
  getUser(id: $id) {
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
` as GeneratedQuery<APITypes.GetUserQueryVariables, APITypes.GetUserQuery>;
export const listUsers = /* GraphQL */ `query ListUsers(
  $id: ID
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUsers(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      id
      displayName
      faceCount
      primaryFaceId
      profilePhotoKey
      expoPushToken
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.ListUsersQueryVariables, APITypes.ListUsersQuery>;
export const syncUsers = /* GraphQL */ `query SyncUsers(
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
  $lastSync: AWSTimestamp
) {
  syncUsers(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    lastSync: $lastSync
  ) {
    items {
      id
      displayName
      faceCount
      primaryFaceId
      profilePhotoKey
      expoPushToken
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.SyncUsersQueryVariables, APITypes.SyncUsersQuery>;
export const searchUsers = /* GraphQL */ `query SearchUsers(
  $filter: SearchableUserFilterInput
  $sort: [SearchableUserSortInput]
  $limit: Int
  $nextToken: String
  $from: Int
  $aggregates: [SearchableUserAggregationInput]
) {
  searchUsers(
    filter: $filter
    sort: $sort
    limit: $limit
    nextToken: $nextToken
    from: $from
    aggregates: $aggregates
  ) {
    items {
      id
      displayName
      faceCount
      primaryFaceId
      profilePhotoKey
      expoPushToken
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    total
    aggregateItems {
      name
      result {
        ... on SearchableAggregateScalarResult {
          value
        }
        ... on SearchableAggregateBucketResult {
          buckets {
            key
            doc_count
            __typename
          }
        }
      }
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SearchUsersQueryVariables,
  APITypes.SearchUsersQuery
>;
export const getFriendship = /* GraphQL */ `query GetFriendship($id: ID!) {
  getFriendship(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetFriendshipQueryVariables,
  APITypes.GetFriendshipQuery
>;
export const listFriendships = /* GraphQL */ `query ListFriendships(
  $id: ID
  $filter: ModelFriendshipFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listFriendships(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListFriendshipsQueryVariables,
  APITypes.ListFriendshipsQuery
>;
export const syncFriendships = /* GraphQL */ `query SyncFriendships(
  $filter: ModelFriendshipFilterInput
  $limit: Int
  $nextToken: String
  $lastSync: AWSTimestamp
) {
  syncFriendships(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    lastSync: $lastSync
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SyncFriendshipsQueryVariables,
  APITypes.SyncFriendshipsQuery
>;
export const friendshipsByOwnerIdAndFriendId = /* GraphQL */ `query FriendshipsByOwnerIdAndFriendId(
  $ownerId: ID!
  $friendId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelFriendshipFilterInput
  $limit: Int
  $nextToken: String
) {
  friendshipsByOwnerIdAndFriendId(
    ownerId: $ownerId
    friendId: $friendId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.FriendshipsByOwnerIdAndFriendIdQueryVariables,
  APITypes.FriendshipsByOwnerIdAndFriendIdQuery
>;
export const friendshipsByFriendIdAndOwnerId = /* GraphQL */ `query FriendshipsByFriendIdAndOwnerId(
  $friendId: ID!
  $ownerId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelFriendshipFilterInput
  $limit: Int
  $nextToken: String
) {
  friendshipsByFriendIdAndOwnerId(
    friendId: $friendId
    ownerId: $ownerId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.FriendshipsByFriendIdAndOwnerIdQueryVariables,
  APITypes.FriendshipsByFriendIdAndOwnerIdQuery
>;
export const getSharedCamera = /* GraphQL */ `query GetSharedCamera($id: ID!) {
  getSharedCamera(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetSharedCameraQueryVariables,
  APITypes.GetSharedCameraQuery
>;
export const listSharedCameras = /* GraphQL */ `query ListSharedCameras(
  $id: ID
  $filter: ModelSharedCameraFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listSharedCameras(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      id
      name
      ownerId
      memberIds
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListSharedCamerasQueryVariables,
  APITypes.ListSharedCamerasQuery
>;
export const syncSharedCameras = /* GraphQL */ `query SyncSharedCameras(
  $filter: ModelSharedCameraFilterInput
  $limit: Int
  $nextToken: String
  $lastSync: AWSTimestamp
) {
  syncSharedCameras(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    lastSync: $lastSync
  ) {
    items {
      id
      name
      ownerId
      memberIds
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SyncSharedCamerasQueryVariables,
  APITypes.SyncSharedCamerasQuery
>;
export const sharedCamerasByOwnerIdAndCreatedAt = /* GraphQL */ `query SharedCamerasByOwnerIdAndCreatedAt(
  $ownerId: ID!
  $createdAt: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelSharedCameraFilterInput
  $limit: Int
  $nextToken: String
) {
  sharedCamerasByOwnerIdAndCreatedAt(
    ownerId: $ownerId
    createdAt: $createdAt
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      name
      ownerId
      memberIds
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SharedCamerasByOwnerIdAndCreatedAtQueryVariables,
  APITypes.SharedCamerasByOwnerIdAndCreatedAtQuery
>;
export const getSharedCameraMember = /* GraphQL */ `query GetSharedCameraMember($id: ID!) {
  getSharedCameraMember(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetSharedCameraMemberQueryVariables,
  APITypes.GetSharedCameraMemberQuery
>;
export const listSharedCameraMembers = /* GraphQL */ `query ListSharedCameraMembers(
  $id: ID
  $filter: ModelSharedCameraMemberFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listSharedCameraMembers(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListSharedCameraMembersQueryVariables,
  APITypes.ListSharedCameraMembersQuery
>;
export const syncSharedCameraMembers = /* GraphQL */ `query SyncSharedCameraMembers(
  $filter: ModelSharedCameraMemberFilterInput
  $limit: Int
  $nextToken: String
  $lastSync: AWSTimestamp
) {
  syncSharedCameraMembers(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    lastSync: $lastSync
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SyncSharedCameraMembersQueryVariables,
  APITypes.SyncSharedCameraMembersQuery
>;
export const sharedCameraMembersByCameraIdAndUserId = /* GraphQL */ `query SharedCameraMembersByCameraIdAndUserId(
  $cameraId: ID!
  $userId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelSharedCameraMemberFilterInput
  $limit: Int
  $nextToken: String
) {
  sharedCameraMembersByCameraIdAndUserId(
    cameraId: $cameraId
    userId: $userId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SharedCameraMembersByCameraIdAndUserIdQueryVariables,
  APITypes.SharedCameraMembersByCameraIdAndUserIdQuery
>;
export const sharedCameraMembersByUserIdAndCameraId = /* GraphQL */ `query SharedCameraMembersByUserIdAndCameraId(
  $userId: ID!
  $cameraId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelSharedCameraMemberFilterInput
  $limit: Int
  $nextToken: String
) {
  sharedCameraMembersByUserIdAndCameraId(
    userId: $userId
    cameraId: $cameraId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SharedCameraMembersByUserIdAndCameraIdQueryVariables,
  APITypes.SharedCameraMembersByUserIdAndCameraIdQuery
>;
export const getPhoto = /* GraphQL */ `query GetPhoto($id: ID!) {
  getPhoto(id: $id) {
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
` as GeneratedQuery<APITypes.GetPhotoQueryVariables, APITypes.GetPhotoQuery>;
export const listPhotos = /* GraphQL */ `query ListPhotos(
  $id: ID
  $filter: ModelPhotoFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listPhotos(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      id
      ownerId
      ownerIdentityId
      sharedCameraId
      s3Key
      thumbKey
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListPhotosQueryVariables,
  APITypes.ListPhotosQuery
>;
export const syncPhotos = /* GraphQL */ `query SyncPhotos(
  $filter: ModelPhotoFilterInput
  $limit: Int
  $nextToken: String
  $lastSync: AWSTimestamp
) {
  syncPhotos(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    lastSync: $lastSync
  ) {
    items {
      id
      ownerId
      ownerIdentityId
      sharedCameraId
      s3Key
      thumbKey
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SyncPhotosQueryVariables,
  APITypes.SyncPhotosQuery
>;
export const photosByOwnerIdAndCreatedAt = /* GraphQL */ `query PhotosByOwnerIdAndCreatedAt(
  $ownerId: ID!
  $createdAt: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelPhotoFilterInput
  $limit: Int
  $nextToken: String
) {
  photosByOwnerIdAndCreatedAt(
    ownerId: $ownerId
    createdAt: $createdAt
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      ownerId
      ownerIdentityId
      sharedCameraId
      s3Key
      thumbKey
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PhotosByOwnerIdAndCreatedAtQueryVariables,
  APITypes.PhotosByOwnerIdAndCreatedAtQuery
>;
export const photosBySharedCameraIdAndCreatedAt = /* GraphQL */ `query PhotosBySharedCameraIdAndCreatedAt(
  $sharedCameraId: ID!
  $createdAt: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelPhotoFilterInput
  $limit: Int
  $nextToken: String
) {
  photosBySharedCameraIdAndCreatedAt(
    sharedCameraId: $sharedCameraId
    createdAt: $createdAt
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      ownerId
      ownerIdentityId
      sharedCameraId
      s3Key
      thumbKey
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
      __typename
    }
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PhotosBySharedCameraIdAndCreatedAtQueryVariables,
  APITypes.PhotosBySharedCameraIdAndCreatedAtQuery
>;
export const getPhotoRecipient = /* GraphQL */ `query GetPhotoRecipient($id: ID!) {
  getPhotoRecipient(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetPhotoRecipientQueryVariables,
  APITypes.GetPhotoRecipientQuery
>;
export const listPhotoRecipients = /* GraphQL */ `query ListPhotoRecipients(
  $id: ID
  $filter: ModelPhotoRecipientFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listPhotoRecipients(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListPhotoRecipientsQueryVariables,
  APITypes.ListPhotoRecipientsQuery
>;
export const syncPhotoRecipients = /* GraphQL */ `query SyncPhotoRecipients(
  $filter: ModelPhotoRecipientFilterInput
  $limit: Int
  $nextToken: String
  $lastSync: AWSTimestamp
) {
  syncPhotoRecipients(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    lastSync: $lastSync
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.SyncPhotoRecipientsQueryVariables,
  APITypes.SyncPhotoRecipientsQuery
>;
export const photoRecipientsByPhotoIdAndRecipientId = /* GraphQL */ `query PhotoRecipientsByPhotoIdAndRecipientId(
  $photoId: ID!
  $recipientId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelPhotoRecipientFilterInput
  $limit: Int
  $nextToken: String
) {
  photoRecipientsByPhotoIdAndRecipientId(
    photoId: $photoId
    recipientId: $recipientId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PhotoRecipientsByPhotoIdAndRecipientIdQueryVariables,
  APITypes.PhotoRecipientsByPhotoIdAndRecipientIdQuery
>;
export const photoRecipientsByRecipientIdAndPhotoId = /* GraphQL */ `query PhotoRecipientsByRecipientIdAndPhotoId(
  $recipientId: ID!
  $photoId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelPhotoRecipientFilterInput
  $limit: Int
  $nextToken: String
) {
  photoRecipientsByRecipientIdAndPhotoId(
    recipientId: $recipientId
    photoId: $photoId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PhotoRecipientsByRecipientIdAndPhotoIdQueryVariables,
  APITypes.PhotoRecipientsByRecipientIdAndPhotoIdQuery
>;
export const photoRecipientsByRecipientIdAndCreatedAt = /* GraphQL */ `query PhotoRecipientsByRecipientIdAndCreatedAt(
  $recipientId: ID!
  $createdAt: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelPhotoRecipientFilterInput
  $limit: Int
  $nextToken: String
) {
  photoRecipientsByRecipientIdAndCreatedAt(
    recipientId: $recipientId
    createdAt: $createdAt
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PhotoRecipientsByRecipientIdAndCreatedAtQueryVariables,
  APITypes.PhotoRecipientsByRecipientIdAndCreatedAtQuery
>;
export const photoRecipientsByOwnerIdAndRecipientIdAndCreatedAt = /* GraphQL */ `query PhotoRecipientsByOwnerIdAndRecipientIdAndCreatedAt(
  $ownerId: ID!
  $recipientIdCreatedAt: ModelPhotoRecipientByOwnerCompositeKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelPhotoRecipientFilterInput
  $limit: Int
  $nextToken: String
) {
  photoRecipientsByOwnerIdAndRecipientIdAndCreatedAt(
    ownerId: $ownerId
    recipientIdCreatedAt: $recipientIdCreatedAt
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    startedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PhotoRecipientsByOwnerIdAndRecipientIdAndCreatedAtQueryVariables,
  APITypes.PhotoRecipientsByOwnerIdAndRecipientIdAndCreatedAtQuery
>;
