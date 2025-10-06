# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `npx expo start` - Start Expo development server
- `npx expo run:ios` - Run on iOS simulator
- `npx expo run:android` - Run on Android emulator
- `npm test` - Run Jest tests

### Build Commands

- Check package.json for any additional build scripts

## Architecture Overview

**PhomoCam** is a React Native/Expo social photo-sharing application with AI-powered face recognition using AWS backend services.

### Technology Stack

- **React Native 0.79.5** with **Expo 53.0.19**
- **Expo Router 5.1.3** for file-based routing with typed routes
- **TypeScript 5.8.3** for type safety
- **TanStack Query 5.83.0** for server state management
- **AWS Amplify 6.15.0** backend with GraphQL API
- **AWS Rekognition** for face recognition
- **AWS S3** for photo storage
- **React 19.0.0** with new architecture enabled
- **Zustand 5.0.6** for local state management

### Key Dependencies

#### UI & Navigation

- `expo-router` ~5.1.3 - File-based routing with typed routes
- `@react-navigation/native` ^7.1.6 - Navigation framework
- `react-native-gesture-handler` ~2.24.0 - Touch gesture handling
- `react-native-reanimated` ~3.17.4 - Animations and gestures
- `react-native-screens` ~4.11.1 - Native screen optimization
- `@gluestack-ui/themed` ^1.1.73 - Component library with theming
- `lucide-react-native` ^0.539.0 - Icon library
- `react-native-skeleton-placeholder` ^5.2.4 - Loading skeletons
- `react-native-linear-gradient` ^2.8.3 - Gradient backgrounds

#### Camera & Media

- `react-native-vision-camera` ^4.7.1 - Advanced camera functionality with better performance
- `expo-image` ~2.3.2 - Optimized image component with caching
- `expo-image-manipulator` ~13.1.7 - Image processing and manipulation
- `expo-image-picker` ^16.1.4 - Image selection from gallery
- `expo-media-library` ~17.1.7 - Photo library access and management
- `expo-sqlite` ^16.0.8 - SQLite database for local photo URL caching
- `@georstat/react-native-image-cache` ^3.1.0 - Image caching system
- `react-native-file-access` ^3.1.1 - File system operations

#### AWS Integration

- `@aws-amplify/react-native` ^1.1.10 - React Native specific Amplify components
- `@aws-amplify/rtn-web-browser` ^1.1.4 - Web browser integration
- `aws-amplify` ^6.15.0 - Core AWS SDK with GraphQL client
- `@react-native-community/netinfo` ^11.4.1 - Network state management

#### State Management & Data Fetching

- `@tanstack/react-query` ^5.83.0 - Server state management
- `zustand` ^5.0.6 - Client state management (preferences, upload queue, recent photos)
- Query hooks for cameras, photos, users, and profiles
- Optimistic updates for instant UI feedback
- Real-time subscriptions for live updates

#### Background Processing & Notifications

- `expo-background-task` ~0.2.8 - Background task execution
- `expo-task-manager` ~13.1.6 - Task scheduling and management
- `expo-notifications` ^0.31.4 - Push notifications with deep linking
- `expo-device` ^7.1.4 - Device information and capabilities
- `expo-constants` ^17.1.7 - App constants and configuration

### Directory Structure

