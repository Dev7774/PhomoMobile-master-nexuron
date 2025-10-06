import React from 'react';
import { View, useColorScheme, Dimensions } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const FriendItemSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ 
      backgroundColor: isDark ? '#1a1a1a' : '#f8f8f8',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? '#333' : '#e5e5e5',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        borderRadius={12}
      >
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
        }}>
          <View style={{ width: 60, height: 60, borderRadius: 30 }} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ width: '60%', height: 20, borderRadius: 4 }} />
            <View style={{ width: '40%', height: 14, borderRadius: 4, marginTop: 6 }} />
          </View>
        </View>
      </SkeletonPlaceholder>
    </View>
  );
};

export const FriendsListSkeleton = ({ count = 4 }: { count?: number }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <FriendItemSkeleton key={index} />
      ))}
    </View>
  );
};

export const PhotoGridSkeleton = ({ columns = 3, extraRow = false }: { columns?: number, extraRow?: boolean }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // Match the loaded state: square touching photos with thin borders between them
  const itemSize = screenWidth / columns;
  const itemCount = extraRow ? 16 : 12;
  
  return (
    <View style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap',
      // No padding to match loaded state
      padding: 0,
    }}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <View 
          key={index}
          style={{ 
            width: itemSize, 
            height: itemSize, 
            borderWidth: 0.5,
            borderColor: isDark ? '#333' : '#e0e0e0',
            // No border radius to match loaded photos
            borderRadius: 0 
          }} 
        >
          <SkeletonPlaceholder
            backgroundColor={isDark ? '#1a1a1a' : '#e0e0e0'}
            highlightColor={isDark ? '#2a2a2a' : '#f0f0f0'}
          >
            <View style={{ 
              width: '100%', 
              height: '100%'
            }} />
          </SkeletonPlaceholder>
        </View>
      ))}
    </View>
  );
};

export const CameraItemSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ 
      backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? '#333' : '#e5e5e5',
    }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        borderRadius={12}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: '60%', height: 18, borderRadius: 4, marginBottom: 8 }} />
          <View style={{ width: '40%', height: 14, borderRadius: 4, marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 70, height: 36, borderRadius: 8 }} />
            <View style={{ width: 100, height: 36, borderRadius: 8 }} />
          </View>
        </View>
      </SkeletonPlaceholder>
    </View>
  );
};

export const CameraListSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <CameraItemSkeleton key={index} />
      ))}
    </View>
  );
};

export const CameraMemberSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ 
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333' : '#e5e5e5',
    }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        borderRadius={12}
      >
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Left side: Photo + Name */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <View style={{ width: '70%', height: 18, borderRadius: 4, marginBottom: 4 }} />
              <View style={{ width: '50%', height: 14, borderRadius: 4 }} />
            </View>
          </View>
          {/* Right side: Role badge */}
          <View style={{ width: 60, height: 24, borderRadius: 12 }} />
        </View>
      </SkeletonPlaceholder>
    </View>
  );
};

export const CameraMembersSkeleton = ({ count = 4 }: { count?: number }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ flex: 1 }}>
      {/* Header Skeleton */}
      <View style={{
        paddingTop: 24,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#333' : '#e5e5e5',
      }}>
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 180, height: 28, borderRadius: 4, marginBottom: 8 }} />
            <View style={{ width: 80, height: 16, borderRadius: 4 }} />
          </View>
        </SkeletonPlaceholder>
        
        {/* Share button positioned absolutely on the right */}
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          <View style={{
            position: 'absolute',
            right: 8,
            top: -34, // Adjust to align with title
            width: 70,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isDark ? '#333' : '#e5e5e5',
          }} />
        </SkeletonPlaceholder>
      </View>
      
      {/* Members List Skeleton */}
      <View style={{ flex: 1 }}>
        {Array.from({ length: count }).map((_, index) => (
          <CameraMemberSkeleton key={index} />
        ))}
      </View>
    </View>
  );
};

export const UserSearchItemSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ 
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333' : '#e5e5e5',
    }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        borderRadius={12}
      >
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
        }}>
          {/* Checkbox placeholder */}
          <View style={{ width: 20, height: 20, borderRadius: 4, marginRight: 12 }} />
          {/* Profile Photo */}
          <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
          {/* User Info */}
          <View style={{ flex: 1 }}>
            <View style={{ width: '70%', height: 20, borderRadius: 4, marginBottom: 4 }} />
            <View style={{ width: '50%', height: 14, borderRadius: 4 }} />
          </View>
        </View>
      </SkeletonPlaceholder>
    </View>
  );
};

