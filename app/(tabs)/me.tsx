/* app/(tabs)/me.tsx  */
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { getPhotoAccessLevel, PhotoAccessLevel, askForMorePhotos } from "@/src/utils/photoPermissions";
import * as photoSyncManager from "@/src/utils/icloudsync/photoSyncManager";
import {
  Alert,
  useColorScheme,
  Dimensions,
  Animated,
  PanResponder,
  ScrollView,
  RefreshControl,
  FlatList,
  Linking
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalBody,
  Spinner,
  Pressable,
  Center,
  Heading,
} from "@gluestack-ui/themed";
import { useMyProfile } from "../../src/hooks/useProfileQueries";
import { useUpdateProfilePhoto } from "../../src/hooks/useProfileMutations";
import { useCameraInvitesAndMemberships } from "../../src/hooks/useCameraQueries";
import { useAllFriendshipsWithProfiles } from "../../src/hooks/useUserQueries";
import { useAuth } from "@/context/AuthContext";
import { 
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest
} from "../../src/hooks/useUserMutations";
import { 
  useAcceptCameraInvite, 
  useDeclineCameraInvite 
} from "../../src/hooks/useCameraMutations";
import { useCameraSubscriptions } from "../../src/hooks/useCameraSubscriptions";
import { usePhotoSubscriptions } from "../../src/hooks/usePhotoSubscriptions";
import { Image as ExpoImage } from "expo-image";
import { showMessage } from "react-native-flash-message";
import { 
  MeMainSkeleton
} from "../../components/SkeletonLoaders";
import { useWalkthroughElement } from "../../src/context/WalkthroughContext";

// Add drag constants
const screenHeight = Dimensions.get("window").height;
const COLLAPSED_HEIGHT = screenHeight * 0.482;
const EXPANDED_HEIGHT = screenHeight * 0.78;
const DRAG_HANDLE_HEIGHT = Math.min(Math.max(38, screenHeight * 0.04), 50);

// Activity feed item types
type ActivityItemType = 
  | 'friend_request_sent'
  | 'friend_request_received' 
  | 'friendship_established'
  | 'camera_created'
  | 'camera_invite_received'
  | 'camera_joined';

// Unified activity item interface
interface ActivityItem {
  id: string;
  type: ActivityItemType;
  timestamp: string;
  data: {
    // Friend data
    friendship?: any;
    friendProfile?: {
      id: string;
      displayName?: string | null;
      photoUrl?: string | null;
    } | null;
    isIncoming?: boolean;
    isOutgoing?: boolean;
    otherUserId?: string;
    
    // Camera data
    cameraId?: string;
    cameraName?: string;
    role?: string;
    _version?: number;
    membershipId?: string;
  };
}

