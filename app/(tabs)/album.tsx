/* app/(tabs)/album.tsx */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  FlatList,
  View,
  useWindowDimensions,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  PanResponder,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ScrollView,
  Keyboard
} from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  InputField,
  Center,
  Pressable,
  Heading,
  Spinner,
  Modal,
  ModalBackdrop,
  ModalContent,
  CloseIcon,
  Icon
} from '@gluestack-ui/themed';
import { router, useLocalSearchParams } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { OptimizedPhotoItem } from "../../components/OptimizedPhotoItem";
import { getSinglePhotoNavigation } from '@/src/hooks/useNotificationHandler';
import { preloadImages } from "@/src/utils/services/imageCacheConfig";
import { 
  PhotoGridSkeleton, 
  FriendsListSkeleton, 
  FriendSearchSkeleton,
  AlbumMainSkeleton 
} from "@/components/SkeletonLoaders";
import {
  useUserCameras,
  useUserFriends,
  useSearchUsers,
  useInfiniteSingleSharedCameraPhotos,
  useInfiniteFaceMatchedPhotos,
  useInfiniteMultiSharedCameraPhotos,
  useInfiniteFaceMatchedPhotosAll,
} from "@/src/hooks/usePhotoQueries";
import { useUserCameraMemberships } from "@/src/hooks/useCameraQueries";
import { useAllFriendshipsWithProfiles } from "@/src/hooks/useUserQueries";
import { useAuth } from "@/context/AuthContext";
import { useWalkthroughElement } from "@/src/context/WalkthroughContext";
import { usePreferencesStore } from "@/src/stores/preferencesStore";

// Square touching photos with no padding
const screenWidth = Dimensions.get("window").width;
const PHOTOS_PER_ROW = 4;
const thumbSize = screenWidth / PHOTOS_PER_ROW;

const screenHeight = Dimensions.get("window").height;
const COLLAPSED_HEIGHT = screenHeight * 0.48;
const EXPANDED_HEIGHT = screenHeight * 0.786;
const FRIENDS_CAROUSEL_HEIGHT = Math.min(
  Math.max(200, screenHeight * 0.2),
  220
);

const DRAG_HANDLE_HEIGHT = Math.min(
  Math.max(38, screenHeight * 0.04),
  50
);

type Friend = {
  id: string;
  displayName: string;
  profilePhotoUrl: string | null;
};

interface UserItem {
  id: string;
  displayName?: string | null;
  profilePhotoKey?: string | null;
  profilePhotoUrl?: string | null;
}

// Extended block type to include special sections
type ExtendedBlock = {
  cameraId: string;
  name: string;
  photos?: any[];
  isSpecialSection?: boolean;
  sectionType?: 'faceMatch' | 'sharedCameras';
};