```
/app/                    # Expo Router screens (file-based routing)
├── (tabs)/             # Tab navigation layout
│   ├── _layout.tsx     # Tab navigation configuration (3 tabs: camera, album, me)
│   ├── album.tsx       # Photo album view with drag-to-expand friends list
│   ├── camera.tsx      # Camera capture screen with integrated face enrollment
│   └── me.tsx          # User profile with photos grid
├── camera/             # Camera-related screens
│   ├── [camId]/        # Dynamic shared camera screens
│   │   ├── index.tsx   # Camera view
│   │   └── invite.tsx  # Invite friends to camera
│   └── new.tsx         # Create new shared camera
├── legal/              # Legal documents
│   ├── privacy.tsx     # Privacy policy page
│   └── terms.tsx       # Terms of service page
├── onboard/            # User onboarding flow
│   ├── index.tsx       # Onboarding coordinator (face enrollment moved to camera)
│   ├── privacy.tsx     # Privacy policy onboarding step
│   ├── profile.tsx     # Profile setup onboarding step
│   └── terms.tsx       # Terms of service onboarding step
├── photo/              # Photo detail screens
│   ├── [id].tsx        # Photo detail view with save to camera roll and reporting
│   └── face-preview.tsx # Face detection preview
├── user/               # User profile screens
│   └── [userId].tsx    # User profile view with reporting functionality
├── _layout.tsx         # Root layout with auth
├── +html.tsx           # Web-specific HTML template
├── +not-found.tsx      # 404 error page
├── index.tsx           # Home/landing screen
├── login.tsx           # Login screen with birthday picker
├── cameraModal.tsx     # Camera modal overlay
├── friendsModal.tsx    # Friends selection modal
├── settingsModal.tsx   # App settings screen
├── syncedPhotosReview.tsx # Review and share synced photos from iCloud
└── debug.tsx           # Development debug screen

/src/                   # Generated and utility code
├── API.ts              # Generated GraphQL API types
├── content/            # Reusable content components
│   ├── PrivacyContent.tsx    # Privacy policy content component
│   └── TermsContent.tsx      # Terms of service content component
├── providers/          # App-level service providers
│   └── AppServicesProvider.tsx # Main app services and background task coordination
├── background/         # Background task implementations
│   ├── PhotoSyncTask.ts     # Photo synchronization task
│   ├── TestBackgroundSync.ts # Test background sync
│   └── queueProcessor.ts    # Photo upload queue processor
├── graphql/            # Generated GraphQL operations
│   ├── mutations.ts    # GraphQL mutations
│   ├── queries.ts      # GraphQL queries
│   ├── subscriptions.ts # Real-time subscriptions
│   └── schema.json     # GraphQL schema introspection
├── hooks/              # Custom React hooks
│   ├── useCameraQueries.ts    # Camera data fetching
│   ├── useCameraMutations.ts  # Camera operations
│   ├── useCameraSubscriptions.ts # Real-time camera updates
│   ├── usePhotoQueries.ts     # Photo data fetching
│   ├── usePhotoMutations.ts   # Photo operations
│   ├── usePhotoSubscriptions.ts # Real-time photo updates
│   ├── useUserQueries.ts      # User data fetching
│   ├── useUserMutations.ts    # User operations
│   ├── useProfileQueries.ts   # Profile data fetching
│   ├── useProfileMutations.ts # Profile updates
│   ├── usePushNotifications.ts # Push notification handling
│   ├── useNotificationHandler.ts # Notification tap handling
│   ├── useDeepLinkHandler.ts  # Deep link routing
│   ├── useSubscriptions.ts    # GraphQL subscriptions
│   └── useSyncedPhotoMutations.ts # Synced photo operations
├── lib/                # Shared libraries
│   └── queryClient.ts  # TanStack Query config
├── models/             # Generated data models
│   ├── index.js/.d.ts  # Model exports
│   └── schema.js/.d.ts # Schema definitions
├── utils/              # Utility functions
│   ├── services/              # Core service implementations
│   │   ├── PhotoCacheDB.ts         # SQLite database for instant photo URL caching
│   │   ├── AppServicesProvider.tsx # Main app services coordination
│   │   └── imageCacheConfig.ts     # Image caching configuration
│   ├── userManagement.ts      # User-related utilities
│   ├── photoPermissions.ts    # Photo permission utilities
│   ├── icloudsync/            # Photo album sync
│   │   ├── photoAlbumService.ts    # Album operations
│   │   ├── photoSyncService.ts     # Sync logic
│   │   ├── photoSyncManager.ts     # Sync state management
│   │   ├── photoAlbumLogger.ts     # Sync debugging logger
│   │   ├── photoAlbumTypes.ts      # Type definitions
│   │   └── photoAlbumConstants.ts  # Constants for photo sync
│   └── pushNotifications/     # Push notification system
│       ├── pushNotificationService.ts  # Notification service
│       └── pushNotificationTypes.ts    # Notification type definitions
├── amplifyconfiguration.json # Amplify configuration
└── aws-exports.js      # AWS service exports

/src/stores/            # Zustand state management
├── preferencesStore.ts # User preferences and settings
├── recentPhotosStore.ts # Recently captured photos cache
├── uploadQueueStore.ts # Photo upload queue management
└── walkthroughStore.ts # App walkthrough/tutorial state

/components/            # Reusable UI components
├── auth/               # Authentication components
│   └── LoginForm.tsx   # Enhanced login form with validation
├── walkthrough/        # App walkthrough components
│   └── WalkthroughOverlay.tsx # Tutorial overlay system
├── Carousel.tsx        # Image carousel component
├── EditScreenInfo.tsx  # Development info component
├── ExternalLink.tsx    # External link handler
├── StyledText.tsx      # Styled text components
├── Themed.tsx          # Theme-aware components
├── OptimizedPhotoItem.tsx # Performance-optimized photo grid item
├── SkeletonLoaders.tsx # Loading state components
├── sections/           # Settings screen sections
│   ├── EmailSection.tsx        # Email update component (using AWS Amplify)
│   ├── FaceUpdateSection.tsx   # Face enrollment update with sync indicators
│   ├── LegalSection.tsx        # Legal links section
│   ├── PasswordSection.tsx     # Password change (using AWS Amplify)
│   └── PreferencesSection.tsx  # App preferences with photo sync settings
├── useClientOnlyValue.ts # Client-side value hook
├── useColorScheme.ts   # Color scheme detection
└── __tests__/          # Component tests

/context/               # React Context providers
└── AuthContext.tsx     # Authentication state management

/constants/             # App constants
└── Colors.ts           # Color definitions

/amplify/               # AWS Amplify backend configuration
└── backend/            # Backend resource definitions
├── backend/api/        # GraphQL schema and resolvers
├── backend/function/   # Lambda functions for face recognition
├── backend/auth/       # Cognito authentication setup
└── backend/storage/    # S3 bucket configuration
```

