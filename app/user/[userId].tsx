/* app/user/[userId].tsx */
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Alert,
  useColorScheme,
  Dimensions,
  Animated,
  PanResponder,
  NativeScrollEvent,
  NativeSyntheticEvent,
  FlatList,
  useWindowDimensions,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated as RNAnimated,
} from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Spinner,
  Center,
  Divider,
  Pressable,
  Heading,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalBody,
} from '@gluestack-ui/themed';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";

// API Hooks
import { useUserProfile, useFriendshipStatus } from "@/src/hooks/useUserQueries";
import { 
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest
} from "@/src/hooks/useUserMutations";
import { 
  useCurrentUser,
  useUserCameras,
  useInfiniteFaceMatchedPhotos,
  useInfiniteSharedCameraPhotosWithFriend,
  useInfiniteFaceMatchedPhotosAll,
  useInfiniteMultiSharedCameraPhotos,
  type MyPhoto 
} from "@/src/hooks/usePhotoQueries";
import { useCameraSubscriptions } from "@/src/hooks/useCameraSubscriptions";
import { usePhotoSubscriptions } from "@/src/hooks/usePhotoSubscriptions";
import { useUserCameraMemberships, useCameraInvitesAndMemberships } from "@/src/hooks/useCameraQueries";
import { useSendCameraInvites } from "@/src/hooks/useCameraMutations";
import { OptimizedPhotoItem } from "@/components/OptimizedPhotoItem";
import { UserProfileSkeleton } from "@/components/SkeletonLoaders";
import * as WebBrowser from "expo-web-browser";
import { MoreVertical, Flag, Camera, UserCheck } from "lucide-react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const PHOTOS_PER_ROW = 4;
const thumbSize = screenWidth / PHOTOS_PER_ROW;

const COLLAPSED_HEIGHT = screenHeight * 0.585;
const EXPANDED_HEIGHT = screenHeight * 0.87;
const DRAG_HANDLE_HEIGHT = Math.min(Math.max(38, screenHeight * 0.04), 50);

// Types
interface PhotoStats {
  owned: number;
  faceMatch: number;
  shared: number;
  received: number;
  total: number;
  faceMatchHasMore?: boolean;
  sharedHasMore?: boolean;
}

// Section type for carousel
type PhotoSection = {
  id: 'faceMatch' | 'sharedCameras';
  name: string;
  emoji: string;
  photos: MyPhoto[];
  hasMore?: boolean;
};

// Optimized PhotoItem component using cached images like me.tsx
const PhotoItem = React.memo(({ photo, thumbSize, columnIndex, isSelf, status, userId, router, isNavigating, setIsNavigating }: {
  photo: MyPhoto;
  thumbSize: number;
  columnIndex: number;
  isSelf: boolean;
  status: string;
  userId: string;
  router: any;
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
}) => {
  const handlePress = useCallback(() => {
    // Prevent multiple simultaneous navigations
    if (isNavigating) return;
    
    setIsNavigating(true);
    
    // Debounce navigation - reset after a short delay
    setTimeout(() => setIsNavigating(false), 1000);
    
    if (!isSelf && status === "ACCEPTED") {
      // Friend's shared photo
      if (photo.cameraId) {
        // Shared camera photo
        router.push({
          pathname: `/photo/${photo.id}` as any,
          params: { cameraId: photo.cameraId },
        });
      } else {
        // Face-matched photo
        router.push({
          pathname: `/photo/${photo.id}` as any,
          params: { friendId: userId },
        });
      }
    } else if (isSelf) {
      // Personal photo - use existing navigation logic
      if (photo.friendGroupKey && !photo.cameraId) {
        router.push({
          pathname: `/photo/${photo.id}` as any,
          params: { friendGroupKey: photo.friendGroupKey },
        });
      } else if (photo.cameraId) {
        router.push({
          pathname: `/photo/${photo.id}` as any,
          params: { cameraId: photo.cameraId },
        });
      } else {
        router.push(`/photo/${photo.id}` as any);
      }
    }
  }, [photo, isSelf, status, userId, router, isNavigating, setIsNavigating]);

  return (
    <OptimizedPhotoItem
      photo={{
        id: photo.id,
        url: photo.url,
        cameraId: photo.cameraId,
        friendGroupKey: photo.friendGroupKey,
      }}
      thumbSize={thumbSize}
      columnIndex={columnIndex}
      onPress={handlePress}
      recyclingKey={photo.id}
    />
  );
});

