import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  useColorScheme,
  Image,
  Animated as RNAnimated,
  Alert,
  Linking
} from "react-native";
import {
  Box,
  VStack,
  Text,
  Center,
  Spinner,
  Button,
  ButtonText,
  View
} from "@gluestack-ui/themed";
import { useLocalSearchParams, router } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from '@tanstack/react-query';
import { usePhotoAlbumData, type DetailedPhoto } from "@/src/hooks/usePhotoQueries";
import { useDeletePhoto } from "@/src/hooks/usePhotoMutations";
import { useAuth } from "@/context/AuthContext";
import { fetchAuthSession } from "aws-amplify/auth";
import { PhotoDetailSkeleton } from "@/components/SkeletonLoaders";
import { Download, Trash2, CheckCircle, Flag, MoreVertical } from "lucide-react-native";
import { usePreferencesStore } from "@/src/stores/preferencesStore";
import * as WebBrowser from "expo-web-browser";
import { photoSyncService } from "@/src/utils/icloudsync/photoSyncService";
import { showMessage } from "react-native-flash-message";
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const OVERLAY_HIDE_DELAY = 2000;

type Photo = DetailedPhoto;

interface ZoomablePhotoProps {
  photo: Photo;
  onToggleOverlay: () => void;
}

const ZoomablePhoto: React.FC<ZoomablePhotoProps> = React.memo(({ photo, onToggleOverlay }) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const isPortrait = imageDimensions ? imageDimensions.height > imageDimensions.width : false;
  const contentFitMode = isPortrait ? "cover" : "contain";

  const imageStyle = isPortrait
    ? {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }
    : {
        position: "absolute" as const,
        top: SCREEN_HEIGHT * 0.05,
        left: 0,
        right: 0,
        bottom: SCREEN_HEIGHT * 0.22,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.73,
      };

  useEffect(() => {
    Image.getSize(
      photo.url,
      (width, height) => {
        setImageDimensions({ width, height });
      },
      (error) => {
        console.warn("Failed to get image size:", error);
        setImageDimensions(null);
      }
    );
  }, [photo.url]);

  const [isZoomed, setIsZoomed] = useState(false);

  const pinchHandler = useAnimatedGestureHandler({
    onStart: () => {
      lastScale.value = scale.value;
    },
    onActive: (event: any) => {
      scale.value = Math.max(0.5, Math.min(lastScale.value * event.scale, 5));
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        lastTranslateX.value = 0;
        lastTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else if (scale.value > 1) {
        runOnJS(setIsZoomed)(true);
      } else {
        runOnJS(setIsZoomed)(false);
      }
    },
  });

  const panHandler = useAnimatedGestureHandler({
    onStart: () => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    },
    onActive: (event: any) => {
      if (scale.value > 1) {
        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;

        translateX.value = Math.max(
          -maxTranslateX,
          Math.min(maxTranslateX, lastTranslateX.value + event.translationX)
        );
        translateY.value = Math.max(
          -maxTranslateY,
          Math.min(maxTranslateY, lastTranslateY.value + event.translationY)
        );
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const resetZoom = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    lastScale.value = 1;
    lastTranslateX.value = 0;
    lastTranslateY.value = 0;
    setIsZoomed(false);
  };

  const handleDoubleTap = () => {
    if (isZoomed) {
      resetZoom();
    } else {
      scale.value = withSpring(2);
      setIsZoomed(true);
    }
  };

  return (
    <Box width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={onToggleOverlay}
        activeOpacity={1}
      >
        <PinchGestureHandler onGestureEvent={pinchHandler}>
          <Animated.View style={StyleSheet.absoluteFillObject}>
            <PanGestureHandler onGestureEvent={panHandler} shouldCancelWhenOutside enabled={isZoomed}>
              <Animated.View style={[StyleSheet.absoluteFillObject, animatedStyle]}>
                <TapGestureHandler
                  onHandlerStateChange={({ nativeEvent }) => {
                    if (nativeEvent.state === State.ACTIVE) {
                      handleDoubleTap();
                    }
                  }}
                  numberOfTaps={2}
                >
                  <Animated.View style={StyleSheet.absoluteFillObject}>
                    {imageDimensions ? (
                      <ExpoImage
                        source={{ uri: photo.url }}
                        style={imageStyle}
                        contentFit={contentFitMode}
                        transition={200}
                      />
                    ) : (
                      <>
                        <Box mb={-150}/>
                        <Center flex={1}>
                          <Spinner size="large" color="#60a5fa" />
                        </Center>
                      </>
                    )}
                  </Animated.View>
                </TapGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </TouchableOpacity>
    </Box>
  );
});

ZoomablePhoto.displayName = "ZoomablePhoto";

export default function PhotoDetail() {
  const params = useLocalSearchParams<{
    id: string;
    cameraId?: string;
    friendId?: string;
    friendGroupKey?: string;
  }>();

  const { user } = useAuth();
  const userId = user?.username;
  const queryClient = useQueryClient();

  const {
    currentPhoto,
    albumPhotos,
    currentIndex: initialIndex,
    cameraName,
    isLoadingAlbum: loading,
  } = usePhotoAlbumData(userId, params.id as string, params.cameraId, params.friendId, params.friendGroupKey);

  // Get thumbnail versions for the bottom carousel
  const {
    albumPhotos: thumbnailAlbumPhotos,
  } = usePhotoAlbumData(userId, params.id as string, params.cameraId, params.friendId, params.friendGroupKey, true);

  // Delete photo mutation
  const deletePhoto = useDeletePhoto();

  // Preferences
  const { autoSyncToDevice } = usePreferencesStore();
  
  // State
  const [showOverlay, setShowOverlay] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isOwner, setIsOwner] = useState(false);
  const [syncingPhotoIds, setSyncingPhotoIds] = useState<Set<string>>(new Set());
  const [syncedPhotoIds, setSyncedPhotoIds] = useState<Set<string>>(new Set());
  const [isInvalidatingQueries, setIsInvalidatingQueries] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const thumbnailListRef = useRef<FlatList>(null);
  const overlayOpacity = useRef(new RNAnimated.Value(1)).current;
  const dropdownAnim = useRef(new RNAnimated.Value(0)).current;
  const hideTimer = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Effects
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Load syncing and synced photo IDs and cleanup stale ones
  const loadPhotoStates = useCallback(async () => {
    try {
      // Clean up stale syncing photos first
      const stalePhotoIds = await photoSyncService.cleanupStaleSyncingPhotos(60000);
      
      // Get current syncing and synced state from service
      const [syncingPhotoIds, syncedPhotoIds] = await Promise.all([
        photoSyncService.getSyncingPhotoIds(),
        photoSyncService.getSyncedPhotoIds()
      ]);
      
      setSyncingPhotoIds(syncingPhotoIds);
      setSyncedPhotoIds(syncedPhotoIds);
      
      // Log cleanup if any stale photos were found
      if (stalePhotoIds.length > 0) {
        console.log(`Cleaned up ${stalePhotoIds.length} stale syncing photos:`, stalePhotoIds);
      }
    } catch (error) {
      console.warn('Failed to load photo states:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPhotoStates();
  }, [loadPhotoStates]);

  // Listen for query invalidations to refresh sync state
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey) {
        const queryKey = event.query.queryKey;
        const [firstKey, secondKey] = queryKey;
        
        // Check if it's a photo-related query that was invalidated
        const isPhotoQuery = (
          (firstKey === 'myPhotos' && secondKey === userId) ||
          (firstKey === 'userCameras' && secondKey === userId) ||
          (firstKey === 'infiniteMultiSharedCameraPhotos' && secondKey === userId) ||
          (firstKey === 'sharedPhotos' && secondKey === userId) ||
          (firstKey === 'photoRecipients' && secondKey === userId) ||
          firstKey === 'sharedCameraPhotos' ||
          firstKey === 'infiniteSingleSharedCameraPhotos' ||
          firstKey === 'cameraPhotos'
        );
        
        if (isPhotoQuery && !isInvalidatingQueries) {
          console.log('📸 Photo query invalidated, refreshing sync state');
          loadPhotoStates();
        }
      }
    });

    return () => unsubscribe();
  }, [userId, queryClient, loadPhotoStates, isInvalidatingQueries]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      StatusBar.setBarStyle("light-content");
      
      // Refresh sync state when page comes into focus
      loadPhotoStates();
      
      return () => {
        StatusBar.setHidden(false);
        StatusBar.setBarStyle("default");
      };
    }, [loadPhotoStates])
  );

  useEffect(() => {
    if (albumPhotos.length > 0 && initialIndex >= 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [albumPhotos.length, initialIndex]);

  // Auto-scroll thumbnail strip on currentIndex change
  useEffect(() => {
    if (thumbnailListRef.current && albumPhotos.length > 0) {
      thumbnailListRef.current.scrollToIndex({
        index: currentIndex,
        animated: true,
        viewPosition: 0.5, // center thumbnail
      });
    }
  }, [currentIndex, albumPhotos.length]);

  useEffect(() => {
    startHideTimer();
    return clearHideTimer;
  }, []);

  // Timer functions
  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const startHideTimer = () => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      hideOverlay();
    }, OVERLAY_HIDE_DELAY);
  };

  const hideOverlay = () => {
    if (!showOverlay) return;

    // Close dropdown menu with animation when hiding overlay
    if (showActionSheet) {
      RNAnimated.timing(dropdownAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowActionSheet(false);
      });
    }

    setShowOverlay(false);
    RNAnimated.timing(overlayOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const displayOverlay = () => {
    if (showOverlay) return;

    setShowOverlay(true);
    RNAnimated.timing(overlayOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    startHideTimer();
  };

  const toggleOverlay = useCallback(() => {
    clearHideTimer();

    // If menu is open, close it first before toggling overlay
    if (showActionSheet) {
      RNAnimated.timing(dropdownAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowActionSheet(false);
      });
    }

    if (showOverlay) {
      hideOverlay();
    } else {
      displayOverlay();
    }
  }, [showOverlay, showActionSheet, dropdownAnim]);

  // Handlers
  const handleMomentumScrollEnd = useCallback(
    (event: any) => {
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffsetX / SCREEN_WIDTH);

      if (index !== currentIndex && index >= 0 && index < albumPhotos.length) {
        setCurrentIndex(index);
      }

      // Reset programmatic scroll flag
      isProgrammaticScroll.current = false;
    },
    [currentIndex, albumPhotos.length]
  );

  // Helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  // Renderers
  const renderPhoto = useCallback(
    ({ item }: { item: Photo }) => <ZoomablePhoto photo={item} onToggleOverlay={toggleOverlay} />,
    [toggleOverlay]
  );

  const currentPhotoData = albumPhotos[currentIndex] || currentPhoto;
  const isCurrentPhotoSyncing = currentPhotoData ? syncingPhotoIds.has(currentPhotoData.id) : false;
  const isCurrentPhotoSynced = currentPhotoData ? syncedPhotoIds.has(currentPhotoData.id) : false;

  // Check if current user owns this photo
  useEffect(() => {
    const checkOwnership = async () => {
      if (!currentPhotoData) {
        setIsOwner(false);
        return;
      }
      
      try {
        const { identityId } = await fetchAuthSession();
        const owns = identityId === currentPhotoData.ownerIdentityId;
        setIsOwner(owns);
      } catch (error) {
        console.error("Failed to check photo ownership:", error);
        setIsOwner(false);
      }
    };
    
    checkOwnership();
  }, [currentPhotoData]);

  // Save to camera roll handler
  const handleSaveToAlbum = useCallback(async () => {
    if (!currentPhotoData || !userId || isCurrentPhotoSyncing) return;
    
    const photoToSave = currentPhotoData;
    const photoId = photoToSave.id;
    
    // Prevent double-clicks and concurrent downloads of same photo
    if (syncingPhotoIds.has(photoId)) return;
    
    // Update UI immediately to show syncing state
    setSyncingPhotoIds(prev => new Set(prev).add(photoId));
    
    // Start background sync
    (async () => {
      try {
        console.log(`📥 Starting download for photo ${photoToSave.id}`);
        
        const assetId = await photoSyncService.savePhotoToAlbumWithTracking(
          photoId,
          photoToSave.s3Key,
          photoToSave.ownerIdentityId,
          {
            title: `Shared Event: ${cameraName || 'Photo'}`,
            description: `Photo from PhomoCam`,
          }
        );
        
        console.log(`📱 Photo ${photoToSave.id} saved to album with asset ID: ${assetId}`);
        
        // Update component state to remove from syncing and add to synced
        setSyncingPhotoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(photoId);
          return newSet;
        });
        
        setSyncedPhotoIds(prev => {
          const newSet = new Set(prev);
          newSet.add(photoId);
          return newSet;
        });
        
        // Show success flash message
        showMessage({
          message: "Photo saved to camera roll!",
          type: "success",
          duration: 3000,
        });
        
        // Invalidate all photo-related queries to prevent duplicate downloads
        // Copy the same list that app/_layout.tsx listens for
        // Use flag to prevent query invalidation loops
        setIsInvalidatingQueries(true);
        if (userId) {
          queryClient.invalidateQueries({ queryKey: ['myPhotos', userId] });
          queryClient.invalidateQueries({ queryKey: ['userCameras', userId] });
          queryClient.invalidateQueries({ queryKey: ['infiniteMultiSharedCameraPhotos', userId] });
          queryClient.invalidateQueries({ queryKey: ['sharedPhotos', userId] });
          queryClient.invalidateQueries({ queryKey: ['photoRecipients', userId] });
        }
        // These don't need userId but still need invalidation
        queryClient.invalidateQueries({ queryKey: ['sharedCameraPhotos'] });
        queryClient.invalidateQueries({ queryKey: ['infiniteSingleSharedCameraPhotos'] });
        queryClient.invalidateQueries({ queryKey: ['cameraPhotos'] });
        setIsInvalidatingQueries(false);
        
      } catch (error) {
        console.error("Failed to save photo to album:", error);
        
        // Remove from syncing state on error
        setSyncingPhotoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(photoId);
          return newSet;
        });
        
        // Handle different error types with appropriate user feedback
        const errorMessage = String(error);
        
        if (errorMessage.includes('permission') || errorMessage.includes('Permission') || errorMessage.includes('denied')) {
          Alert.alert(
            "Permission Required", 
            "Please allow photo library access in Settings to save photos.",
            [
              { text: "Cancel", style: "cancel" },
              { 
                text: "Settings", 
                onPress: () => Linking.openSettings()
              }
            ]
          );
        } else if (errorMessage.includes('queue full') || errorMessage.includes('Download queue full')) {
          Alert.alert(
            "Too Many Downloads", 
            "Please wait for current downloads to finish before starting new ones.",
            [{ text: "OK", style: "default" }]
          );
        } else if (errorMessage.includes('sync already in progress')) {
          // This shouldn't happen with proper state management, but handle it gracefully
          console.log('Sync collision detected - refreshing state');
          loadPhotoStates(); // Refresh state to get accurate sync status
        } else if (errorMessage.includes('timeout')) {
          Alert.alert(
            "Download Timeout", 
            "The photo download took too long. Please check your connection and try again.",
            [{ text: "OK", style: "default" }]
          );
        }
        // Other errors fail silently - user will see button return to blue state
      }
    })();
    
  }, [currentPhotoData, userId, isCurrentPhotoSyncing, cameraName, syncingPhotoIds, queryClient, loadPhotoStates]);

  // Delete photo handler
  const handleDeletePhoto = useCallback(() => {
    if (!currentPhotoData || !userId) return;
    
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePhoto.mutateAsync({
                photoId: currentPhotoData.id,
                s3Key: currentPhotoData.s3Key,
                ownerIdentityId: currentPhotoData.ownerIdentityId,
                sharedCameraId: currentPhotoData.sharedCameraId,
                _version: currentPhotoData._version,
              });
              
              // Clean up synced state for this photo using photoSyncService
              const photoId = currentPhotoData.id;
              
              // Update component state immediately
              setSyncingPhotoIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(photoId);
                return newSet;
              });
              
              // Clean up storage in background
              photoSyncService.removePhotoFromSyncState(photoId).catch(error => {
                console.warn('Failed to cleanup photo sync state:', error);
              });
              
              // Navigate back after successful deletion
              router.back();
            } catch (error) {
              console.error("Failed to delete photo:", error);
              // Error is already handled by the mutation's onError
            }
          },
        },
      ]
    );
  }, [currentPhotoData, userId, deletePhoto, router]);

  // Menu handlers
  const handleMenuPress = useCallback(() => {
    if (showActionSheet) {
      // Close dropdown
      RNAnimated.timing(dropdownAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowActionSheet(false);
      });
    } else {
      // Open dropdown
      setShowActionSheet(true);
      RNAnimated.timing(dropdownAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showActionSheet, dropdownAnim]);

  const handleReportPhoto = useCallback(() => {
    RNAnimated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowActionSheet(false);
      
      // Collect photo metadata for reporting
      const photoData = currentPhotoData || currentPhoto;
      const metadata = {
        photoId: photoData?.id || 'unknown',
        cameraId: params.cameraId || 'none',
        s3Key: photoData?.s3Key || 'unknown',
        createdAt: photoData?.createdAt || 'unknown',
        source: params.cameraId ? 'shared_camera' : (params.friendId ? 'face_match' : (params.friendGroupKey ? 'friend_group' : 'unknown')),
        reportedAt: new Date().toISOString()
      };
      
      // Create detailed subject and metadata with locked subject
      const subject = "Report%20Inappropriate%20Photo"; // URL encoded and locked
      const metadataString = encodeURIComponent(`Photo Details:
• Photo ID: ${metadata.photoId}
• Source: ${metadata.source}
• Event ID: ${metadata.cameraId}
• S3 Key: ${metadata.s3Key}
• Upload date: ${metadata.createdAt}
• Reported at: ${metadata.reportedAt}`);
      
      const url = `https://phomo.camera/support?from=app&subject=${subject}&metadata=${metadataString}&lock_subject=true`;
      WebBrowser.openBrowserAsync(url);
    });
  }, [dropdownAnim, currentPhotoData, currentPhoto, params]);

  const handleMenuDeletePhoto = useCallback(() => {
    RNAnimated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowActionSheet(false);
      handleDeletePhoto();
    });
  }, [handleDeletePhoto, dropdownAnim]);

  const handleMenuSavePhoto = useCallback(() => {
    RNAnimated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowActionSheet(false);
      handleSaveToAlbum();
    });
  }, [handleSaveToAlbum, dropdownAnim]);

  // Early returns for loading/error
  if (loading) {
    return <PhotoDetailSkeleton />;
  }

  if (!currentPhoto || albumPhotos.length === 0) {
    return (
      <Center flex={1} bg="$black" px="$6">
        <VStack space="xl" alignItems="center">
          <Box
            width={80}
            height={80}
            borderRadius="$full"
            bg="rgba(255,255,255,0.1)"
            justifyContent="center"
            alignItems="center"
          >
            <Text fontSize="$3xl">📷</Text>
          </Box>

          <VStack space="lg" alignItems="center">
            <Text color="$white" fontSize="$xl" fontWeight="$semibold" textAlign="center">
              Photo Not Found
            </Text>

            <Text color="rgba(255,255,255,0.7)" fontSize="$md" textAlign="center">
              The photo you're looking for doesn't exist or has been removed.
            </Text>
          </VStack>

          <Button
            bg="rgba(255,255,255,0.2)"
            borderRadius="$lg"
            px="$6"
            h={48}
            onPress={() => router.back()}
            $pressed={{ bg: "rgba(255,255,255,0.3)" }}
          >
            <ButtonText color="$white" fontWeight="$semibold">
              Go Back
            </ButtonText>
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Box style={StyleSheet.absoluteFillObject} bg={isDark ? "$black" : "$white"}>
      {/* Top Metadata Bar */}
      <RNAnimated.View
        style={[styles.topBar, { opacity: overlayOpacity }]}
        pointerEvents={showOverlay ? "auto" : "none"}
      >
        <VStack alignItems="center" space="sm" flex={1}>
          <Text color="$white" fontSize="$md" fontWeight="bold">
            {currentIndex + 1} of {albumPhotos.length}
          </Text>
          {cameraName && (
            <Text color="#60a5fa" fontSize="$sm" fontWeight="semibold">
              📷 {cameraName}
            </Text>
          )}
          <Text color="rgba(255,255,255,0.9)" fontSize="$sm" fontWeight="medium">
            {formatDate(currentPhotoData.createdAt)}
          </Text>
        </VStack>

        {/* Sync Status Indicator - Left side */}
        {isCurrentPhotoSynced && (
          <View
            style={{
              position: "absolute",
              left: 15,
              top: "50%",
              transform: [{ translateY: -12 }],
              backgroundColor: "rgba(34, 197, 94, 0.9)",
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3,
            }}
          >
            <CheckCircle size={20} color="white" />
          </View>
        )}

        {/* Three Dots Menu with Dropdown - Right side */}
        <View style={{ position: "absolute", right: 15, top: "50%", transform: [{ translateY: -12 }] }}>
          <TouchableOpacity
            onPress={handleMenuPress}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3,
            }}
            activeOpacity={0.8}
          >
            <MoreVertical size={20} color="white" />
          </TouchableOpacity>

          {/* Dropdown Menu */}
          {showActionSheet && (
            <RNAnimated.View
              style={{
                position: "absolute",
                top: 65,
                right: -5,
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
                opacity: dropdownAnim,
                transform: [
                  {
                    scale: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                  {
                    translateY: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              }}
            >
              {/* Save to Camera Roll - Only show when auto sync is off */}
              {!autoSyncToDevice && (
                <TouchableOpacity
                  onPress={handleMenuSavePhoto}
                  disabled={isCurrentPhotoSyncing || deletePhoto.isPending}
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
                  <Download 
                    size={20} 
                    color={
                      (isCurrentPhotoSyncing || deletePhoto.isPending) 
                        ? "#999" 
                        : "#3b82f6"
                    } 
                  />
                </TouchableOpacity>
              )}

              {/* Report Photo */}
              {!isOwner && (
                <TouchableOpacity
                  onPress={handleReportPhoto}
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
              )}

              {/* Delete Photo - Only show for photo owners */}
              {isOwner && (
                <TouchableOpacity
                  onPress={handleMenuDeletePhoto}
                  disabled={deletePhoto.isPending || isCurrentPhotoSyncing}
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
                  <Trash2 
                    size={20} 
                    color={
                      (deletePhoto.isPending || isCurrentPhotoSyncing) 
                        ? "#999" 
                        : "#dc2626"
                    } 
                  />
                </TouchableOpacity>
              )}
            </RNAnimated.View>
          )}
        </View>
      </RNAnimated.View>

      {/* Main Photo Gallery */}
      <FlatList
        ref={flatListRef}
        data={albumPhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        initialScrollIndex={initialIndex}
        onScrollToIndexFailed={(info) => {
          console.warn("Main photo scroll to index failed:", info);
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: Math.min(info.index, albumPhotos.length - 1),
              animated: false,
            });
          });
        }}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
      />

      {/* Thumbnail Preview Strip */}
      {albumPhotos.length > 1 && (
        <RNAnimated.View
          style={[styles.thumbnailContainer, { opacity: overlayOpacity }]}
          pointerEvents={showOverlay ? "auto" : "none"}
        >
          <FlatList
            ref={thumbnailListRef}
            data={thumbnailAlbumPhotos}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            getItemLayout={(_, index) => ({
              length: 50 + 12,
              offset: (50 + 12) * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              console.warn("Thumbnail scroll to index failed:", info);
              const wait = new Promise((resolve) => setTimeout(resolve, 500));
              wait.then(() => {
                thumbnailListRef.current?.scrollToIndex({
                  index: Math.min(info.index, thumbnailAlbumPhotos.length - 1),
                  animated: true,
                });
              });
            }}
            renderItem={({ item, index }) => {
              const isActive = index === currentIndex;
              return (
                <TouchableOpacity
                  onPress={() => {
                    isProgrammaticScroll.current = true;
                    setCurrentIndex(index);
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.thumbnailWrapper,
                    isActive && styles.activeThumbnailWrapper,
                  ]}
                >
                  <ExpoImage
                    source={{ uri: item.url }}
                    style={[
                      styles.thumbnailImage,
                      isActive && styles.activeThumbnailImage,
                    ]}
                    contentFit="cover"
                    transition={200}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </RNAnimated.View>
      )}
    </Box>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginHorizontal: 20,
    alignSelf: "center",
  },

  thumbnailContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
  },

  thumbnailWrapper: {
    marginHorizontal: 6,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },

  activeThumbnailWrapper: {
    borderColor: "#60a5fa",
    borderWidth: 2,
  },

  thumbnailImage: {
    width: 50,
    height: 70,
  },

  activeThumbnailImage: {
    opacity: 1,
  },
});