### Recent Updates & Improvements

#### SQLite Photo Cache System (Latest - Sept 2025)
- **PhotoCacheDB**: High-performance SQLite database for instant photo URL caching in `src/utils/services/PhotoCacheDB.ts`
- **Instant Photo Loading**: Cached S3 signed URLs enable immediate photo display without network requests
- **Smart Expiry Management**: 12-hour URL expiration with automatic refresh detection
- **WAL Mode**: Write-Ahead Logging for optimal performance in mobile environment
- **Optimized Queries**: Strategic indexes on cameraId, ownerId, createdAt, and lastAccessed
- **Batch Operations**: Transaction-based bulk operations for efficient cache updates
- **Background Cleanup**: Automatic removal of 30-day-old unused entries
- **Subscription Integration**: Photo subscriptions now automatically cache URLs for instant access
- **Query Optimization**: Photo queries leverage cache for immediate results with background refresh

#### App Services Provider Architecture (Sept 2025)
- **AppServicesProvider**: Centralized service coordination in `src/providers/AppServicesProvider.tsx`
- **Background Task Management**: Unified background task registration and lifecycle management
- **Service Integration**: Coordinates push notifications, photo sync, upload queue, and subscriptions
- **App State Handling**: Proper cleanup and initialization based on app lifecycle
- **Permission Coordination**: Centralized permission checks and service enablement

#### Authentication Modernization (Sept 2025)
- **AWS Amplify Migration**: Switched from direct Cognito SDK to AWS Amplify for auth operations
- **Simplified Dependencies**: Removed `@aws-sdk/client-cognito-identity-provider` dependency
- **Enhanced Login Form**: Improved validation and error handling in authentication flows
- **Hardened Security**: Better input validation and session management

#### Onboarding Flow Redesign (Sept 2025)
- **Multi-Step Onboarding**: Split onboarding into discrete steps (privacy, terms, profile)
- **Face Enrollment Integration**: Moved face enrollment from onboarding to camera screen for better UX
- **Reusable Content**: Extracted privacy and terms content into reusable components
- **Walkthrough System**: Integrated tutorial overlay system for user guidance
- **Provider-Based Logic**: Moved complex app initialization logic from root layout to dedicated provider

#### Reporting & Moderation Features (Sept 2025)
- **Photo Reporting**: Users can report inappropriate photos with built-in reporting system
- **User Reporting**: Report functionality added to user profiles
- **Owner Protection**: Report buttons only visible to non-owners of content
- **Moderation Support**: Backend integration for content moderation workflows

#### Photo Sync System
- **Full Photo Sync**: Complete library synchronization with iCloud
- **Limited Photo Sync**: Selective photo sync based on user permissions
- **Sync Manager**: `photoSyncManager.ts` manages sync state and progress
- **Visual Indicators**: Real-time sync status in settings and UI
- **Error Recovery**: Robust handling of permission changes and sync failures
- **Background Sync**: Improved background task scheduling and execution

#### Camera Terminology
- **Events**: Renamed from "cameras" throughout the app for better UX
- **Event Creation**: Updated UI and terminology in camera creation flow

