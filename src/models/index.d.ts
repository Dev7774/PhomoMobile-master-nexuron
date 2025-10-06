import { ModelInit, MutableModel, __modelMeta__, OptionallyManagedIdentifier } from "@aws-amplify/datastore";
// @ts-ignore
import { LazyLoading, LazyLoadingDisabled, AsyncCollection } from "@aws-amplify/datastore";



type EagerUpdateUserFaceResult = {
  readonly success: boolean;
  readonly faceId?: string | null;
  readonly newFaceCount?: number | null;
  readonly message?: string | null;
  readonly error?: string | null;
}

type LazyUpdateUserFaceResult = {
  readonly success: boolean;
  readonly faceId?: string | null;
  readonly newFaceCount?: number | null;
  readonly message?: string | null;
  readonly error?: string | null;
}

export declare type UpdateUserFaceResult = LazyLoading extends LazyLoadingDisabled ? EagerUpdateUserFaceResult : LazyUpdateUserFaceResult

export declare const UpdateUserFaceResult: (new (init: ModelInit<UpdateUserFaceResult>) => UpdateUserFaceResult)

type EagerFaceProcessingResult = {
  readonly facesDetected: number;
  readonly friendsMatched: number;
  readonly matches: FaceMatch[];
}

type LazyFaceProcessingResult = {
  readonly facesDetected: number;
  readonly friendsMatched: number;
  readonly matches: FaceMatch[];
}

export declare type FaceProcessingResult = LazyLoading extends LazyLoadingDisabled ? EagerFaceProcessingResult : LazyFaceProcessingResult

export declare const FaceProcessingResult: (new (init: ModelInit<FaceProcessingResult>) => FaceProcessingResult)

type EagerFaceMatch = {
  readonly userId: string;
  readonly confidence: number;
  readonly boundingBox: BoundingBox;
}

type LazyFaceMatch = {
  readonly userId: string;
  readonly confidence: number;
  readonly boundingBox: BoundingBox;
}

export declare type FaceMatch = LazyLoading extends LazyLoadingDisabled ? EagerFaceMatch : LazyFaceMatch

export declare const FaceMatch: (new (init: ModelInit<FaceMatch>) => FaceMatch)

type EagerBoundingBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

type LazyBoundingBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export declare type BoundingBox = LazyLoading extends LazyLoadingDisabled ? EagerBoundingBox : LazyBoundingBox

export declare const BoundingBox: (new (init: ModelInit<BoundingBox>) => BoundingBox)

type EagerAcceptInviteResult = {
  readonly success: boolean;
  readonly message: string;
  readonly cameraId: string;
  readonly cameraName: string;
  readonly role: string;
  readonly inviterName?: string | null;
}

type LazyAcceptInviteResult = {
  readonly success: boolean;
  readonly message: string;
  readonly cameraId: string;
  readonly cameraName: string;
  readonly role: string;
  readonly inviterName?: string | null;
}

export declare type AcceptInviteResult = LazyLoading extends LazyLoadingDisabled ? EagerAcceptInviteResult : LazyAcceptInviteResult

export declare const AcceptInviteResult: (new (init: ModelInit<AcceptInviteResult>) => AcceptInviteResult)

type EagerDeleteUserFaceResult = {
  readonly success: boolean;
  readonly message?: string | null;
  readonly error?: string | null;
}

type LazyDeleteUserFaceResult = {
  readonly success: boolean;
  readonly message?: string | null;
  readonly error?: string | null;
}

export declare type DeleteUserFaceResult = LazyLoading extends LazyLoadingDisabled ? EagerDeleteUserFaceResult : LazyDeleteUserFaceResult

export declare const DeleteUserFaceResult: (new (init: ModelInit<DeleteUserFaceResult>) => DeleteUserFaceResult)

