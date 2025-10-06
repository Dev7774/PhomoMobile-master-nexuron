/* Custom optimized GraphQL queries for better performance */

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

// Custom types for optimized GraphQL queries
export type BatchGetUsersQueryVariables = {
  userFilters: Array<APITypes.ModelUserFilterInput>;
  limit?: number;
  nextToken?: string;
};

export type BatchGetCamerasQueryVariables = {
  cameraFilters: Array<APITypes.ModelSharedCameraFilterInput>;
  limit?: number;
  nextToken?: string;
};

export type GetAllUserPhotosQueryVariables = {
  userId: string;
  limit?: number;
  nextTokenOwned?: string;
  nextTokenReceived?: string;
};

export type GetAllUserPhotosQuery = {
  owned?: {
    __typename: "ModelPhotoConnection";
    items: Array<{
      __typename: "Photo";
      id: string;
      ownerId: string;
      ownerIdentityId: string;
      s3Key: string;
      createdAt: string;
    } | null>;
    nextToken?: string | null;
  } | null;
  received?: {
    __typename: "ModelPhotoRecipientConnection";
    items: Array<{
      __typename: "PhotoRecipient";
      photoId: string;
    } | null>;
    nextToken?: string | null;
  } | null;
};

export type GetAllUserFriendshipsQueryVariables = {
  userId: string;
};

export type GetAllUserFriendshipsQuery = {
  outgoing?: {
    __typename: "ModelFriendshipConnection";
    items: Array<{
      __typename: "Friendship";
      friendId: string;
      status: string;
    } | null>;
  } | null;
  incoming?: {
    __typename: "ModelFriendshipConnection";
    items: Array<{
      __typename: "Friendship";
      ownerId: string;
      status: string;
    } | null>;
  } | null;
};

export type GetSharedPhotosOptimizedQueryVariables = {
  userA: string;
  userB: string;
  limit?: number;
  nextTokenAtoB?: string;
  nextTokenBtoA?: string;
  nextTokenReceivedA?: string;
  nextTokenReceivedB?: string;
};

export type GetSharedPhotosOptimizedQuery = {
  fromAtoB?: {
    __typename: "ModelPhotoRecipientConnection";
    items: Array<{
      __typename: "PhotoRecipient";
      id: string;
      photoId: string;
      recipientId: string;
      ownerId: string;
      createdAt: string;
    } | null>;
    nextToken?: string | null;
  } | null;
  fromBtoA?: {
    __typename: "ModelPhotoRecipientConnection";
    items: Array<{
      __typename: "PhotoRecipient";
      id: string;
      photoId: string;
      recipientId: string;
      ownerId: string;
      createdAt: string;
    } | null>;
    nextToken?: string | null;
  } | null;
  receivedByA?: {
    __typename: "ModelPhotoRecipientConnection";
    items: Array<{
      __typename: "PhotoRecipient";
      id: string;
      photoId: string;
      recipientId: string;
      ownerId: string;
      createdAt: string;
    } | null>;
    nextToken?: string | null;
  } | null;
  receivedByB?: {
    __typename: "ModelPhotoRecipientConnection";
    items: Array<{
      __typename: "PhotoRecipient";
      id: string;
      photoId: string;
      recipientId: string;
      ownerId: string;
      createdAt: string;
    } | null>;
    nextToken?: string | null;
  } | null;
};

// Batch fetch users by IDs using OR operator - replaces multiple individual getUser calls
export const batchGetUsers = /* GraphQL */ `
  query BatchGetUsers(
    $userFilters: [ModelUserFilterInput!]!
    $limit: Int = 100
    $nextToken: String
  ) {
    listUsers(
      filter: {
        or: $userFilters
        _deleted: { ne: true }
      }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        displayName
        profilePhotoKey
        createdAt
        updatedAt
        _version
        _deleted
        __typename
      }
      nextToken
    }
  }
` as GeneratedQuery<BatchGetUsersQueryVariables, APITypes.ListUsersQuery>;

// Get all photos a user has access to (owned + received) in one query
export const getAllUserPhotos = /* GraphQL */ `
  query GetAllUserPhotos(
    $userId: ID!
    $limit: Int = 30
    $nextTokenOwned: String
    $nextTokenReceived: String
  ) {
    owned: photosByOwnerIdAndCreatedAt(
      ownerId: $userId
      limit: $limit
      nextToken: $nextTokenOwned
      sortDirection: DESC
      filter: { _deleted: { ne: true } }
    ) {
      items {
        id
        ownerId
        ownerIdentityId
        s3Key
        createdAt
        __typename
      }
      nextToken
    }
    received: photoRecipientsByRecipientIdAndPhotoId(
      recipientId: $userId
      limit: $limit
      nextToken: $nextTokenReceived
      filter: { _deleted: { ne: true } }
    ) {
      items {
        photoId
        __typename
      }
      nextToken
    }
  }
` as GeneratedQuery<GetAllUserPhotosQueryVariables, GetAllUserPhotosQuery>;

