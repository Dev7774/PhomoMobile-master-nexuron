/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type UpdateUserFaceResult = {
  __typename: "UpdateUserFaceResult",
  success: boolean,
  faceId?: string | null,
  newFaceCount?: number | null,
  message?: string | null,
  error?: string | null,
};

export type FaceProcessingResult = {
  __typename: "FaceProcessingResult",
  facesDetected: number,
  friendsMatched: number,
  matches:  Array<FaceMatch >,
};

export type FaceMatch = {
  __typename: "FaceMatch",
  userId: string,
  confidence: number,
  boundingBox: BoundingBox,
};

export type BoundingBox = {
  __typename: "BoundingBox",
  left: number,
  top: number,
  width: number,
  height: number,
};

export type DeleteUserFaceResult = {
  __typename: "DeleteUserFaceResult",
  success: boolean,
  message?: string | null,
  error?: string | null,
};

export type CreateUserInput = {
  id?: string | null,
  displayName?: string | null,
  faceCount?: number | null,
  primaryFaceId?: string | null,
  profilePhotoKey?: string | null,
  expoPushToken?: string | null,
  _version?: number | null,
};

export type ModelUserConditionInput = {
  displayName?: ModelStringInput | null,
  faceCount?: ModelIntInput | null,
  primaryFaceId?: ModelStringInput | null,
  profilePhotoKey?: ModelStringInput | null,
  expoPushToken?: ModelStringInput | null,
  and?: Array< ModelUserConditionInput | null > | null,
  or?: Array< ModelUserConditionInput | null > | null,
  not?: ModelUserConditionInput | null,
  _deleted?: ModelBooleanInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type ModelIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type ModelBooleanInput = {
  ne?: boolean | null,
  eq?: boolean | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type User = {
  __typename: "User",
  id: string,
  displayName?: string | null,
  faceCount?: number | null,
  primaryFaceId?: string | null,
  profilePhotoKey?: string | null,
  expoPushToken?: string | null,
  photos?: ModelPhotoConnection | null,
  createdAt: string,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type ModelPhotoConnection = {
  __typename: "ModelPhotoConnection",
  items:  Array<Photo | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type Photo = {
  __typename: "Photo",
  id: string,
  ownerId: string,
  ownerIdentityId: string,
  sharedCameraId?: string | null,
  s3Key: string,
  thumbKey?: string | null,
  createdAt: string,
  recipients?: ModelPhotoRecipientConnection | null,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type ModelPhotoRecipientConnection = {
  __typename: "ModelPhotoRecipientConnection",
  items:  Array<PhotoRecipient | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type PhotoRecipient = {
  __typename: "PhotoRecipient",
  id: string,
  photoId: string,
  recipientId: string,
  ownerId: string,
  confidence?: number | null,
  method?: string | null,
  createdAt: string,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
};

export type UpdateUserInput = {
  id: string,
  displayName?: string | null,
  faceCount?: number | null,
  primaryFaceId?: string | null,
  profilePhotoKey?: string | null,
  expoPushToken?: string | null,
  _version?: number | null,
};

export type DeleteUserInput = {
  id: string,
  _version?: number | null,
};

export type CreateFriendshipInput = {
  id?: string | null,
  ownerId: string,
  friendId: string,
  status: string,
  createdAt?: string | null,
  _version?: number | null,
};

export type ModelFriendshipConditionInput = {
  ownerId?: ModelIDInput | null,
  friendId?: ModelIDInput | null,
  status?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelFriendshipConditionInput | null > | null,
  or?: Array< ModelFriendshipConditionInput | null > | null,
  not?: ModelFriendshipConditionInput | null,
  _deleted?: ModelBooleanInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export type Friendship = {
  __typename: "Friendship",
  id: string,
  ownerId: string,
  friendId: string,
  status: string,
  createdAt?: string | null,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type UpdateFriendshipInput = {
  id: string,
  ownerId?: string | null,
  friendId?: string | null,
  status?: string | null,
  createdAt?: string | null,
  _version?: number | null,
};

export type DeleteFriendshipInput = {
  id: string,
  _version?: number | null,
};

export type CreateSharedCameraInput = {
  id?: string | null,
  name: string,
  ownerId: string,
  memberIds: Array< string >,
  createdAt?: string | null,
  _version?: number | null,
};

export type ModelSharedCameraConditionInput = {
  name?: ModelStringInput | null,
  ownerId?: ModelIDInput | null,
  memberIds?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelSharedCameraConditionInput | null > | null,
  or?: Array< ModelSharedCameraConditionInput | null > | null,
  not?: ModelSharedCameraConditionInput | null,
  _deleted?: ModelBooleanInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type SharedCamera = {
  __typename: "SharedCamera",
  id: string,
  name: string,
  ownerId: string,
  memberIds: Array< string >,
  createdAt: string,
  photos?: ModelPhotoConnection | null,
  members?: ModelSharedCameraMemberConnection | null,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type ModelSharedCameraMemberConnection = {
  __typename: "ModelSharedCameraMemberConnection",
  items:  Array<SharedCameraMember | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type SharedCameraMember = {
  __typename: "SharedCameraMember",
  id: string,
  cameraId: string,
  userId: string,
  role: string,
  addedAt: string,
  createdAt: string,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type UpdateSharedCameraInput = {
  id: string,
  name?: string | null,
  ownerId?: string | null,
  memberIds?: Array< string > | null,
  createdAt?: string | null,
  _version?: number | null,
};

export type DeleteSharedCameraInput = {
  id: string,
  _version?: number | null,
};

export type CreateSharedCameraMemberInput = {
  id?: string | null,
  cameraId: string,
  userId: string,
  role: string,
  addedAt: string,
  _version?: number | null,
};

export type ModelSharedCameraMemberConditionInput = {
  cameraId?: ModelIDInput | null,
  userId?: ModelIDInput | null,
  role?: ModelStringInput | null,
  addedAt?: ModelStringInput | null,
  and?: Array< ModelSharedCameraMemberConditionInput | null > | null,
  or?: Array< ModelSharedCameraMemberConditionInput | null > | null,
  not?: ModelSharedCameraMemberConditionInput | null,
  _deleted?: ModelBooleanInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type UpdateSharedCameraMemberInput = {
  id: string,
  cameraId?: string | null,
  userId?: string | null,
  role?: string | null,
  addedAt?: string | null,
  _version?: number | null,
};

export type DeleteSharedCameraMemberInput = {
  id: string,
  _version?: number | null,
};

export type CreatePhotoInput = {
  id?: string | null,
  ownerId: string,
  ownerIdentityId: string,
  sharedCameraId?: string | null,
  s3Key: string,
  thumbKey?: string | null,
  createdAt?: string | null,
  _version?: number | null,
};

export type ModelPhotoConditionInput = {
  ownerId?: ModelIDInput | null,
  ownerIdentityId?: ModelStringInput | null,
  sharedCameraId?: ModelIDInput | null,
  s3Key?: ModelStringInput | null,
  thumbKey?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelPhotoConditionInput | null > | null,
  or?: Array< ModelPhotoConditionInput | null > | null,
  not?: ModelPhotoConditionInput | null,
  _deleted?: ModelBooleanInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type UpdatePhotoInput = {
  id: string,
  ownerId?: string | null,
  ownerIdentityId?: string | null,
  sharedCameraId?: string | null,
  s3Key?: string | null,
  thumbKey?: string | null,
  createdAt?: string | null,
  _version?: number | null,
};

export type DeletePhotoInput = {
  id: string,
  _version?: number | null,
};

export type CreatePhotoRecipientInput = {
  id?: string | null,
  photoId: string,
  recipientId: string,
  ownerId: string,
  confidence?: number | null,
  method?: string | null,
  createdAt?: string | null,
  _version?: number | null,
};

export type ModelPhotoRecipientConditionInput = {
  photoId?: ModelIDInput | null,
  recipientId?: ModelIDInput | null,
  ownerId?: ModelIDInput | null,
  confidence?: ModelFloatInput | null,
  method?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelPhotoRecipientConditionInput | null > | null,
  or?: Array< ModelPhotoRecipientConditionInput | null > | null,
  not?: ModelPhotoRecipientConditionInput | null,
  _deleted?: ModelBooleanInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelFloatInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type UpdatePhotoRecipientInput = {
  id: string,
  photoId?: string | null,
  recipientId?: string | null,
  ownerId?: string | null,
  confidence?: number | null,
  method?: string | null,
  createdAt?: string | null,
  _version?: number | null,
};

export type DeletePhotoRecipientInput = {
  id: string,
  _version?: number | null,
};

export type AcceptInviteResult = {
  __typename: "AcceptInviteResult",
  success: boolean,
  message: string,
  cameraId: string,
  cameraName: string,
  role: string,
  inviterName?: string | null,
};

export type ModelUserFilterInput = {
  id?: ModelIDInput | null,
  displayName?: ModelStringInput | null,
  faceCount?: ModelIntInput | null,
  primaryFaceId?: ModelStringInput | null,
  profilePhotoKey?: ModelStringInput | null,
  expoPushToken?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserFilterInput | null > | null,
  or?: Array< ModelUserFilterInput | null > | null,
  not?: ModelUserFilterInput | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelUserConnection = {
  __typename: "ModelUserConnection",
  items:  Array<User | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type ModelSharedCameraFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  ownerId?: ModelIDInput | null,
  memberIds?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelSharedCameraFilterInput | null > | null,
  or?: Array< ModelSharedCameraFilterInput | null > | null,
  not?: ModelSharedCameraFilterInput | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelSharedCameraConnection = {
  __typename: "ModelSharedCameraConnection",
  items:  Array<SharedCamera | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type ModelFriendshipConnection = {
  __typename: "ModelFriendshipConnection",
  items:  Array<Friendship | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type SearchableUserFilterInput = {
  id?: SearchableIDFilterInput | null,
  displayName?: SearchableStringFilterInput | null,
  faceCount?: SearchableIntFilterInput | null,
  primaryFaceId?: SearchableStringFilterInput | null,
  profilePhotoKey?: SearchableStringFilterInput | null,
  expoPushToken?: SearchableStringFilterInput | null,
  createdAt?: SearchableStringFilterInput | null,
  updatedAt?: SearchableStringFilterInput | null,
  _version?: SearchableIntFilterInput | null,
  _deleted?: SearchableBooleanFilterInput | null,
  _lastChangedAt?: SearchableIntFilterInput | null,
  and?: Array< SearchableUserFilterInput | null > | null,
  or?: Array< SearchableUserFilterInput | null > | null,
  not?: SearchableUserFilterInput | null,
};

export type SearchableIDFilterInput = {
  ne?: string | null,
  gt?: string | null,
  lt?: string | null,
  gte?: string | null,
  lte?: string | null,
  eq?: string | null,
  match?: string | null,
  matchPhrase?: string | null,
  matchPhrasePrefix?: string | null,
  multiMatch?: string | null,
  exists?: boolean | null,
  wildcard?: string | null,
  regexp?: string | null,
  range?: Array< string | null > | null,
};

export type SearchableStringFilterInput = {
  ne?: string | null,
  gt?: string | null,
  lt?: string | null,
  gte?: string | null,
  lte?: string | null,
  eq?: string | null,
  match?: string | null,
  matchPhrase?: string | null,
  matchPhrasePrefix?: string | null,
  multiMatch?: string | null,
  exists?: boolean | null,
  wildcard?: string | null,
  regexp?: string | null,
  range?: Array< string | null > | null,
};

export type SearchableIntFilterInput = {
  ne?: number | null,
  gt?: number | null,
  lt?: number | null,
  gte?: number | null,
  lte?: number | null,
  eq?: number | null,
  range?: Array< number | null > | null,
};

export type SearchableBooleanFilterInput = {
  eq?: boolean | null,
  ne?: boolean | null,
};

export type SearchableUserSortInput = {
  field?: SearchableUserSortableFields | null,
  direction?: SearchableSortDirection | null,
};

export enum SearchableUserSortableFields {
  id = "id",
  displayName = "displayName",
  faceCount = "faceCount",
  primaryFaceId = "primaryFaceId",
  profilePhotoKey = "profilePhotoKey",
  expoPushToken = "expoPushToken",
  createdAt = "createdAt",
  updatedAt = "updatedAt",
  _version = "_version",
  _deleted = "_deleted",
  _lastChangedAt = "_lastChangedAt",
}


export enum SearchableSortDirection {
  asc = "asc",
  desc = "desc",
}


export type SearchableUserAggregationInput = {
  name: string,
  type: SearchableAggregateType,
  field: SearchableUserAggregateField,
};

export enum SearchableAggregateType {
  terms = "terms",
  avg = "avg",
  min = "min",
  max = "max",
  sum = "sum",
  cardinality = "cardinality",
}


export enum SearchableUserAggregateField {
  id = "id",
  displayName = "displayName",
  faceCount = "faceCount",
  primaryFaceId = "primaryFaceId",
  profilePhotoKey = "profilePhotoKey",
  expoPushToken = "expoPushToken",
  createdAt = "createdAt",
  updatedAt = "updatedAt",
  _version = "_version",
  _deleted = "_deleted",
  _lastChangedAt = "_lastChangedAt",
}


export type SearchableUserConnection = {
  __typename: "SearchableUserConnection",
  items:  Array<User | null >,
  nextToken?: string | null,
  total?: number | null,
  aggregateItems:  Array<SearchableAggregateResult | null >,
};

export type SearchableAggregateResult = {
  __typename: "SearchableAggregateResult",
  name: string,
  result?: SearchableAggregateGenericResult | null,
};

export type SearchableAggregateGenericResult = SearchableAggregateScalarResult | SearchableAggregateBucketResult


export type SearchableAggregateScalarResult = {
  __typename: "SearchableAggregateScalarResult",
  value: number,
};

export type SearchableAggregateBucketResult = {
  __typename: "SearchableAggregateBucketResult",
  buckets?:  Array<SearchableAggregateBucketResultItem | null > | null,
};

export type SearchableAggregateBucketResultItem = {
  __typename: "SearchableAggregateBucketResultItem",
  key: string,
  doc_count: number,
};

export type ModelFriendshipFilterInput = {
  id?: ModelIDInput | null,
  ownerId?: ModelIDInput | null,
  friendId?: ModelIDInput | null,
  status?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelFriendshipFilterInput | null > | null,
  or?: Array< ModelFriendshipFilterInput | null > | null,
  not?: ModelFriendshipFilterInput | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelIDKeyConditionInput = {
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
};

export type ModelStringKeyConditionInput = {
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
};

export type ModelSharedCameraMemberFilterInput = {
  id?: ModelIDInput | null,
  cameraId?: ModelIDInput | null,
  userId?: ModelIDInput | null,
  role?: ModelStringInput | null,
  addedAt?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelSharedCameraMemberFilterInput | null > | null,
  or?: Array< ModelSharedCameraMemberFilterInput | null > | null,
  not?: ModelSharedCameraMemberFilterInput | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelPhotoFilterInput = {
  id?: ModelIDInput | null,
  ownerId?: ModelIDInput | null,
  ownerIdentityId?: ModelStringInput | null,
  sharedCameraId?: ModelIDInput | null,
  s3Key?: ModelStringInput | null,
  thumbKey?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelPhotoFilterInput | null > | null,
  or?: Array< ModelPhotoFilterInput | null > | null,
  not?: ModelPhotoFilterInput | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelPhotoRecipientFilterInput = {
  id?: ModelIDInput | null,
  photoId?: ModelIDInput | null,
  recipientId?: ModelIDInput | null,
  ownerId?: ModelIDInput | null,
  confidence?: ModelFloatInput | null,
  method?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelPhotoRecipientFilterInput | null > | null,
  or?: Array< ModelPhotoRecipientFilterInput | null > | null,
  not?: ModelPhotoRecipientFilterInput | null,
  _deleted?: ModelBooleanInput | null,
};

export type ModelPhotoRecipientByOwnerCompositeKeyConditionInput = {
  eq?: ModelPhotoRecipientByOwnerCompositeKeyInput | null,
  le?: ModelPhotoRecipientByOwnerCompositeKeyInput | null,
  lt?: ModelPhotoRecipientByOwnerCompositeKeyInput | null,
  ge?: ModelPhotoRecipientByOwnerCompositeKeyInput | null,
  gt?: ModelPhotoRecipientByOwnerCompositeKeyInput | null,
  between?: Array< ModelPhotoRecipientByOwnerCompositeKeyInput | null > | null,
  beginsWith?: ModelPhotoRecipientByOwnerCompositeKeyInput | null,
};

export type ModelPhotoRecipientByOwnerCompositeKeyInput = {
  recipientId?: string | null,
  createdAt?: string | null,
};

export type ModelSubscriptionUserFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  displayName?: ModelSubscriptionStringInput | null,
  faceCount?: ModelSubscriptionIntInput | null,
  primaryFaceId?: ModelSubscriptionStringInput | null,
  profilePhotoKey?: ModelSubscriptionStringInput | null,
  expoPushToken?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserFilterInput | null > | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionFriendshipFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  ownerId?: ModelSubscriptionIDInput | null,
  status?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionFriendshipFilterInput | null > | null,
  or?: Array< ModelSubscriptionFriendshipFilterInput | null > | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
  friendId?: ModelStringInput | null,
};

export type ModelSubscriptionSharedCameraFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  ownerId?: ModelSubscriptionIDInput | null,
  memberIds?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionSharedCameraFilterInput | null > | null,
  or?: Array< ModelSubscriptionSharedCameraFilterInput | null > | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionSharedCameraMemberFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  cameraId?: ModelSubscriptionIDInput | null,
  role?: ModelSubscriptionStringInput | null,
  addedAt?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionSharedCameraMemberFilterInput | null > | null,
  or?: Array< ModelSubscriptionSharedCameraMemberFilterInput | null > | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
  userId?: ModelStringInput | null,
};

export type ModelSubscriptionPhotoFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  ownerId?: ModelSubscriptionIDInput | null,
  ownerIdentityId?: ModelSubscriptionStringInput | null,
  s3Key?: ModelSubscriptionStringInput | null,
  thumbKey?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionPhotoFilterInput | null > | null,
  or?: Array< ModelSubscriptionPhotoFilterInput | null > | null,
  _deleted?: ModelBooleanInput | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionPhotoRecipientFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  photoId?: ModelSubscriptionIDInput | null,
  confidence?: ModelSubscriptionFloatInput | null,
  method?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionPhotoRecipientFilterInput | null > | null,
  or?: Array< ModelSubscriptionPhotoRecipientFilterInput | null > | null,
  _deleted?: ModelBooleanInput | null,
  recipientId?: ModelStringInput | null,
  ownerId?: ModelStringInput | null,
};

export type ModelSubscriptionFloatInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type EnrollUserFaceMutationVariables = {
  userId: string,
  s3Key: string,
};

export type EnrollUserFaceMutation = {
  enrollUserFace?: boolean | null,
};

export type UpdateUserFaceMutationVariables = {
  userId: string,
  s3Key: string,
};

export type UpdateUserFaceMutation = {
  updateUserFace?:  {
    __typename: "UpdateUserFaceResult",
    success: boolean,
    faceId?: string | null,
    newFaceCount?: number | null,
    message?: string | null,
    error?: string | null,
  } | null,
};

export type ProcessPhotoFacesMutationVariables = {
  photoId: string,
  s3Key: string,
  ownerId: string,
  sharedCameraId?: string | null,
};

export type ProcessPhotoFacesMutation = {
  processPhotoFaces?:  {
    __typename: "FaceProcessingResult",
    facesDetected: number,
    friendsMatched: number,
    matches:  Array< {
      __typename: "FaceMatch",
      userId: string,
      confidence: number,
    } >,
  } | null,
};

export type DeleteUserFaceMutationVariables = {
  userId: string,
  identityId: string,
};

export type DeleteUserFaceMutation = {
  deleteUserFace?:  {
    __typename: "DeleteUserFaceResult",
    success: boolean,
    message?: string | null,
    error?: string | null,
  } | null,
};

export type CreateUserMutationVariables = {
  input: CreateUserInput,
  condition?: ModelUserConditionInput | null,
};

export type CreateUserMutation = {
  createUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type UpdateUserMutationVariables = {
  input: UpdateUserInput,
  condition?: ModelUserConditionInput | null,
};

export type UpdateUserMutation = {
  updateUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type DeleteUserMutationVariables = {
  input: DeleteUserInput,
  condition?: ModelUserConditionInput | null,
};

export type DeleteUserMutation = {
  deleteUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreateFriendshipMutationVariables = {
  input: CreateFriendshipInput,
  condition?: ModelFriendshipConditionInput | null,
};

export type CreateFriendshipMutation = {
  createFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type UpdateFriendshipMutationVariables = {
  input: UpdateFriendshipInput,
  condition?: ModelFriendshipConditionInput | null,
};

export type UpdateFriendshipMutation = {
  updateFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type DeleteFriendshipMutationVariables = {
  input: DeleteFriendshipInput,
  condition?: ModelFriendshipConditionInput | null,
};

export type DeleteFriendshipMutation = {
  deleteFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreateSharedCameraMutationVariables = {
  input: CreateSharedCameraInput,
  condition?: ModelSharedCameraConditionInput | null,
};

export type CreateSharedCameraMutation = {
  createSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type UpdateSharedCameraMutationVariables = {
  input: UpdateSharedCameraInput,
  condition?: ModelSharedCameraConditionInput | null,
};

export type UpdateSharedCameraMutation = {
  updateSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type DeleteSharedCameraMutationVariables = {
  input: DeleteSharedCameraInput,
  condition?: ModelSharedCameraConditionInput | null,
};

export type DeleteSharedCameraMutation = {
  deleteSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreateSharedCameraMemberMutationVariables = {
  input: CreateSharedCameraMemberInput,
  condition?: ModelSharedCameraMemberConditionInput | null,
};

export type CreateSharedCameraMemberMutation = {
  createSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type UpdateSharedCameraMemberMutationVariables = {
  input: UpdateSharedCameraMemberInput,
  condition?: ModelSharedCameraMemberConditionInput | null,
};

export type UpdateSharedCameraMemberMutation = {
  updateSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type DeleteSharedCameraMemberMutationVariables = {
  input: DeleteSharedCameraMemberInput,
  condition?: ModelSharedCameraMemberConditionInput | null,
};

export type DeleteSharedCameraMemberMutation = {
  deleteSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreatePhotoMutationVariables = {
  input: CreatePhotoInput,
  condition?: ModelPhotoConditionInput | null,
};

export type CreatePhotoMutation = {
  createPhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type UpdatePhotoMutationVariables = {
  input: UpdatePhotoInput,
  condition?: ModelPhotoConditionInput | null,
};

export type UpdatePhotoMutation = {
  updatePhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type DeletePhotoMutationVariables = {
  input: DeletePhotoInput,
  condition?: ModelPhotoConditionInput | null,
};

export type DeletePhotoMutation = {
  deletePhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreatePhotoRecipientMutationVariables = {
  input: CreatePhotoRecipientInput,
  condition?: ModelPhotoRecipientConditionInput | null,
};

export type CreatePhotoRecipientMutation = {
  createPhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type UpdatePhotoRecipientMutationVariables = {
  input: UpdatePhotoRecipientInput,
  condition?: ModelPhotoRecipientConditionInput | null,
};

export type UpdatePhotoRecipientMutation = {
  updatePhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type DeletePhotoRecipientMutationVariables = {
  input: DeletePhotoRecipientInput,
  condition?: ModelPhotoRecipientConditionInput | null,
};

export type DeletePhotoRecipientMutation = {
  deletePhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type GenerateCameraInviteMutationVariables = {
  cameraId: string,
  cameraName: string,
  inviterUserId: string,
  inviterName: string,
};

export type GenerateCameraInviteMutation = {
  generateCameraInvite?: string | null,
};

export type AcceptCameraInviteMutationVariables = {
  token: string,
  userId: string,
};

export type AcceptCameraInviteMutation = {
  acceptCameraInvite?:  {
    __typename: "AcceptInviteResult",
    success: boolean,
    message: string,
    cameraId: string,
    cameraName: string,
    role: string,
    inviterName?: string | null,
  } | null,
};

export type BatchGetUsersQueryVariables = {
  userFilters: Array< ModelUserFilterInput >,
  limit?: number | null,
  nextToken?: string | null,
};

export type BatchGetUsersQuery = {
  listUsers?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      displayName?: string | null,
      profilePhotoKey?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetAllUserPhotosQueryVariables = {
  userId: string,
  limit?: number | null,
  nextTokenOwned?: string | null,
  nextTokenReceived?: string | null,
};

export type GetAllUserPhotosQuery = {
  owned?:  {
    __typename: "ModelPhotoConnection",
    items:  Array< {
      __typename: "Photo",
      id: string,
      ownerId: string,
      ownerIdentityId: string,
      s3Key: string,
      createdAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
  received?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      photoId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type BatchGetCamerasQueryVariables = {
  cameraFilters: Array< ModelSharedCameraFilterInput >,
  limit?: number | null,
  nextToken?: string | null,
};

export type BatchGetCamerasQuery = {
  listSharedCameras?:  {
    __typename: "ModelSharedCameraConnection",
    items:  Array< {
      __typename: "SharedCamera",
      id: string,
      name: string,
      ownerId: string,
      memberIds: Array< string >,
      createdAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetAllUserFriendshipsQueryVariables = {
  userId: string,
};

export type GetAllUserFriendshipsQuery = {
  outgoing?:  {
    __typename: "ModelFriendshipConnection",
    items:  Array< {
      __typename: "Friendship",
      friendId: string,
      status: string,
    } | null >,
  } | null,
  incoming?:  {
    __typename: "ModelFriendshipConnection",
    items:  Array< {
      __typename: "Friendship",
      ownerId: string,
      status: string,
    } | null >,
  } | null,
};

export type GetUserQueryVariables = {
  id: string,
};

export type GetUserQuery = {
  getUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type ListUsersQueryVariables = {
  id?: string | null,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUsersQuery = {
  listUsers?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      displayName?: string | null,
      faceCount?: number | null,
      primaryFaceId?: string | null,
      profilePhotoKey?: string | null,
      expoPushToken?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncUsersQueryVariables = {
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncUsersQuery = {
  syncUsers?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      displayName?: string | null,
      faceCount?: number | null,
      primaryFaceId?: string | null,
      profilePhotoKey?: string | null,
      expoPushToken?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SearchUsersQueryVariables = {
  filter?: SearchableUserFilterInput | null,
  sort?: Array< SearchableUserSortInput | null > | null,
  limit?: number | null,
  nextToken?: string | null,
  from?: number | null,
  aggregates?: Array< SearchableUserAggregationInput | null > | null,
};

export type SearchUsersQuery = {
  searchUsers?:  {
    __typename: "SearchableUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      displayName?: string | null,
      faceCount?: number | null,
      primaryFaceId?: string | null,
      profilePhotoKey?: string | null,
      expoPushToken?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    total?: number | null,
    aggregateItems:  Array< {
      __typename: "SearchableAggregateResult",
      name: string,
      result: ( {
          __typename: "SearchableAggregateScalarResult",
          value: number,
        } | {
          __typename: "SearchableAggregateBucketResult",
          buckets?:  Array< {
            __typename: string,
            key: string,
            doc_count: number,
          } | null > | null,
        }
      ) | null,
    } | null >,
  } | null,
};

export type GetFriendshipQueryVariables = {
  id: string,
};

export type GetFriendshipQuery = {
  getFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type ListFriendshipsQueryVariables = {
  id?: string | null,
  filter?: ModelFriendshipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListFriendshipsQuery = {
  listFriendships?:  {
    __typename: "ModelFriendshipConnection",
    items:  Array< {
      __typename: "Friendship",
      id: string,
      ownerId: string,
      friendId: string,
      status: string,
      createdAt?: string | null,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncFriendshipsQueryVariables = {
  filter?: ModelFriendshipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncFriendshipsQuery = {
  syncFriendships?:  {
    __typename: "ModelFriendshipConnection",
    items:  Array< {
      __typename: "Friendship",
      id: string,
      ownerId: string,
      friendId: string,
      status: string,
      createdAt?: string | null,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type FriendshipsByOwnerIdAndFriendIdQueryVariables = {
  ownerId: string,
  friendId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelFriendshipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type FriendshipsByOwnerIdAndFriendIdQuery = {
  friendshipsByOwnerIdAndFriendId?:  {
    __typename: "ModelFriendshipConnection",
    items:  Array< {
      __typename: "Friendship",
      id: string,
      ownerId: string,
      friendId: string,
      status: string,
      createdAt?: string | null,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type FriendshipsByFriendIdAndOwnerIdQueryVariables = {
  friendId: string,
  ownerId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelFriendshipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type FriendshipsByFriendIdAndOwnerIdQuery = {
  friendshipsByFriendIdAndOwnerId?:  {
    __typename: "ModelFriendshipConnection",
    items:  Array< {
      __typename: "Friendship",
      id: string,
      ownerId: string,
      friendId: string,
      status: string,
      createdAt?: string | null,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type GetSharedCameraQueryVariables = {
  id: string,
};

export type GetSharedCameraQuery = {
  getSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type ListSharedCamerasQueryVariables = {
  id?: string | null,
  filter?: ModelSharedCameraFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListSharedCamerasQuery = {
  listSharedCameras?:  {
    __typename: "ModelSharedCameraConnection",
    items:  Array< {
      __typename: "SharedCamera",
      id: string,
      name: string,
      ownerId: string,
      memberIds: Array< string >,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncSharedCamerasQueryVariables = {
  filter?: ModelSharedCameraFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncSharedCamerasQuery = {
  syncSharedCameras?:  {
    __typename: "ModelSharedCameraConnection",
    items:  Array< {
      __typename: "SharedCamera",
      id: string,
      name: string,
      ownerId: string,
      memberIds: Array< string >,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SharedCamerasByOwnerIdAndCreatedAtQueryVariables = {
  ownerId: string,
  createdAt?: ModelStringKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelSharedCameraFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type SharedCamerasByOwnerIdAndCreatedAtQuery = {
  sharedCamerasByOwnerIdAndCreatedAt?:  {
    __typename: "ModelSharedCameraConnection",
    items:  Array< {
      __typename: "SharedCamera",
      id: string,
      name: string,
      ownerId: string,
      memberIds: Array< string >,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type GetSharedCameraMemberQueryVariables = {
  id: string,
};

export type GetSharedCameraMemberQuery = {
  getSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type ListSharedCameraMembersQueryVariables = {
  id?: string | null,
  filter?: ModelSharedCameraMemberFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListSharedCameraMembersQuery = {
  listSharedCameraMembers?:  {
    __typename: "ModelSharedCameraMemberConnection",
    items:  Array< {
      __typename: "SharedCameraMember",
      id: string,
      cameraId: string,
      userId: string,
      role: string,
      addedAt: string,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncSharedCameraMembersQueryVariables = {
  filter?: ModelSharedCameraMemberFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncSharedCameraMembersQuery = {
  syncSharedCameraMembers?:  {
    __typename: "ModelSharedCameraMemberConnection",
    items:  Array< {
      __typename: "SharedCameraMember",
      id: string,
      cameraId: string,
      userId: string,
      role: string,
      addedAt: string,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SharedCameraMembersByCameraIdAndUserIdQueryVariables = {
  cameraId: string,
  userId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelSharedCameraMemberFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type SharedCameraMembersByCameraIdAndUserIdQuery = {
  sharedCameraMembersByCameraIdAndUserId?:  {
    __typename: "ModelSharedCameraMemberConnection",
    items:  Array< {
      __typename: "SharedCameraMember",
      id: string,
      cameraId: string,
      userId: string,
      role: string,
      addedAt: string,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SharedCameraMembersByUserIdAndCameraIdQueryVariables = {
  userId: string,
  cameraId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelSharedCameraMemberFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type SharedCameraMembersByUserIdAndCameraIdQuery = {
  sharedCameraMembersByUserIdAndCameraId?:  {
    __typename: "ModelSharedCameraMemberConnection",
    items:  Array< {
      __typename: "SharedCameraMember",
      id: string,
      cameraId: string,
      userId: string,
      role: string,
      addedAt: string,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type GetPhotoQueryVariables = {
  id: string,
};

export type GetPhotoQuery = {
  getPhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type ListPhotosQueryVariables = {
  id?: string | null,
  filter?: ModelPhotoFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListPhotosQuery = {
  listPhotos?:  {
    __typename: "ModelPhotoConnection",
    items:  Array< {
      __typename: "Photo",
      id: string,
      ownerId: string,
      ownerIdentityId: string,
      sharedCameraId?: string | null,
      s3Key: string,
      thumbKey?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncPhotosQueryVariables = {
  filter?: ModelPhotoFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncPhotosQuery = {
  syncPhotos?:  {
    __typename: "ModelPhotoConnection",
    items:  Array< {
      __typename: "Photo",
      id: string,
      ownerId: string,
      ownerIdentityId: string,
      sharedCameraId?: string | null,
      s3Key: string,
      thumbKey?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type PhotosByOwnerIdAndCreatedAtQueryVariables = {
  ownerId: string,
  createdAt?: ModelStringKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelPhotoFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type PhotosByOwnerIdAndCreatedAtQuery = {
  photosByOwnerIdAndCreatedAt?:  {
    __typename: "ModelPhotoConnection",
    items:  Array< {
      __typename: "Photo",
      id: string,
      ownerId: string,
      ownerIdentityId: string,
      sharedCameraId?: string | null,
      s3Key: string,
      thumbKey?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type PhotosBySharedCameraIdAndCreatedAtQueryVariables = {
  sharedCameraId: string,
  createdAt?: ModelStringKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelPhotoFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type PhotosBySharedCameraIdAndCreatedAtQuery = {
  photosBySharedCameraIdAndCreatedAt?:  {
    __typename: "ModelPhotoConnection",
    items:  Array< {
      __typename: "Photo",
      id: string,
      ownerId: string,
      ownerIdentityId: string,
      sharedCameraId?: string | null,
      s3Key: string,
      thumbKey?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type GetPhotoRecipientQueryVariables = {
  id: string,
};

export type GetPhotoRecipientQuery = {
  getPhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type ListPhotoRecipientsQueryVariables = {
  id?: string | null,
  filter?: ModelPhotoRecipientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListPhotoRecipientsQuery = {
  listPhotoRecipients?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      id: string,
      photoId: string,
      recipientId: string,
      ownerId: string,
      confidence?: number | null,
      method?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncPhotoRecipientsQueryVariables = {
  filter?: ModelPhotoRecipientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncPhotoRecipientsQuery = {
  syncPhotoRecipients?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      id: string,
      photoId: string,
      recipientId: string,
      ownerId: string,
      confidence?: number | null,
      method?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type PhotoRecipientsByPhotoIdAndRecipientIdQueryVariables = {
  photoId: string,
  recipientId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelPhotoRecipientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type PhotoRecipientsByPhotoIdAndRecipientIdQuery = {
  photoRecipientsByPhotoIdAndRecipientId?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      id: string,
      photoId: string,
      recipientId: string,
      ownerId: string,
      confidence?: number | null,
      method?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type PhotoRecipientsByRecipientIdAndPhotoIdQueryVariables = {
  recipientId: string,
  photoId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelPhotoRecipientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type PhotoRecipientsByRecipientIdAndPhotoIdQuery = {
  photoRecipientsByRecipientIdAndPhotoId?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      id: string,
      photoId: string,
      recipientId: string,
      ownerId: string,
      confidence?: number | null,
      method?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type PhotoRecipientsByRecipientIdAndCreatedAtQueryVariables = {
  recipientId: string,
  createdAt?: ModelStringKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelPhotoRecipientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type PhotoRecipientsByRecipientIdAndCreatedAtQuery = {
  photoRecipientsByRecipientIdAndCreatedAt?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      id: string,
      photoId: string,
      recipientId: string,
      ownerId: string,
      confidence?: number | null,
      method?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type PhotoRecipientsByOwnerIdAndRecipientIdAndCreatedAtQueryVariables = {
  ownerId: string,
  recipientIdCreatedAt?: ModelPhotoRecipientByOwnerCompositeKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelPhotoRecipientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type PhotoRecipientsByOwnerIdAndRecipientIdAndCreatedAtQuery = {
  photoRecipientsByOwnerIdAndRecipientIdAndCreatedAt?:  {
    __typename: "ModelPhotoRecipientConnection",
    items:  Array< {
      __typename: "PhotoRecipient",
      id: string,
      photoId: string,
      recipientId: string,
      ownerId: string,
      confidence?: number | null,
      method?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type OnCreateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnCreateUserSubscription = {
  onCreateUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnUpdateUserSubscription = {
  onUpdateUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeleteUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnDeleteUserSubscription = {
  onDeleteUser?:  {
    __typename: "User",
    id: string,
    displayName?: string | null,
    faceCount?: number | null,
    primaryFaceId?: string | null,
    profilePhotoKey?: string | null,
    expoPushToken?: string | null,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreateFriendshipSubscriptionVariables = {
  filter?: ModelSubscriptionFriendshipFilterInput | null,
  owner?: string | null,
  friendId?: string | null,
};

export type OnCreateFriendshipSubscription = {
  onCreateFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdateFriendshipSubscriptionVariables = {
  filter?: ModelSubscriptionFriendshipFilterInput | null,
  owner?: string | null,
  friendId?: string | null,
};

export type OnUpdateFriendshipSubscription = {
  onUpdateFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeleteFriendshipSubscriptionVariables = {
  filter?: ModelSubscriptionFriendshipFilterInput | null,
  owner?: string | null,
  friendId?: string | null,
};

export type OnDeleteFriendshipSubscription = {
  onDeleteFriendship?:  {
    __typename: "Friendship",
    id: string,
    ownerId: string,
    friendId: string,
    status: string,
    createdAt?: string | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreateSharedCameraSubscriptionVariables = {
  filter?: ModelSubscriptionSharedCameraFilterInput | null,
  owner?: string | null,
};

export type OnCreateSharedCameraSubscription = {
  onCreateSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdateSharedCameraSubscriptionVariables = {
  filter?: ModelSubscriptionSharedCameraFilterInput | null,
  owner?: string | null,
};

export type OnUpdateSharedCameraSubscription = {
  onUpdateSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeleteSharedCameraSubscriptionVariables = {
  filter?: ModelSubscriptionSharedCameraFilterInput | null,
  owner?: string | null,
};

export type OnDeleteSharedCameraSubscription = {
  onDeleteSharedCamera?:  {
    __typename: "SharedCamera",
    id: string,
    name: string,
    ownerId: string,
    memberIds: Array< string >,
    createdAt: string,
    photos?:  {
      __typename: "ModelPhotoConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    members?:  {
      __typename: "ModelSharedCameraMemberConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreateSharedCameraMemberSubscriptionVariables = {
  filter?: ModelSubscriptionSharedCameraMemberFilterInput | null,
  owner?: string | null,
  userId?: string | null,
};

export type OnCreateSharedCameraMemberSubscription = {
  onCreateSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdateSharedCameraMemberSubscriptionVariables = {
  filter?: ModelSubscriptionSharedCameraMemberFilterInput | null,
  owner?: string | null,
  userId?: string | null,
};

export type OnUpdateSharedCameraMemberSubscription = {
  onUpdateSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeleteSharedCameraMemberSubscriptionVariables = {
  filter?: ModelSubscriptionSharedCameraMemberFilterInput | null,
  owner?: string | null,
  userId?: string | null,
};

export type OnDeleteSharedCameraMemberSubscription = {
  onDeleteSharedCameraMember?:  {
    __typename: "SharedCameraMember",
    id: string,
    cameraId: string,
    userId: string,
    role: string,
    addedAt: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreatePhotoSubscriptionVariables = {
  filter?: ModelSubscriptionPhotoFilterInput | null,
  owner?: string | null,
};

export type OnCreatePhotoSubscription = {
  onCreatePhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdatePhotoSubscriptionVariables = {
  filter?: ModelSubscriptionPhotoFilterInput | null,
  owner?: string | null,
};

export type OnUpdatePhotoSubscription = {
  onUpdatePhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeletePhotoSubscriptionVariables = {
  filter?: ModelSubscriptionPhotoFilterInput | null,
  owner?: string | null,
};

export type OnDeletePhotoSubscription = {
  onDeletePhoto?:  {
    __typename: "Photo",
    id: string,
    ownerId: string,
    ownerIdentityId: string,
    sharedCameraId?: string | null,
    s3Key: string,
    thumbKey?: string | null,
    createdAt: string,
    recipients?:  {
      __typename: "ModelPhotoRecipientConnection",
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreatePhotoRecipientSubscriptionVariables = {
  filter?: ModelSubscriptionPhotoRecipientFilterInput | null,
  recipientId?: string | null,
  ownerId?: string | null,
};

export type OnCreatePhotoRecipientSubscription = {
  onCreatePhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type OnUpdatePhotoRecipientSubscriptionVariables = {
  filter?: ModelSubscriptionPhotoRecipientFilterInput | null,
  recipientId?: string | null,
  ownerId?: string | null,
};

export type OnUpdatePhotoRecipientSubscription = {
  onUpdatePhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type OnDeletePhotoRecipientSubscriptionVariables = {
  filter?: ModelSubscriptionPhotoRecipientFilterInput | null,
  recipientId?: string | null,
  ownerId?: string | null,
};

export type OnDeletePhotoRecipientSubscription = {
  onDeletePhotoRecipient?:  {
    __typename: "PhotoRecipient",
    id: string,
    photoId: string,
    recipientId: string,
    ownerId: string,
    confidence?: number | null,
    method?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};