type EagerUser = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<User, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly displayName?: string | null;
  readonly faceCount?: number | null;
  readonly primaryFaceId?: string | null;
  readonly profilePhotoKey?: string | null;
  readonly expoPushToken?: string | null;
  readonly photos?: (Photo | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyUser = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<User, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly displayName?: string | null;
  readonly faceCount?: number | null;
  readonly primaryFaceId?: string | null;
  readonly profilePhotoKey?: string | null;
  readonly expoPushToken?: string | null;
  readonly photos: AsyncCollection<Photo>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type User = LazyLoading extends LazyLoadingDisabled ? EagerUser : LazyUser

export declare const User: (new (init: ModelInit<User>) => User) & {
  copyOf(source: User, mutator: (draft: MutableModel<User>) => MutableModel<User> | void): User;
}

type EagerFriendship = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<Friendship, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly ownerId: string;
  readonly friendId: string;
  readonly status: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFriendship = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<Friendship, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly ownerId: string;
  readonly friendId: string;
  readonly status: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Friendship = LazyLoading extends LazyLoadingDisabled ? EagerFriendship : LazyFriendship

export declare const Friendship: (new (init: ModelInit<Friendship>) => Friendship) & {
  copyOf(source: Friendship, mutator: (draft: MutableModel<Friendship>) => MutableModel<Friendship> | void): Friendship;
}

type EagerSharedCamera = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<SharedCamera, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly memberIds: string[];
  readonly createdAt: string;
  readonly photos?: (Photo | null)[] | null;
  readonly members?: (SharedCameraMember | null)[] | null;
  readonly updatedAt?: string | null;
}

type LazySharedCamera = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<SharedCamera, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly memberIds: string[];
  readonly createdAt: string;
  readonly photos: AsyncCollection<Photo>;
  readonly members: AsyncCollection<SharedCameraMember>;
  readonly updatedAt?: string | null;
}

export declare type SharedCamera = LazyLoading extends LazyLoadingDisabled ? EagerSharedCamera : LazySharedCamera

export declare const SharedCamera: (new (init: ModelInit<SharedCamera>) => SharedCamera) & {
  copyOf(source: SharedCamera, mutator: (draft: MutableModel<SharedCamera>) => MutableModel<SharedCamera> | void): SharedCamera;
}

type EagerSharedCameraMember = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<SharedCameraMember, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly cameraId: string;
  readonly userId: string;
  readonly role: string;
  readonly addedAt: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazySharedCameraMember = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<SharedCameraMember, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly cameraId: string;
  readonly userId: string;
  readonly role: string;
  readonly addedAt: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type SharedCameraMember = LazyLoading extends LazyLoadingDisabled ? EagerSharedCameraMember : LazySharedCameraMember

export declare const SharedCameraMember: (new (init: ModelInit<SharedCameraMember>) => SharedCameraMember) & {
  copyOf(source: SharedCameraMember, mutator: (draft: MutableModel<SharedCameraMember>) => MutableModel<SharedCameraMember> | void): SharedCameraMember;
}

type EagerPhoto = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<Photo, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly ownerId: string;
  readonly ownerIdentityId: string;
  readonly sharedCameraId?: string | null;
  readonly s3Key: string;
  readonly thumbKey?: string | null;
  readonly createdAt: string;
  readonly recipients?: (PhotoRecipient | null)[] | null;
  readonly updatedAt?: string | null;
}

type LazyPhoto = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<Photo, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly ownerId: string;
  readonly ownerIdentityId: string;
  readonly sharedCameraId?: string | null;
  readonly s3Key: string;
  readonly thumbKey?: string | null;
  readonly createdAt: string;
  readonly recipients: AsyncCollection<PhotoRecipient>;
  readonly updatedAt?: string | null;
}

export declare type Photo = LazyLoading extends LazyLoadingDisabled ? EagerPhoto : LazyPhoto

export declare const Photo: (new (init: ModelInit<Photo>) => Photo) & {
  copyOf(source: Photo, mutator: (draft: MutableModel<Photo>) => MutableModel<Photo> | void): Photo;
}

type EagerPhotoRecipient = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<PhotoRecipient, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly photoId: string;
  readonly recipientId: string;
  readonly ownerId: string;
  readonly confidence?: number | null;
  readonly method?: string | null;
  readonly createdAt: string;
  readonly updatedAt?: string | null;
}

type LazyPhotoRecipient = {
  readonly [__modelMeta__]: {
    identifier: OptionallyManagedIdentifier<PhotoRecipient, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly photoId: string;
  readonly recipientId: string;
  readonly ownerId: string;
  readonly confidence?: number | null;
  readonly method?: string | null;
  readonly createdAt: string;
  readonly updatedAt?: string | null;
}

export declare type PhotoRecipient = LazyLoading extends LazyLoadingDisabled ? EagerPhotoRecipient : LazyPhotoRecipient

export declare const PhotoRecipient: (new (init: ModelInit<PhotoRecipient>) => PhotoRecipient) & {
  copyOf(source: PhotoRecipient, mutator: (draft: MutableModel<PhotoRecipient>) => MutableModel<PhotoRecipient> | void): PhotoRecipient;
}