#### Authentication Improvements
- **Birthday Picker**: Enhanced UI in login screen
- **Token Management**: Fixed stale push token behavior
- **Session Handling**: Improved auth state persistence

#### Photo Features
- **Save to Camera Roll**: Direct save functionality in photo detail view
- **Face Update**: Improved face enrollment update with visual feedback
- **Photo Permissions**: Enhanced permission handling with `photoPermissions.ts`

### Key Features & Data Models

#### Core Models (GraphQL)

- **User**: Face recognition data (primaryFaceID), profile info
- **SharedCamera**: Group photo sharing with role-based access (ADMIN/MEMBER/INVITED)
- **Photo**: S3-stored images with thumbnails, linked to shared cameras
- **Friendship**: Social connections between users
- **PhotoRecipient**: Controls photo visibility and access

#### Authentication Flow

1. Sign-in via AWS Cognito
2. Automatic user record creation
3. Face enrollment onboarding with AWS Rekognition
4. Protected routes based on auth state

#### Face Recognition System

- **Integrated Face Enrollment**: Face enrollment now happens within the camera screen (not separate onboarding)
- **Seamless UX**: Users with `faceCount === 0` see face enrollment UI when accessing camera
- **AWS Rekognition**: Processes and stores face vectors for identification
- **Lambda Functions**: Handle face matching and validation logic
- **User Identification**: Users identified by `primaryFaceID` in DynamoDB
- **Full-Screen Experience**: Face enrollment uses dedicated camera view with overlay guide

### AWS Integration

#### Key Services

- **Amplify API**: GraphQL operations via generateClient
- **S3 Storage**: Photos with protected access levels
- **Rekognition**: Face detection and comparison
- **Lambda**: Custom face recognition logic
- **Media Library**: Local photo album integration

#### Storage Strategy

- Photos stored in S3 with auto-generated thumbnails
- Protected access ensures users only see authorized content

### Navigation & Routing

Uses Expo Router with file-based routing:

- Tab navigation for main features
- Stack navigation for detailed views
- Protected routes require authentication
- Deep linking support for photo sharing

### State Management

- **AuthContext**: Global authentication state
- **TanStack Query**: Server state with caching and synchronization
  - Query keys pattern for consistent cache management
  - Optimistic updates for instant UI feedback
  - Automatic retries and background refetching
  - 5-minute stale time, 30-minute cache time defaults
- Component-level state for UI interactions

### TanStack Query Patterns

#### Query Hooks
```typescript
// Fetch data with caching
const { data, isLoading, error } = useUserCameraMemberships();
const { data: photos } = usePhotos({ cameraId });
```

#### Mutation Hooks
```typescript
// Perform operations with optimistic updates
const uploadPhoto = useUploadPhoto();
const updateProfile = useUpdateUserProfile();
```

#### Query Key Convention
```typescript
export const QUERY_KEYS = {
  USER_CAMERA_MEMBERSHIPS: (userId) => ['userCameraMemberships', userId],
  CAMERA_MEMBERS: (cameraId) => ['cameraMembers', cameraId],
  PHOTOS: (filters) => ['photos', filters],
};
```

### Development Notes

#### Camera Integration

- Uses `react-native-vision-camera` for advanced camera functionality
- Requires camera and microphone permissions on iOS/Android
- Gesture-based controls with `react-native-gesture-handler`
- Real-time preview with touch-to-focus capabilities
- `expo-image-manipulator` for post-capture processing
- Face detection happens in AWS Lambda, not client-side
- Camera flash animation and visual feedback

#### Testing Strategy

- Focus on component rendering and data flow
- Mock AWS services for testing

#### Platform Considerations

- **iOS Primary Target**: Bundle ID `com.prasiddha123.Phomo`
- **Apple Sign-In**: Integrated with `expo-apple-authentication`
- **React Native New Architecture**: Enabled for performance
- **Permissions Required**: Camera, microphone, photo library, notifications
- **Universal App**: Supports iPhone and iPad
- **Dark Mode**: Automatic UI style with proper theming

#### App Configuration (app.json)
- **Bundle ID**: `com.prasiddha123.Phomo`
- **Scheme**: `phomomobile://` for deep linking
- **EAS Project ID**: `c5969cec-1b5e-4435-b6df-486d63d6c53d`
- **Typed Routes**: Enabled for compile-time route validation
- **Plugins**: Vision Camera, Notifications, Background Tasks, Apple Auth

