import React, { useCallback, useRef } from "react";
import { Pressable, useColorScheme } from "react-native";
import { Box } from "@gluestack-ui/themed";
import { CachedImage } from '@georstat/react-native-image-cache';
import { useRouter } from "expo-router";

export interface Photo {
  id: string;
  url: string;
  cameraId?: string;
  friendGroupKey?: string;
}

export interface OptimizedPhotoItemProps {
  photo: Photo;
  thumbSize: number;
  columnIndex: number;
  onPress?: (photo: Photo) => void;
  recyclingKey?: string;
}

/**
 * High-performance photo component using cached images
 * URLs are pre-cached by usePhotoQueries with SQLite for instant display
 * Uses thumbnail URLs for grid views, CachedImage for additional file caching
 */
const OptimizedPhotoItemComponent: React.FC<OptimizedPhotoItemProps> = ({
  photo,
  thumbSize,
  columnIndex,
  onPress,
  recyclingKey,
}) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isNavigating = useRef(false);

  // Handle press with navigation
  const handlePress = useCallback(() => {
    // Prevent double navigation
    if (isNavigating.current) return;
    isNavigating.current = true;
    
    // Reset after a delay
    setTimeout(() => {
      isNavigating.current = false;
    }, 1000);
    
    if (onPress) {
      onPress(photo);
      return;
    }

    // Default navigation logic based on photo context
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
  }, [photo, onPress, router]);

  return (
    <Pressable
      style={{
        width: thumbSize,
        height: thumbSize,
      }}
      onPress={handlePress}
      android_ripple={{ color: "rgba(255,255,255,0.1)" }}
    >
      <Box
        flex={1}
        overflow="hidden"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 2 }}
        shadowOpacity={0.15}
        shadowRadius={6}
        borderWidth="$1"
        borderColor={isDark ? "$borderDark700" : "$borderLight200"}
        borderRadius="$sm"
      >
        <CachedImage
          key={`${photo.id}-${photo.url}`}
          source={photo.url}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: isDark ? "#1a1a1a" : "#f5f5f5", // Fallback background
          }}
          resizeMode="cover"
          sourceAnimationDuration={0}
          thumbnailAnimationDuration={0}
          loadingImageStyle={{
            width: "100%",
            height: "100%",
            backgroundColor: isDark ? "#2a2a2a" : "#e5e5e5", // Lighter loading color
          }}
          imageStyle={{
            width: "100%",
            height: "100%",
          }}
          onError={() => {
            console.warn(`❌ [CACHED_IMAGE_ERROR] Failed to load image ${photo.id}`);
            console.warn(`❌ [CACHED_IMAGE_ERROR] Photo URL:`, photo.url);
            console.warn(`❌ [CACHED_IMAGE_ERROR] Camera ID:`, photo.cameraId);
          }}
          onLoad={() => {
            // Image loaded successfully
          }}
          testID={`photo-${photo.id}`}
        />
      </Box>
    </Pressable>
  );
};

/**
 * Smart comparison function for React.memo
 * Only re-renders if photo ID, URL, or size changes
 */
const arePropsEqual = (
  prevProps: OptimizedPhotoItemProps,
  nextProps: OptimizedPhotoItemProps
): boolean => {
  // Photo ID is the primary key - if it changes, always re-render
  if (prevProps.photo.id !== nextProps.photo.id) {
    return false;
  }

  // URL change means different image
  if (prevProps.photo.url !== nextProps.photo.url) {
    return false;
  }

  // Size change affects layout
  if (prevProps.thumbSize !== nextProps.thumbSize) {
    return false;
  }

  // Column index change affects styling
  if (prevProps.columnIndex !== nextProps.columnIndex) {
    return false;
  }

  // Recycling key change affects memory management
  if (prevProps.recyclingKey !== nextProps.recyclingKey) {
    return false;
  }

  // Context changes that affect navigation
  if (
    prevProps.photo.cameraId !== nextProps.photo.cameraId ||
    prevProps.photo.friendGroupKey !== nextProps.photo.friendGroupKey
  ) {
    return false;
  }

  // All important props are the same - skip re-render
  return true;
};

// Export memoized component with custom comparison
export const OptimizedPhotoItem = React.memo(
  OptimizedPhotoItemComponent,
  arePropsEqual
);

export default OptimizedPhotoItem;