export default function UserProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const windowDimensions = useWindowDimensions();
  const { width } = windowDimensions || Dimensions.get('window');

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const [isCarouselExpanded, setIsCarouselExpanded] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<'faceMatch' | 'sharedCameras'>('faceMatch');
  const [refreshing, setRefreshing] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showUserActionMenu, setShowUserActionMenu] = useState(false);

  // Animation refs
  const animatedTranslateY = useRef(new Animated.Value(0)).current;
  const photosListRefs = useRef<{ [key: string]: FlatList | null }>({});
  const isScrollEnabled = useRef(true);
  const scrollOffset = useRef(0);
  const gestureStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const isDragging = useRef(false);
  const gestureReady = useRef(false);

  // Carousel scroll tracking
  const scrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  // Get current user ID
  const { data: currentUserId, isLoading: userIdLoading } = useCurrentUser();

  // Profile and friendship data
  const { 
    data: profile, 
    isLoading: profileLoading, 
    error: profileError,
    refetch: refetchProfile 
  } = useUserProfile(userId || "");
  
  const { 
    data: friendshipData, 
    isLoading: friendshipLoading, 
    refetch: refetchFriendship 
  } = useFriendshipStatus(currentUserId || "", userId || "");


  // Determine friendship status
  const { status = "NONE", isSelf = false } = friendshipData || {};

  const { data: userCameras = [] } = useUserCameras(currentUserId);
  const sharedCameraNames = useMemo(() => userCameras.map(c => c.name), [userCameras]);
  
  // Get user's camera memberships for invite functionality
  const { data: currentUserCameraMemberships = [] } = useUserCameraMemberships(currentUserId);
  
  // Get friend's camera invites and memberships (includes role information)
  const { data: friendCameraData } = useCameraInvitesAndMemberships(
    !isSelf && status === "ACCEPTED" ? userId : null
  );
  
  // Combine friend's invites and memberships to get complete list with roles
  const friendCameraMemberships = useMemo(() => {
    if (!friendCameraData) return [];
    return [...friendCameraData.invites, ...friendCameraData.myCams];
  }, [friendCameraData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMIZED PHOTO QUERIES
  // ═══════════════════════════════════════════════════════════════════════════
  
  // For SELF-VIEW: Use optimized infinite queries
  const selfFaceMatchedPhotosQuery = useInfiniteFaceMatchedPhotosAll(
    isSelf ? currentUserId : null
  );
  const selfSharedCameraPhotosQuery = useInfiniteMultiSharedCameraPhotos(
    isSelf ? currentUserId : null
  );

  // For FRIEND-VIEW: Use friend-specific queries
  const friendFaceMatchedPhotosQuery = useInfiniteFaceMatchedPhotos(
    currentUserId || "",
    !isSelf && status === "ACCEPTED" ? userId : null
  );
  const friendSharedCameraPhotosQuery = useInfiniteSharedCameraPhotosWithFriend(
    currentUserId,
    !isSelf && status === "ACCEPTED" ? userId : null
  );

  // Enable subscriptions for real-time updates
  useCameraSubscriptions(!!currentUserId, currentUserId);
  usePhotoSubscriptions(!!currentUserId, currentUserId);

  // Mutations
  const cancelFriendRequest = useCancelFriendRequest();
  const sendFriendRequestMutation = useSendFriendRequest();
  const acceptFriendRequestMutation = useAcceptFriendRequest();
  const declineFriendRequestMutation = useDeclineFriendRequest();
  const sendCameraInvitesMutation = useSendCameraInvites();

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES - OPTIMIZED STATS COMPUTATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Optimized photo data computation using infinite queries
  const { photoStats, photoSections, photosLoading } = useMemo(() => {
    if (isSelf && currentUserId) {
      // Self-view: use optimized infinite queries
      const faceMatchedPhotos = selfFaceMatchedPhotosQuery.deduplicatedPhotos;
      const sharedCameraPhotos = selfSharedCameraPhotosQuery.data?.pages?.flatMap(page => page.photos) || [];

      // Compute stats directly from infinite query results
      const stats: PhotoStats = {
        owned: 0, // Could be computed from photo.source if needed
        faceMatch: faceMatchedPhotos.length,
        shared: sharedCameraPhotos.length,
        received: 0, // Could be computed from photo.source if needed
        total: faceMatchedPhotos.length + sharedCameraPhotos.length,
        // Track if there are more photos to load for each category
        faceMatchHasMore: selfFaceMatchedPhotosQuery.hasNextPage,
        sharedHasMore: selfSharedCameraPhotosQuery.hasNextPage
      };

      const sections = {
        faceMatch: faceMatchedPhotos,
        sharedCameras: sharedCameraPhotos
      };

      const isLoading = 
        (selfFaceMatchedPhotosQuery.isLoading && faceMatchedPhotos.length === 0) ||
        (selfSharedCameraPhotosQuery.isLoading && sharedCameraPhotos.length === 0);

      return {
        photoStats: stats,
        photoSections: sections,
        photosLoading: isLoading
      };
    } else if (status === "ACCEPTED" && !isSelf && currentUserId) {
      // Friend-view: use friend-specific infinite queries with proper deduplication
      const faceMatchedPhotos = friendFaceMatchedPhotosQuery.data?.pages?.flatMap(page => page.photos) || [];
      const sharedCameraPhotos = friendSharedCameraPhotosQuery.data?.pages?.flatMap(page => page.photos) || [];

      // Convert to MyPhoto format for consistency
      const faceMatchPhotos: MyPhoto[] = faceMatchedPhotos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        createdAt: photo.createdAt,
        source: "shared" as const,
        cameraName: "Face-match",
      }));

      const stats: PhotoStats = {
        owned: 0,
        faceMatch: faceMatchPhotos.length,
        shared: sharedCameraPhotos.length,
        received: 0,
        total: faceMatchPhotos.length + sharedCameraPhotos.length,
        // Track if there are more photos to load for each category
        faceMatchHasMore: friendFaceMatchedPhotosQuery.hasNextPage,
        sharedHasMore: friendSharedCameraPhotosQuery.hasNextPage
      };

      const sections = {
        faceMatch: faceMatchPhotos,
        sharedCameras: sharedCameraPhotos
      };

      const isLoading = 
        (friendFaceMatchedPhotosQuery.isLoading && faceMatchPhotos.length === 0) ||
        (friendSharedCameraPhotosQuery.isLoading && sharedCameraPhotos.length === 0);

      return {
        photoStats: stats,
        photoSections: sections,
        photosLoading: isLoading
      };
    } else {
      // Non-friend or loading: no photos
      return {
        photoStats: { owned: 0, faceMatch: 0, shared: 0, received: 0, total: 0 },
        photoSections: { faceMatch: [], sharedCameras: [] },
        photosLoading: false
      };
    }
  }, [
    isSelf, 
    status, 
    currentUserId, 
    selfFaceMatchedPhotosQuery.deduplicatedPhotos,
    selfFaceMatchedPhotosQuery.isLoading,
    selfSharedCameraPhotosQuery.data,
    selfSharedCameraPhotosQuery.isLoading,
    friendFaceMatchedPhotosQuery.data,
    friendFaceMatchedPhotosQuery.isLoading,
    friendSharedCameraPhotosQuery.data,
    friendSharedCameraPhotosQuery.isLoading
  ]);

  // Loading states
  const loading = profileLoading || friendshipLoading || userIdLoading || !currentUserId || photosLoading;
  const actionLoading = sendFriendRequestMutation.isPending || 
                       acceptFriendRequestMutation.isPending || 
                       declineFriendRequestMutation.isPending;

  // Optimized infinite scroll handlers
  const loadMoreSharedPhotos = useCallback(() => {
    if (isSelf) {
      if (selfSharedCameraPhotosQuery.hasNextPage && !selfSharedCameraPhotosQuery.isFetchingNextPage) {
        console.log(`🔄 [INFINITE_SCROLL] Loading more shared camera photos (self)`);
        selfSharedCameraPhotosQuery.fetchNextPage();
      }
    } else {
      if (friendSharedCameraPhotosQuery.hasNextPage && !friendSharedCameraPhotosQuery.isFetchingNextPage) {
        console.log(`🔄 [INFINITE_SCROLL] Loading more shared camera photos (friend)`);
        friendSharedCameraPhotosQuery.fetchNextPage();
      }
    }
  }, [
    isSelf,
    selfSharedCameraPhotosQuery.hasNextPage,
    selfSharedCameraPhotosQuery.isFetchingNextPage,
    selfSharedCameraPhotosQuery.fetchNextPage,
    friendSharedCameraPhotosQuery.hasNextPage,
    friendSharedCameraPhotosQuery.isFetchingNextPage,
    friendSharedCameraPhotosQuery.fetchNextPage
  ]);

  const loadMoreFaceMatchedPhotos = useCallback(() => {
    if (isSelf) {
      if (selfFaceMatchedPhotosQuery.hasNextPage && !selfFaceMatchedPhotosQuery.isFetchingNextPage) {
        console.log(`🔄 [INFINITE_SCROLL] Loading more face-matched photos (self)`);
        selfFaceMatchedPhotosQuery.fetchNextPage();
      }
    } else {
      if (friendFaceMatchedPhotosQuery.hasNextPage && !friendFaceMatchedPhotosQuery.isFetchingNextPage) {
        console.log(`🔄 [INFINITE_SCROLL] Loading more face-matched photos (friend)`);
        friendFaceMatchedPhotosQuery.fetchNextPage();
      }
    }
  }, [
    isSelf,
    selfFaceMatchedPhotosQuery.hasNextPage,
    selfFaceMatchedPhotosQuery.isFetchingNextPage,
    selfFaceMatchedPhotosQuery.fetchNextPage,
    friendFaceMatchedPhotosQuery.hasNextPage,
    friendFaceMatchedPhotosQuery.isFetchingNextPage,
    friendFaceMatchedPhotosQuery.fetchNextPage
  ]);

  // Create sections for carousel with optimized hasMore logic
  const photoCarouselSections: PhotoSection[] = useMemo(() => [
    {
      id: 'faceMatch',
      name: 'Face-match',
      emoji: '🎯',
      photos: photoSections.faceMatch,
      hasMore: isSelf 
        ? selfFaceMatchedPhotosQuery.hasNextPage 
        : friendFaceMatchedPhotosQuery.hasNextPage,
    },
    {
      id: 'sharedCameras', 
      name: 'Shared Events',
      emoji: '📷',
      photos: photoSections.sharedCameras,
      hasMore: isSelf 
        ? selfSharedCameraPhotosQuery.hasNextPage 
        : friendSharedCameraPhotosQuery.hasNextPage,
    }
  ], [
    photoSections.faceMatch, 
    photoSections.sharedCameras, 
    isSelf,
    selfFaceMatchedPhotosQuery.hasNextPage,
    selfSharedCameraPhotosQuery.hasNextPage,
    friendFaceMatchedPhotosQuery.hasNextPage,
    friendSharedCameraPhotosQuery.hasNextPage
  ]);

  const selectedSection = photoCarouselSections.find(s => s.id === selectedSectionId) || photoCarouselSections[0];

  // Create camera status map for the friend (instead of filtering out)
  const cameraStatusMap = useMemo(() => {
    if (!friendCameraMemberships) {
      return new Map();
    }
    
    const statusMap = new Map();
    friendCameraMemberships.forEach(cam => {
      statusMap.set(cam.cameraId, cam.role);
    });
    return statusMap;
  }, [friendCameraMemberships]);

  // Get cameras: filter out MEMBER/ADMIN, show INVITED as greyed out, show NONE as available
  const camerasWithStatus = useMemo(() => {
    if (!currentUserCameraMemberships) {
      return [];
    }
    
    return currentUserCameraMemberships
      .map(camera => ({
        ...camera,
        friendStatus: cameraStatusMap.get(camera.cameraId) || 'NONE'
      }))
      .filter(camera => {
        // Filter out cameras where friend is already MEMBER or ADMIN
        return camera.friendStatus !== 'MEMBER' && camera.friendStatus !== 'ADMIN';
      });
  }, [currentUserCameraMemberships, cameraStatusMap]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === "PENDING_SENT") {
      pulseAnim.setValue(0);
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      
      pulseLoop.start();
      return () => {
        pulseLoop.stop();
      };
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }
  }, [status, pulseAnim]);

  // Profile header opacity during drag
  const profileHeaderOpacity = animatedTranslateY.interpolate({
    inputRange: [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), -100, 0],
    outputRange: [0, 0.7, 1],
    extrapolate: "clamp",
  });

  // Keep translateY refs in sync
  useEffect(() => {
    currentTranslateY.current = isCarouselExpanded 
      ? -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) 
      : 0;
  }, [isCarouselExpanded]);

  // Pan responder for drag gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (refreshing) return false;
        const { dy, dx } = gestureState;
        if (Math.abs(dy) < 5 || Math.abs(dx) > Math.abs(dy)) return false;
        
        if (dy < 0) return scrollOffset.current <= 5;
        if (dy > 0) return isCarouselExpanded || scrollOffset.current <= 5;
        
        return false;
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
        if (!gestureReady.current) return;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS (OPTIMIZED FOCUS EFFECT)
  // ═══════════════════════════════════════════════════════════════════════════

  // Optimized focus effect for data refresh
  useFocusEffect(
    useCallback(() => {
      if (isSelf && currentUserId) {
        if (selfFaceMatchedPhotosQuery.isStale) {
          console.log("🔄 [USER_SCREEN] Refreshing stale face-matched photos (self)");
          selfFaceMatchedPhotosQuery.refetch();
        }
        if (selfSharedCameraPhotosQuery.isStale) {
          console.log("🔄 [USER_SCREEN] Refreshing stale shared camera photos (self)");
          selfSharedCameraPhotosQuery.refetch();
        }
      } else if (!isSelf && status === "ACCEPTED" && currentUserId) {
        if (friendFaceMatchedPhotosQuery.isStale) {
          console.log("🔄 [USER_SCREEN] Refreshing stale face-matched photos (friend)");
          friendFaceMatchedPhotosQuery.refetch();
        }
        if (friendSharedCameraPhotosQuery.isStale) {
          console.log("🔄 [USER_SCREEN] Refreshing stale shared camera photos (friend)");
          friendSharedCameraPhotosQuery.refetch();
        }
      }
    }, [
      isSelf, 
      status, 
      currentUserId,
      selfFaceMatchedPhotosQuery.isStale,
      selfFaceMatchedPhotosQuery.refetch,
      selfSharedCameraPhotosQuery.isStale,
      selfSharedCameraPhotosQuery.refetch,
      friendFaceMatchedPhotosQuery.isStale,
      friendFaceMatchedPhotosQuery.refetch,
      friendSharedCameraPhotosQuery.isStale,
      friendSharedCameraPhotosQuery.refetch
    ])
  );

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const refreshPromises: Promise<any>[] = [
        refetchProfile(),
        refetchFriendship(),
      ];
      await Promise.all(refreshPromises);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile, refetchFriendship]);

  // Photo list scroll handler
  const handlePhotoListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  // Handle section switching based on scroll
  const updateSelectedSectionFromScroll = useCallback((scrollX: number) => {
    const currentIndex = Math.round(scrollX / width);
    if (currentIndex >= 0 && currentIndex < photoCarouselSections.length) {
      const newSelectedSectionId = photoCarouselSections[currentIndex].id;
      if (newSelectedSectionId !== selectedSectionId) {
        setTimeout(() => setSelectedSectionId(newSelectedSectionId), 50);
      }
    }
  }, [width, photoCarouselSections, selectedSectionId]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollXValue = event.nativeEvent.contentOffset.x;
    requestAnimationFrame(() => {
      updateSelectedSectionFromScroll(scrollXValue);
    });
  }, [updateSelectedSectionFromScroll]);

  // Optimized scroll handler for carousel
  const handleScroll = useMemo(() => 
    Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
      { 
        useNativeDriver: false,
        listener: undefined,
      }
    ), [scrollX]
  );

  // Friendship action handlers
  const cancelRequest = useCallback(async () => {
    try {
      if (friendshipData?.rowId && friendshipData?.rowVersion) {
        cancelFriendRequest.mutate({
          rowId: friendshipData.rowId,
          rowVersion: friendshipData.rowVersion,
          friendId: userId,
        });
      }
    } catch (err) {
      console.error("Cancel request error:", err)
      Alert.alert("Error", "Could not cancel friend request")
    }
  }, [friendshipData?.rowId, friendshipData?.rowVersion, cancelFriendRequest, userId]);

  const sendRequest = useCallback(async () => {
    if (!userId) return;
    try {
      await sendFriendRequestMutation.mutateAsync({ friendId: userId });
    } catch (err) {
      console.error("Send request error:", err);
      Alert.alert("Error", "Could not send friend request");
    }
  }, [userId, sendFriendRequestMutation]);

  const acceptRequest = useCallback(async () => {
    if (!friendshipData?.rowId || friendshipData?.rowVersion === null || friendshipData?.rowVersion === undefined) {
      Alert.alert("Error", "Missing request information");
      return;
    }
    
    try {
      await acceptFriendRequestMutation.mutateAsync({ rowId: friendshipData.rowId, rowVersion: friendshipData.rowVersion });
    } catch (err) {
      console.error("Accept request error:", err);
      Alert.alert("Error", "Could not accept friend request");
    }
  }, [friendshipData?.rowId, friendshipData?.rowVersion, acceptFriendRequestMutation]);

  const declineRequest = useCallback(async () => {
    if (!friendshipData?.rowId || friendshipData?.rowVersion === null || friendshipData?.rowVersion === undefined) {
      Alert.alert("Error", "Missing request information");
      return;
    }
    
    try {
      await declineFriendRequestMutation.mutateAsync({ rowId: friendshipData.rowId, rowVersion: friendshipData.rowVersion });
    } catch (err) {
      console.error("Decline request error:", err);
      Alert.alert("Error", "Could not decline friend request");
    }
  }, [friendshipData?.rowId, friendshipData?.rowVersion, declineFriendRequestMutation]);

  const handleCameraInvite = useCallback(async (cameraId: string) => {
    if (!userId || isNavigating) return;
    
    // Find the camera name to include in the alert
    const camera = camerasWithStatus.find(cam => cam.cameraId === cameraId);
    const cameraName = camera?.name || "the event";
    
    try {
      await sendCameraInvitesMutation.mutateAsync({
        cameraId,
        userIds: [userId],
      });
      
      setShowCameraPicker(false);
      Alert.alert(
        "Invite Sent!", 
        `Successfully invited ${profile?.displayName ?? "this user"} to ${cameraName}.`,
        [{ text: "OK" }]
      );
    } catch (err) {
      console.error("Failed to send event invite:", err);
      Alert.alert(
        "Error", 
        "Failed to send event invite. Please try again.",
        [{ text: "OK" }]
      );
    }
  }, [userId, profile?.displayName, sendCameraInvitesMutation, camerasWithStatus, isNavigating]);

  // User action menu handlers
  const userActionMenuAnim = useRef(new RNAnimated.Value(0)).current;

  const handleUserMenuPress = useCallback(() => {
    if (showUserActionMenu) {
      // Close menu
      RNAnimated.timing(userActionMenuAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowUserActionMenu(false);
      });
    } else {
      // Open menu
      setShowUserActionMenu(true);
      RNAnimated.timing(userActionMenuAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showUserActionMenu, userActionMenuAnim]);

  const handleReportUser = useCallback(() => {
    RNAnimated.timing(userActionMenuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowUserActionMenu(false);
      
      // Collect user metadata for reporting
      const userMetadata = {
        userId: userId || 'unknown',
        displayName: profile?.displayName || 'unknown',
        profilePhotoUrl: profile?.profilePhotoUrl || 'none',
        friendshipStatus: status || 'unknown',
        reportedAt: new Date().toISOString()
      };
      
      const subject = "Report%20User%20Behavior";
      const metadataString = encodeURIComponent(`User Details:
• User ID: ${userMetadata.userId}
• Display Name: ${userMetadata.displayName}
• Friendship Status: ${userMetadata.friendshipStatus}
• Profile Photo: ${userMetadata.profilePhotoUrl}
• Reported at: ${userMetadata.reportedAt}`);
      
      const url = `https://phomo.camera/support?from=app&subject=${subject}&metadata=${metadataString}&lock_subject=true`;
      WebBrowser.openBrowserAsync(url);
    });
  }, [userActionMenuAnim, userId, profile, status]);


  const handleMenuCameraInvite = useCallback(() => {
    RNAnimated.timing(userActionMenuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowUserActionMenu(false);
      if (!isNavigating) {
        setShowCameraPicker(true);
      }
    });
  }, [userActionMenuAnim, isNavigating]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Simple static dot indicator component
  const renderDot = useCallback((index: number) => {
    const selectedIndex = photoCarouselSections.findIndex(s => s.id === selectedSectionId);
    const isActive = index === selectedIndex;
    return (
      <View
        key={index}
        style={{
          width: isActive ? 12 : 8,
          height: isActive ? 12 : 8,
          borderRadius: isActive ? 6 : 4,
          backgroundColor: "#007AFF",
          marginHorizontal: 6,
          opacity: isActive ? 1 : 0.4,
        }}
      />
    );
  }, [selectedSectionId, photoCarouselSections]);

  // Section renderer (no skeleton loading, simplified)
  const renderSectionContent = useCallback((section: PhotoSection) => {
    if (section.photos.length === 0) {
      return (
        <Center flex={1} mb={340}>
          <VStack space="md" alignItems="center">
            <Box
              width={60}
              height={60}
              borderRadius="$full"
              bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
              justifyContent="center"
              alignItems="center"
              shadowColor="$shadowColor"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.1}
              shadowRadius={12}
            >
              <Text fontSize="$xl">{section.emoji}</Text>
            </Box>
            <VStack space="sm" alignItems="center">
              <Text fontSize="$lg" color={isDark ? "#666" : "#999"} fontWeight="$medium">
                No {section.name} Photos
              </Text>
              <Text
                fontSize="$sm"
                color={isDark ? "#555" : "#666"}
                textAlign="center"
                px="$8"
              >
                {section.id === 'faceMatch'
                  ? "Take photos together to see them here"
                  : "Join the same events to share photos"
                }
              </Text>
            </VStack>
          </VStack>
        </Center>
      );
    }

    return (
      <FlatList
        ref={(ref) => {
          if (ref) photosListRefs.current[section.id] = ref;
        }}
        data={section.photos}
        keyExtractor={(item) => item.id}
        numColumns={PHOTOS_PER_ROW}
        bounces={true}
        overScrollMode="never"
        scrollEnabled={isScrollEnabled.current}
        onScroll={handlePhotoListScroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        maxToRenderPerBatch={16}
        windowSize={8}
        initialNumToRender={12}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={50}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: -1,
        }}
        getItemLayout={(_, index) => ({
          length: thumbSize,
          offset: Math.floor(index / 4) * thumbSize,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        onEndReached={section.hasMore ? (
          section.id === 'sharedCameras' ? loadMoreSharedPhotos : 
          section.id === 'faceMatch' ? loadMoreFaceMatchedPhotos : 
          undefined
        ) : undefined}
        onEndReachedThreshold={0.8}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
        ListFooterComponent={
          // Simple spinner for infinite scroll loading
          (section.id === 'sharedCameras' && (
            (isSelf && selfSharedCameraPhotosQuery.isFetchingNextPage) ||
            (!isSelf && friendSharedCameraPhotosQuery.isFetchingNextPage)
          )) ||
          (section.id === 'faceMatch' && (
            (isSelf && selfFaceMatchedPhotosQuery.isFetchingNextPage) ||
            (!isSelf && friendFaceMatchedPhotosQuery.isFetchingNextPage)
          )) ? (
            <Center py="$4">
              <Spinner size="small" color={isDark ? "$primary400" : "$primary600"} />
            </Center>
          ) : null
        }
        renderItem={({ item, index }) => {
          const columnIndex = index % PHOTOS_PER_ROW;
          return (
            <PhotoItem 
              photo={item}
              thumbSize={thumbSize}
              columnIndex={columnIndex}
              isSelf={isSelf}
              status={status}
              userId={userId || ""}
              router={router}
              isNavigating={isNavigating}
              setIsNavigating={setIsNavigating}
            />
          );
        }}
      />
    );
  }, [
    isDark, 
    handlePhotoListScroll, 
    isScrollEnabled, 
    thumbSize, 
    isSelf, 
    status, 
    userId, 
    router, 
    loadMoreSharedPhotos, 
    loadMoreFaceMatchedPhotos,
    selfSharedCameraPhotosQuery.isFetchingNextPage,
    selfFaceMatchedPhotosQuery.isFetchingNextPage,
    friendSharedCameraPhotosQuery.isFetchingNextPage,
    friendFaceMatchedPhotosQuery.isFetchingNextPage,
    isNavigating,
    setIsNavigating
  ]);

  // Friendship status renderer
  const renderFriendshipStatus = () => {
    if (isSelf) return null;

    return (
      <Box mt="$2" px="$4">
        {status === "NONE" && (
          <Box
            w="100%"
            bg={isDark ? "#007AFF" : "#3b82f6"}
            p="$6"
            borderRadius="$2xl"
            mt="$3"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="$6xl" mb="$3" color="$white">🤝</Text>
            <Text
              fontSize="$2xl"
              fontWeight="$bold"
              color="$white"
              textAlign="center"
              mb="$2"
            >
              Become friends with {profile?.displayName ?? "this user"}
            </Text>
            <Text
              fontSize="$md"
              color="rgba(255,255,255,0.85)"
              textAlign="center"
              mb="$6"
            >
              Send a friend request to unlock shared cameras, face-match photos, 
              and start capturing memories together.
            </Text>
            <Button
              w="100%"
              h={56}
              bg={isDark ? "#2563eb" : "#1d4ed8"}
              borderRadius="$xl"
              onPress={sendRequest}
              disabled={actionLoading}
              $pressed={{ bg: "#1e3a8a" }}
            >
              {actionLoading ? (
                <Spinner size="small" color="white" />
              ) : (
                <HStack alignItems="center" space="sm">
                  <Text fontSize="$xl" color="$white">➕</Text>
                  <ButtonText color="$white" fontWeight="$bold" fontSize="$lg">
                    Add Friend
                  </ButtonText>
                </HStack>
              )}
            </Button>
          </Box>
        )}

        {status === "PENDING_SENT" && (
          <VStack space="md" w="100%">
            <Box
              bg={isDark ? "#222" : "#e9f0ff"}
              borderRadius="$xl"
              p="$3"
              borderWidth="$1"
              borderColor={isDark ? "#444" : "#90a4ff"}
              style={{ elevation: 4 }}
              alignItems="center"
            >
              <Animated.Text
                style={{
                  fontSize: 48,
                  opacity: pulseAnim,
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    },
                  ],
                }}
                accessible={true}
                accessibilityLabel="Pending friend request"
              >
                ⏳
              </Animated.Text>

              <Box mb={10}/>
              
              <Text
                fontSize="$xl"
                fontWeight="$bold"
                color={isDark ? "#fff" : "#1a237e"}
                textAlign="center"
                mb="$2"
              >
                Friend Request Sent
              </Text>

              <Text
                fontSize="$md"
                color={isDark ? "#bbb" : "#3949ab"}
                textAlign="center"
                maxWidth="80%"
                lineHeight={24}
                mb="$4"
              >
                Your friend request is on its way! Waiting for them to accept or decline.
              </Text>

              <HStack space="md">
                <Button
                  variant="outline"
                  borderColor="#ff3b30"
                  borderRadius="$lg"
                  flex={1}
                  h={48}
                  onPress={cancelRequest}
                  disabled={actionLoading}
                  $pressed={{ bg: "#1e3a8a" }}
                >
                  {actionLoading ? (
                    <Spinner size="small" color="#ff3b30" />
                  ) : (
                    <ButtonText color="#ff3b30" fontWeight="$medium" fontSize="$md">
                      Cancel Friend Request
                    </ButtonText>
                  )}
                </Button>
              </HStack>
            </Box>
          </VStack>
        )}

        {status === "PENDING_RECEIVED" && (
          <VStack space="md" w="100%">
            <Box 
              bg={isDark ? "#1a1a1a" : "#f8f9fa"}
              borderRadius="$lg"
              p="$4"
              borderWidth="$1"
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
              <VStack space="sm" alignItems="center">
                <Text fontSize="$xl">📩</Text>
                <Text 
                  fontSize="$md"
                  fontWeight="$medium"
                  color={isDark ? "#fff" : "#000"}
                  textAlign="center"
                >
                  Friend Request Received
                </Text>
                <Text 
                  fontSize="$sm"
                  color={isDark ? "#999" : "#666"}
                  textAlign="center"
                >
                  They want to be your friend
                </Text>
              </VStack>
            </Box>

            <HStack space="md">
              <Button
                variant="outline"
                borderColor="#ff3b30"
                borderRadius="$lg"
                flex={1}
                h={48}
                onPress={declineRequest}
                disabled={actionLoading}
                $pressed={{ bg: isDark ? "#1a0a0a" : "#fff0f0" }}
              >
                {actionLoading ? (
                  <Spinner size="small" color="#ff3b30" />
                ) : (
                  <ButtonText color="#ff3b30" fontWeight="$medium" fontSize="$md">
                    Decline
                  </ButtonText>
                )}
              </Button>
              
              <Button
                bg="#4ade80"
                borderRadius="$lg"
                flex={1}
                h={48}
                onPress={acceptRequest}
                disabled={actionLoading}
                $pressed={{ bg: "#22c55e" }}
              >
                {actionLoading ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <ButtonText color="$white" fontWeight="$medium" fontSize="$md">
                    Accept
                  </ButtonText>
                )}
              </Button>
            </HStack>
          </VStack>
        )}
      </Box>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING & ERROR STATES
  // ═══════════════════════════════════════════════════════════════════════════

  if (profileError && !profileLoading) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack space="lg" alignItems="center" px="$8">
          <Text fontSize="$4xl">⚠️</Text>
          <Text 
            fontSize="$lg"
            color={isDark ? "#fff" : "#000"}
            fontWeight="$medium"
            textAlign="center"
          >
            Failed to load profile
          </Text>
          <Text 
            fontSize="$sm"
            color={isDark ? "#999" : "#666"}
            textAlign="center"
          >
            {profileError?.message || "Something went wrong"}
          </Text>
          <Button
            bg="#007AFF"
            borderRadius="$lg"
            px="$6"
            h={48}
            onPress={onRefresh}
            $pressed={{ bg: "#0056CC" }}
          >
            <ButtonText color="$white" fontWeight="$semibold">
              Try Again
            </ButtonText>
          </Button>
        </VStack>
      </Center>
    );
  }

  if (loading) {
    return <UserProfileSkeleton />;
  }

  if (!profile) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack space="lg" alignItems="center" px="$8">
          <Text fontSize="$4xl">👤</Text>
          <Text 
            fontSize="$lg"
            color={isDark ? "#fff" : "#000"}
            fontWeight="$medium"
            textAlign="center"
          >
            User not found
          </Text>
          <Text 
            fontSize="$sm"
            color={isDark ? "#999" : "#666"}
            textAlign="center"
          >
            This user may have deleted their account or doesn't exist.
          </Text>
        </VStack>
      </Center>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Box flex={1} bg={isDark ? "#000" : "#fff"}>
      {/* Top Right Action Menu - Only show for non-self users */}
      {!isSelf && (
        <Box position="absolute" top="$6" right="$1" zIndex={10}>
          <TouchableOpacity
            onPress={handleUserMenuPress}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              justifyContent: "center",
              alignItems: "center",
            }}
            activeOpacity={0.7}
          >
            <MoreVertical size={20} color={isDark ? "#fff" : "#000"} />
          </TouchableOpacity>

          {/* Dropdown Menu */}
          {showUserActionMenu && (
            <RNAnimated.View
              style={{
                position: "absolute",
                top: 50,
                right: 0,
                backgroundColor: isDark ? "rgba(40, 40, 40, 0.95)" : "rgba(255, 255, 255, 0.95)",
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                flexDirection: "column",
                gap: 4,
                opacity: userActionMenuAnim,
                transform: [
                  {
                    scale: userActionMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                  {
                    translateY: userActionMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              }}
            >
              {/* Invite to Event - Only show if there are cameras available */}
              {status === "ACCEPTED" && camerasWithStatus.length > 0 && (
                <TouchableOpacity
                  onPress={handleMenuCameraInvite}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "transparent",
                  }}
                  activeOpacity={0.7}
                >
                  <Camera size={20} color="#007AFF" />
                </TouchableOpacity>
              )}

              {/* Report User */}
              <TouchableOpacity
                onPress={handleReportUser}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "transparent",
                }}
                activeOpacity={0.7}
              >
                <Flag size={20} color="#ff6b35" />
              </TouchableOpacity>
            </RNAnimated.View>
          )}
        </Box>
      )}

      {!isSelf && (status === "NONE" || status === "PENDING_SENT" || status === "PENDING_RECEIVED") ? (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Profile Header */}
          <Animated.View style={{ opacity: profileHeaderOpacity }}>
            <Box p="$4" pb="$2">
              {/* Profile Photo */}
              <Center>
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
                    <ExpoImage
                      source={{ uri: profile.profilePhotoUrl }}
                      style={{ width: "100%", height: "100%", borderRadius: 58 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Box
                      width="100%"
                      height="100%"
                      bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text color={isDark ? "#999" : "#666"} fontSize="$6xl">👤</Text>
                    </Box>
                  )}
                </Box>
              </Center>

              {/* Username */}
              <Text
                fontSize="$2xl"
                fontWeight="$semibold"
                textAlign="center"
                mt="$2"
                color={isDark ? "#fff" : "#000"}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {profile.displayName ?? "Unnamed"}
              </Text>

              {/* Friendship Status */}
              {renderFriendshipStatus()}
            </Box>
          </Animated.View>

          {/* Add minimum height to enable pull-to-refresh */}
          <Box minHeight={300} />
        </ScrollView>
      ) : (
        <>
          {/* Profile Header */}
          <Animated.View style={{ opacity: profileHeaderOpacity }}>
            <Box p="$4" pb="$2">
              {/* Profile Photo */}
              <Center>
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
                    <ExpoImage
                      source={{ uri: profile.profilePhotoUrl }}
                      style={{ width: "100%", height: "100%", borderRadius: 58 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Box
                      width="100%"
                      height="100%"
                      bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text color={isDark ? "#999" : "#666"} fontSize="$6xl">👤</Text>
                    </Box>
                  )}
                </Box>
              </Center>

              {/* Username with Friends Icon */}
              <Box alignItems="center">
                <HStack alignItems="center" justifyContent="center" space="sm">
                  <Text
                    fontSize="$2xl"
                    fontWeight="$semibold"
                    textAlign="center"
                    mt="$2"
                    color={isDark ? "#fff" : "#000"}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {profile.displayName ?? "Unnamed"}
                  </Text>
                  
                  {/* Friends Icon - Next to username */}
                  {!isSelf && status === "ACCEPTED" && (
                    <Box mt="$2">
                      <UserCheck size={19} color="#10b981" />
                    </Box>
                  )}
                </HStack>
              </Box>
              
              {/* Friends Divider - Only show for friends */}
              {!isSelf && status === "ACCEPTED" && (
                <>
                  {/* Spacer to push divider down */}
                  <Box height={16} />
                  
                  <Divider mb="$2" bg={isDark ? "#333" : "#e0e0e0"} />
                </>
              )}
              
              {/* Stats */}
              {(isSelf || (!isSelf && status === "ACCEPTED")) && (
                <>
                  <HStack
                    justifyContent="space-around"
                    alignItems="center"
                    mt={isSelf ? "$3" : -5}
                    ml="$3"
                    px="$1"
                  >
                    <VStack alignItems="center" minWidth={45}>
                      <Text
                        fontSize="$xl"
                        fontWeight="$bold"
                        color={isDark ? "#fff" : "#000"}
                      >
                        {photoStats.total}{(photoStats.faceMatchHasMore || photoStats.sharedHasMore) ? "+" : ""}
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
                        {photoStats.faceMatch}{photoStats.faceMatchHasMore ? "+" : ""}
                      </Text>
                      <Text
                        fontSize="$2xs"
                        color={isDark ? "#999" : "#666"}
                        fontWeight="$medium"
                        textAlign="center"
                        numberOfLines={1}
                      >
                        🎯 Face-match
                      </Text>
                    </VStack>
                    <VStack alignItems="center" minWidth={40}>
                      <Text fontSize="$sm" fontWeight="$semibold" color="#34C759">
                        {photoStats.shared}{photoStats.sharedHasMore ? "+" : ""}
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
                  
                  <Divider mt={isSelf ? "$4" : "$1"} mb="$3" bg={isDark ? "#333" : "#e0e0e0"} />
                </>
              )}

              {/* Self Profile Actions */}
              {isSelf && (
                <Box mt="$1">
                  {/* Quick Stats Card */}
                  <Box 
                    bg={isDark ? "#1a1a1a" : "#f8f9fa"}
                    borderRadius="$xl"
                    p="$4"
                    borderWidth="$1"
                    borderColor={isDark ? "#333" : "#e5e5e5"}
                    shadowColor="$shadowColor"
                    shadowOffset={{ width: 0, height: 2 }}
                    shadowOpacity={0.1}
                    shadowRadius={8}
                    mx="$1" // Added horizontal margin for proper spacing
                  >
                    <VStack space="sm">
                      <HStack alignItems="center" justifyContent="center" space="sm">
                        <Text fontSize="$lg">📊</Text>
                        <Text 
                          fontSize="$md"
                          fontWeight="$bold"
                          color={isDark ? "#fff" : "#000"}
                        >
                          Your Photo Activity
                        </Text>
                      </HStack>
                      
                      <Text 
                        fontSize="$sm"
                        color={isDark ? "#999" : "#666"}
                        textAlign="center"
                        lineHeight={20}
                      >
                        You have {photoStats.total} photos across {photoStats.faceMatch} face-matched 
                        and {photoStats.shared} shared event photos
                        {sharedCameraNames.length > 0 && 
                          ` in events: ${sharedCameraNames.slice(0, 3).join(", ")}${sharedCameraNames.length > 3 ? ` and ${sharedCameraNames.length - 3} more` : ""}`
                        }.
                        {photoStats.total === 0
                          ? " Start taking photos to build your collection!"
                          : " Keep capturing memories!"
                        }
                      </Text>
                    </VStack>
                  </Box>
                </Box>
              )}

              {/* Friendship Status */}
              {renderFriendshipStatus()}
            </Box>
          </Animated.View>

          <Box flex={1} />
        </>
      )}

      {/* Camera Roll Section - Only for friends */}
      {!isSelf && status === "ACCEPTED" && (
        <>
          {photoStats.total === 0 ? (
            <ScrollView
              style={{ flex: 1, marginTop: -265 }}
              contentContainerStyle={{ 
                flexGrow: 1,
                justifyContent: 'flex-start',
                alignItems: 'center',
                paddingTop: 20,
                paddingBottom: 100,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
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
                      <Text fontSize="$3xl">📷</Text>
                    </Box>
                    <VStack space="sm" alignItems="center">
                      <Heading
                        size="lg"
                        color={isDark ? "$textDark100" : "$textLight900"}
                        textAlign="center"
                        fontWeight="$semibold"
                      >
                        No Shared Photos Yet
                      </Heading>
                      <Text
                        fontSize="$md"
                        color={isDark ? "$textDark300" : "$textLight600"}
                        textAlign="center"
                        lineHeight={22}
                      >
                        No shared memories found with this friend
                      </Text>
                    </VStack>
                  </VStack>
                </Center>
            </ScrollView>
          ) : (
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
                  <HStack alignItems="center" justifyContent="center" w="100%" px="$4" position="relative">
                    <Heading
                      size="lg"
                      textAlign="center"
                      color={isDark ? "$textDark100" : "$textLight900"}
                      fontWeight="$bold"
                    >
                      Shared Photos
                    </Heading>
                  </HStack>
                </Box>
              </Box>

              <Box mb={-15}/>

              {/* First Divider */}
              <Box
                height={0.5}
                mx="$5"
                bg={isDark ? "$borderDark600" : "$borderLight300"}
              />

              {/* Section Header */}
              <Box
                bg={isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.95)"}
                py="$3"
              >
                <HStack 
                  alignItems="center" 
                  justifyContent="space-between" 
                  w="100%"
                  px="$5"
                >
                  <HStack alignItems="center" space="xs">
                    <Text fontSize="$lg" fontWeight="$bold" color={isDark ? "#fff" : "#000"}>
                      {selectedSection.emoji} {selectedSection.name}
                    </Text>
                    <Text fontSize="$sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      ({selectedSection.photos.length}{selectedSection.hasMore ? "+" : ""})
                    </Text>
                  </HStack>

                  <HStack alignItems="center" space="xs">
                    {photoCarouselSections.map((_, index) => renderDot(index))}
                  </HStack>
                </HStack>
              </Box>

              {/* Second Divider */}
              <Box
                height={0.5}
                mx="$5"
                bg={isDark ? "$borderDark600" : "$borderLight300"}
              />

              {/* Photos Content */}
              <Box flex={1}>
                {/* Photos are already loaded when we get here since photosLoading is part of main loading check */}
                <FlatList
                    ref={carouselRef}
                    data={photoCarouselSections}
                    keyExtractor={(item) => item.id}
                    horizontal
                    pagingEnabled
                    onScroll={handleScroll}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    scrollEventThrottle={16}
                    showsHorizontalScrollIndicator={false}
                    removeClippedSubviews={false}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    initialNumToRender={2}
                    decelerationRate="fast"
                    snapToInterval={width}
                    snapToAlignment="start"
                    getItemLayout={(_, index) => ({
                      length: width,
                      offset: width * index,
                      index,
                    })}
                    style={{ flex: 1 }}
                    renderItem={({ item }) => (
                      <Box width={width} flex={1}>
                        {renderSectionContent(item)}
                      </Box>
                    )}
                  />
              </Box>
            </Animated.View>
          )}
        </>
      )}

      {/* Camera Picker Modal */}
      <Modal isOpen={showCameraPicker} onClose={() => setShowCameraPicker(false)}>
        <ModalBackdrop bg="rgba(0,0,0,0.6)" />
        <ModalContent
          bg={isDark ? "#000" : "#fff"}
          borderRadius="$lg"
          minWidth={280}
          maxHeight={400}
        >
          <ModalBody p="$0">
            <VStack>
              {/* Header with Cancel button on the right */}
              <HStack
                p="$4"
                borderBottomWidth="$1"
                borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
                alignItems="center"
                justifyContent="space-between"
              >
                <VStack flex={1} alignItems="center">
                  <Text
                    fontSize="$lg"
                    fontWeight="$bold"
                    color={isDark ? "$textDark50" : "$textLight900"}
                  >
                    Choose Event
                  </Text>
                  <Text
                    fontSize="$sm"
                    color={isDark ? "$textDark300" : "$textLight600"}
                    textAlign="center"
                    mt="$1"
                  >
                    Invite {profile?.displayName ?? "this user"} to join
                  </Text>
                </VStack>
                <Pressable
                  onPress={() => setShowCameraPicker(false)}
                  p="$2"
                  borderRadius="$full"
                  bg={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}
                  $pressed={{
                    bg: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
                  }}
                >
                  <Box
                    width={24}
                    height={24}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text 
                      fontSize="$lg" 
                      color={isDark ? "#fff" : "#000"}
                      fontWeight="$bold"
                    >
                      ✕
                    </Text>
                  </Box>
                </Pressable>
              </HStack>
              
              {camerasWithStatus.map((camera, index) => {
                const isInvited = camera.friendStatus === 'INVITED';
                const isDisabled = isInvited || sendCameraInvitesMutation.isPending;
                
                return (
                  <Box key={camera.cameraId}>
                    <Pressable
                      p="$4"
                      onPress={() => !isDisabled && handleCameraInvite(camera.cameraId)}
                      disabled={isDisabled}
                      opacity={isInvited ? 0.6 : 1}
                      $pressed={{
                        bg: !isDisabled ? (isDark ? "$backgroundDark800" : "$backgroundLight100") : "transparent",
                      }}
                    >
                      <HStack alignItems="center" space="md">
                        <Text fontSize="$2xl">📷</Text>
                        <VStack flex={1}>
                          <Text
                            fontSize="$md"
                            fontWeight="$medium"
                            color={isInvited 
                              ? (isDark ? "$textDark400" : "$textLight500")
                              : (isDark ? "$textDark50" : "$textLight900")
                            }
                            numberOfLines={1}
                          >
                            {camera.name}
                          </Text>
                          {isInvited && (
                            <Text
                              fontSize="$sm"
                              color={isDark ? "$textDark400" : "$textLight500"}
                              mt="$1"
                            >
                              Already invited to this event
                            </Text>
                          )}
                        </VStack>
                        {sendCameraInvitesMutation.isPending && (
                          <Spinner size="small" color={isDark ? "$primary400" : "$primary600"} />
                        )}
                      </HStack>
                    </Pressable>
                    {/* Divider after each camera except the last one */}
                    {index < camerasWithStatus.length - 1 && (
                      <Divider bg={isDark ? "$borderDark700" : "$borderLight200"} />
                    )}
                  </Box>
                );
              })}
              
              {camerasWithStatus.length === 0 && (
                <Center py="$8">
                  <VStack space="md" alignItems="center">
                    <Text fontSize="$3xl">📷</Text>
                    <Text
                      fontSize="$md"
                      color={isDark ? "$textDark300" : "$textLight600"}
                      textAlign="center"
                    >
                      No events available
                    </Text>
                  </VStack>
                </Center>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}