export default function MyProfile() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  const { user } = useAuth();
  const userId = user?.username;

  useCameraSubscriptions(!!userId, userId);
  usePhotoSubscriptions(!!userId, userId);

  // Walkthrough element refs
  const profilePhotoRef = useWalkthroughElement('profile-photo');

  // State management
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use profile hooks
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useMyProfile();
  const updateProfilePhoto = useUpdateProfilePhoto();

  // Fetch friendship data
  const { 
    data: friendshipsWithProfilesRaw = [], 
    isLoading: friendshipsLoading, 
    refetch: refetchFriendships 
  } = useAllFriendshipsWithProfiles(userId);
  
  // Memoize friendshipsWithProfiles to prevent infinite re-renders
  const friendshipsWithProfiles = useMemo(() => friendshipsWithProfilesRaw, [JSON.stringify(friendshipsWithProfilesRaw)]);

  // Fetch camera invites and memberships
  const { 
    data: cameraData, 
    isLoading: camerasLoading, 
    refetch: refetchCameras 
  } = useCameraInvitesAndMemberships(userId);
  const { invites: cameraInvites = [], myCams = [] } = cameraData || {};

  // Mutations for friend actions
  const acceptFriendRequestMutation = useAcceptFriendRequest();
  const declineFriendRequestMutation = useDeclineFriendRequest();
  const cancelFriendRequestMutation = useCancelFriendRequest();

  // Mutations for camera actions
  const acceptCameraInviteMutation = useAcceptCameraInvite();
  const declineCameraInviteMutation = useDeclineCameraInvite();

  // Combine and sort all activity items
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    // Process friendships
    friendshipsWithProfiles.forEach((item) => {
      const { friendship, friendProfile, isIncoming, isOutgoing, otherUserId } = item;
      const isPending = friendship.status === 'PENDING';
      const isAccepted = friendship.status === 'ACCEPTED';

      if (isPending) {
        // Pending requests - use createdAt (when requested)
        if (isOutgoing) {
          items.push({
            id: `friend-sent-${friendship.id}`,
            type: 'friend_request_sent',
            timestamp: friendship.createdAt,
            data: { friendship, friendProfile, isOutgoing, otherUserId },
          });
        } else {
          items.push({
            id: `friend-received-${friendship.id}`,
            type: 'friend_request_received',
            timestamp: friendship.createdAt,
            data: { friendship, friendProfile, isIncoming, otherUserId },
          });
        }
      } else if (isAccepted) {
        // Accepted friendships - use updatedAt (when became friends)
        items.push({
          id: `friendship-${friendship.id}`,
          type: 'friendship_established',
          timestamp: friendship.updatedAt || friendship.createdAt,
          data: { friendship, friendProfile, otherUserId },
        });
      }
    });

    // Process camera memberships (your owned/joined cameras)
    myCams.forEach((cam: any) => {
      if (cam.role === 'ADMIN') {
        items.push({
          id: `camera-created-${cam.cameraId}-${cam.userId}`,
          type: 'camera_created',
          timestamp: cam.createdAt,
          data: { cameraId: cam.cameraId, cameraName: cam.name, role: cam.role, membershipId: cam.id, _version: cam._version },
        });
      } else if (cam.role === 'MEMBER') {
        items.push({
          id: `camera-joined-${cam.cameraId}-${cam.userId}`,
          type: 'camera_joined',
          timestamp: cam.createdAt, // When you joined
          data: { cameraId: cam.cameraId, cameraName: cam.name, role: cam.role, membershipId: cam.id, _version: cam._version },
        });
      }
    });

    // Process camera invites (pending)
    cameraInvites.forEach((invite: any) => {
      items.push({
        id: `camera-invite-${invite.cameraId}-${invite.userId}`,
        type: 'camera_invite_received',
        timestamp: invite.createdAt,
        data: { cameraId: invite.cameraId, cameraName: invite.name, role: invite.role, membershipId: invite.id, _version: invite._version },
      });
    });

    // Sort by timestamp (newest first)
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [friendshipsWithProfiles, myCams, cameraInvites]);

  // Activity stats
  const activityStats = useMemo(() => {
    const pending = activityItems.filter(item => 
      item.type === 'friend_request_received' || 
      item.type === 'friend_request_sent' || 
      item.type === 'camera_invite_received'
    ).length;
    
    const friends = activityItems.filter(item => 
      item.type === 'friendship_established'
    ).length;
    
    const events = activityItems.filter(item => 
      item.type === 'camera_created' || 
      item.type === 'camera_joined'
    ).length;

    return { pending, friends, events, total: activityItems.length };
  }, [activityItems]);

  // Track previous activity count to detect new items
  const prevActivityCountRef = useRef(0);
  
  // Scroll to top when new activity items are added
  useEffect(() => {
    const currentCount = activityItems.length;
    const prevCount = prevActivityCountRef.current;
    
    // If we have more items than before and it's not the initial load
    if (currentCount > prevCount && prevCount > 0) {
      // Scroll to top of the activity list
      setTimeout(() => {
        activityListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100); // Small delay to ensure the list has updated
    }
    
    prevActivityCountRef.current = currentCount;
  }, [activityItems.length]);
  

  
  // Focus effect for refreshing data
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        // Refresh if data is stale
        if (friendshipsWithProfiles.length === 0 && !friendshipsLoading) {
          refetchFriendships();
        }
        if ((!cameraData || (cameraInvites.length === 0 && myCams.length === 0)) && !camerasLoading) {
          refetchCameras();
        }
      }
    }, [userId, friendshipsWithProfiles.length, friendshipsLoading, cameraData, cameraInvites.length, myCams.length, camerasLoading, refetchFriendships, refetchCameras])
  );

  // Check photo permissions on mount and focus
  const checkPhotoAccess = useCallback(async () => {
    try {
      const access = await getPhotoAccessLevel();
      setPhotoAccess(access);
      
      if (access === 'limited') {
        // Get count of accessible photos for UI
        const photos = await MediaLibrary.getAssetsAsync({ first: 1 });
        setLimitedPhotoCount(photos.totalCount || 0);
      }
    } catch (error) {
      console.error('Error checking photo access:', error);
      setPhotoAccess('denied');
    }
  }, []);

  // Check permissions on mount
  useEffect(() => {
    checkPhotoAccess();
  }, [checkPhotoAccess]);

  // Re-check permissions when returning from settings
  useFocusEffect(
    useCallback(() => {
      checkPhotoAccess();
    }, [checkPhotoAccess])
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  // Add drag state and animations
  const [isCarouselExpanded, setIsCarouselExpanded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSyncingPhotos, setIsSyncingPhotos] = useState(false);
  const isNavigatingRef = useRef(false);
  const isSyncingPhotosRef = useRef(false);

  // New simplified sync state
  const [photoAccess, setPhotoAccess] = useState<PhotoAccessLevel>('denied');
  const [limitedPhotoCount, setLimitedPhotoCount] = useState<number>(0);

  // Animation values and refs
  const animatedTranslateY = useRef(new Animated.Value(0)).current;
  const isScrollEnabled = useRef(true);
  const scrollOffset = useRef(0);
  const gestureStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const isDragging = useRef(false);
  const activityListRef = useRef<FlatList>(null);

  // Interpolated opacity values for smooth transitions
  const profileHeaderOpacity = animatedTranslateY.interpolate({
    inputRange: [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), -100, 0],
    outputRange: [0, 0.7, 1],
    extrapolate: "clamp",
  });
  const gestureReady = useRef(false);

  useEffect(() => {
    currentTranslateY.current = isCarouselExpanded
      ? -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)
      : 0;
  }, [isCarouselExpanded]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy, dx } = gestureState;
        if (Math.abs(dy) < 5 || Math.abs(dx) > Math.abs(dy)) return false;
        // Only allow drag gestures when at the top of the scroll (scrollOffset <= 5)
        return scrollOffset.current <= 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        gestureReady.current = false;
        animatedTranslateY.stopAnimation((currentValue: number) => {
          gestureStartY.current = currentValue;
          currentTranslateY.current = currentValue;
          gestureReady.current = true;
        });
        setTimeout(() => {
          if (!gestureReady.current) {
            gestureStartY.current = currentTranslateY.current;
            gestureReady.current = true;
          }
        }, 10);
        if (isCarouselExpanded) isScrollEnabled.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!gestureReady.current) {
          return;
        }
        const { dy } = gestureState;
        // Calculate new translateY position
        const newTranslateY = gestureStartY.current + dy;
        // Clamp between expanded (negative) and collapsed (0)
        const maxTranslate = -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT);
        const clampedTranslateY = Math.max(Math.min(newTranslateY, 0), maxTranslate);
        
        animatedTranslateY.setValue(clampedTranslateY);
        currentTranslateY.current = clampedTranslateY;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { vy, dy } = gestureState;
        isScrollEnabled.current = true;
        isDragging.current = false;

        // Get the current position
        const currentTranslate = gestureStartY.current + dy;
        const maxTranslate = -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT);
        
        // Calculate progress (0 = collapsed, 1 = expanded)
        const progress = Math.abs(currentTranslate / maxTranslate);
        
        // Determine snap target based on velocity and position
        const SWIPE_VELOCITY_THRESHOLD = 0.4;
        const POSITION_THRESHOLD = 0.3; // 30% threshold for snapping
        
        let shouldExpand;
        if (vy < -SWIPE_VELOCITY_THRESHOLD) {
          // Fast swipe up - expand
          shouldExpand = true;
        } else if (vy > SWIPE_VELOCITY_THRESHOLD) {
          // Fast swipe down - collapse
          shouldExpand = false;
        } else {
          // Slow release - snap based on position
          shouldExpand = progress > POSITION_THRESHOLD;
        }
        
        // Set the target to either fully collapsed or fully expanded
        const targetTranslateY = shouldExpand ? maxTranslate : 0;
        
        // Update expanded state
        setIsCarouselExpanded(shouldExpand);

        // Animate to the snap position with spring physics
        Animated.spring(animatedTranslateY, {
          toValue: targetTranslateY,
          velocity: vy,
          tension: 50,
          friction: 10,
          overshootClamping: true,
          restDisplacementThreshold: 0.5,
          restSpeedThreshold: 0.5,
          useNativeDriver: true,
        }).start(() => {
          currentTranslateY.current = targetTranslateY;
        });
      },
    })
  ).current;

  // Unified sync handler for all permission scenarios
  const handlePhotoSync = useCallback(async () => {
    // Prevent double-clicks using refs
    if (isSyncingPhotosRef.current || isSyncingPhotos || isNavigatingRef.current || isNavigating) return;
    
    try {
      console.log('🔄 Photo sync triggered, access level:', photoAccess);
      
      // Check for existing unreviewed batches first
      const existingBatchIds = await photoSyncManager.checkExistingBatches();
      if (existingBatchIds.length > 0) {
        console.log(`📋 Found ${existingBatchIds.length} unreviewed batches, navigating to review`);
        isNavigatingRef.current = true;
        setIsNavigating(true);
        router.push(`/syncedPhotosReview?batches=${existingBatchIds.join(',')}&source=me`);
        setTimeout(() => {
          isNavigatingRef.current = false;
          setIsNavigating(false);
        }, 1000);
        return;
      }
      
      // Set sync state
      isSyncingPhotosRef.current = true;
      setIsSyncingPhotos(true);
      
      // Handle based on permission level
      if (photoAccess === 'undetermined') {
        // First time - request permissions
        console.log('🔒 Requesting photo permissions for first time');
        await askForMorePhotos();
        // Re-check permissions after user responds
        await checkPhotoAccess();
        
        // If user granted limited access, immediately process those first photos
        const newAccessLevel = await getPhotoAccessLevel();
        if (newAccessLevel === 'limited') {
          console.log('🔄 User granted limited access, processing first photos immediately');
          
          // Get the photos they just granted access to
          const initialPhotos = await MediaLibrary.getAssetsAsync({ 
            first: 1000,
            mediaType: 'photo',
            sortBy: [['creationTime', false]]
          });
          
          if (initialPhotos.assets.length > 0) {
            // Create batch with the initial granted photos (they're all new)
            const batch = await photoSyncManager.createPhotoBatch(initialPhotos.assets);
            
            // Store limited access photo IDs for future comparison
            const photoIds = initialPhotos.assets.map(a => a.id);
            await AsyncStorage.setItem('phomo_limited_access_photos', JSON.stringify(photoIds));
            
            // Navigate to review
            isNavigatingRef.current = true;
            setIsNavigating(true);
            router.push(`/syncedPhotosReview?batches=${batch.batchId}&source=me`);
            setTimeout(() => {
              isNavigatingRef.current = false;
              setIsNavigating(false);
            }, 1000);
            return; // Exit early
          }
        } else if (newAccessLevel === 'full') {
          // User granted full access, continue to full access sync below
          console.log('🔄 User granted full access, proceeding to full sync');
          // Don't return here - let it fall through to full access logic
        }
      } else if (photoAccess === 'denied') {
        // Previously denied - open settings
        console.log('🔒 Opening settings for denied access');
        await Linking.openSettings();
        // Re-check permissions after potentially returning from settings
        await checkPhotoAccess();
      } else if (photoAccess === 'full') {
        // Full access sync
        console.log('🔄 Starting full access sync');
        const result = await photoSyncManager.syncFullAccess(userId);
        if (result.batchId) {
          isNavigatingRef.current = true;
          setIsNavigating(true);
          router.push(`/syncedPhotosReview?batches=${result.batchId}&source=me`);
          setTimeout(() => {
            isNavigatingRef.current = false;
            setIsNavigating(false);
          }, 1000);
        } else {
          showMessage({
            message: "✅ No new photos to sync",
            description: "Your photos are up to date",
            type: "info",
            duration: 2000,
          });
        }
      } else if (photoAccess === 'limited') {
        // Limited access - will handle navigation internally after picker dismisses
        console.log('🔄 Starting limited access sync with picker');
        await photoSyncManager.syncLimitedAccess(
          userId,
          router,
          (syncing) => {
            isSyncingPhotosRef.current = syncing;
            setIsSyncingPhotos(syncing);
          }
        );
        // Note: setIsSyncing(false) handled in the syncLimitedAccess callback
        await checkPhotoAccess(); // Refresh photo count
        return; // Early return since limited access handles its own state reset
      }
    } catch (error) {
      console.error('❌ Photo sync error:', error);
      showMessage({
        message: "❌ Sync failed",
        description: "Could not sync photos. Please try again.",
        type: "danger",
        duration: 2000,
      });
    } finally {
      // Reset sync state (limited access handles its own reset)
      if (photoAccess !== 'limited') {
        isSyncingPhotosRef.current = false;
        setIsSyncingPhotos(false);
      }
    }
  }, [photoAccess, userId, isSyncingPhotos, isNavigating, router, checkPhotoAccess]);

  // Pull to refresh handler for activity list
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchFriendships(), refetchCameras()]);
    } catch (error) {
      console.error("Error refreshing activity:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchFriendships, refetchCameras]);

  // Handle scroll to track position for pan responder
  const handleScrollView = useCallback((event: any) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  // Action handlers
  const handleAction = useCallback(async (action: string, itemId: string, data: any) => {
    if (processingItems.has(itemId)) return;
    
    setProcessingItems(prev => new Set(prev).add(itemId));
    
    try {
      switch (action) {
        case 'accept_friend':
          await acceptFriendRequestMutation.mutateAsync({ 
            rowId: data.friendship.id, 
            rowVersion: data.friendship._version 
          });
          break;
        case 'decline_friend':
          await declineFriendRequestMutation.mutateAsync({ 
            rowId: data.friendship.id, 
            rowVersion: data.friendship._version 
          });
          break;
        case 'cancel_friend':
          await cancelFriendRequestMutation.mutateAsync({
            rowId: data.friendship.id,
            rowVersion: data.friendship._version,
            friendId: data.friendship.friendId || data.otherUserId,
          });
          break;
        case 'accept_camera':
          await acceptCameraInviteMutation.mutateAsync({
            membershipId: data.membershipId,
            version: data._version,
          });
          break;
        case 'decline_camera':
          await declineCameraInviteMutation.mutateAsync({
            membershipId: data.membershipId,
            version: data._version,
          });
          break;
        case 'view_camera':
          if (!isNavigatingRef.current) {
            isNavigatingRef.current = true;
            setIsNavigating(true);
            router.push(`/camera/${data.cameraId}?from=me`);
            setTimeout(() => {
              isNavigatingRef.current = false;
              setIsNavigating(false);
            }, 1000);
          }
          break;
        case 'invite_camera':
          if (!isNavigatingRef.current) {
            isNavigatingRef.current = true;
            setIsNavigating(true);
            router.push(`/camera/${data.cameraId}/invite?from=me`);
            setTimeout(() => {
              isNavigatingRef.current = false;
              setIsNavigating(false);
            }, 1000);
          }
          break;
        case 'view_profile':
          if (!isNavigatingRef.current) {
            isNavigatingRef.current = true;
            setIsNavigating(true);
            router.push(`/user/${data.otherUserId}?from=me`);
            setTimeout(() => {
              isNavigatingRef.current = false;
              setIsNavigating(false);
            }, 1000);
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      Alert.alert('Error', `Failed to ${action.replace('_', ' ')}. Please try again.`);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [processingItems, acceptFriendRequestMutation, declineFriendRequestMutation, cancelFriendRequestMutation, acceptCameraInviteMutation, declineCameraInviteMutation, router]);

  // Render activity item function
  const renderActivityItem = useCallback(({ item }: { item: ActivityItem }) => {
    const isProcessing = processingItems.has(item.id);
    const data = item.data;

    const formatTimestamp = (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffHours < 24) {
        return `${Math.floor(diffHours)}h ago`;
      } else if (diffDays < 7) {
        return `${Math.floor(diffDays)}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    };

    // Friend request sent (outgoing)
    if (item.type === 'friend_request_sent') {
      return (
        <Box 
          bg={isDark ? "#1a1a1a" : "#f8f8f8"}
          borderRadius="$xl"
          p="$4"
          mb="$3"
          borderWidth="$1"
          borderColor={isDark ? "#333" : "#e5e5e5"}
          opacity={isProcessing ? 0.6 : 1}
        >
          <HStack alignItems="center" space="md">
            {data.friendProfile?.photoUrl ? (
              <Box
                w={50}
                h={50}
                borderRadius={25}
                overflow="hidden"
                borderWidth="$1"
                borderColor={isDark ? "#444" : "#ddd"}
              >
                <ExpoImage
                  source={{ uri: data.friendProfile.photoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              </Box>
            ) : (
              <Box
                w={50}
                h={50}
                borderRadius={25}
                bg="#fef3c7"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="$xl">📤</Text>
              </Box>
            )}
            
            <VStack flex={1} space="xs">
              <Text fontSize="$sm" fontWeight="$semibold" color={isDark ? "#fff" : "#000"} numberOfLines={2} ellipsizeMode="tail">
                Friend request sent to {data.friendProfile?.displayName || data.otherUserId}
              </Text>
              <Text fontSize="$sm" color={isDark ? "#999" : "#666"}>
                {formatTimestamp(item.timestamp)}
              </Text>
            </VStack>
            
            <Button
              size="sm"
              variant="outline"
              borderColor="#ff3b30"
              onPress={() => handleAction('cancel_friend', item.id, data)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Spinner size="small" color="#ff3b30" />
              ) : (
                <ButtonText color="#ff3b30" fontSize="$xs">Cancel</ButtonText>
              )}
            </Button>
          </HStack>
        </Box>
      );
    }

    // Friend request received (incoming)
    if (item.type === 'friend_request_received') {
      return (
        <Box 
          bg={isDark ? "#1a1a1a" : "#f8f8f8"}
          borderRadius="$xl"
          p="$4"
          mb="$3"
          borderWidth="$1"
          borderColor={isDark ? "#333" : "#e5e5e5"}
          opacity={isProcessing ? 0.6 : 1}
        >
          <VStack space="md" alignItems="center">
            <VStack space="xs" alignItems="center">
              {data.friendProfile?.photoUrl ? (
                <Box
                  w={50}
                  h={50}
                  borderRadius={25}
                  overflow="hidden"
                  borderWidth="$1"
                  borderColor={isDark ? "#444" : "#ddd"}
                >
                  <ExpoImage
                    source={{ uri: data.friendProfile.photoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </Box>
              ) : (
                <Box
                  w={50}
                  h={50}
                  borderRadius={25}
                  bg="#fef3c7"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Text fontSize="$xl">📩</Text>
                </Box>
              )}
              
              <Pressable onPress={() => handleAction('view_profile', item.id, data)}>
                <Text fontSize="$sm" fontWeight="$semibold" color={isDark ? "#fff" : "#000"} numberOfLines={2} ellipsizeMode="tail">
                  {data.friendProfile?.displayName || data.otherUserId}
                </Text>
              </Pressable>
              
              <Text fontSize="$xs" color={isDark ? "#999" : "#666"} textAlign="center">
                wants to be your friend • {formatTimestamp(item.timestamp)}
              </Text>
            </VStack>
            
            <HStack space="md">
              <Button
                variant="outline"
                borderColor="#ff3b30"
                size="sm"
                onPress={() => handleAction('decline_friend', item.id, data)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Spinner size="small" color="#ff3b30" />
                ) : (
                  <ButtonText color="#ff3b30" fontSize="$sm">Decline</ButtonText>
                )}
              </Button>
              
              <Button
                bg="#4ade80"
                size="sm"
                onPress={() => handleAction('accept_friend', item.id, data)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <ButtonText color="$white" fontSize="$sm">Accept</ButtonText>
                )}
              </Button>
            </HStack>
          </VStack>
        </Box>
      );
    }

    // Friendship established (accepted)
    if (item.type === 'friendship_established') {
      return (
        <Pressable onPress={() => handleAction('view_profile', item.id, data)}>
          <Box 
            bg={isDark ? "#1a1a1a" : "#f8f8f8"}
            borderRadius="$xl"
            p="$4"
            mb="$3"
            borderWidth="$1"
            borderColor={isDark ? "#333" : "#e5e5e5"}
          >
            <HStack alignItems="center" space="md">
              <Box
                w={50}
                h={50}
                borderRadius="$full"
                bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                borderWidth="$2"
                borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                overflow="hidden"
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 2 }}
                shadowOpacity={0.15}
                shadowRadius={8}
                justifyContent="center"
                alignItems="center"
              >
                {data.friendProfile?.photoUrl ? (
                  <ExpoImage
                    source={{ uri: data.friendProfile.photoUrl }}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 23,
                    }}
                    contentFit="cover"
                  />
                ) : (
                  <Box
                    width="100%"
                    height="100%"
                    bg={
                      isDark
                        ? "$backgroundDark300"
                        : "$backgroundLight100"
                    }
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Text
                      color={isDark ? "#999" : "#666"}
                      fontSize="$2xl"
                    >
                      👤
                    </Text>
                  </Box>
                )}
              </Box>
              
              <VStack flex={1} space="xs">
                <Text fontSize="$sm" fontWeight="$semibold" color={isDark ? "#fff" : "#000"} numberOfLines={2} ellipsizeMode="tail">
                  You and {data.friendProfile?.displayName || data.otherUserId} became friends
                </Text>
                <Text fontSize="$xs" color={isDark ? "#999" : "#666"}>
                  {formatTimestamp(item.timestamp)}
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Pressable>
      );
    }

    // Camera created
    if (item.type === 'camera_created') {
      return (
        <Pressable onPress={() => handleAction('view_camera', item.id, data)}>
          <Box 
            bg={isDark ? "#1a1a1a" : "#f8f8f8"}
            borderRadius="$xl"
            p="$4"
            mb="$3"
            borderWidth="$1"
            borderColor={isDark ? "#333" : "#e5e5e5"}
          >
            <HStack alignItems="center" space="md">
              <Box
                w={50}
                h={50}
                borderRadius={25}
                bg="#dbeafe"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="$xl">📷</Text>
              </Box>
              
              <VStack flex={1} space="xs">
                <Text fontSize="$sm" fontWeight="$semibold" color={isDark ? "#fff" : "#000"} numberOfLines={2} ellipsizeMode="tail">
                  Created {data.cameraName}
                </Text>
                <Text fontSize={12} color={isDark ? "#999" : "#666"}>
                  You own this event • {formatTimestamp(item.timestamp)}
                </Text>
              </VStack>
              
              <Button
                size="sm"
                variant="outline"
                borderColor="#007AFF"
                onPress={(e) => {
                  e.stopPropagation();
                  handleAction('invite_camera', item.id, data);
                }}
              >
                <ButtonText color="#007AFF" fontSize="$xs">Invite</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Pressable>
      );
    }

    // Camera invite received
    if (item.type === 'camera_invite_received') {
      return (
        <Box 
          bg={isDark ? "#1a1a1a" : "#f8f8f8"}
          borderRadius="$xl"
          p="$4"
          mb="$3"
          borderWidth="$1"
          borderColor={isDark ? "#333" : "#e5e5e5"}
          opacity={isProcessing ? 0.6 : 1}
        >
          <VStack space="md" alignItems="center">
            <VStack space="xs" alignItems="center">
              <Box
                w={50}
                h={50}
                borderRadius={25}
                bg="#fef3c7"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="$xl">📩</Text>
              </Box>
              
              <Text fontSize="$sm" fontWeight="$semibold" color={isDark ? "#fff" : "#000"} textAlign="center" numberOfLines={2} ellipsizeMode="tail">
                Invited to {data.cameraName}
              </Text>
              
              <Text fontSize="$xs" color={isDark ? "#999" : "#666"} textAlign="center">
                Event invitation • {formatTimestamp(item.timestamp)}
              </Text>
            </VStack>
            
            <HStack space="md">
              <Button
                variant="outline"
                borderColor="#ff3b30"
                size="sm"
                onPress={() => handleAction('decline_camera', item.id, data)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Spinner size="small" color="#ff3b30" />
                ) : (
                  <ButtonText color="#ff3b30" fontSize="$sm">Decline</ButtonText>
                )}
              </Button>
              
              <Button
                bg="#4ade80"
                size="sm"
                onPress={() => handleAction('accept_camera', item.id, data)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <ButtonText color="$white" fontSize="$sm">Accept</ButtonText>
                )}
              </Button>
            </HStack>
          </VStack>
        </Box>
      );
    }

    // Camera joined
    if (item.type === 'camera_joined') {
      return (
        <Pressable onPress={() => handleAction('view_camera', item.id, data)}>
          <Box 
            bg={isDark ? "#1a1a1a" : "#f8f8f8"}
            borderRadius="$xl"
            p="$4"
            mb="$3"
            borderWidth="$1"
            borderColor={isDark ? "#333" : "#e5e5e5"}
          >
            <HStack alignItems="center" space="md">
              <Box
                w={50}
                h={50}
                borderRadius={25}
                bg="#d1fae5"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="$xl">✅</Text>
              </Box>
              
              <VStack flex={1} space="xs">
                <Text fontSize="$sm" fontWeight="$semibold" color={isDark ? "#fff" : "#000"} numberOfLines={1} ellipsizeMode="tail">
                  Joined {data.cameraName}
                </Text>
                <Text fontSize="$xs" color={isDark ? "#999" : "#666"}>
                  Event member • {formatTimestamp(item.timestamp)}
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Pressable>
      );
    }

    return null;
  }, [isDark, processingItems, handleAction]);

  const pickFromICloud = async () => {
    if (!profile) {
      Alert.alert("Error", "Profile not loaded.");
      return;
    }

    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,     // ✅ enables crop UI
        aspect: [1, 1],          // ✅ enforce square crop
        quality: 0.9,
        base64: false,
      });

      if (pickerResult.canceled || pickerResult.assets.length === 0) return;

      const imageAsset = pickerResult.assets[0];
      const uri = imageAsset.uri;
      
      // Basic validation
      if (!uri || !imageAsset.width || !imageAsset.height) {
        Alert.alert("Error", "Invalid image selected. Please try another image.");
        return;
      }
      
      // Check if file still exists (handles iCloud deletion case)
      try {
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error('File not accessible');
        }
      } catch (fileError) {
        Alert.alert(
          "File Not Available", 
          "This photo may have been deleted from iCloud or is not downloaded to your device. Please select a different photo."
        );
        return;
      }
      
      setPreviewImageUri(uri);
    } catch (e) {
      console.warn("Error picking profile photo:", e);
      Alert.alert("Error", "Could not pick photo.");
    }
  };

  // Show skeleton while profile is loading
  if (profileLoading) {
    return <MeMainSkeleton />;
  }

  if (profileError || !profile) {
    return (
      <Box flex={1} p="$4" bg={isDark ? "#000" : "#fff"}>
        <Text color={isDark ? "#fff" : "#000"}>
          {profileError ? "Failed to load profile." : "Profile not found."}
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box flex={1}>
        <Box flex={1} bg={isDark ? "#000" : "#fff"}>
        {/* Profile Header - Will fade out when activity section expands */}
        <Animated.View
          style={{
            opacity: profileHeaderOpacity,
          }}
        >
          <Box p="$4" pb="$2">
            <Center>
              <Pressable
                ref={profilePhotoRef}
                onPress={() => {
                  if (isNavigatingRef.current || isNavigating || isSyncingPhotosRef.current || isSyncingPhotos) return;
                  
                  isNavigatingRef.current = true;
                  setIsNavigating(true);
                  
                  setModalVisible(true);
                  
                  setTimeout(() => {
                    isNavigatingRef.current = false;
                    setIsNavigating(false);
                  }, 1000);
                }}
                borderRadius="$full"
                overflow="hidden"
              >
                {({ pressed }) => (
                  <Box
                    width={120}
                    height={120}
                    borderRadius="$full"
                    bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                    borderWidth="$2"
                    borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                    overflow="hidden"
                    shadowColor="$shadowColor"
                    shadowOffset={{ width: 0, height: 4 }}
                    shadowOpacity={0.15}
                    shadowRadius={12}
                  >
                    {profile.profilePhotoUrl ? (
                      <>
                        <ExpoImage
                          source={{ uri: profile.profilePhotoUrl }}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 58,
                          }}
                          contentFit="cover"
                        />
                        {pressed && (
                          <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            bg="rgba(255,255,255,0.25)"
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <Box
                          width="100%"
                          height="100%"
                          bg={
                            isDark
                              ? "$backgroundDark300"
                              : "$backgroundLight100"
                          }
                          justifyContent="center"
                          alignItems="center"
                        >
                          <Text
                            color={isDark ? "#999" : "#666"}
                            fontSize="$6xl"
                          >
                            👤
                          </Text>
                        </Box>
                        {pressed && (
                          <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            bg="rgba(255,255,255,0.25)"
                          />
                        )}
                      </>
                    )}
                  </Box>
                )}
              </Pressable>
            </Center>

            <Text
              fontSize="$2xl"
              fontWeight="$semibold"
              textAlign="center"
              mt="$3"
              color={isDark ? "#fff" : "#000"}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {profile.displayName ?? "Unnamed"}
            </Text>

            <HStack
              justifyContent="space-around"
              alignItems="center"
              mt="$3"
              ml="$1.5"
              px="$1"
            >
              <VStack alignItems="center" minWidth={45}>
                <Text
                  fontSize="$xl"
                  fontWeight="$bold"
                  color={isDark ? "#fff" : "#000"}
                >
                  {activityStats.total}
                </Text>
                <Text
                  fontSize="$xs"
                  color={isDark ? "#999" : "#666"}
                  fontWeight="$medium"
                  textAlign="center"
                >
                  Total
                </Text>
              </VStack>
              <VStack alignItems="center" minWidth={40}>
                <Text fontSize="$sm" fontWeight="$semibold" color="#5856D6">
                  {activityStats.pending}
                </Text>
                <Text
                  fontSize="$2xs"
                  color={isDark ? "#999" : "#666"}
                  fontWeight="$medium"
                  textAlign="center"
                  numberOfLines={1}
                >
                  📋 Pending
                </Text>
              </VStack>
              <VStack alignItems="center" minWidth={40}>
                <Text fontSize="$sm" fontWeight="$semibold" color="#007AFF">
                  {friendshipsWithProfiles.filter(f => f.friendship?.status === 'ACCEPTED').length}
                </Text>
                <Text
                  fontSize="$2xs"
                  color={isDark ? "#999" : "#666"}
                  fontWeight="$medium"
                  textAlign="center"
                  numberOfLines={1}
                >
                  👥 Friends
                </Text>
              </VStack>
              <VStack alignItems="center" minWidth={40}>
                <Text fontSize="$sm" fontWeight="$semibold" color="#34C759">
                  {activityStats.events}
                </Text>
                <Text
                  fontSize="$2xs"
                  color={isDark ? "#999" : "#666"}
                  fontWeight="$medium"
                  textAlign="center"
                  numberOfLines={1}
                >
                  📷 Events
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Animated.View>

        {/* Manual Sync Button */}
        <Animated.View
          style={{
            opacity: profileHeaderOpacity,
          }}
        >
          <Box ml={6} px="$4" pb="$3">
            <Center>
              <Pressable
                onPress={handlePhotoSync}
                disabled={isSyncingPhotos || isNavigating}
                borderRadius="$full"
                bg={(photoAccess === 'denied' || photoAccess === 'undetermined') ? "#ffebee" : isDark ? "rgba(0,122,255,0.1)" : "rgba(0,122,255,0.05)"}
                borderColor={(photoAccess === 'denied' || photoAccess === 'undetermined') ? "#f44336" : undefined}
                borderWidth={(photoAccess === 'denied' || photoAccess === 'undetermined') ? "$1" : undefined}
                px="$1.5"
                mb={25}
                py="$0.5"
                $pressed={{
                  bg: (photoAccess === 'denied' || photoAccess === 'undetermined') ? "#ffcdd2" : isDark ? "rgba(0,122,255,0.2)" : "rgba(0,122,255,0.1)",
                }}
                opacity={isSyncingPhotos || isNavigating ? 0.6 : 1}
              >
                <Text 
                  color={(photoAccess === 'denied' || photoAccess === 'undetermined') ? "#d32f2f" : (isSyncingPhotos || isNavigating) ? "#999" : "#007AFF"}
                  fontSize={(photoAccess === 'denied' || photoAccess === 'undetermined') ? "$xs" : "$sm"}
                  fontWeight="$semibold"
                >
                  {isSyncingPhotos ? "⏳ Syncing..." : 
                   isNavigating ? "⏳ Loading..." :
                   photoAccess === 'undetermined' ? "🔄 Sync Photos" :
                   photoAccess === 'denied' ? "🔒 Enable Photo Access in Settings" :
                   photoAccess === 'limited' ? `🔄 Sync Photos (${limitedPhotoCount} available)` :
                   "🔄 Sync iCloud Photos"}
                </Text>
              </Pressable>
            </Center>
          </Box>
        </Animated.View>

        {activityItems.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingVertical: 100,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
              />
            }
            showsVerticalScrollIndicator={false}
            bounces={true}
            alwaysBounceVertical={true}
          >
            <Center>
              <VStack space="lg" alignItems="center">
                <Box
                  width={80}
                  height={80}
                  borderRadius="$full"
                  bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                  justifyContent="center"
                  alignItems="center"
                  shadowColor="$shadowColor"
                  shadowOffset={{ width: 0, height: 4 }}
                  shadowOpacity={0.1}
                  shadowRadius={12}
                >
                  <Text fontSize="$3xl">📬</Text>
                </Box>
                <VStack space="sm" alignItems="center">
                  <Heading
                    size="lg"
                    color={isDark ? "$textDark100" : "$textLight900"}
                    textAlign="center"
                    fontWeight="$semibold"
                  >
                    No Activity Yet
                  </Heading>
                  <Text
                    fontSize="$md"
                    color={isDark ? "$textDark300" : "$textLight600"}
                    textAlign="center"
                    lineHeight={22}
                  >
                    Add friends and join events to see your activity here
                  </Text>
                </VStack>
              </VStack>
            </Center>
          </ScrollView>
        ) : (
          <>
            {/* Container */}
            <Animated.View
                style={{
                  height: EXPANDED_HEIGHT,
                  transform: [{ translateY: animatedTranslateY }],
                  overflow: "hidden",
                  backgroundColor: isDark
                    ? "rgba(0,0,0,0.95)"
                    : "rgba(255,255,255,0.98)",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  elevation: 8,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: isDark ? 0.4 : 0.15,
                  shadowRadius: 20,
                  zIndex: isCarouselExpanded ? 15 : 2,
                  position: "absolute",
                  bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
                  left: 0,
                  right: 0,
                }}
                {...panResponder.panHandlers}
              >
              {/* Header */}
              <Box>
                <Box
                  bg={isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.95)"}
                  pt="$2"
                  borderTopLeftRadius="$3xl"
                  borderTopRightRadius="$3xl"
                  shadowColor="$shadowColor"
                  shadowOffset={{ width: 0, height: -4 }}
                  shadowOpacity={0.08}
                  shadowRadius={16}
                >
                  <Box
                    minHeight={DRAG_HANDLE_HEIGHT + 16}
                    justifyContent="flex-start"
                    alignItems="center"
                    pt="$0"
                    pb="$3"
                    px="$3"
                  >
                    {/* Activity Section Title */}
                    <HStack alignItems="center" justifyContent="center" w="100%" px="$4" position="relative">
                      <Heading
                        size="lg"
                        textAlign="center"
                        color={isDark ? "$textDark100" : "$textLight900"}
                        fontWeight="$bold"
                      >
                        Friends/Events
                      </Heading>
                    </HStack>
                  </Box>
                </Box>
              </Box>

              <Box mb={-15}/>

              {/* First Divider */}
              <Box
                height={0.5}
                mx="$5"
                bg={isDark ? "$borderDark600" : "$borderLight300"}
              />



              {/* Friends/Events Content */}
              <Box flex={1}>
                {activityItems.length === 0 ? (
                  <Center flex={1} pt="$8">
                    <VStack space="md" alignItems="center">
                      <Box
                        width={60}
                        height={60}
                        borderRadius="$full"
                        bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                        justifyContent="center"
                        alignItems="center"
                      >
                        <Text fontSize="$xl">👥</Text>
                      </Box>
                      <Text fontSize="$lg" color={isDark ? "#666" : "#999"} fontWeight="$medium">
                        No Activity Yet
                      </Text>
                      <Text fontSize="$sm" color={isDark ? "#555" : "#666"} textAlign="center">
                        Friend requests and event invites will appear here
                      </Text>
                    </VStack>
                  </Center>
                ) : (
                  <FlatList
                    ref={activityListRef}
                    data={activityItems}
                    renderItem={renderActivityItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    ItemSeparatorComponent={() => <Box height={8} />}
                    initialNumToRender={8}
                    maxToRenderPerBatch={5}
                    windowSize={10}
                    removeClippedSubviews={false}
                    updateCellsBatchingPeriod={50}
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={async () => {
                          setIsRefreshing(true);
                          try {
                            await Promise.all([refetchFriendships(), refetchCameras()]);
                          } finally {
                            setIsRefreshing(false);
                          }
                        }}
                      />
                    }
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScrollView}
                    scrollEventThrottle={16}
                    getItemLayout={(_, index) => ({
                      length: 120, // Approximate height of each activity item
                      offset: 120 * index,
                      index,
                    })}
                  />
                )}
              </Box>
            </Animated.View>
          </>
        )}
        </Box>
      </Box>

      {/* Profile Photo Modal */}
      <Modal 
        isOpen={modalVisible} 
        onClose={() => {
          // Prevent closing modal during upload to avoid confusion
          if (updateProfilePhoto.isPending) {
            return;
          }
          setModalVisible(false);
          setPreviewImageUri(null); // ✅ clear preview when closing
        }}
      >
        <ModalBackdrop bg="rgba(0,0,0,0.4)" />
        <ModalContent
          maxWidth="$80"
          borderRadius="$2xl"
          bg={isDark ? "#1c1c1c" : "#fff"}
          shadowColor="$shadowColor"
          shadowOffset={{ width: 0, height: 12 }}
          shadowOpacity={0.25}
          shadowRadius={20}
          elevation={12}
          borderWidth="$1"
          borderColor={isDark ? "#333" : "#e5e5e5"}
        >
          <ModalBody p="$0">
            <Box
              bg={isDark ? "#1c1c1c" : "#fff"}
              borderTopLeftRadius="$2xl"
              borderTopRightRadius="$2xl"
              pt="$6"
              px="$6"
              pb="$4"
              borderBottomWidth="$1"
              borderBottomColor={isDark ? "#333" : "#e5e5e5"}
            >
              <VStack space="xs" alignItems="center">
                <Box
                  w="$16"
                  h="$16"
                  bg="linear-gradient(135deg, #007AFF 0%, #5856D6 100%)"
                  borderRadius="$full"
                  justifyContent="center"
                  alignItems="center"
                  shadowColor="#007AFF"
                  shadowOffset={{ width: 0, height: 4 }}
                  shadowOpacity={0.3}
                  shadowRadius={8}
                >
                  <Text fontSize="$2xl" color="$white">
                    📸
                  </Text>
                </Box>

                <Text
                  fontSize="$xl"
                  fontWeight="$bold"
                  textAlign="center"
                  color={isDark ? "#fff" : "#000"}
                  mt="-$3"
                >
                  Profile Photo
                </Text>

                <Text
                  fontSize="$sm"
                  textAlign="center"
                  color={isDark ? "#999" : "#666"}
                  opacity={0.8}
                >
                  Choose a photo from your iCloud library
                </Text>
              </VStack>
            </Box>

            <Box p="$6">
              {updateProfilePhoto.isPending ? (
                <VStack space="lg" alignItems="center" py="$8">
                  <Box position="relative">
                    <Spinner size="large" color="#007AFF" />
                  </Box>

                  <VStack space="xs" alignItems="center">
                    <Text
                      color={isDark ? "#fff" : "#000"}
                      fontSize="$md"
                      fontWeight="$medium"
                    >
                      Uploading your photo
                    </Text>
                    <Text color={isDark ? "#999" : "#666"} fontSize="$sm">
                      This may take a moment...
                    </Text>
                  </VStack>
                </VStack>
              ) : (
                <VStack space="md" w="100%">
                  {previewImageUri && (
                    <Center my="$4">
                      <Box
                        width={150}
                        height={150}
                        borderRadius={75}        // ✅ circle preview
                        overflow="hidden"
                        borderWidth="$2"
                        borderColor="#007AFF"
                        shadowColor="#007AFF"
                        shadowOffset={{ width: 0, height: 4 }}
                        shadowOpacity={0.2}
                        shadowRadius={6}
                      >
                        <ExpoImage
                          source={{ uri: previewImageUri }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      </Box>
                      <Text mt="$2" fontSize="$sm" color={isDark ? "#999" : "#666"}>
                        Preview
                      </Text>
                    </Center>
                  )}

                  <Button
                    bg="#007AFF"
                    disabled={updateProfilePhoto.isPending}
                    opacity={updateProfilePhoto.isPending ? 0.6 : 1}
                    onPress={() => {
                      if (previewImageUri) {
                        updateProfilePhoto.mutate(
                          { imageUri: previewImageUri },
                          {
                            onSuccess: () => {
                              Alert.alert("Success", "Profile photo updated!");
                              setPreviewImageUri(null); // ✅ clear preview after save
                              setModalVisible(false);
                            },
                            onError: (error) => {
                              console.error("Profile photo upload failed:", error);
                              setPreviewImageUri(null); // ✅ Clear preview to free memory
                              Alert.alert("Error", "Could not update profile photo. Please try again.");
                            }
                          }
                        );
                      } else {
                        pickFromICloud();
                      }
                    }}
                    borderRadius="$xl"
                    w="100%"
                    h={50}
                  >
                    <ButtonText color="$white" fontWeight="$bold" fontSize="$md">
                      {updateProfilePhoto.isPending ? "Uploading..." : (previewImageUri ? "Save Photo" : "📱 Choose from Library")}
                    </ButtonText>
                  </Button>

                  <Box h="$px" bg={isDark ? "#444" : "#ccc"} my="$2" w="100%" />

                  <Button
                    variant="outline"
                    borderColor={isDark ? "#444" : "#ccc"}
                    disabled={updateProfilePhoto.isPending}
                    opacity={updateProfilePhoto.isPending ? 0.6 : 1}
                    onPress={() => {
                      setPreviewImageUri(null); // ✅ Clear preview
                      setModalVisible(false);
                    }}
                    borderRadius="$xl"
                    w="100%"
                    h={50}
                    bg="transparent"
                    shadowColor="$shadowColor"
                    shadowOffset={{ width: 0, height: 2 }}
                    shadowOpacity={0.1}
                    shadowRadius={4}
                  >
                    <ButtonText
                      color={isDark ? "#fff" : "#000"}
                      fontWeight="$medium"
                      fontSize="$md"
                    >
                      Cancel
                    </ButtonText>
                  </Button>
                </VStack>
              )}
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}