// Batch get multiple cameras by IDs using OR operator
export const batchGetCameras = /* GraphQL */ `
  query BatchGetCameras(
    $cameraFilters: [ModelSharedCameraFilterInput!]!
    $limit: Int = 50
    $nextToken: String
  ) {
    listSharedCameras(
      filter: {
        and: [
          { or: $cameraFilters }
          { _deleted: { ne: true } }
        ]
      }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        name
        ownerId
        memberIds
        createdAt
        __typename
      }
      nextToken
    }
  }
` as GeneratedQuery<
  BatchGetCamerasQueryVariables,
  APITypes.ListSharedCamerasQuery
>;

// Get user friendships (both directions) in one query
export const getAllUserFriendships = /* GraphQL */ `
  query GetAllUserFriendships($userId: ID!) {
    outgoing: friendshipsByOwnerIdAndFriendId(
      ownerId: $userId
      filter: {
        status: { eq: "ACCEPTED" }
        _deleted: { ne: true }
      }
      limit: 100
    ) {
      items {
        friendId
        status
        __typename
      }
    }
    incoming: friendshipsByFriendIdAndOwnerId(
      friendId: $userId
      filter: {
        status: { eq: "ACCEPTED" }
        _deleted: { ne: true }
      }
      limit: 100
    ) {
      items {
        ownerId
        status
        __typename
      }
    }
  }
` as GeneratedQuery<
  GetAllUserFriendshipsQueryVariables,
  GetAllUserFriendshipsQuery
>;

// Optimized query for getting shared photos between two users
// Uses new PhotoRecipient indexes: byOwner and byRecipientCreated
export const getSharedPhotosOptimized = /* GraphQL */ `
  query GetSharedPhotosOptimized(
    $userA: ID!
    $userB: ID!
    $limit: Int = 100
    $nextTokenAtoB: String
    $nextTokenBtoA: String
    $nextTokenReceivedA: String
    $nextTokenReceivedB: String
  ) {
    # Photos from A shared with B (A→B)
    fromAtoB: photoRecipientsByOwnerIdAndRecipientIdAndCreatedAt(
      ownerId: $userA
      recipientIdCreatedAt: { beginsWith: { recipientId: $userB } }
      limit: $limit
      nextToken: $nextTokenAtoB
      sortDirection: DESC
      filter: { _deleted: { ne: true } }
    ) {
      items {
        id
        photoId
        recipientId
        ownerId
        createdAt
        __typename
      }
      nextToken
    }

    # Photos from B shared with A (B→A)
    fromBtoA: photoRecipientsByOwnerIdAndRecipientIdAndCreatedAt(
      ownerId: $userB
      recipientIdCreatedAt: { beginsWith: { recipientId: $userA } }
      limit: $limit
      nextToken: $nextTokenBtoA
      sortDirection: DESC
      filter: { _deleted: { ne: true } }
    ) {
      items {
        id
        photoId
        recipientId
        ownerId
        createdAt
        __typename
      }
      nextToken
    }

    # All photos received by A (for intersection calculation)
    receivedByA: photoRecipientsByRecipientIdAndCreatedAt(
      recipientId: $userA
      limit: $limit
      nextToken: $nextTokenReceivedA
      sortDirection: DESC
      filter: { _deleted: { ne: true } }
    ) {
      items {
        id
        photoId
        recipientId
        ownerId
        createdAt
        __typename
      }
      nextToken
    }

    # All photos received by B (for intersection calculation)
    receivedByB: photoRecipientsByRecipientIdAndCreatedAt(
      recipientId: $userB
      limit: $limit
      nextToken: $nextTokenReceivedB
      sortDirection: DESC
      filter: { _deleted: { ne: true } }
    ) {
      items {
        id
        photoId
        recipientId
        ownerId
        createdAt
        __typename
      }
      nextToken
    }
  }
` as GeneratedQuery<
  GetSharedPhotosOptimizedQueryVariables,
  GetSharedPhotosOptimizedQuery
>;