export const FriendSearchItemSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ 
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333' : '#e5e5e5',
    }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        borderRadius={12}
      >
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
        }}>
          {/* Profile Photo */}
          <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
          {/* User Name */}
          <View style={{ flex: 1 }}>
            <View style={{ width: '70%', height: 20, borderRadius: 4 }} />
          </View>
        </View>
      </SkeletonPlaceholder>
    </View>
  );
};

export const UserSearchSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <UserSearchItemSkeleton key={index} />
      ))}
    </View>
  );
};

export const FriendSearchSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <FriendSearchItemSkeleton key={index} />
      ))}
    </View>
  );
};

export const CameraCardSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <SkeletonPlaceholder
      backgroundColor={isDark ? '#1a1a1a' : '#e0e0e0'}
      highlightColor={isDark ? '#2a2a2a' : '#f0f0f0'}
      borderRadius={12}
    >
      <View style={{ 
        width: screenWidth - 32,
        marginHorizontal: 16,
        marginBottom: 16,
      }}>
        <View style={{ 
          height: 200, 
          borderRadius: 12,
          marginBottom: 12
        }} />
        <View style={{ paddingHorizontal: 8 }}>
          <View style={{ width: '70%', height: 24, borderRadius: 4 }} />
          <View style={{ width: '50%', height: 16, borderRadius: 4, marginTop: 8 }} />
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ))}
          </View>
        </View>
      </View>
    </SkeletonPlaceholder>
  );
};

export const AlbumCarouselSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <SkeletonPlaceholder
      backgroundColor={isDark ? '#1a1a1a' : '#e0e0e0'}
      highlightColor={isDark ? '#2a2a2a' : '#f0f0f0'}
    >
      <View style={{ padding: 16 }}>
        <View style={{ width: 120, height: 20, borderRadius: 4, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ 
              width: 120, 
              height: 120, 
              borderRadius: 8 
            }} />
          ))}
        </View>
      </View>
    </SkeletonPlaceholder>
  );
};

export const FacePreviewSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
      >
        {/* Header */}
        <View style={{
          paddingTop: 24,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#333' : '#e5e5e5',
          alignItems: 'center'
        }}>
          <View style={{ width: 180, height: 28, borderRadius: 4 }} />
        </View>

        {/* Detection Results Box */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          marginBottom: 16,
          padding: 16,
          backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDark ? '#333' : '#e5e5e5',
          alignItems: 'center'
        }}>
          <View style={{ width: 160, height: 24, borderRadius: 4, marginBottom: 12 }} />
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ width: 100, height: 20, borderRadius: 4 }} />
            <View style={{ width: 120, height: 20, borderRadius: 4 }} />
          </View>
        </View>

        {/* Photo Preview */}
        <View style={{
          alignSelf: 'center',
          marginHorizontal: 20,
          marginBottom: 8,
          width: 250,
          height: 200,
          borderRadius: 12
        }} />

        {/* Share With Header */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 12,
          alignItems: 'center'
        }}>
          <View style={{ width: 120, height: 24, borderRadius: 4 }} />
        </View>
      </SkeletonPlaceholder>

      {/* Share With List */}
      <View style={{ 
        marginHorizontal: 20, 
        height: 150,
        backgroundColor: isDark ? '#1a1a1a' : '#f8f8f8',
        borderRadius: 12,
        marginBottom: 16
      }}>
        <UserSearchSkeleton count={3} />
      </View>

      {/* Share Button */}
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
      >
        <View style={{
          marginHorizontal: 20,
          marginTop: 8,
          marginBottom: 16,
          height: 56,
          borderRadius: 12
        }} />
      </SkeletonPlaceholder>
    </View>
  );
};

export const AlbumFriendsCarouselSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
      paddingTop: 12,
      paddingBottom: 12,
    }}>
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
      >
        {/* Friends carousel header */}
        <View style={{ paddingHorizontal: 26, marginBottom: 8 }}>
          <View style={{ width: 120, height: 20, borderRadius: 4 }} />
        </View>
        
        {/* Horizontal friends list */}
        <View style={{ 
          flexDirection: 'row', 
          paddingHorizontal: 8,
          gap: 8
        }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={{
              alignItems: 'center',
              marginHorizontal: 4,
              maxWidth: 100,
            }}>
              {/* Friend avatar */}
              <View style={{ 
                width: 88, 
                height: 88, 
                borderRadius: 44,
                marginBottom: 4
              }} />
              {/* Friend name */}
              <View style={{ 
                width: 80, 
                height: 16, 
                borderRadius: 4 
              }} />
            </View>
          ))}
        </View>
      </SkeletonPlaceholder>
    </View>
  );
};

export const AlbumDraggableCarouselSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const screenHeight = Dimensions.get('window').height;
  const COLLAPSED_HEIGHT = screenHeight * 0.48;
  const EXPANDED_HEIGHT = screenHeight * 0.85;
  const DRAG_HANDLE_HEIGHT = Math.min(Math.max(38, screenHeight * 0.04), 50);
  
  return (
    <View style={{
      height: EXPANDED_HEIGHT,
      backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.98)',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      position: 'absolute',
      bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
      left: 0,
      right: 0,
    }}>
      {/* Camera Section with Drag Handle */}
      <View style={{
        backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        paddingTop: 8,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}>
        {/* Drag Handle Area */}
        <View style={{
          minHeight: DRAG_HANDLE_HEIGHT + 16,
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 2,
          paddingHorizontal: 12,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingHorizontal: 15, // Move elements left
            marginBottom: 8, // Move elements down
          }}>
            {/* Camera name */}
            <SkeletonPlaceholder
              backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
              highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
            >
              <View style={{
                width: 200,
                height: 28,
                borderRadius: 4,
                marginTop: 6, // Move up slightly
              }} />
            </SkeletonPlaceholder>
            
            {/* Dots indicator */}
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 10, // Move up slightly
              position: 'relative',
              flexDirection: 'row',
            }}>
              <SkeletonPlaceholder
                backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
                highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4 }} />
                </View>
              </SkeletonPlaceholder>
            </View>
          </View>
        </View>
        
        {/* Spacer to match loaded state positioning */}
        <View style={{ marginTop: -20 }} />
        
        {/* Divider */}
        <View style={{
          height: 0.5,
          marginHorizontal: 20,
          marginVertical: 2,
          backgroundColor: isDark ? '#333' : '#e5e5e5',
        }} />
        
        {/* Search Bar Section */}
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 2,
          paddingBottom: 4,
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        }}>
          <SkeletonPlaceholder
            backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
            highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
          >
            <View style={{
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#e5e5e5',
            }} />
          </SkeletonPlaceholder>
        </View>
      </View>
      
      {/* Photo Grid */}
      <View style={{ flex: 1, marginTop: 1 }}>
        <PhotoGridSkeleton columns={4} extraRow={true} />
      </View>
    </View>
  );
};

export const AlbumMainSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const screenHeight = Dimensions.get('window').height;
  
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      {/* Search bar */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
      }}>
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          <View style={{
            backgroundColor: isDark ? '#000' : '#fff',
            paddingTop: 13,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}>
            <View style={{
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#ccc',
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
            }} />
          </View>
        </SkeletonPlaceholder>
      </View>

      {/* Friends carousel */}
      <View style={{
        position: 'absolute',
        top: screenHeight * 0.08,
        height: Math.min(Math.max(200, screenHeight * 0.2), 220) + 20,
        left: 0,
        right: 0,
        marginTop: 25,
        zIndex: 1,
      }}>
        <AlbumFriendsCarouselSkeleton />
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Main photo carousel */}
      <AlbumDraggableCarouselSkeleton />
    </View>
  );
};