export default function AlbumScreen() {
  const windowDimensions = useWindowDimensions();
  const { width } = windowDimensions || Dimensions.get('window');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { user } = useAuth();
  const userId = user?.username;
  const { autoSyncToDevice } = usePreferencesStore();
  
  // Walkthrough element refs
  const photoGridRef = useWalkthroughElement('photo-grid');
  
  // Get cameraId and friendId from URL parameters (for deep linking from notifications)
  const params = useLocalSearchParams<{ cameraId?: string; friendId?: string }>();
  const urlCameraId = params.cameraId;
  const urlFriendId = params.friendId;
  
  const { data: blocks = [], isLoading: camerasLoading, refetch: refetchCameras } = useUserCameras(userId);
  const { data: friends = [], isLoading: friendsLoading, refetch: refetchFriends } = useUserFriends(userId);

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  
  const infiniteFaceMatchedPhotosQuery = useInfiniteFaceMatchedPhotosAll(userId);
  
  const infiniteSharedPhotosQuery = useInfiniteMultiSharedCameraPhotos(
    isInitialLoadComplete ? userId : null
  );

  const { data: allFriendshipsWithProfiles = [], isLoading: friendsForSearchLoading } = useAllFriendshipsWithProfiles(userId);
  const { data: userCamerasForSearch = [], isLoading: camerasForSearchLoading } = useUserCameraMemberships(userId);

  // Initialize staggered loading
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setIsInitialLoadComplete(true);
    });
  }, []);

  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  
  // Infinite query for selected camera's photos (only when we have a valid camera selected)
  const { 
    data: infinitePhotoData, 
    fetchNextPage: fetchMorePhotos,
    hasNextPage: hasMorePhotos,
    isFetchingNextPage: isFetchingMorePhotos,
    isLoading: infinitePhotosLoading,
    refetch: refetchPhotos
  } = useInfiniteSingleSharedCameraPhotos(selectedCameraId);

  // Flatten infinite query pages into single photos array
  const infinitePhotos = useMemo(() => {
    if (!infinitePhotoData?.pages) {
      return [];
    }
    
    const totalPhotos = infinitePhotoData.pages.flatMap(page => page.photos);
    console.log(`📱 [ALBUM_INFINITE] Photos for camera ${selectedCameraId}:`, totalPhotos.length);
    
    return totalPhotos;
  }, [infinitePhotoData]);

  // Separate effect for image preloading with cleanup
  useEffect(() => {
    if (infinitePhotos.length > 0 && selectedCameraId) {
      // More aggressive debounce to avoid orphaned tasks during rapid switching
      const timeoutId = setTimeout(() => {
        const urlsToPreload = infinitePhotos.slice(0, 20).map(p => p.url);
        preloadImages(urlsToPreload, 'high').catch(error => {
          // Suppress warnings for cancelled preload operations
          if (error && error.message && !error.message.includes('cancelled')) {
            console.warn('Failed to preload images:', error);
          }
        });
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [infinitePhotos, selectedCameraId]);

  const [refreshingFriends, setRefreshingFriends] = useState(false);
  const friendsCarouselPushDownValue = useRef(new Animated.Value(0)).current;
  const photosCarouselPushDownValue = useRef(new Animated.Value(0)).current;
  const friendsListRef = useRef<FlatList>(null);

  // Track cameras that have completed initial load (including empty ones)
  const [loadedCameras, setLoadedCameras] = useState<Set<string>>(new Set());

  // Handle carousel return animation when refreshing completes
  useEffect(() => {
    if (!refreshingFriends) {
      // Only animate back if carousels are not already at 0 to prevent jitter
      setTimeout(() => {
        Animated.spring(friendsCarouselPushDownValue, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
        
        Animated.spring(photosCarouselPushDownValue, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
      }, 100); // Small delay to avoid conflict with scroll handler
    }
  }, [refreshingFriends]);

  // Mark camera as loaded when query completes (whether it has photos or not)
  useEffect(() => {
    if (selectedCameraId && !infinitePhotosLoading) {
      setLoadedCameras(prev => new Set([...prev, selectedCameraId]));
    }
  }, [selectedCameraId, infinitePhotosLoading]);

  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  const [faceMatchSearch, setFaceMatchSearch] = useState('');
  const [sharedCameraSearch, setSharedCameraSearch] = useState('');
  const [isFaceMatchSearchActive, setIsFaceMatchSearchActive] = useState(false);
  const [isSharedCameraSearchActive, setIsSharedCameraSearchActive] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<'faceMatch' | 'sharedCameras' | string>('faceMatch');
  const [selectedFriends, setSelectedFriends] = useState<{id: string, name: string, photoUrl?: string}[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<{id: string, name: string} | null>(null);
  
  const faceMatchSearchRef = useRef<any>(null);
  const sharedCameraSearchRef = useRef<any>(null);
  
  // Flatten infinite query results for shared cameras with preloading
  const infiniteSharedPhotos = useMemo(() => {
    const photos = infiniteSharedPhotosQuery.data?.pages?.flatMap(page => page.photos) || [];
    
    // Preload first batch of shared camera images for better performance
    if (photos.length > 0) {
      const urlsToPreload = photos.slice(0, 20).map(p => p.url);
      preloadImages(urlsToPreload, 'high').catch(error => {
        console.warn('Failed to preload shared camera images:', error);
      });
    }
    
    return photos;
  }, [infiniteSharedPhotosQuery.data]);

  // Filter friends locally based on search query (from me.tsx)
  const friendSearchResults = useMemo(() => {
    if (!isFaceMatchSearchActive || !faceMatchSearch) return [];
    
    // Only show accepted friends (status === 'ACCEPTED')
    const acceptedFriends = allFriendshipsWithProfiles.filter(item => 
      item.friendship.status === 'ACCEPTED'
    );
    
    // Filter by search query
    return acceptedFriends
      .filter(item => 
        item.friendProfile.displayName?.toLowerCase().includes(faceMatchSearch.toLowerCase())
      )
      .map(item => ({
        id: item.friendProfile.id,
        displayName: item.friendProfile.displayName,
        profilePhotoUrl: item.friendProfile.photoUrl
      }));
  }, [allFriendshipsWithProfiles, isFaceMatchSearchActive, faceMatchSearch]);

  // Filter cameras based on search 
  const filteredCameras = useMemo(() => {
    if (!sharedCameraSearch) return [];
    return userCamerasForSearch.filter(cam => 
      cam.name?.toLowerCase().includes(sharedCameraSearch.toLowerCase())
    ).map(cam => ({ cameraId: cam.cameraId, name: cam.name }));
  }, [userCamerasForSearch, sharedCameraSearch]);

  // Filter photos based on search criteria 
  const filteredFaceMatchPhotos = useMemo(() => {
    if (selectedFriends.length === 0) {
      return infiniteFaceMatchedPhotosQuery.deduplicatedPhotos;
    }
    
    // Filter photos where YOU and ALL selected friends appear together
    const filtered = infiniteFaceMatchedPhotosQuery.deduplicatedPhotos.filter(photo => {
      const photoFriendIds = photo.friendGroupKey?.split(',') || [];
      const allFriendsInPhoto = selectedFriends.every(friend => photoFriendIds.includes(friend.id));
      return allFriendsInPhoto;
    });
    
    return filtered;
  }, [infiniteFaceMatchedPhotosQuery.deduplicatedPhotos, selectedFriends, userId]);

  const filteredSharedCameraPhotos = useMemo(() => {
    if (!selectedCamera) {
      return infiniteSharedPhotos;
    }
    
    // Filter photos from selected camera only
    return infiniteSharedPhotos.filter(photo => photo.cameraId === selectedCamera.id);
  }, [infiniteSharedPhotos, selectedCamera]);

  // Infinite query for face-matched photos with selected friend
  const faceMatchedQuery = useInfiniteFaceMatchedPhotos(userId, selectedFriend?.id || null);

  // Extract photos from all pages
  const faceMatchedPhotos = useMemo(() => {
    return faceMatchedQuery.data?.pages.flatMap(page => page.photos) || [];
  }, [faceMatchedQuery.data]);

  // Use the photos directly from the hook (renamed for consistency with existing code)
  const sharedPhotos = faceMatchedPhotos;
  const sharedPhotosLoading = faceMatchedQuery.isLoading;
  const hasMoreFaceMatchedPhotos = faceMatchedQuery.hasNextPage;
  const isFetchingMoreFaceMatchedPhotos = faceMatchedQuery.isFetchingNextPage;
  const refetchFaceMatchedPhotos = faceMatchedQuery.refetch;
  const fetchMoreFaceMatchedPhotos = faceMatchedQuery.fetchNextPage;

  const [showModal, setShowModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults = [], isLoading: searchLoading } = useSearchUsers(searchQuery);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isCarouselExpanded, setIsCarouselExpanded] = useState(false);
  const [pendingModalRestore, setPendingModalRestore] = useState<string | null>(null);
  
  // Convert isScrollEnabled from ref to state for reactive updates
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  
  const carouselRef = useRef<FlatList>(null);
  const animatedTranslateY = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const [isDraggingDots, setIsDraggingDots] = useState(false);
  const dotsContainerRef = useRef<View>(null);
  const [dotsWidth, setDotsWidth] = useState(0);
  const [dotsX, setDotsX] = useState(0);
  const dragStartX = useRef(0);
  const dragStartScrollX = useRef(0);
  const [visibleDotRange, setVisibleDotRange] = useState({ start: 0, end: 5 });
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalRefreshing, setIsModalRefreshing] = useState(false);
  const [isCarouselAnimating, setIsCarouselAnimating] = useState(false);
  const isSettingFromUrl = useRef(false);
  const hasNavigatedAway = useRef(false);
  const MAX_VISIBLE_DOTS = 3;
  
  // Create extended blocks array with new sections first
  const allBlocks: ExtendedBlock[] = useMemo(() => [
    {
      cameraId: 'face-match-section',
      name: 'Face-matched',
      isSpecialSection: true,
      sectionType: 'faceMatch' as const,
      photos: filteredFaceMatchPhotos
    },
    {
      cameraId: 'shared-cameras-section', 
      name: 'Shared Events',
      isSpecialSection: true,
      sectionType: 'sharedCameras' as const,
      photos: filteredSharedCameraPhotos
    },
    ...blocks.map(block => ({ ...block, isSpecialSection: false })) // existing shared cameras
  ], [filteredFaceMatchPhotos, filteredSharedCameraPhotos, blocks]);

  const blocksRef = useRef(allBlocks);
  const isDragReleasePending = useRef(false);
  
  // Update blocksRef when allBlocks change
  useEffect(() => {
    blocksRef.current = allBlocks;
  }, [allBlocks]);

  // Initialize loaded cameras with any that already have photos from static data
  useEffect(() => {
    const camerasWithPhotos = allBlocks.filter(block => block.photos && block.photos.length > 0).map(block => block.cameraId);
    if (camerasWithPhotos.length > 0) {
      setLoadedCameras(prev => {
        // Only update if there are new cameras to add
        const newCameras = camerasWithPhotos.filter(id => !prev.has(id));
        if (newCameras.length > 0) {
          return new Set([...prev, ...newCameras]);
        }
        return prev; // Return same reference if no changes
      });
    }
  }, [allBlocks]);

  // Show main skeleton if still loading core data or if we don't have a selected camera yet
  const loading = camerasLoading || friendsLoading || (allBlocks.length > 2 && !selectedCameraId); // +2 for special sections

  useEffect(() => {
    if (allBlocks.length > 0 && !selectedCameraId && !urlCameraId) {
      // Set to first section (face-match) by default
      const initialCameraId = allBlocks[0].cameraId;
      console.log(`📱 [ALBUM_INIT] Setting initial camera to first: ${initialCameraId}`);
      
      setSelectedCameraId(initialCameraId);
      setSelectedSectionId('faceMatch'); // Set section ID for first section
      currentCameraIdRef.current = initialCameraId;
      
      // Scroll to the first section position
      scrollX.setValue(0);
      carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [allBlocks, selectedCameraId, urlCameraId, width]);

  // Handle URL parameter changes (both open and killed state) - now with +2 offset for new sections
  useEffect(() => {
    if (urlCameraId && allBlocks.length > 0 && !camerasLoading && !friendsLoading) {
      const targetBlock = allBlocks.find(block => block.cameraId === urlCameraId);
      if (targetBlock && selectedCameraId !== urlCameraId) {
        const scrollToIndex = allBlocks.findIndex(block => block.cameraId === urlCameraId);
        const isFromKilledState = !selectedCameraId;
        console.log(`📱 [ALBUM_URL] Setting camera from URL: ${urlCameraId} (index: ${scrollToIndex}), killed state: ${isFromKilledState}`);
        
        // Set flag to prevent scroll handler interference
        isSettingFromUrl.current = true;
        
        // Use ref to prevent scroll handler interference during programmatic scrolling
        currentCameraIdRef.current = urlCameraId;
        setSelectedCameraId(urlCameraId);
        
        // Update section ID based on target block
        if (targetBlock.isSpecialSection) {
          setSelectedSectionId(targetBlock.sectionType!);
        } else {
          setSelectedSectionId(urlCameraId); // Use camera ID for regular cameras
        }
        
        // Scroll to the appropriate camera position
        const scrollOffset = scrollToIndex * width;
        console.log(`📱 [ALBUM_URL_DEBUG] Attempting scroll - scrollToIndex: ${scrollToIndex}, width: ${width}, scrollOffset: ${scrollOffset}`);
        console.log(`📱 [ALBUM_URL_DEBUG] Current scrollX value: ${(scrollX as any)._value}, isFromKilledState: ${isFromKilledState}`);
        
        scrollX.setValue(scrollOffset);
        carouselRef.current?.scrollToOffset({ 
          offset: scrollOffset, 
          animated: false
        });

        // For open state, use the global flag to detect single photo navigation
        if (!isFromKilledState) {
          setTimeout(() => {
            console.log(`📱 [ALBUM_OPEN_STATE] Checking if should clear URL parameter`);
            
            const isSinglePhoto = getSinglePhotoNavigation();
            console.log(`📱 [ALBUM_OPEN_STATE] Single photo navigation flag:`, isSinglePhoto);
            
            if (!isSinglePhoto) {
              console.log(`📱 [ALBUM_OPEN_STATE] Clearing URL parameter for batch notification`);
              router.replace('/(tabs)/album');
            }
            
            isSettingFromUrl.current = false;
          }, 300);
        }
        
      } else if (!targetBlock && !selectedCameraId) {
        // URL camera doesn't exist, fallback to first section
        console.log(`📱 [ALBUM_URL] URL camera ${urlCameraId} not found, falling back to first section`);
        const initialCameraId = allBlocks[0].cameraId;
        currentCameraIdRef.current = initialCameraId;
        setSelectedCameraId(initialCameraId);
        setSelectedSectionId('faceMatch');
        scrollX.setValue(0);
        carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
        
        // Clear URL parameter immediately on fallback
        router.replace('/(tabs)/album');
      }
    }
  }, [urlCameraId, allBlocks, selectedCameraId, camerasLoading, friendsLoading, width]);

  useEffect(() => {
    if (urlCameraId && selectedCameraId === urlCameraId && !infinitePhotosLoading && infinitePhotos.length >= 0) {
      console.log(`📱 [ALBUM_PHOTOS_LOADED] Photos loaded for ${urlCameraId}, performing final scroll`);
      
      // Now that photos are loaded, ensure the FlatList is properly scrolled
      const targetIndex = allBlocks.findIndex(block => block.cameraId === urlCameraId);
      if (targetIndex >= 0) {
        const finalScrollOffset = targetIndex * width;
        console.log(`📱 [ALBUM_PHOTOS_LOADED] Final scroll attempt - targetIndex: ${targetIndex}, finalScrollOffset: ${finalScrollOffset}`);
        
        carouselRef.current?.scrollToOffset({ 
          offset: finalScrollOffset, 
          animated: false
        });
        
        // Update scrollX to match
        scrollX.setValue(finalScrollOffset);
      }

      setTimeout(() => {
        isSettingFromUrl.current = false;
      }, 300);
    }
  }, [urlCameraId, selectedCameraId, infinitePhotosLoading, infinitePhotos.length, allBlocks, width]);

  // Handle friendId URL parameter for face match notifications
  useEffect(() => {
    if (urlFriendId && allBlocks.length > 0 && !camerasLoading && !friendsLoading && friends.length > 0) {
      console.log(`📱 [ALBUM_FRIEND_URL] Handling friendId from URL: ${urlFriendId}`);
      
      // Find the friend in the friends list
      const targetFriend = friends.find(friend => friend.id === urlFriendId || friend.displayName === urlFriendId);
      
      if (targetFriend) {
        console.log(`📱 [ALBUM_FRIEND_URL] Found friend: ${targetFriend.displayName}, scrolling to face match section`);
        
        // Set to face match section (index 0)
        const faceMatchSection = allBlocks[0];
        if (faceMatchSection && faceMatchSection.cameraId === 'face-match-section') {
          setSelectedCameraId(faceMatchSection.cameraId);
          setSelectedSectionId('faceMatch');
          setSelectedFriend(targetFriend);
          currentCameraIdRef.current = faceMatchSection.cameraId;
          
          // Scroll to face match section
          scrollX.setValue(0);
          carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
          
          console.log(`📱 [ALBUM_FRIEND_URL] Set camera to face match section and selected friend: ${targetFriend.displayName}`);
        }
      } else {
        console.log(`📱 [ALBUM_FRIEND_URL] Friend ${urlFriendId} not found in friends list`);
      }
    }
  }, [urlFriendId, allBlocks, camerasLoading, friendsLoading, friends, width]);
  
  // Optimized refs for better scroll handling
  const photosListRefs = useRef<{ [key: string]: FlatList | null }>({});
  const scrollOffset = useRef(0);
  const gestureStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const isDragging = useRef(false);

  // Create animated opacity values for smooth transitions during drag
  const searchBarOpacity = useMemo(() => 
    animatedTranslateY.interpolate({
      inputRange: [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), -100, 0],
      outputRange: [0, 0.7, 1],
      extrapolate: 'clamp',
    }), [animatedTranslateY]
  );

  const friendsCarouselOpacity = useMemo(() => 
    animatedTranslateY.interpolate({
      inputRange: [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), -150, 0],
      outputRange: [0, 0.5, 1],
      extrapolate: 'clamp',
    }), [animatedTranslateY]
  );

  const searchResultsOpacity = useMemo(() => 
    animatedTranslateY.interpolate({
      inputRange: [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), -80, 0],
      outputRange: [0, 0.8, 1],
      extrapolate: 'clamp',
    }), [animatedTranslateY]
  );

  // 🔧 FIX: Use refs to prevent re-renders during scroll
  const currentCameraIdRef = useRef<string | null>(null);
  const isScrollingRef = useRef(false);

  // Update ref when selectedCameraId changes (only after momentum ends)
  useEffect(() => {
    if (!isScrollingRef.current) {
      currentCameraIdRef.current = selectedCameraId;
    }
  }, [selectedCameraId]);

  // 🔧 FIX: Track scroll state to prevent updates during scroll
  const handleScrollBegin = useCallback(() => {
    isScrollingRef.current = true;
  }, []);

  const handleScrollEnd = useCallback(() => {
    isScrollingRef.current = false;
    currentCameraIdRef.current = selectedCameraId;
  }, [selectedCameraId]);

  // Individual friend press animations - one per friend
  const friendPressAnimations = useRef<{ [key: string]: Animated.Value }>({});
  const getFriendPressAnimation = useCallback((friendId: string) => {
    if (!friendPressAnimations.current[friendId]) {
      friendPressAnimations.current[friendId] = new Animated.Value(1);
    }
    return friendPressAnimations.current[friendId];
  }, []);

  const gestureReady = useRef(false);

  // Update panResponder to use only translateY for smooth performance
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) => {
        // Only block carousel gestures when dragging dots, allow collapse during refresh
        if (isDraggingDots) return false;
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only block carousel gestures when dragging dots, allow collapse during refresh
        if (isDraggingDots) return false;
        
        const { dy, dx } = gestureState;
        if (Math.abs(dy) < 5 || Math.abs(dx) > Math.abs(dy)) return false;
        if (dy < 0) return scrollOffset.current <= 5;
        if (dy > 0) return isCarouselExpanded || scrollOffset.current <= 5;
        return false;
      },
      onPanResponderTerminationRequest: () => isDraggingDots, // Allow termination if dots are being dragged
      onPanResponderGrant: () => {
        // Only block carousel expansion if dots are being dragged, allow collapse during refresh
        if (isDraggingDots) return;
        
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
        if (isCarouselExpanded) setIsScrollEnabled(false);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only block carousel movement if dots are being dragged, allow collapse during refresh
        if (isDraggingDots || !gestureReady.current) {
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
        // Only block carousel release handling if dots are being dragged, allow collapse during refresh
        if (isDraggingDots) return;
        
        const { vy, dy } = gestureState;
        setIsScrollEnabled(true);
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

        // If refresh is in progress, allow collapse but without spring animation
        if (isRefreshing) {
          // Use a quick timing animation instead of spring to avoid conflicts
          Animated.timing(animatedTranslateY, {
            toValue: targetTranslateY,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            currentTranslateY.current = targetTranslateY;
          });
          return;
        }

        // Set animation state to disable new refresh during animation
        setIsCarouselAnimating(true);

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
          // Re-enable refresh after animation completes
          setIsCarouselAnimating(false);
        });
      },
    })
  ).current;

  const dotsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isRefreshing,
      onStartShouldSetPanResponderCapture: () => !isRefreshing, // Capture events before they reach other responders
      onMoveShouldSetPanResponder: () => !isRefreshing,
      onMoveShouldSetPanResponderCapture: () => !isRefreshing, // Capture events before they reach other responders
      onPanResponderTerminationRequest: () => false, // Don't allow termination while dots are being dragged
      onPanResponderGrant: (evt) => {
        if (isRefreshing) return;
        setIsDraggingDots(true);
        isDragReleasePending.current = false;
        
        // Measure the dots container if we don't have width yet
        if (dotsContainerRef.current) {
          dotsContainerRef.current.measure((_x, _y, width, _height, pageX, _pageY) => {
            setDotsWidth(width);
            setDotsX(pageX);
            
            // Store initial position after we have the measurement
            dragStartX.current = evt.nativeEvent.pageX;
          });
        } else {
          // Store the initial touch position using pageX for absolute position
          dragStartX.current = evt.nativeEvent.pageX;
        }
        
        // Get the current scroll position
        scrollX.stopAnimation((value) => {
          dragStartScrollX.current = value;
        });
      },
      onPanResponderMove: (evt) => {
        if (isRefreshing) return;
        // Use ref to get current blocks
        const currentBlocks = blocksRef.current;
        
        // Check if we have the necessary data
        if (!currentBlocks || currentBlocks.length === 0) {
          return;
        }
        
        // Get the latest dots width from state or measure
        let currentDotsWidth = dotsWidth;
        if (currentDotsWidth === 0 && dotsContainerRef.current) {
          // Try synchronous measure (might not work on all platforms)
          dotsContainerRef.current.measure((_x, _y, width, _height, pageX, _pageY) => {
            if (width > 0) {
              currentDotsWidth = width;
              setDotsWidth(width);
              setDotsX(pageX);
            }
          });
        }
        
        // Use a fallback width if still 0
        if (currentDotsWidth === 0) {
          currentDotsWidth = 140; // Approximate width based on what we measured
        }

        // Calculate the drag delta using pageX for absolute position
        const currentX = evt.nativeEvent.pageX;
        const deltaX = currentX - dragStartX.current;
        
        // Map the drag across visible dots to the full camera range
        const totalScrollRange = width * (currentBlocks.length - 1);
        const dragRatio = deltaX / currentDotsWidth;
        
        // Scale the drag to represent the full range of cameras
        const scrollDelta = dragRatio * totalScrollRange;
        
        // Calculate new scroll offset from the starting position
        const newScrollOffset = dragStartScrollX.current + scrollDelta;
        
        // Clamp the scroll offset to valid range
        const clampedOffset = Math.min(Math.max(0, newScrollOffset), totalScrollRange);
        
        // Update scrollX but don't move the carousel during drag - only update when settled
        scrollX.setValue(clampedOffset);
        // Don't update carousel position during drag - let it settle first
        
        // Update selected camera in real-time during drag
        const pageIndex = Math.round(clampedOffset / width);
        if (pageIndex >= 0 && pageIndex < currentBlocks.length) {
          const newCameraId = currentBlocks[pageIndex].cameraId;
          if (newCameraId !== selectedCameraId) {
            setSelectedCameraId(newCameraId);
            currentCameraIdRef.current = newCameraId;
          }
        }
        
        // Update visible dot range during drag to show correct ellipses
        if (currentBlocks.length > MAX_VISIBLE_DOTS) {
          const currentIndex = Math.round(clampedOffset / width);
          const halfVisible = Math.floor(MAX_VISIBLE_DOTS / 2);
          
          let start = Math.max(0, currentIndex - halfVisible);
          let end = Math.min(currentBlocks.length, start + MAX_VISIBLE_DOTS);
          
          // Adjust if we're at the edges
          if (end === currentBlocks.length) {
            start = Math.max(0, currentBlocks.length - MAX_VISIBLE_DOTS);
          }
          if (start === 0) {
            end = Math.min(currentBlocks.length, MAX_VISIBLE_DOTS);
          }
          
          setVisibleDotRange({ start, end });
        }
      },
      onPanResponderRelease: () => {
        if (isRefreshing) return;
        // Immediately clear the dragging state to hide transparent background
        setIsDraggingDots(false);
        const currentBlocks = blocksRef.current;
        if (!currentBlocks.length) return;

        // Set flag to prevent momentum scroll handler from interfering
        isDragReleasePending.current = true;

        // Get current offset and snap to nearest page
        let currentOffset = 0;
        scrollX.stopAnimation((value) => {
          currentOffset = value;
        });
        
        const pageIndex = Math.round(currentOffset / width);
        const snappedOffset = pageIndex * width;
        
        // Update selected camera FIRST to prevent snap-back
        if (pageIndex >= 0 && pageIndex < currentBlocks.length) {
          const newCameraId = currentBlocks[pageIndex].cameraId;
          if (newCameraId !== selectedCameraId) {
            setSelectedCameraId(newCameraId);
            currentCameraIdRef.current = newCameraId;
          }
        }
        
        // Animate scrollX to the snapped position (but don't move carousel yet)
        Animated.spring(scrollX, {
          toValue: snappedOffset,
          useNativeDriver: false,
          tension: 50,
          friction: 10,
        }).start();
        
        // Move the carousel to the final position without animation to prevent snap-back
        carouselRef.current?.scrollToOffset({ offset: snappedOffset, animated: false });
        
        // Clear the flag after a short delay
        setTimeout(() => {
          isDragReleasePending.current = false;
        }, 100);
      },
    })
  ).current;


  // Optimized scroll handler with throttling
  const handlePhotoListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  // 🔧 FIX: Only update selectedCameraId on momentum scroll end - NOT during scroll
  const updateSelectedCameraFromScroll = useCallback((scrollX: number) => {
    const currentIndex = Math.round(scrollX / width);
    if (currentIndex >= 0 && currentIndex < allBlocks.length) {
      const newBlock = allBlocks[currentIndex];
      const newSelectedCameraId = newBlock.cameraId;
      if (newSelectedCameraId !== selectedCameraId) {
        console.log(`📱 [ALBUM_CAMERA_SWITCH] Switching from ${selectedCameraId} to ${newSelectedCameraId}`);
        setSelectedCameraId(newSelectedCameraId);
        
        // Update section ID based on block type
        if (newBlock.isSpecialSection) {
          setSelectedSectionId(newBlock.sectionType!);
        } else {
          setSelectedSectionId(newSelectedCameraId);
        }
      }
    }
  }, [width, allBlocks, selectedCameraId]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Don't interfere if drag release is handling the update
      if (isDragReleasePending.current) {
        return;
      }
      const scrollXValue = event.nativeEvent.contentOffset.x;
      updateSelectedCameraFromScroll(scrollXValue);
      
    },
    [updateSelectedCameraFromScroll, width, allBlocks]
  );

  const onSearchTextChange = (text: string) => {
    setSearchQuery(text);
    if (!isSearchActive) {
      setIsSearchActive(true)
    }
  };

  const onSearchFocus = () => {
    setIsSearchActive(true);
  };

  const onSearchBlur = () => {
    if (searchQuery.trim().length === 0) {
      setIsSearchActive(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Reset navigation state when screen gains focus
      isNavigatingRef.current = false;
      setIsNavigating(false);
      
      // Reset the navigation flag when returning to album
      hasNavigatedAway.current = false;
      
      // Handle URL parameter clearing for all scenarios
      if (urlCameraId || urlFriendId) {
        const timeoutId = setTimeout(() => {
          // Check the global flag to see if single photo navigation is in progress
          const isSinglePhoto = getSinglePhotoNavigation();
          
          // For camera notifications
          const shouldClearCamera = urlCameraId && !isSinglePhoto && !infinitePhotosLoading && infinitePhotos.length >= 0 && selectedCameraId === urlCameraId;
          // For friend notifications (face match)
          const shouldClearFriend = urlFriendId && !isSinglePhoto && selectedCameraId === 'face-match-section';
          
          if (shouldClearCamera || shouldClearFriend) {
            console.log(`📱 [ALBUM_FOCUS] Data loaded and not single photo, clearing URL parameter for batch notification`);
            router.replace('/(tabs)/album');
            isSettingFromUrl.current = false;
          } else {
            console.log(`📱 [ALBUM_FOCUS] Skipping URL clear - data still loading or camera/friend not set`);
            
            // Retry after more time if data is still loading
            const shouldRetryCamera = urlCameraId && (infinitePhotosLoading || selectedCameraId !== urlCameraId);
            const shouldRetryFriend = urlFriendId && selectedCameraId !== 'face-match-section';
            
            if (shouldRetryCamera || shouldRetryFriend) {
              setTimeout(() => {
                console.log(`📱 [ALBUM_FOCUS] Retry check for batch notification URL clear`);
                const retryCamera = urlCameraId && !getSinglePhotoNavigation() && !infinitePhotosLoading && selectedCameraId === urlCameraId;
                const retryFriend = urlFriendId && !getSinglePhotoNavigation() && selectedCameraId === 'face-match-section';
                
                if (retryCamera || retryFriend) {
                  console.log(`📱 [ALBUM_FOCUS] Retry: Clearing URL parameter for batch notification`);
                  router.replace('/(tabs)/album');
                  isSettingFromUrl.current = false;
                }
              }, 1000);
            }
          }
        }, 800);
        
        return () => {
          clearTimeout(timeoutId);
        };
      }
      
      if (pendingModalRestore) {
        const friendToRestore = friends.find(f => f.id === pendingModalRestore);
        if (friendToRestore) {
          setTimeout(() => {
            setSelectedFriend(friendToRestore);
            setShowModal(true);
            setPendingModalRestore(null);
          }, 200);
        } else {
          setPendingModalRestore(null);
        }
      }

      return () => {
        isNavigatingRef.current = false;
        setIsNavigating(false);
        hasNavigatedAway.current = true;
      };
    }, [pendingModalRestore, friends, urlCameraId])
  );

  // Add focus effect preloading and stale data refresh
  useFocusEffect(
    useCallback(() => {
      // Check and refetch stale queries
      if (isInitialLoadComplete && infiniteSharedPhotosQuery.isStale) {
        console.log("🔄 [ALBUM_SCREEN] Refreshing stale infinite shared photos on focus");
        infiniteSharedPhotosQuery.refetch();
      }
      if (infiniteFaceMatchedPhotosQuery.isStale) {
        console.log("🔄 [ALBUM_SCREEN] Refreshing stale infinite face-matched photos on focus");
        infiniteFaceMatchedPhotosQuery.refetch();
      }
      
      // Preload images for the active section when tab becomes active
      const currentPhotos = selectedSectionId === 'faceMatch' 
        ? infiniteFaceMatchedPhotosQuery.deduplicatedPhotos 
        : selectedSectionId === 'sharedCameras'
        ? infiniteSharedPhotos
        : infinitePhotos;
      
      if (currentPhotos.length > 0) {
        const urlsToPreload = currentPhotos.slice(0, 30).map(p => p.url);
        preloadImages(urlsToPreload, 'high').catch(error => {
          console.warn('Failed to preload focus images:', error);
        });
      }
    }, [infiniteSharedPhotosQuery.isStale, infiniteSharedPhotosQuery.refetch, infiniteFaceMatchedPhotosQuery.isStale, infiniteFaceMatchedPhotosQuery.refetch, isInitialLoadComplete, selectedSectionId, infiniteFaceMatchedPhotosQuery.deduplicatedPhotos, infiniteSharedPhotos, infinitePhotos])
  );

  const handleRefreshFriends = async () => {
    if (refreshingFriends) return;
    
    try {
      setRefreshingFriends(true);
      console.log("🔄 Refreshing friends list...");
      await refetchFriends();
      console.log("✅ Friends list refreshed");
    } catch (error) {
      console.error("❌ Failed to refresh friends:", error);
    } finally {
      // Add a small delay to show the refresh completion
      setTimeout(() => {
        setRefreshingFriends(false);
      }, 500);
    }
  };

  // Pull to refresh handler for photos - refreshes all cameras
  const handleRefreshPhotos = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log("🔄 Refreshing all cameras and photos...");
      // Refetch cameras which includes their photos
      await refetchCameras();
      // Also refetch current camera's infinite scroll data if needed
      if (selectedCameraId) {
        await refetchPhotos();
      }
      console.log("✅ All cameras and photos refreshed");
    } catch (error) {
      console.error("❌ Failed to refresh:", error);
    } finally {
      // Add small delay to ensure refresh indicator disappears properly
      setTimeout(() => setIsRefreshing(false), 100);
    }
  }, [refetchPhotos, refetchCameras, selectedCameraId]);

  // Pull to refresh handler for modal photos
  const handleRefreshModalPhotos = useCallback(async () => {
    setIsModalRefreshing(true);
    try {
      console.log("🔄 Refreshing modal photos and friends...");
      await Promise.all([
        refetchFaceMatchedPhotos(),
        refetchFriends()
      ]);
      console.log("✅ Modal photos and friends refreshed");
    } catch (error) {
      console.error("❌ Failed to refresh modal data:", error);
    } finally {
      setIsModalRefreshing(false);
    }
  }, [refetchFaceMatchedPhotos, refetchFriends]);

  // Pull-to-refresh scroll handler
  const handlePullToRefreshScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    
    // During pull-to-refresh, scrollY becomes negative
    if (scrollY < 0) {
      const pullDistance = Math.abs(scrollY);
      const maxPull = 60; // Optimized max pull distance
      
      // Calculate progress (0 to 1) based on pull distance
      const progress = Math.min(pullDistance / maxPull, 1);
      
      // Direct setValue without requestAnimationFrame for better performance
      // Friends carousel moves down less (up to 30px)
      const friendsOffset = progress * 30;
      friendsCarouselPushDownValue.setValue(friendsOffset);
      
      // Photos carousel moves down more (up to 100px)
      const photosOffset = progress * 100;
      photosCarouselPushDownValue.setValue(photosOffset);
    } else if (!refreshingFriends && scrollY >= 0) {
      // Only reset when not refreshing AND scroll is at or above 0 to prevent jitter
      friendsCarouselPushDownValue.setValue(0);
      photosCarouselPushDownValue.setValue(0);
    }
  }, [friendsCarouselPushDownValue, photosCarouselPushDownValue, refreshingFriends]);

  // Direct scroll handler for real-time updates
  const handleScrollWithUpdates = useCallback((event: any) => {
    const scrollXValue = event.nativeEvent.contentOffset.x;
    
    // Calculate the current position more precisely - update when 25% through to next camera
    const precisePosition = scrollXValue / width;
    const currentIndex = Math.floor(precisePosition + 0.25); // Update when 25% into next camera
    const clampedIndex = Math.max(0, Math.min(allBlocks.length - 1, currentIndex));
    
    if (!isDraggingDots && !isSettingFromUrl.current) {
      // Update camera name in real-time during scroll (but not when setting from URL)
      if (clampedIndex !== allBlocks.findIndex(b => b.cameraId === selectedCameraId)) {
        const newBlock = allBlocks[clampedIndex];
        const newCameraId = newBlock.cameraId;
        console.log(`📱 [SCROLL_UPDATE] Camera: ${selectedCameraId} -> ${newCameraId}, Index: ${clampedIndex}, Position: ${precisePosition.toFixed(2)}`);
        console.log(`📱 [SCROLL_DEBUG] scrollXValue: ${scrollXValue}, width: ${width}, allBlocks.length: ${allBlocks.length}`);
        setSelectedCameraId(newCameraId);
        currentCameraIdRef.current = newCameraId;
        
        // Update section ID based on block type
        if (newBlock.isSpecialSection) {
          setSelectedSectionId(newBlock.sectionType!);
        } else {
          setSelectedSectionId(newCameraId);
        }
      }
      
      // Update visible dot range in real-time during scroll
      if (allBlocks.length > MAX_VISIBLE_DOTS) {
        const halfVisible = Math.floor(MAX_VISIBLE_DOTS / 2);
        
        let start = Math.max(0, clampedIndex - halfVisible);
        let end = Math.min(allBlocks.length, start + MAX_VISIBLE_DOTS);
        
        // Adjust if we're at the edges
        if (end === allBlocks.length) {
          start = Math.max(0, allBlocks.length - MAX_VISIBLE_DOTS);
        }
        if (start === 0) {
          end = Math.min(allBlocks.length, MAX_VISIBLE_DOTS);
        }
        
        // Only update if the range actually changed
        if (start !== visibleDotRange.start || end !== visibleDotRange.end) {
          setVisibleDotRange({ start, end });
        }
      }
    }
  }, [width, allBlocks, selectedCameraId, isDraggingDots, MAX_VISIBLE_DOTS, visibleDotRange]);

  // Optimized scroll handler for carousel with real-time updates
  const handleScroll = useMemo(() => 
    Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
      { 
        useNativeDriver: false,
        listener: handleScrollWithUpdates,
      }
    ), [scrollX, handleScrollWithUpdates]
  );

  const handleFriendPress = async (friend: Friend) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIsNavigating(true);
    
    // Individual friend press animation using the friend's ID
    const friendAnimation = getFriendPressAnimation(friend.id);
    
    Animated.sequence([
      Animated.timing(friendAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(friendAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setSelectedFriend(friend);
    setShowModal(true);
    
    // Reset after modal animation completes
    setTimeout(() => {
      isNavigatingRef.current = false;
      setIsNavigating(false);
    }, 500);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFriend(null);
  };

  const handleSharedPhotoPress = (photoId: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIsNavigating(true);
    setPendingModalRestore(selectedFriend?.id || null);

    // Close modal when navigating
    setShowModal(false);
    setSelectedFriend(null);

    router.push({
      pathname: `/photo/${photoId}` as any,
      params: { friendId: selectedFriend?.id }
    });
    
    // Reset navigation state
    setTimeout(() => {
      isNavigatingRef.current = false;
      setIsNavigating(false);
    }, 1000);
  };

  const renderSearchUserItem = ({ item }: { item: UserItem }) => (
    <Pressable 
      onPress={() => {
        // Double-check both ref and state
        if (isNavigatingRef.current || isNavigating) return;
        
        // Set both immediately
        isNavigatingRef.current = true;
        setIsNavigating(true);
        
        // Small delay to ensure all UI updates
        setTimeout(() => {
          router.push(`/user/${item.id}`);
        }, 10);
        
        // Reset after navigation
        setTimeout(() => {
          isNavigatingRef.current = false;
          setIsNavigating(false);
        }, 2000);
      }}
      disabled={isNavigating}
    >
      <Box
        py="$4"
        px="$4"
        borderBottomWidth="$1"
        borderBottomColor={isDark ? "#333" : "#e5e5e5"}
        $pressed={{
          bg: isDark ? "#1a1a1a" : "#f5f5f5",
        }}
      >
        <HStack space="md" alignItems="center">
          {/* Profile Photo */}
          <Box
            width={48}
            height={48}
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
            {item.profilePhotoUrl ? (
              <ExpoImage
                source={{ uri: item.profilePhotoUrl }}
                style={{ width: "100%", height: "100%", borderRadius: 22 }}
                contentFit="cover"
              />
            ) : (
              <Center flex={1}>
                <Box
                  width="100%"
                  height="100%"
                  bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Text fontSize="$md">👤</Text>
                </Box>
              </Center>
            )}
          </Box>

          {/* User Info */}
          <VStack flex={1}>
            <Text 
              fontSize="$lg"
              color={isDark ? "#fff" : "#000"}
              fontWeight="$medium"
              numberOfLines={1}
            >
              {item.displayName ?? "Unnamed"}
            </Text>
          </VStack>
        </HStack>
      </Box>
    </Pressable>
  );

  // Update visible dot range based on scroll position
  useEffect(() => {
    const updateDotRange = () => {
      if (allBlocks.length <= MAX_VISIBLE_DOTS) {
        setVisibleDotRange({ start: 0, end: allBlocks.length });
      } else {
        // Get current scroll position
        let currentScrollValue = 0;
        scrollX.stopAnimation((value) => {
          currentScrollValue = value;
        });
        
        const currentIndex = Math.round(currentScrollValue / width);
        const halfVisible = Math.floor(MAX_VISIBLE_DOTS / 2);
        
        let start = Math.max(0, currentIndex - halfVisible);
        let end = Math.min(allBlocks.length, start + MAX_VISIBLE_DOTS);
        
        // Adjust if we're at the edges
        if (end === allBlocks.length) {
          start = Math.max(0, allBlocks.length - MAX_VISIBLE_DOTS);
        }
        if (start === 0) {
          end = Math.min(allBlocks.length, MAX_VISIBLE_DOTS);
        }
        
        setVisibleDotRange({ start, end });
      }
    };

    // Update immediately
    updateDotRange();
    
    // The scroll listener is now handled by the handleScroll function above
    // Keep this effect just for initial setup and cleanup
    return () => {};
  }, [allBlocks.length, width]);

  // Dot indicator component - no animation, instant snap
  const renderDot = useCallback((index: number) => {
    // Calculate if this dot is currently active based on selected camera
    const selectedIndex = allBlocks.findIndex(b => b.cameraId === selectedCameraId);
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
  }, [selectedCameraId, allBlocks]);

  // Friend item component with individual animations
  const renderFriendItem = ({ item }: { item: Friend }) => {
    const friendAnimation = getFriendPressAnimation(item.id);
    
    return (
      <Animated.View style={{ transform: [{ scale: friendAnimation }] }}>
        <Pressable
          onPress={refreshingFriends || isNavigating ? undefined : () => handleFriendPress(item)}
          disabled={refreshingFriends || isNavigating}
          style={{ 
            alignItems: "center",
            justifyContent: "center",
            marginHorizontal: 4,
            maxWidth: 100,
            opacity: refreshingFriends ? 0.6 : 1,
          }}
        >
          <Box mb="$1" justifyContent="center" alignItems="center">
            <Box
              width={88}
              height={88}
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
              {item.profilePhotoUrl ? (
                <ExpoImage
                  source={{ uri: item.profilePhotoUrl }}
                  style={{ width: "100%", height: "100%", borderRadius: 42 }}
                  contentFit="cover"
                />
              ) : (
                <Center flex={1}>
                  <Box
                    width="100%"
                    height="100%"
                    bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Text fontSize="$xl">👤</Text>
                  </Box>
                </Center>
              )}
            </Box>
          </Box>
          
          <Text 
            fontSize="$md" 
            textAlign="center" 
            color={isDark ? "$textDark100" : "$textLight900"}
            maxWidth={120}
            numberOfLines={1}
            fontWeight="$semibold"
          >
            {item.displayName}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  // Maintain stable photo cache that doesn't change on camera switch
  const [cameraPhotoCache, setCameraPhotoCache] = useState<{ [key: string]: any[] }>({});
  const cacheInitialized = useRef(false);

  // Update photo cache when infinite photos actually change (not just on camera switch)
  useEffect(() => {
    if (selectedCameraId) {
      // Only update cache if we have photos OR if we're not loading (to avoid overwriting cache with empty array during loading)
      if (infinitePhotos.length > 0 || !infinitePhotosLoading) {
        setCameraPhotoCache(prev => ({
          ...prev,
          [selectedCameraId]: infinitePhotos
        }));
      }
    }
  }, [selectedCameraId, infinitePhotos, infinitePhotosLoading]); // Include infinitePhotosLoading to prevent premature cache clearing

  // Initialize cache with existing block photos - only run once
  useEffect(() => {
    if (allBlocks.length > 2 && !cacheInitialized.current) { // >2 because first 2 are special sections
      const initialCache: { [key: string]: any[] } = {};
      // Only cache the regular camera blocks (skip the first 2 special sections)
      const regularBlocks = allBlocks.slice(2);
      regularBlocks.forEach(block => {
        if (block.photos && block.photos.length > 0) {
          initialCache[block.cameraId] = block.photos;
        }
      });
      if (Object.keys(initialCache).length > 0) {
        setCameraPhotoCache(prev => ({ ...initialCache, ...prev }));
      }
      cacheInitialized.current = true;
    }
  }, [allBlocks.length]);

  // Get photos for rendering - use cache or fallback to block data
  const getCameraPhotos = useCallback((cameraId: string) => {
    if (cameraId === selectedCameraId) {
      return infinitePhotos.length > 0 ? infinitePhotos : (cameraPhotoCache[cameraId] || []);
    }
    return cameraPhotoCache[cameraId] || allBlocks.find(b => b.cameraId === cameraId)?.photos || [];
  }, [selectedCameraId, infinitePhotos, cameraPhotoCache, allBlocks]);

  // Helper function to get photo count with + indicator for sections
  const getPhotoCountForSection = useCallback((block: ExtendedBlock) => {
    if (block.isSpecialSection) {
      if (block.sectionType === 'faceMatch') {
        const count = filteredFaceMatchPhotos.length;
        const hasMore = infiniteFaceMatchedPhotosQuery.hasNextPage;
        return `${count}${hasMore ? '+' : ''}`;
      } else if (block.sectionType === 'sharedCameras') {
        const count = filteredSharedCameraPhotos.length;
        const hasMore = infiniteSharedPhotosQuery.hasNextPage;
        return `${count}${hasMore ? '+' : ''}`;
      }
    } else {
      // Regular camera - get photos from cache or current query
      const photos = getCameraPhotos(block.cameraId);
      const count = photos.length;
      const hasMore = block.cameraId === selectedCameraId ? hasMorePhotos : false;
      return `${count}${hasMore ? '+' : ''}`;
    }
    return '0';
  }, [filteredFaceMatchPhotos, filteredSharedCameraPhotos, infiniteFaceMatchedPhotosQuery.hasNextPage, infiniteSharedPhotosQuery.hasNextPage, getCameraPhotos, selectedCameraId, hasMorePhotos]);

  const renderPhotoList = useCallback((item: any) => {
    const isCurrentCamera = item.cameraId === selectedCameraId;
    
    // Handle special sections differently
    let photosToShow: any[];
    let isLoadingPhotos: boolean;
    let hasMorePhotosLocal: boolean = false;
    let isFetchingMorePhotosLocal: boolean = false;
    let fetchMorePhotosLocal: () => void = () => {};
    
    if (item.isSpecialSection) {
      if (item.sectionType === 'faceMatch') {
        photosToShow = filteredFaceMatchPhotos;
        isLoadingPhotos = isCurrentCamera && infiniteFaceMatchedPhotosQuery.isLoading && photosToShow.length === 0;
        hasMorePhotosLocal = infiniteFaceMatchedPhotosQuery.hasNextPage;
        isFetchingMorePhotosLocal = infiniteFaceMatchedPhotosQuery.isFetchingNextPage;
        fetchMorePhotosLocal = infiniteFaceMatchedPhotosQuery.fetchNextPage;
      } else { // sharedCameras
        photosToShow = filteredSharedCameraPhotos;
        isLoadingPhotos = isCurrentCamera && infiniteSharedPhotosQuery.isLoading && photosToShow.length === 0;
        hasMorePhotosLocal = infiniteSharedPhotosQuery.hasNextPage;
        isFetchingMorePhotosLocal = infiniteSharedPhotosQuery.isFetchingNextPage;
        fetchMorePhotosLocal = infiniteSharedPhotosQuery.fetchNextPage;
      }
    } else {
      // Regular camera handling - use proper scope variables without shadowing
      photosToShow = getCameraPhotos(item.cameraId);
      const hasBeenLoaded = loadedCameras.has(item.cameraId);
      isLoadingPhotos = isCurrentCamera && infinitePhotosLoading && !hasBeenLoaded;
      hasMorePhotosLocal = hasMorePhotos;
      isFetchingMorePhotosLocal = isFetchingMorePhotos;
      fetchMorePhotosLocal = fetchMorePhotos;
    }
    
    // Show loading state only if we're loading AND have no photos AND haven't loaded this camera before
    if (isLoadingPhotos) {
      return (
        <Box flex={1} key={`loading-${item.cameraId}`} style={{ marginTop: -325 }}>
          <PhotoGridSkeleton columns={4} />
        </Box>
      );
    }
    
    // Show empty state only when not loading and no photos
    if (!isLoadingPhotos && photosToShow.length === 0) {
      return (
        <ScrollView
          key={`empty-${item.cameraId}`}
          style={{ flex: 1, marginTop: -15 }}
          contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={isCarouselAnimating ? undefined : handleRefreshPhotos}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <VStack space="md" alignItems="center" mb={350}>
            <Box
              width={60}
              height={60}
              borderRadius="$full"
              bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
              justifyContent="center"
              alignItems="center"
            >
              <Text fontSize="$xl">📸</Text>
            </Box>
            <Text 
              fontSize="$sm"
              color={isDark ? "$textDark300" : "$textLight600"}
              textAlign="center"
              fontWeight="$medium"
            >
              No photos yet
            </Text>
          </VStack>
        </ScrollView>
      );
    }

    // Always render FlatList with current photos (even if empty during loading)
    return (
      <Box ref={photoGridRef}>
        <FlatList
        key={`photos-${item.cameraId}`}
        ref={(ref) => {
          if (ref) photosListRefs.current[item.cameraId] = ref;
        }}
        data={photosToShow}
        keyExtractor={(p) => p.id}
        extraData={photosToShow.length}
        numColumns={4}
        bounces={true}
        overScrollMode="never"
        scrollEnabled={isScrollEnabled && !isRefreshing}
        onScroll={handlePhotoListScroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        maxToRenderPerBatch={20}
        windowSize={5}
        initialNumToRender={16}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={100}
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
            refreshing={isRefreshing}
            onRefresh={isCarouselAnimating ? undefined : handleRefreshPhotos}
          />
        }
        onEndReached={isCurrentCamera && hasMorePhotosLocal ? () => {
          console.log(`🔄 [INFINITE_SCROLL] Loading more for ${item.sectionType || 'camera'} ${item.cameraId}`);
          fetchMorePhotosLocal();
        } : undefined}
        onEndReachedThreshold={0.8}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
        ListFooterComponent={
          isCurrentCamera && isFetchingMorePhotosLocal ? (
            <Center py="$4">
              <Spinner size="small" color={isDark ? "$primary400" : "$primary600"} />
            </Center>
          ) : null
        }
        renderItem={({ item: photo, index }) => {
          const columnIndex = index % PHOTOS_PER_ROW;
          return (
            <OptimizedPhotoItem 
              photo={photo}
              thumbSize={thumbSize}
              columnIndex={columnIndex}
              recyclingKey={photo.id}
              onPress={(photo) => {
                if (isNavigatingRef.current) return;
                isNavigatingRef.current = true;
                setIsNavigating(true);
                
                // Navigate based on photo context
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
                
                setTimeout(() => {
                  isNavigatingRef.current = false;
                  setIsNavigating(false);
                }, 2000);
              }}
            />
          );
        }}
      />
      </Box>
    );
  }, [selectedCameraId, getCameraPhotos, infinitePhotosLoading, loadedCameras, hasMorePhotos, isFetchingMorePhotos, isDark, handlePhotoListScroll, isScrollEnabled, fetchMorePhotos, thumbSize, isNavigating, isNavigatingRef, router, isRefreshing, handleRefreshPhotos, filteredFaceMatchPhotos, filteredSharedCameraPhotos, infiniteFaceMatchedPhotosQuery, infiniteSharedPhotosQuery]);

  if (loading) {
    return <AlbumMainSkeleton />;
  }

  const selectedBlock = allBlocks.find((b) => b.cameraId === selectedCameraId);

  return (
    <>
      <Box 
        flex={1} 
        bg={isDark ? "#000" : "#fff"}
      >
        {/* Search Bar */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: isCarouselExpanded ? 1 : (isSearchActive ? 10 : 5),
            opacity: searchBarOpacity,
          }}
          pointerEvents={refreshingFriends ? "none" : "auto"}
        >
          <Box
            bg={isDark ? "#000" : "#fff"}
            pt={13}
            px="$4"
            pb={10}
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.1}
            shadowRadius={8}
          >
            <Input
              h={48}
              borderWidth="$1"
              borderColor={isDark ? "#333" : "#ccc"}
              borderRadius="$lg"
              bg={isDark ? "#1a1a1a" : "#fff"}
              $focus={{
                borderColor: "#007AFF",
                shadowColor: "#007AFF",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            >
              <InputField
                placeholder="Search users…"
                placeholderTextColor={isDark ? "#666" : "#999"}
                color={isDark ? "#fff" : "#000"}
                value={searchQuery}
                onChangeText={onSearchTextChange}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                fontSize="$md"
                py="$3"
                px="$4"
              />
            </Input>
          </Box>
        </Animated.View>

        {/* Search Results Overlay */}
        {isSearchActive && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: isCarouselExpanded ? 2 : 8,
              opacity: searchResultsOpacity,
            }}
            pointerEvents={refreshingFriends ? "none" : "auto"}
            {...PanResponder.create({
              onStartShouldSetPanResponder: () => true,
              onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only handle downward swipes to dismiss keyboard
                return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
              },
              onPanResponderGrant: () => {
                Keyboard.dismiss();
              },
            }).panHandlers}
          >
            <Box
              bg={isDark ? "#000" : "#fff"}
              pt={(StatusBar.currentHeight || 44) + 30}
              flex={1}
            >
              <VStack space="md" flex={1} px="$0">
                {/* Loading Indicator */}
                {searchLoading && (
                  <FriendSearchSkeleton count={8} />
                )}

                {/* Results List */}
                <Box flex={1}>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSearchUserItem}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                      !searchLoading && searchQuery.length >= 2 ? (
                        <Center py="$8">
                          <VStack space="md" alignItems="center">
                            <Text fontSize="$4xl">🔍</Text>
                            <Text 
                              fontSize="$lg"
                              color={isDark ? "#666" : "#999"}
                              textAlign="center"
                            >
                              No users found
                            </Text>
                            <Text 
                              fontSize="$sm"
                              color={isDark ? "#555" : "#666"}
                              textAlign="center"
                            >
                              Try searching with a different name
                            </Text>
                          </VStack>
                        </Center>
                      ) : searchQuery.length === 0 ? (
                        <Center py="$8">
                          <VStack space="md" alignItems="center">
                            <Text fontSize="$4xl">👥</Text>
                            <Text 
                              fontSize="$lg"
                              color={isDark ? "#666" : "#999"}
                              textAlign="center"
                            >
                              Find Friends
                            </Text>
                            <Text 
                              fontSize="$sm"
                              color={isDark ? "#555" : "#666"}
                              textAlign="center"
                              px="$8"
                            >
                              Start typing to search for users by their display name
                            </Text>
                          </VStack>
                        </Center>
                      ) : null
                    }
                    style={{ flex: 1 }}
                  />
                </Box>
              </VStack>
            </Box>
          </Animated.View>
        )}

        {/* Friends Carousel with Pull-to-Refresh */}
        <Animated.View
          style={{
            position: "absolute",
            top: screenHeight * 0.08,
            height: FRIENDS_CAROUSEL_HEIGHT + 60, // Increased height to prevent cut-off
            left: 0,
            right: 0,
            marginTop: 25,
            zIndex: 1,
            opacity: friendsCarouselOpacity,
            transform: [{ translateY: friendsCarouselPushDownValue }],
            overflow: 'visible', // Ensure content doesn't get clipped
          }}
        >
          <Box
            flex={1}
            bg={isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)"}
            borderColor={isDark ? "$borderDark800" : "$borderLight200"}
            pt="$3"
            pb="$3"
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.1}
            shadowRadius={8}
          >
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshingFriends}
                  onRefresh={handleRefreshFriends}
                />
              }
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{ 
                flexGrow: 1,
                paddingBottom: 20 // Add bottom padding to prevent cut-off
              }}
              bounces={true}
              onScroll={handlePullToRefreshScroll}
              scrollEventThrottle={16}
            >
              {/* Heading */}
              <Heading
                size="md"
                color={isDark ? "$textDark100" : "$textLight900"}
                mb="$2"
                textAlign={friends.length === 0 ? "center" : "left"}
                fontWeight="$semibold"
                px={26}
              >
                Your Friends
              </Heading>

              {friendsLoading ? (
                <FriendsListSkeleton count={4} />
              ) : friends.length === 0 ? (
                <Center py="$4" minHeight={60}>
                  <VStack space="sm" alignItems="center">
                    <Text
                      fontSize="$sm"
                      color={isDark ? "$textDark400" : "$textLight500"}
                      fontStyle="italic"
                    >
                      No friends yet
                    </Text>
                  </VStack>
                </Center>
              ) : (
                <FlatList
                  ref={friendsListRef}
                  data={friends}
                  renderItem={renderFriendItem}
                  keyExtractor={(item) => item.id}
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={!refreshingFriends && !isRefreshing}
                  contentContainerStyle={{
                    paddingLeft: 8,
                    marginLeft: 2,
                  }}
                  style={{ flexGrow: 0 }}
                />
              )}
            </ScrollView>
          </Box>
        </Animated.View>

        <Box flex={1} />

        {/* Always show carousel with individual section empty states */}
          <>
            {/* Photos Container with Drag Handle */}
            <Animated.View
              style={{
                height: EXPANDED_HEIGHT,
                transform: [
                  { translateY: animatedTranslateY },
                  { translateY: photosCarouselPushDownValue }
                ],
                overflow: "hidden",
                backgroundColor: isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.98)",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                elevation: 8,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: isDark ? 0.4 : 0.15,
                shadowRadius: 20,
                zIndex: isCarouselExpanded ? 15 : 2,
                position: 'absolute',
                bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
                left: 0,
                right: 0,
              }}
              pointerEvents={refreshingFriends ? "none" : "auto"}
              {...(refreshingFriends ? {} : panResponder.panHandlers)}
            >
              {/* Camera Section with Drag Handle */}
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
                {/* Drag Handle Area */}
                <Box 
                  minHeight={DRAG_HANDLE_HEIGHT + 16}
                  justifyContent="flex-start"
                  alignItems="center"
                  pt="$0"
                  pb="$0.5"
                  px="$3"
                >
                  <HStack 
                    alignItems="center" 
                    justifyContent="space-between" 
                    w="100%"
                    px="$5"
                    mb="$1"
                  >
                    <HStack alignItems="center" space="sm" flexShrink={1}>
                      <Heading 
                        size="md"
                        mt={5}
                        color={isDark ? "$textDark100" : "$textLight900"}
                        fontWeight="$bold"
                        numberOfLines={1}
                        flexShrink={1}
                      >
                        {selectedBlock?.isSpecialSection && selectedBlock.sectionType === 'faceMatch' ? '🎯 ' : ''}
                        {selectedBlock?.isSpecialSection && selectedBlock.sectionType === 'sharedCameras' ? '📷 ' : ''}
                        {selectedBlock?.name || "No Camera Selected"}
                      </Heading>
                      {selectedBlock && (
                        <Text 
                          fontSize="$sm"
                          mt={5}
                          color={isDark ? "$textDark400" : "$textLight500"}
                          fontWeight="$medium"
                        >
                          ({getPhotoCountForSection(selectedBlock)})
                        </Text>
                      )}
                    </HStack>

                    <View
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 8,
                        position: "relative",
                        flexDirection: "row",
                      }}
                    >
                      {/* Left ellipsis */}
                      {allBlocks.length > MAX_VISIBLE_DOTS && visibleDotRange.start > 0 && (
                        <Text style={{ 
                          color: isDark ? "#999" : "#666", 
                          fontSize: 16, 
                          marginHorizontal: 4,
                          opacity: 0.6
                        }}>
                          ···
                        </Text>
                      )}
                      
                      <View
                        ref={dotsContainerRef}
                        style={{
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                        {...dotsPanResponder.panHandlers}
                        onLayout={() => {
                          // Delay measurement to ensure layout is complete
                          setTimeout(() => {
                            if (dotsContainerRef.current) {
                              dotsContainerRef.current.measure((_x, _y, width, _height, pageX, _pageY) => {
                                if (width > 0) {
                                  setDotsWidth(width);
                                  setDotsX(pageX);
                                }
                              });
                            }
                          }, 100);
                        }}
                      >
                        {/* Transparent highlight box only on visible dots when dragging */}
                        {isDraggingDots && (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              width: "100%",
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: "rgba(255, 255, 255, 0.12)",
                            }}
                          />
                        )}

                        {/* Visible dots with smooth transitions */}
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "center",
                            paddingVertical: 10,
                            paddingHorizontal: 20,
                          }}
                        >
                          {allBlocks.slice(visibleDotRange.start, visibleDotRange.end).map((_, index) => 
                            renderDot(visibleDotRange.start + index)
                          )}
                        </View>
                      </View>
                      
                      {/* Right ellipsis */}
                      {allBlocks.length > MAX_VISIBLE_DOTS && visibleDotRange.end < allBlocks.length && (
                        <Text style={{ 
                          color: isDark ? "#999" : "#666", 
                          fontSize: 16, 
                          marginHorizontal: 4,
                          opacity: 0.6
                        }}>
                          ···
                        </Text>
                      )}
                    </View>
                  </HStack>
                </Box>

                <Box mt={-17}/>

                {/* Divider */}
                <Box 
                  height={0.5} 
                  mx="$5"
                  my="$0.5"
                  bg={isDark ? "$borderDark700" : "$borderLight200"}
                />

                {/* Search Bar Section (from me.tsx) */}
                {selectedBlock?.isSpecialSection && (
                  <Box px="$5" pt="$1" pb="$1" bg={isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.95)"}>
                      {selectedBlock.sectionType === 'faceMatch' ? (
                        <VStack space="sm">
                          {/* Face Match Search Bar */}
                          <Input
                          borderWidth="$1"
                          borderColor={isDark ? "$borderDark400" : "$borderLight300"}
                          borderRadius="$lg"
                          bg={isDark ? "$backgroundDark800" : "$backgroundLight0"}
                          h="$12"
                          $focus={{
                            borderColor: "$primary600",
                            bg: isDark ? "$backgroundDark700" : "$backgroundLight50"
                          }}
                        >
                          <InputField
                            ref={faceMatchSearchRef}
                            placeholder="Search friends to filter photos..."
                            placeholderTextColor={isDark ? "#666" : "#999"}
                            value={faceMatchSearch}
                            onChangeText={setFaceMatchSearch}
                            onFocus={() => {
                              setIsFaceMatchSearchActive(true);
                              // Auto-expand if collapsed when search is focused
                              if (!isCarouselExpanded) {
                                setIsCarouselExpanded(true);
                                const targetTranslateY = -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT);
                                
                                // If refresh is active, skip animation to avoid conflicts
                                if (isRefreshing) {
                                  animatedTranslateY.setValue(targetTranslateY);
                                  currentTranslateY.current = targetTranslateY;
                                  return;
                                }
                                
                                Animated.spring(animatedTranslateY, {
                                  toValue: targetTranslateY,
                                  tension: 50,
                                  friction: 10,
                                  overshootClamping: true,
                                  restDisplacementThreshold: 0.5,
                                  restSpeedThreshold: 0.5,
                                  useNativeDriver: true,
                                }).start(() => {
                                  currentTranslateY.current = targetTranslateY;
                                });
                              }
                            }}
                            onBlur={() => {
                              if (!faceMatchSearch) setIsFaceMatchSearchActive(false);
                            }}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            color={isDark ? "#fff" : "#000"}
                            fontSize="$md"
                          />
                        </Input>
    
                        {/* Selected Friends Chips */}
                        {selectedFriends.length > 0 && (
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled">
                            <HStack space="sm" py={-5}>
                              {selectedFriends.map(friend => (
                                <HStack
                                  key={friend.id}
                                  alignItems="center"
                                  space="xs"
                                  bg={isDark ? "$primary950" : "$primary100"}
                                  px="$3"
                                  py="$2"
                                  borderRadius="$full"
                                  borderWidth="$1"
                                  borderColor={isDark ? "$primary800" : "$primary200"}
                                >
                                  {friend.photoUrl ? (
                                    <ExpoImage
                                      source={{ uri: friend.photoUrl }}
                                      style={{ width: 20, height: 20, borderRadius: 10 }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <Box
                                      width={20}
                                      height={20}
                                      borderRadius="$full"
                                      bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                                      justifyContent="center"
                                      alignItems="center"
                                    >
                                      <Text fontSize="$2xs">👤</Text>
                                    </Box>
                                  )}
                                  <Text fontSize="$sm" color={isDark ? "$primary200" : "$primary700"} fontWeight="$medium">
                                    {friend.name}
                                  </Text>
                                  <Pressable onPress={() => {
                                    setSelectedFriends(prev => prev.filter(f => f.id !== friend.id));
                                  }}>
                                    <Icon as={CloseIcon} size="xs" color={isDark ? "$primary300" : "$primary600"} />
                                  </Pressable>
                                </HStack>
                              ))}
                            </HStack>
                          </ScrollView>
                        )}
    
                        {/* Friend Search Results Dropdown */}
                        {isFaceMatchSearchActive && faceMatchSearch && (
                          <Box
                            position="absolute"
                            top="$16"
                            left="$0"
                            right="$0"
                            maxHeight={200}
                            bg={isDark ? "$backgroundDark900" : "$backgroundLight0"}
                            borderRadius="$lg"
                            borderWidth="$1"
                            borderColor={isDark ? "$borderDark400" : "$borderLight300"}
                            shadowColor="$shadowColor"
                            shadowOffset={{ width: 0, height: 4 }}
                            shadowOpacity={0.15}
                            shadowRadius={8}
                            zIndex={1000}
                          >
                            <ScrollView keyboardShouldPersistTaps="handled">
                              {friendSearchResults.length === 0 ? (
                                <Box px="$4" py="$4">
                                  <VStack space="sm" alignItems="center">
                                    <Text fontSize="$sm" color={isDark ? "#666" : "#999"}>
                                      No friends found
                                    </Text>
                                    <Text fontSize="$xs" color={isDark ? "#555" : "#aaa"} textAlign="center">
                                      Try searching with a different name
                                    </Text>
                                  </VStack>
                                </Box>
                              ) : (
                                friendSearchResults.map(user => {
                                const isSelected = selectedFriends.some(f => f.id === user.id);
                                return (
                                  <Pressable
                                    key={user.id}
                                    onPress={() => {
                                      if (!isSelected) {
                                        setSelectedFriends(prev => [...prev, {
                                          id: user.id,
                                          name: user.displayName || 'Unnamed',
                                          photoUrl: user.profilePhotoUrl || undefined
                                        }]);
                                      }
                                      setFaceMatchSearch('');
                                    }}
                                    disabled={isSelected}
                                  >
                                    <HStack
                                      alignItems="center"
                                      space="md"
                                      px="$4"
                                      py="$3"
                                      borderBottomWidth="$1"
                                      borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
                                      opacity={isSelected ? 0.5 : 1}
                                    >
                                      {user.profilePhotoUrl ? (
                                        <ExpoImage
                                          source={{ uri: user.profilePhotoUrl }}
                                          style={{ width: 32, height: 32, borderRadius: 16 }}
                                          contentFit="cover"
                                        />
                                      ) : (
                                        <Box
                                          width={32}
                                          height={32}
                                          borderRadius="$full"
                                          bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                                          justifyContent="center"
                                          alignItems="center"
                                        >
                                          <Text fontSize="$sm">👤</Text>
                                        </Box>
                                      )}
                                      <Text fontSize="$md" color={isDark ? "#fff" : "#000"}>
                                        {user.displayName || 'Unnamed'}
                                      </Text>
                                      {isSelected && (
                                        <Text fontSize="$xs" color={isDark ? "#666" : "#999"}>
                                          Selected
                                        </Text>
                                      )}
                                    </HStack>
                                  </Pressable>
                                );
                              })
                              )}
                            </ScrollView>
                          </Box>
                        )}
                      </VStack>
                    ) : (
                      <VStack space="sm">
                        {/* Shared Camera Search Bar */}
                        <Input
                          borderWidth="$1"
                          borderColor={isDark ? "$borderDark400" : "$borderLight300"}
                          borderRadius="$lg"
                          bg={isDark ? "$backgroundDark800" : "$backgroundLight0"}
                          h="$12"
                          $focus={{
                            borderColor: "$primary600",
                            bg: isDark ? "$backgroundDark700" : "$backgroundLight50"
                          }}
                        >
                          <InputField
                            ref={sharedCameraSearchRef}
                            placeholder={userCamerasForSearch.length === 0 ? "No events available" : "Search events to filter photos..."}
                            placeholderTextColor={isDark ? "#666" : "#999"}
                            editable={userCamerasForSearch.length > 0}
                            value={sharedCameraSearch}
                            onChangeText={setSharedCameraSearch}
                            onFocus={() => {
                              setIsSharedCameraSearchActive(true);
                              // Auto-expand if collapsed when search is focused
                              if (!isCarouselExpanded) {
                                setIsCarouselExpanded(true);
                                const targetTranslateY = -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT);
                                
                                // If refresh is active, skip animation to avoid conflicts
                                if (isRefreshing) {
                                  animatedTranslateY.setValue(targetTranslateY);
                                  currentTranslateY.current = targetTranslateY;
                                  return;
                                }
                                
                                Animated.spring(animatedTranslateY, {
                                  toValue: targetTranslateY,
                                  tension: 50,
                                  friction: 10,
                                  overshootClamping: true,
                                  restDisplacementThreshold: 0.5,
                                  restSpeedThreshold: 0.5,
                                  useNativeDriver: true,
                                }).start(() => {
                                  currentTranslateY.current = targetTranslateY;
                                });
                              }
                            }}
                            onBlur={() => {
                              if (!sharedCameraSearch) setIsSharedCameraSearchActive(false);
                            }}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            color={isDark ? "#fff" : "#000"}
                            fontSize="$md"
                          />
                          {selectedCamera && (
                            <Pressable
                              onPress={() => {
                                setSelectedCamera(null);
                                setSharedCameraSearch('');
                              }}
                              px="$2"
                              justifyContent="center"
                              alignItems="center"
                              h="100%"
                            >
                              <Icon as={CloseIcon} size="sm" color={isDark ? "#666" : "#999"} />
                            </Pressable>
                          )}
                        </Input>
    
                        {/* Selected Camera Display */}
                        {selectedCamera && (
                          <HStack alignItems="center" space="xs">
                            <Text fontSize="$sm" color={isDark ? "#999" : "#666"}>
                              Showing photos from:
                            </Text>
                            <Text fontSize="$sm" fontWeight="$bold" color={isDark ? "$primary400" : "$primary600"}>
                              {selectedCamera.name}
                            </Text>
                          </HStack>
                        )}
    
                        {/* Camera Search Results Dropdown */}
                        {isSharedCameraSearchActive && sharedCameraSearch && (
                          <Box
                            position="absolute"
                            top="$16"
                            left="$0"
                            right="$0"
                            maxHeight={200}
                            bg={isDark ? "$backgroundDark900" : "$backgroundLight0"}
                            borderRadius="$lg"
                            borderWidth="$1"
                            borderColor={isDark ? "$borderDark400" : "$borderLight300"}
                            shadowColor="$shadowColor"
                            shadowOffset={{ width: 0, height: 4 }}
                            shadowOpacity={0.15}
                            shadowRadius={8}
                            zIndex={1000}
                          >
                            <ScrollView keyboardShouldPersistTaps="handled">
                              {filteredCameras.length === 0 ? (
                                <Box px="$4" py="$4">
                                  <VStack space="sm" alignItems="center">
                                    <Text fontSize="$sm" color={isDark ? "#666" : "#999"}>
                                      No cameras found
                                    </Text>
                                    <Text fontSize="$xs" color={isDark ? "#555" : "#aaa"} textAlign="center">
                                      Try searching with a different name
                                    </Text>
                                  </VStack>
                                </Box>
                              ) : (
                                filteredCameras.map(camera => (
                                <Pressable
                                  key={camera.cameraId}
                                  onPress={() => {
                                    setSelectedCamera({ id: camera.cameraId, name: camera.name });
                                    setSharedCameraSearch(camera.name);
                                    setIsSharedCameraSearchActive(false);
                                  }}
                                >
                                  <HStack
                                    alignItems="center"
                                    space="md"
                                    px="$4"
                                    py="$3"
                                    borderBottomWidth="$1"
                                    borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
                                  >
                                    <Text fontSize="$lg">📷</Text>
                                    <Text fontSize="$md" color={isDark ? "#fff" : "#000"}>
                                      {camera.name}
                                    </Text>
                                  </HStack>
                                </Pressable>
                              ))
                              )}
                            </ScrollView>
                          </Box>
                        )}
                      </VStack>
                    )}
                  </Box>
                )}

              </Box>

              {/* Photos Content */}
              <FlatList
                ref={carouselRef}
                data={allBlocks}
                keyExtractor={(item) => item.cameraId}
                horizontal
                pagingEnabled
                scrollEnabled={!refreshingFriends && !isRefreshing}
                onScroll={handleScroll}
                onScrollBeginDrag={handleScrollBegin}
                onMomentumScrollEnd={(event) => {
                  handleMomentumScrollEnd(event);
                  handleScrollEnd();
                }}
                scrollEventThrottle={1}
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={true} 
                maxToRenderPerBatch={1}
                windowSize={3}
                initialNumToRender={1}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                decelerationRate="fast"
                snapToInterval={width}
                snapToAlignment="start"
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                  <Box key={`camera-${item.cameraId}`} width={width} flex={1}>
                    {renderPhotoList(item)}
                  </Box>
                )}
              />
            </Animated.View>
          </>
      </Box>

      {/* Shared Photos Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        size="full"
      >
        <ModalBackdrop bg="rgba(0,0,0,0.6)" />
        <ModalContent
          bg={isDark ? "#000" : "#fff"}
          height="100%"
          width="100%"
          borderRadius="$none"
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Enhanced Header */}
            <Box
              bg={isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)"}
              borderBottomWidth="$1"
              borderBottomColor={isDark ? "#333" : "#e5e5e5"}
              px="$6"
              py="$5"
              shadowColor="$shadowColor"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.15}
              shadowRadius={12}
            >
              <HStack alignItems="center" justifyContent="flex-start">
                {/* Friend Avatar & Info */}
                <HStack alignItems="center" space="md" flex={1}>
                  <Box
                    width={48}
                    height={48}
                    borderRadius="$full"
                    bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                    borderWidth="$2"
                    borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                    overflow="hidden"
                    shadowColor="$shadowColor"
                    shadowOffset={{ width: 0, height: 2 }}
                    shadowOpacity={0.1}
                    shadowRadius={4}
                  >
                    {selectedFriend?.profilePhotoUrl ? (
                      <ExpoImage
                        source={{ uri: selectedFriend.profilePhotoUrl }}
                        style={{ width: "100%", height: "100%", borderRadius: 22 }}
                        contentFit="cover"
                      />
                    ) : (
                      <Center flex={1}>
                        <Box
                          width="100%"
                          height="100%"
                          bg={isDark ? "$backgroundDark300" : "$backgroundLight100"}
                          justifyContent="center"
                          alignItems="center"
                        >
                          <Text fontSize="$md">👤</Text>
                        </Box>
                      </Center>
                    )}
                  </Box>
                  
                  <VStack flex={1}>
                    <Heading 
                      size="lg" 
                      color={isDark ? "#fff" : "#000"}
                      fontWeight="$bold"
                      numberOfLines={1}
                    >
                      {selectedFriend?.displayName}
                    </Heading>
                    <Text 
                      fontSize="$sm"
                      color={isDark ? "#999" : "#666"}
                      fontWeight="$medium"
                    >
                      Shared Memories
                    </Text>
                  </VStack>
                </HStack>

                {/* Close Button */}
                <Pressable
                  onPress={handleCloseModal}
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
            </Box>

            {/* Content Area */}
            <Box flex={1} bg={isDark ? "#000" : "#fff"}>
              {sharedPhotosLoading ? (
                <Box flex={1}>
                  {/* Stats Header Skeleton */}
                  <Box
                    bg={isDark ? "rgba(0,122,255,0.05)" : "rgba(0,122,255,0.05)"}
                    px="$6"
                    py="$4"
                    borderBottomWidth="$1"
                    borderBottomColor={isDark ? "#333" : "#e5e5e5"}
                  >
                    <Center>
                      <Box width={200} height={20} borderRadius={4} bg={isDark ? "#1a1a1a" : "#e0e0e0"} />
                    </Center>
                  </Box>
                  
                  {/* Photo Grid Skeleton */}
                  <PhotoGridSkeleton columns={4} />
                </Box>
              ) : sharedPhotos.length === 0 ? (
                /* Enhanced Empty State */
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  refreshControl={
                    <RefreshControl
                      refreshing={isModalRefreshing}
                      onRefresh={handleRefreshModalPhotos}
                    />
                  }
                  showsVerticalScrollIndicator={false}
                >
                  <Center flex={1}>
                    <VStack space="xl" alignItems="center" px="$8">
                      {/* Beautiful Empty Icon */}
                      <Box
                      width={120}
                      height={120}
                      borderRadius="$full"
                      bg={isDark ? "rgba(100,100,100,0.1)" : "rgba(0,0,0,0.05)"}
                      justifyContent="center"
                      alignItems="center"
                      borderWidth="$2"
                      borderColor={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
                      shadowColor="$shadowColor"
                      shadowOffset={{ width: 0, height: 12 }}
                      shadowOpacity={0.15}
                      shadowRadius={20}
                    >
                      <VStack space="xs" alignItems="center">
                        <Text fontSize={32}>📸</Text>
                        <Text fontSize={20}>✨</Text>
                      </VStack>
                    </Box>
                    
                    <VStack space="lg" alignItems="center" maxWidth={320}>
                      <VStack space="sm" alignItems="center">
                        <Heading
                          size="xl"
                          color={isDark ? "#fff" : "#000"}
                          textAlign="center"
                          fontWeight="$bold"
                        >
                          No Shared Memories Yet
                        </Heading>
                        <Text 
                          fontSize="$md"
                          textAlign="center"
                          color={isDark ? "#999" : "#666"}
                          lineHeight={24}
                          fontWeight="$medium"
                        >
                          Start creating memories together! Take photos and they'll appear here when you both have them.
                        </Text>
                      </VStack>
                      
                      {/* Call to Action */}
                      <Box
                        bg={isDark ? "rgba(0,122,255,0.1)" : "rgba(0,122,255,0.1)"}
                        borderRadius="$xl"
                        px="$6"
                        py="$4"
                        borderWidth="$1"
                        borderColor={isDark ? "rgba(0,122,255,0.3)" : "rgba(0,122,255,0.2)"}
                      >
                        <Text 
                          fontSize="$sm"
                          textAlign="center"
                          color="#007AFF"
                          fontWeight="$semibold"
                        >
                          💡 Tip: Use the camera to capture moments together
                        </Text>
                      </Box>
                    </VStack>
                  </VStack>
                </Center>
              </ScrollView>
              ) : (
                /* Enhanced Photo Grid */
                <Box flex={1}>
                  {/* Stats Header */}
                  <Box
                    bg={isDark ? "rgba(0,122,255,0.05)" : "rgba(0,122,255,0.05)"}
                    px="$6"
                    py="$4"
                    borderBottomWidth="$1"
                    borderBottomColor={isDark ? "#333" : "#e5e5e5"}
                  >
                    <HStack alignItems="center" justifyContent="center" space="xs">
                      <Text fontSize="$lg">📷</Text>
                      <Text 
                        fontSize="$md"
                        color={isDark ? "#fff" : "#000"}
                        fontWeight="$bold"
                      >
                        {sharedPhotos.length}{hasMoreFaceMatchedPhotos ? "+" : ""}
                      </Text>
                      <Text 
                        fontSize="$md"
                        color={isDark ? "#999" : "#666"}
                        fontWeight="$medium"
                      >
                        shared photo{sharedPhotos.length !== 1 ? 's' : ''} {hasMoreFaceMatchedPhotos ? "(loading more...)" : "found"}
                      </Text>
                    </HStack>
                  </Box>

                  {/* Photo Grid - 🔧 FIX: Changed to 4 photos per row */}
                  <FlatList
                    data={sharedPhotos}
                    keyExtractor={(item) => item.id}
                    numColumns={4}
                    contentContainerStyle={{ 
                      paddingHorizontal: 0,
                      paddingVertical: 0,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                      <RefreshControl
                        refreshing={isModalRefreshing}
                        onRefresh={handleRefreshModalPhotos}
                      />
                    }
                    onEndReached={hasMoreFaceMatchedPhotos ? () => {
                      console.log(`🔄 [FACE_MATCHED_INFINITE_SCROLL] Loading more face-matched photos`);
                      fetchMoreFaceMatchedPhotos();
                    } : undefined}
                    onEndReachedThreshold={0.8}
                    ListFooterComponent={
                      isFetchingMoreFaceMatchedPhotos ? (
                        <Center py="$4">
                          <Spinner size="small" color={isDark ? "$primary400" : "$primary600"} />
                        </Center>
                      ) : null
                    }
                    renderItem={({ item }) => {
                      const MODAL_PHOTOS_PER_ROW = 4;
                      const modalThumbSize = width / MODAL_PHOTOS_PER_ROW;
                      
                      return (
                        <Pressable
                          style={{
                            width: modalThumbSize,
                            height: modalThumbSize,
                            opacity: isNavigating ? 0.6 : 1,
                          }}
                          onPress={() => handleSharedPhotoPress(item.id)}
                          disabled={isNavigating}
                        >
                          <Box
                            flex={1}
                            overflow="hidden"
                            shadowColor="$shadowColor"
                            shadowOffset={{ width: 0, height: 4 }}
                            shadowOpacity={0.2}
                            shadowRadius={8}
                            borderWidth="$1"
                            borderColor={isDark ? "#333" : "#e5e5e5"}
                            bg={isDark ? "#1a1a1a" : "#f8f8f8"}
                          >
                            <ExpoImage
                              source={{ uri: item.url }}
                              style={{
                                width: "100%",
                                height: "100%",
                              }}
                              contentFit="cover"
                            />
                            
                            <Box
                              position="absolute"
                              top={0}
                              left={0}
                              right={0}
                              bottom={0}
                              bg="rgba(0,122,255,0)"
                            />
                          </Box>
                        </Pressable>
                      );
                    }}
                  />
                </Box>
              )}
            </Box>
          </SafeAreaView>
        </ModalContent>
      </Modal>
    </>
  );
}