import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, useColorScheme, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';

import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Pressable,
  Heading,
  Badge,
  BadgeText,
  Icon,
  Spinner,
  Center,
} from '@gluestack-ui/themed';

import { CheckCircle2, Image as ImageIcon, ChevronDown } from 'lucide-react-native';

import { PendingSyncedPhotosBatch, PendingSyncedPhoto } from '../src/utils/icloudsync/photoAlbumTypes';
import { STORAGE_KEYS } from '../src/utils/icloudsync/photoAlbumConstants';
import { useUserCameraMemberships } from '../src/hooks/useCameraQueries';
import { useAuth } from '../context/AuthContext';
import { useProcessSyncedPhotos } from '../src/hooks/useSyncedPhotoMutations';
import { SyncedPhotosReviewSkeleton } from '../components/SkeletonLoaders';
import { CameraPickerModal } from '../components/CameraPickerModal';

export default function SyncedPhotosReview() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const { batches, source } = useLocalSearchParams<{ batches: string; source?: string }>();

  const [allPhotos, setAllPhotos] = useState<PendingSyncedPhoto[]>([]);
  const [photos, setPhotos] = useState<PendingSyncedPhoto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const { user } = useAuth();
  const userId = user?.username;
  const { data: cams = [] } = useUserCameraMemberships(userId);
  const processPhotos = useProcessSyncedPhotos();

  const selectedCount = selected.size;
  const totalCount = allPhotos.length;
  const visibleCount = photos.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const hasMore = visibleCount < totalCount;
  
  const INITIAL_LOAD = 40;
  const LOAD_MORE_SIZE = 20;

  // Helper function for source-aware navigation
  const navigateBack = useCallback(() => {
    if (source === 'me') {
      router.back();
    } else {
      router.replace('/(tabs)/album');
    }
  }, [source]);

  // Check media library permissions on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        setPermissionStatus(status);
        
        if (status !== 'granted') {
          console.warn('⚠️ Media library permission not granted');
        }
      } catch (e) {
        console.error('Failed to check media library permissions:', e);
        setPermissionStatus(MediaLibrary.PermissionStatus.DENIED);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!batches) return;
        const batchIds = batches.split(',');
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS);
        if (!raw) {
          setAllPhotos([]);
          setPhotos([]);
          return;
        }
        const all: PendingSyncedPhotosBatch[] = JSON.parse(raw);
        const target = all.filter(b => batchIds.includes(b.batchId) && !b.reviewed);
        const allPhotos = target.flatMap(b => b.photos);
        
        // Store all photos and load initial batch
        setAllPhotos(allPhotos);
        setPhotos(allPhotos.slice(0, INITIAL_LOAD));
        
        console.log(`📸 Loaded ${allPhotos.length} total photos, showing first ${Math.min(allPhotos.length, INITIAL_LOAD)}`);
      } catch (e) {
        console.warn('Failed to load synced photos:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [batches, INITIAL_LOAD]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(allPhotos.map(p => p.id))), [allPhotos]);
  const clearAll = useCallback(() => setSelected(new Set()), []);
  
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      const currentCount = photos.length;
      const nextBatch = allPhotos.slice(currentCount, currentCount + LOAD_MORE_SIZE);
      setPhotos(prev => [...prev, ...nextBatch]);
      setLoadingMore(false);
      
      console.log(`📸 Loaded ${nextBatch.length} more photos (${currentCount + nextBatch.length}/${allPhotos.length} total)`);
    }, 300);
  }, [loadingMore, hasMore, photos.length, allPhotos, LOAD_MORE_SIZE]);

  const openPicker = useCallback(() => {
    setShowCameraPicker(true);
  }, []);

  const checkMediaPermission = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      setPermissionStatus(status);
      return status === MediaLibrary.PermissionStatus.GRANTED;
    } catch (e) {
      console.error('Failed to check media library permissions:', e);
      return false;
    }
  }, []);

  const openAppSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (e) {
      console.error('Failed to open settings:', e);
      Alert.alert(
        'Cannot Open Settings',
        'Please manually go to Settings > PhomoCam > Photos to enable photo access.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const confirmShare = useCallback(async () => {
    if (selectedCount === 0) return;
    
    // Check permission before processing
    if (permissionStatus !== MediaLibrary.PermissionStatus.GRANTED) {
      Alert.alert(
        'Permission Required',
        'Media library access is required to share photos. Please enable photo access in Settings > PhomoCam > Photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openAppSettings },
          { text: 'Check Again', onPress: async () => {
            await checkMediaPermission();
            confirmShare();
          }}
        ]
      );
      return;
    }
    
    try {
      const chosen: PendingSyncedPhoto[] = Array.from(selected)
        .map(id => photos.find(p => p.id === id))
        .filter((p): p is PendingSyncedPhoto => !!p && !brokenImages.has(p.id));

      if (chosen.length === 0) {
        Alert.alert(
          'No Valid Photos',
          'All selected photos are inaccessible. Please try selecting different photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const batchIds = batches ? batches.split(',') : [];
      await processPhotos.mutateAsync({ selectedPhotos: chosen, selectedCam, batchIds });

      navigateBack();
    } catch (e) {
      console.warn('Failed to process photos:', e);
      Alert.alert(
        'Share Failed',
        'Unable to share photos. They may no longer be accessible.',
        [{ text: 'OK' }]
      );
    }
  }, [selected, selectedCount, photos, batches, processPhotos, selectedCam, permissionStatus, checkMediaPermission, navigateBack]);

  const handleSharePress = useCallback(() => {
    if (selectedCount === 0) return;
    // By default, share to current destination. Tap "Change" on the chip to pick another.
    confirmShare();
  }, [selectedCount, confirmShare]);

  const handleSkip = useCallback(async () => {
    try {
      if (!batches) return;
      const batchIds = batches.split(',');
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS);
      if (raw) {
        const all: PendingSyncedPhotosBatch[] = JSON.parse(raw);
        const updated = all.map(b => batchIds.includes(b.batchId) ? { ...b, reviewed: true } : b);
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNCED_PHOTOS, JSON.stringify(updated));
      }
      navigateBack();
    } catch (e) {
      console.warn('Failed to mark reviewed:', e);
    }
  }, [batches, navigateBack]);

  const renderItem = useCallback(({ item }: { item: PendingSyncedPhoto }) => {
    const isSelected = selected.has(item.id);
    const isBroken = brokenImages.has(item.id);
    
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        sx={{ flexBasis: '25%', maxWidth: '25%', aspectRatio: 1, p: '$1' }}
      >
        <Box
          overflow="hidden"
          position="relative"
          borderWidth={isSelected ? 2 : 1}
          borderColor={isSelected ? '$primary600' : (isDark ? '$borderDark700' : '$borderLight200')}
          bg={isDark ? '$backgroundDark900' : '$backgroundLight0'}
        >
          {isBroken || permissionStatus !== MediaLibrary.PermissionStatus.GRANTED ? (
            <Center flex={1} bg={isDark ? '$backgroundDark800' : '$backgroundLight100'}>
              <Text fontSize="$2xl" opacity={0.5}>🚫</Text>
              {permissionStatus !== MediaLibrary.PermissionStatus.GRANTED && (
                <Text fontSize="$xs" color={isDark ? '$textDark400' : '$textLight600'} mt="$1">
                  No Access
                </Text>
              )}
            </Center>
          ) : (
            <ExpoImage
              source={{ uri: item.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={100}
              onError={() => {
                setBrokenImages(prev => new Set(prev).add(item.id));
              }}
            />
          )}
          {/* subtle tint only when selected */}
          {isSelected && !isBroken && <Box position="absolute" inset={0} bg="rgba(0,122,255,0.08)" />}

          {/* small check dot */}
          <Box position="absolute" top={6} right={6}>
            <Box
              w={22}
              h={22}
              borderRadius={'$full'}
              alignItems="center"
              justifyContent="center"
              bg={isSelected ? '$primary600' : 'rgba(0,0,0,0.35)'}
              borderWidth={isSelected ? 0 : 1}
              borderColor="rgba(255,255,255,0.6)"
            >
              <Icon as={CheckCircle2} size="xs" color="$white" />
            </Box>
          </Box>
        </Box>
      </Pressable>
    );
  }, [selected, toggle, isDark, brokenImages, permissionStatus, setBrokenImages]);

  if (loading) {
    return <SyncedPhotosReviewSkeleton />;
  }

  // Show permission error state if permission is explicitly denied
  if (permissionStatus === MediaLibrary.PermissionStatus.DENIED || permissionStatus === MediaLibrary.PermissionStatus.UNDETERMINED) {
    return (
      <Box flex={1} bg={isDark ? '#000' : '#fff'}>
        <Center flex={1} px="$8">
          <Box
            w={100}
            h={100}
            borderRadius={'$full'}
            bg={isDark ? '$backgroundDark800' : '$backgroundLight100'}
            alignItems="center"
            justifyContent="center"
            mb="$4"
          >
            <Text fontSize="$4xl">🔒</Text>
          </Box>
          
          <VStack space="lg" alignItems="center">
            <Heading size="lg" color={isDark ? '$textDark100' : '$textLight900'} textAlign="center">
              Media Access Required
            </Heading>
            
            <Text color={isDark ? '$textDark300' : '$textLight600'} textAlign="center" px="$4">
              To review and share your synced photos, PhomoCam needs access to your photo library.
            </Text>
            
            <VStack space="sm" w="100%" px="$4">
              <Button
                bg="$primary600"
                borderRadius="$lg"
                h={48}
                onPress={() => {
                  Alert.alert(
                    'Enable Photo Access',
                    'Please go to Settings > PhomoCam > Photos and enable "All Photos" access, then return to the app.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: openAppSettings },
                      { text: 'Check Again', onPress: () => checkMediaPermission() }
                    ]
                  );
                }}
                $pressed={{ bg: '$primary700' }}
              >
                <ButtonText color="$white" fontWeight="$semibold">
                  Open Settings
                </ButtonText>
              </Button>
              
              <Button
                variant="outline"
                borderColor="$primary600"
                borderRadius="$lg"
                h={48}
                onPress={navigateBack}
                $pressed={{ opacity: 0.7 }}
              >
                <ButtonText color="$primary600" fontWeight="$semibold">
                  Go to Album
                </ButtonText>
              </Button>
            </VStack>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box flex={1} bg={isDark ? '#000' : '#fff'}>
        {/* Warning banner for broken images */}
        {brokenImages.size > 0 && (
          <Box
            px="$4"
            py="$2"
            bg={isDark ? '#1a0a00' : '#fff5f0'}
            borderBottomWidth={1}
            borderColor={isDark ? '#4a2000' : '#ff9060'}
          >
            <HStack alignItems="center" space="sm">
              <Text fontSize="$sm">⚠️</Text>
              <Text fontSize="$sm" color={isDark ? '#ff9060' : '#ff6030'}>
                {brokenImages.size} photo{brokenImages.size === 1 ? ' is' : 's are'} inaccessible
              </Text>
            </HStack>
          </Box>
        )}
        
        {/* Compact sticky header */}
        <Box
          px="$4"
          pt="$2"
          pb="$3"
          borderBottomWidth={1}
          borderColor={isDark ? '#1F1F1F' : '#E9EAEC'}
          bg={isDark ? 'rgba(0,0,0,0.98)' : 'rgba(255,255,255,0.98)'}
        >
          <HStack alignItems="center" justifyContent="space-between">
            <VStack space="xs">
              <Heading size="md" color={isDark ? '$textDark100' : '$textLight900'}>
                Review Synced Photos
              </Heading>
              <HStack alignItems="center" space="sm">
                <Text size="sm" color={isDark ? '$textDark400' : '$textLight600'}>
                  {totalCount} photo{totalCount === 1 ? '' : 's'} from iCloud
                  {hasMore && ` (showing ${visibleCount})`}
                </Text>
                <Badge variant="solid" action="muted" rounded="$full" px="$2">
                  <BadgeText size="xs">{selectedCount} selected</BadgeText>
                </Badge>
              </HStack>
            </VStack>

            <Button
              variant="link"
              onPress={allSelected ? clearAll : selectAll}
              isDisabled={totalCount === 0}
            >
              <ButtonText color="$primary600">
                {allSelected ? 'Clear All' : hasMore ? 'Select All Photos' : 'Select All'}
              </ButtonText>
            </Button>
          </HStack>

          {/* Destination chip */}
          <Pressable onPress={openPicker} mt="$3" $pressed={{ opacity: 0.9 }}>
            <HStack
              px="$3"
              py="$2"
              borderWidth={1}
              borderColor={isDark ? '$borderDark700' : '$borderLight300'}
              borderRadius="$lg"
              alignItems="center"
              justifyContent="space-between"
              bg={isDark ? '$backgroundDark900' : '$backgroundLight50'}
            >
              <HStack space="sm" alignItems="center">
                <Icon as={ImageIcon} size="sm" color={isDark ? '$textDark200' : '$textLight700'} />
                <Text fontWeight="$semibold" numberOfLines={2} ellipsizeMode="tail">
                  Share to: {selectedCam ? (cams.find(c => c.cameraId === selectedCam)?.name ?? 'Event') : 'Face-match'}
                </Text>
              </HStack>
              <HStack space="xs" alignItems="center">
                <Text size="sm" color="$primary600">Change</Text>
                <Icon as={ChevronDown} size="xs" color="$primary600" />
              </HStack>
            </HStack>
          </Pressable>
        </Box>

        {/* Photo Grid */}
        {totalCount === 0 ? (
          <Center flex={1} px="$8" mb={120}>
            <Box
              w={80}
              h={80}
              borderRadius={'$full'}
              bg={isDark ? '$backgroundDark800' : '$backgroundLight100'}
              alignItems="center"
              justifyContent="center"
              mb="$3"
            >
              <Text fontSize="$3xl">📷</Text>
            </Box>
            <VStack space="xs" alignItems="center">
              <Heading size="md" color={isDark ? '$textDark100' : '$textLight900'}>No Photos Found</Heading>
              <Text color={isDark ? '$textDark300' : '$textLight600'} textAlign="center">
                When photos sync from iCloud, you can review and share them here.
              </Text>
            </VStack>
          </Center>
        ) : (
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={4}
            overScrollMode="never"
            bounces={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 140 }}
            onEndReached={loadMore}
            scrollEventThrottle={16}
            onEndReachedThreshold={0.8}
            removeClippedSubviews={false}
            maxToRenderPerBatch={16}
            windowSize={8}
            initialNumToRender={12}
            updateCellsBatchingPeriod={50}
            ListFooterComponent={
              hasMore ? (
                <Center py="$6">
                  {loadingMore ? (
                    <VStack space="sm" alignItems="center">
                      <Spinner size="small" color={isDark ? '$textDark300' : '$textLight600'} />
                      <Text size="xs" color={isDark ? '$textDark400' : '$textLight600'}>
                        Loading more photos...
                      </Text>
                    </VStack>
                  ) : (
                    <Button
                      variant="outline"
                      borderColor={isDark ? '$borderDark700' : '$borderLight300'}
                      onPress={loadMore}
                      size="sm"
                    >
                      <ButtonText size="sm" color={isDark ? '$textDark200' : '$textLight700'}>
                        Load More ({allPhotos.length - photos.length} remaining)
                      </ButtonText>
                    </Button>
                  )}
                </Center>
              ) : null
            }
          />
        )}

        {/* Bottom action bar */}
        <Box
          position="absolute"
          left={0}
          right={0}
          bottom={0}
          px="$4"
          pb={Math.max(insets.bottom || 0, 20)}
          pt="$3"
          borderTopWidth={1}
          borderColor={isDark ? '#171717' : '#E9EAEC'}
          bg={isDark ? 'rgba(0,0,0,0.98)' : 'rgba(255,255,255,0.98)'}
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
            elevation: 12,
          }}
        >
          <HStack space="sm">
            <Button
              variant="outline"
              borderColor="$primary600"
              onPress={handleSkip}
              isDisabled={processPhotos.isPending}
              flex={1}
              h={48}
              justifyContent="center"
              alignItems="center"
            >
              <ButtonText color="$primary600" textAlign="center">Skip All</ButtonText>
            </Button>
            <Button
              onPress={handleSharePress}
              isDisabled={selectedCount === 0 || processPhotos.isPending}
              action="primary"
              flex={1}
              h={48}
              justifyContent="center"
              alignItems="center"
            >
              {processPhotos.isPending ? (
                <HStack space="sm" alignItems="center">
                  <Spinner size="small" color="$white" />
                  <ButtonText color="$white">Processing…</ButtonText>
                </HStack>
              ) : (
                <ButtonText color="$white" textAlign="center">
                  {selectedCount === 0 ? 'Select Photos' : `Share Selected (${selectedCount})`}
                </ButtonText>
              )}
            </Button>
          </HStack>
        </Box>

        <CameraPickerModal
          isOpen={showCameraPicker}
          onClose={() => setShowCameraPicker(false)}
          cameras={cams}
          onSelect={setSelectedCam}
          selectedCameraId={selectedCam}
        />
      </Box>
  );
}