// Me page specific skeletons
export const MeProfileHeaderSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <SkeletonPlaceholder
      backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
      highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
    >
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ alignItems: 'center' }}>
          {/* Profile Photo */}
          <View style={{ 
            width: 120, 
            height: 120, 
            borderRadius: 60, 
            marginBottom: 12 
          }} />
          
          {/* Username */}
          <View style={{ 
            width: 150, 
            height: 24, 
            borderRadius: 4, 
            marginBottom: 12 
          }} />
          
          {/* Stats Section */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginTop: 6,
            paddingHorizontal: 4,
            marginLeft: 4,
            width: '100%'
          }}>
            {/* Total */}
            <View style={{ alignItems: 'center', minWidth: 45 }}>
              <View style={{ width: 30, height: 20, borderRadius: 4, marginBottom: 4 }} />
              <View style={{ width: 35, height: 12, borderRadius: 4 }} />
            </View>
            {/* Face-match */}
            <View style={{ alignItems: 'center', minWidth: 40 }}>
              <View style={{ width: 25, height: 16, borderRadius: 4, marginBottom: 4 }} />
              <View style={{ width: 70, height: 10, borderRadius: 4 }} />
            </View>
            {/* Cameras */}
            <View style={{ alignItems: 'center', minWidth: 40 }}>
              <View style={{ width: 25, height: 16, borderRadius: 4, marginBottom: 4 }} />
              <View style={{ width: 50, height: 10, borderRadius: 4 }} />
            </View>
          </View>
        </View>
        
        {/* Manual Sync Button Skeleton */}
        <View style={{ marginLeft: -4, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ 
              width: 140, 
              height: 20,
              borderRadius: 20,
              marginBottom: 25,
              paddingHorizontal: 6
            }} />
          </View>
        </View>
      </View>
    </SkeletonPlaceholder>
  );
};

export const MeDraggableCarouselSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const screenHeight = Dimensions.get('window').height;
  const COLLAPSED_HEIGHT = screenHeight * 0.482;
  const EXPANDED_HEIGHT = screenHeight * 0.78;
  const DRAG_HANDLE_HEIGHT = Math.min(Math.max(38, screenHeight * 0.04), 50);
  
  return (
    <View style={{
      height: EXPANDED_HEIGHT,
      backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.98)',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      position: 'absolute',
      bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
      left: 0,
      right: 0,
    }}>
      {/* Friends/Events Header */}
      <View style={{
        backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        paddingTop: 8,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}>
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          {/* Friends/Events Title */}
          <View style={{
            minHeight: DRAG_HANDLE_HEIGHT + 16,
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: 0,
            paddingBottom: 12,
            paddingHorizontal: 12,
          }}>
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              paddingHorizontal: 16,
            }}>
              <View style={{ width: 140, height: 28, borderRadius: 4 }} />
            </View>
          </View>
        </SkeletonPlaceholder>

        {/* Spacer */}
        <View style={{ marginBottom: -15 }} />

        {/* Divider */}
        <View style={{
          height: 0.5,
          marginHorizontal: 20,
          backgroundColor: isDark ? '#333' : '#e5e5e5',
        }} />
      </View>
      
      {/* Activity Items List */}
      <View style={{ flex: 1, padding: 16 }}>
        {/* Activity Items Skeleton */}
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={{
            backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isDark ? '#333' : '#e5e5e5',
          }}>
            <SkeletonPlaceholder
              backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
              highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
            >
              {/* Activity item content */}
              {index % 2 === 0 ? (
                // Pending action layout (centered with buttons)
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 140, height: 18, borderRadius: 4, marginBottom: 8 }} />
                  <View style={{ width: 160, height: 14, borderRadius: 4, marginBottom: 8 }} />
                  <View style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 16 }} />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 70, height: 36, borderRadius: 8 }} />
                    <View style={{ width: 70, height: 36, borderRadius: 8 }} />
                  </View>
                </View>
              ) : (
                // Timeline event layout (left-aligned with avatar)
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ width: '60%', height: 18, borderRadius: 4, marginBottom: 6 }} />
                    <View style={{ width: '80%', height: 14, borderRadius: 4, marginBottom: 6 }} />
                    <View style={{ width: '40%', height: 12, borderRadius: 4 }} />
                  </View>
                </View>
              )}
            </SkeletonPlaceholder>
          </View>
        ))}
      </View>
    </View>
  );
};

export const MeMainSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      {/* Profile Header */}
      <MeProfileHeaderSkeleton />
      
      {/* Spacer */}
      <View style={{ flex: 1 }} />
      
      {/* Draggable photo carousel */}
      <MeDraggableCarouselSkeleton />
    </View>
  );
};