### Photo Album Sync

- **Local Album**: Automatic "PhomoCam" album creation
- **iCloud Sync**: Photos saved locally sync to iCloud
- **Sync Modes**: Full sync (entire library) or limited sync (selected photos)
- **Permissions**: Media library access with granular permission levels
- **Background Sync**: Periodic photo synchronization with progress tracking
- **Review Flow**: `syncedPhotosReview.tsx` for batch photo selection and sharing
- **Sync Manager**: Centralized sync state management with `photoSyncManager.ts`
- **Visual Feedback**: Sync progress indicators and status messages
- **Error Recovery**: Automatic retry with exponential backoff
- **Debug Logging**: Comprehensive logging with `photoAlbumLogger.ts`

### Push Notification System

- **Notification Types**: Face matches, shared camera updates, friend requests, camera invitations
- **Real-time Delivery**: Expo push notification service integration
- **Deep Linking**: Notifications route to specific screens with context
- **Permission Handling**: Graceful degradation when notifications disabled

### Error Handling & Permissions

#### Media Library Permissions
- **Runtime Checks**: Permission status validated before photo operations
- **Permission UI**: Full-screen prompt for denied/undetermined permissions
- **Broken Photo URIs**: Graceful handling of inaccessible photos with placeholder UI
- **Warning Indicators**: Visual feedback for inaccessible content
- **Retry Mechanisms**: User can re-request permissions with clear guidance

#### Notification Permissions
- **Smart Registration**: Only updates database when token changes
- **Token Management**: Automatic refresh handling with listeners
- **Error Recovery**: Fallback behavior when push notifications unavailable

### Query Client Configuration

```typescript
// Default query client settings
{
  staleTime: 1000 * 60 * 5,      // 5 minutes
  gcTime: 1000 * 60 * 30,        // 30 minutes
  retry: smart retry logic,       // No retry on 4xx errors
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
}
```

## Important Implementation Notes

### Performance Optimizations

#### Photo Grid Rendering
- **OptimizedPhotoItem**: Memoized photo components prevent unnecessary re-renders
- **Skeleton Loading**: `react-native-skeleton-placeholder` provides smooth loading states
- **Dual-Layer Caching**:
  - `PhotoCacheDB` SQLite database for instant URL access (12-hour expiration)
  - `@georstat/react-native-image-cache` for binary image data (500MB limit)
- **Smart Cache Strategy**: Database lookups for URLs, then image cache for actual photos
- **File System**: `react-native-file-access` for efficient file operations
- **Background Refresh**: Expired URLs refreshed automatically without blocking UI

#### Background Processing
- **Queue Management**: Zustand-based upload queue with persistence
- **Task Scheduling**: `expo-task-manager` and `expo-background-task` integration
- **Queue Processor**: `queueProcessor.ts` handles batch uploads with retry logic
- **Memory Management**: Proper cleanup of subscriptions and listeners
- **State Persistence**: Recent photos cache and preferences stored locally

### State Management Patterns

#### Server State (TanStack Query)
- **GraphQL Subscriptions**: Live updates for cameras and photos with automatic URL caching
- **Optimistic Updates**: Instant UI feedback for user actions
- **Cache Invalidation**: Smart query invalidation on mutations
- **Query Key Patterns**: Consistent cache management across components
- **Photo URL Persistence**: Subscriptions save URLs to SQLite for instant access on next launch
- **Batch Cache Updates**: Photo queries automatically populate URL cache in transactions

#### Client State (Zustand)
- **preferencesStore**: User settings and app preferences with sync configuration
- **uploadQueueStore**: Photo upload queue with persistence and retry logic
- **recentPhotosStore**: Cache of recently captured photos for quick access
- **walkthroughStore**: Tutorial and onboarding state management
- **Persistence**: Automatic state persistence across app sessions

#### Permission State Tracking
- **Runtime Checks**: Permission status validated before operations
- **Error State Management**: Comprehensive error boundaries for permission failures
- **User Experience**: Graceful degradation when permissions unavailable

### Notification Flow Architecture

The notification system handles deep linking with proper navigation context:

1. **Notification Tap**: Routes to specific screens based on notification type
2. **Deep Link Context**: Maintains app state when arriving from notifications
3. **Permission Checks**: Validates required permissions before showing content
4. **Error Recovery**: Fallback navigation when target content unavailable