// Photo Detail page skeleton
export const PhotoDetailSkeleton = () => {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Top Metadata Bar */}
      <View style={{
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginHorizontal: 20,
        alignSelf: 'center',
      }}>
        <SkeletonPlaceholder
          backgroundColor={'#2a2a2a'}
          highlightColor={'#3a3a3a'}
        >
          <View style={{ alignItems: 'center', gap: 4 }}>
            {/* Photo count */}
            <View style={{ width: 80, height: 16, borderRadius: 4 }} />
            {/* Camera name */}
            <View style={{ width: 120, height: 14, borderRadius: 4 }} />
            {/* Date */}
            <View style={{ width: 100, height: 12, borderRadius: 4 }} />
          </View>
        </SkeletonPlaceholder>
      </View>

      {/* Main Photo Area - Full Screen */}
      <SkeletonPlaceholder
        backgroundColor={'#1a1a1a'}
        highlightColor={'#2a2a2a'}
      >
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: screenWidth,
          height: screenHeight,
        }} />
      </SkeletonPlaceholder>

      {/* Thumbnail Strip */}
      <View style={{
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        height: 70,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <SkeletonPlaceholder
          backgroundColor={'#2a2a2a'}
          highlightColor={'#3a3a3a'}
        >
          <View style={{
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 10,
          }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <View
                key={index}
                style={{
                  width: 50,
                  height: 70,
                  borderRadius: 10,
                  borderWidth: index === 2 ? 2 : 1,
                  borderColor: index === 2 ? '#60a5fa' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </View>
        </SkeletonPlaceholder>
      </View>
    </View>
  );
};

export const SyncedPhotosReviewSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      {/* Header Section */}
      <View style={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#1F1F1F' : '#E9EAEC',
        backgroundColor: isDark ? 'rgba(0,0,0,0.98)' : 'rgba(255,255,255,0.98)',
      }}>
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          {/* Header Row */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            {/* Left side - Title and stats */}
            <View style={{ flex: 1 }}>
              {/* Title */}
              <View style={{ width: 180, height: 24, borderRadius: 4, marginBottom: 8 }} />
              {/* Stats row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 120, height: 16, borderRadius: 4 }} />
                <View style={{ width: 80, height: 20, borderRadius: 10 }} />
              </View>
            </View>
            
            {/* Right side - Select All button */}
            <View style={{ width: 80, height: 20, borderRadius: 4 }} />
          </View>
        </SkeletonPlaceholder>

        {/* Destination Chip */}
        <View style={{ marginTop: 12 }}>
          <SkeletonPlaceholder
            backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
            highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
          >
            <View style={{
              height: 40,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#e5e5e5',
              backgroundColor: isDark ? '#1a1a1a' : '#f8f8f8',
            }} />
          </SkeletonPlaceholder>
        </View>
      </View>

      {/* Photo Grid */}
      <View style={{ flex: 1, paddingHorizontal: 6, paddingTop: 8 }}>
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
          }}>
            {Array.from({ length: 24 }).map((_, index) => {
              const itemSize = (screenWidth - 32) / 4; // 4 columns with padding
              return (
                <View
                  key={index}
                  style={{
                    width: itemSize,
                    height: itemSize,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isDark ? '#333' : '#e5e5e5',
                    marginBottom: 4,
                  }}
                />
              );
            })}
          </View>
        </SkeletonPlaceholder>
      </View>

      {/* Bottom Action Bar */}
      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: isDark ? '#171717' : '#E9EAEC',
        backgroundColor: isDark ? 'rgba(0,0,0,0.98)' : 'rgba(255,255,255,0.98)',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -2 },
        elevation: 12,
      }}>
        <SkeletonPlaceholder
          backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
          highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
        >
          <View style={{
            flexDirection: 'row',
            gap: 8,
          }}>
            {/* Skip All button */}
            <View style={{
              flex: 1,
              height: 48,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#e5e5e5',
            }} />
            {/* Share button */}
            <View style={{
              flex: 1,
              height: 48,
              borderRadius: 8,
              backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0',
            }} />
          </View>
        </SkeletonPlaceholder>
      </View>
    </View>
  );
};

// User Profile page skeleton - matches accepted status loaded state exactly
export const UserProfileSkeleton = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLLAPSED_HEIGHT = screenHeight * 0.6;
  const EXPANDED_HEIGHT = screenHeight * 0.87;
  const DRAG_HANDLE_HEIGHT = Math.min(Math.max(38, screenHeight * 0.04), 50);
  
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      {/* Three dots menu in top right */}
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
      >
        <View style={{
          position: 'absolute',
          top: 24, // Approximates $6 in gluestack
          right: 4, // Approximates $1 in gluestack
          width: 32,
          height: 32,
          borderRadius: 6,
          zIndex: 10
        }} />
      </SkeletonPlaceholder>
      
      {/* Profile Header */}
      <SkeletonPlaceholder
        backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
        highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
      >
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <View style={{ alignItems: 'center' }}>
            {/* Profile Photo */}
            <View style={{ 
              width: 120, 
              height: 120, 
              borderRadius: 60, 
              marginBottom: 12 
            }} />
            
            {/* Username */}
            <View style={{ 
              alignItems: 'center',
              marginBottom: 4,
              width: '100%'
            }}>
              <View style={{ 
                width: 150, 
                height: 24, 
                borderRadius: 4
              }} />
            </View>
            
            {/* Spacer to push divider down */}
            <View style={{ height: 8 }} />
            
            {/* Friends Divider - matches Divider mb="$2" */}
            <View style={{
              width: '90%',
              height: 1,
              marginBottom: 4,
            }} />
            
            {/* Stats Section */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              marginTop: -5,
              marginLeft: 12,
              paddingHorizontal: 4,
              width: '100%'
            }}>
              {/* Total */}
              <View style={{ alignItems: 'center', minWidth: 45 }}>
                <View style={{ width: 30, height: 20, borderRadius: 4, marginBottom: 4 }} />
                <View style={{ width: 35, height: 12, borderRadius: 4 }} />
              </View>
              {/* Face-match */}
              <View style={{ alignItems: 'center', minWidth: 40 }}>
                <View style={{ width: 25, height: 16, borderRadius: 4, marginBottom: 4 }} />
                <View style={{ width: 70, height: 10, borderRadius: 4 }} />
              </View>
              {/* Cameras */}
              <View style={{ alignItems: 'center', minWidth: 40 }}>
                <View style={{ width: 25, height: 16, borderRadius: 4, marginBottom: 4 }} />
                <View style={{ width: 50, height: 10, borderRadius: 4 }} />
              </View>
            </View>
            
            {/* Divider after stats */}
            <View style={{
              width: '90%',
              height: 1,
              marginTop: 4,
              marginBottom: 6,
            }} />
          </View>
        </View>
      </SkeletonPlaceholder>
      
      {/* Spacer */}
      <View style={{ flex: 1 }} />
      
      {/* Shared Photos Draggable Carousel */}
      <View style={{
        height: EXPANDED_HEIGHT,
        backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.98)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        position: 'absolute',
        bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
        left: 0,
        right: 0,
      }}>
        {/* Header */}
        <View style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          paddingTop: 8,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}>
          <SkeletonPlaceholder
            backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
            highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
          >
            <View style={{
              minHeight: DRAG_HANDLE_HEIGHT + 16,
              justifyContent: 'flex-start',
              alignItems: 'center',
              paddingTop: 0,
              paddingBottom: 12,
              paddingHorizontal: 12,
            }}>
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                paddingHorizontal: 16,
              }}>
                <View style={{ width: 140, height: 28, borderRadius: 4 }} />
              </View>
            </View>
          </SkeletonPlaceholder>

          <View style={{ marginBottom: -15 }} />

          {/* First Divider */}
          <View style={{
            height: 0.5,
            marginHorizontal: 20,
            backgroundColor: isDark ? '#333' : '#e5e5e5',
          }} />

          {/* Section Header */}
          <View style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
            paddingVertical: 12,
          }}>
            <SkeletonPlaceholder
              backgroundColor={isDark ? '#2a2a2a' : '#e0e0e0'}
              highlightColor={isDark ? '#3a3a3a' : '#f0f0f0'}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingHorizontal: 20,
              }}>
                {/* Section name and count */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <View style={{ width: 100, height: 20, borderRadius: 4 }} />
                  <View style={{ width: 40, height: 16, borderRadius: 4 }} />
                </View>
                
                {/* Dots */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4 }} />
                </View>
              </View>
            </SkeletonPlaceholder>
          </View>

          {/* Second Divider */}
          <View style={{
            height: 0.5,
            marginHorizontal: 20,
            backgroundColor: isDark ? '#333' : '#e5e5e5',
          }} />
        </View>
        
        {/* Photo Grid */}
        <View style={{ flex: 1 }}>
          <PhotoGridSkeleton columns={4} extraRow={true} />
        </View>
      </View>
    </View>
  );
};