/* app/camera.tsx */
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  Linking,
  useColorScheme,
  Dimensions,
  Pressable as RNPressable,
  Animated,
  AppState,
  Switch
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Center,
  Spinner,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalBody,
  Pressable,
} from "@gluestack-ui/themed";
import { Camera, useCameraDevice, useCameraPermission, useCameraFormat } from 'react-native-vision-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { photoAlbumService } from "@/src/utils/icloudsync/photoAlbumService";
import { STORAGE_KEYS } from "@/src/utils/icloudsync/photoAlbumConstants";
import { useUploadPhoto } from "@/src/hooks/usePhotoMutations";
import { useUserCameraMemberships } from "@/src/hooks/useCameraQueries";
import { usePreferencesStore } from "@/src/stores/preferencesStore";
import { useUploadQueue, QueueItem } from "@/src/stores/uploadQueueStore";
import { useRecentPhotosStore } from "@/src/stores/recentPhotosStore";
import { useAuth } from "@/context/AuthContext";
import { Image as ExpoImage } from "expo-image";
import { showMessage } from "react-native-flash-message";
import { CameraPickerModal } from "@/components/CameraPickerModal";
import { useWalkthroughElement } from "@/src/context/WalkthroughContext";
import { useRegisterForPushNotifications } from "@/src/hooks/usePushNotifications";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { enrollUserFace } from "@/src/graphql/mutations";
import { v4 as uuidv4 } from "uuid";
import { Alert } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

function CameraFlash({ visible }: { visible: boolean }) {
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      flashAnim.setValue(1);
      
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, flashAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          zIndex: 3000,
        },
        { opacity: flashAnim }
      ]}
      pointerEvents="auto"
    />
  );
}

function RapidCaptureIndicator({ visible }: { visible: boolean }) {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacityAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 200,
          left: 20,
          right: 20,
          alignItems: 'center',
          zIndex: 2000,
        },
        { opacity: opacityAnim }
      ]}
      pointerEvents="none"
    >
      <Box
        bg="rgba(0,0,0,0.8)"
        borderRadius="$lg"
        px="$4"
        py="$2"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.3)"
      >
        <Text
          color="$white"
          fontSize="$sm"
          fontWeight="$medium"
          textAlign="center"
        >
          📷 Photo saved to background queue
        </Text>
      </Box>
    </Animated.View>
  );
}

function BackgroundUploadIndicator({ activeStats, visible, showingModal }: { 
  activeStats: { active: number; completed: number; failed: number; total: number; canAddMore: boolean };
  visible: boolean;
  showingModal?: boolean;
}) {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && activeStats.active > 0) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, activeStats.active, opacityAnim]);

  if (!visible || activeStats.active === 0) return null;

  return (
    <Animated.View
      style={[
        styles.backgroundIndicator,
        { opacity: opacityAnim }
      ]}
      pointerEvents="none"
    >
      <HStack
        bg="rgba(0,0,0,0.8)"
        borderRadius="$lg"
        px="$3"
        py="$2"
        alignItems="center"
        space="xs"
      >
        <Spinner size="small" color="$white" />
        <Text color="$white" fontSize="$xs" fontWeight="$medium">
          {`${activeStats.active} uploading...`}
        </Text>
        {showingModal && (
          <Text color="$blue300" fontSize="$2xs" fontWeight="$medium">
            + Rapid
          </Text>
        )}
        {!activeStats.canAddMore && (
          <Text color="$orange300" fontSize="$2xs" fontWeight="$medium">
            Queue Full
          </Text>
        )}
      </HStack>
    </Animated.View>
  );
}

function ExposureSlider({ 
  exposure, 
  onExposureChange, 
  visible, 
  disabled 
}: { 
  exposure: number;
  onExposureChange: (exposure: number) => void;
  visible: boolean;
  disabled: boolean;
}) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const sliderHeight = 200;
  const minExposure = -2.0;
  const maxExposure = 2.0;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacityAnim]);

  const updateExposureFromPosition = useCallback((locationY: number) => {
    if (disabled) return;
    
    const normalizedY = 1 - (locationY / sliderHeight);
    const newExposure = minExposure + (normalizedY * (maxExposure - minExposure));
    const clampedExposure = Math.max(minExposure, Math.min(maxExposure, newExposure));
    
    onExposureChange(clampedExposure);
  }, [disabled, onExposureChange, sliderHeight, minExposure, maxExposure]);

  const panGesture = useMemo(() => 
    Gesture.Pan()
      .onStart((event) => {
        'worklet';
        runOnJS(updateExposureFromPosition)(event.y);
      })
      .onUpdate((event) => {
        'worklet';
        runOnJS(updateExposureFromPosition)(event.y);
      })
      .onEnd(() => {
        'worklet';
      })
  , [updateExposureFromPosition]);

  const handleSliderPress = useCallback((event: any) => {
    const { locationY } = event.nativeEvent;
    updateExposureFromPosition(locationY);
  }, [updateExposureFromPosition]);

  if (!visible) return null;

  const exposurePosition = ((exposure - minExposure) / (maxExposure - minExposure));
  const indicatorTop = (1 - exposurePosition) * sliderHeight - 10;

  return (
    <Animated.View
      style={[
        styles.exposureSlider,
        { opacity: opacityAnim }
      ]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <VStack alignItems="center" space="xs">
        <Box
          bg="rgba(0,0,0,0.7)"
          borderRadius="$md"
          px="$2"
          py="$1"
          mb="$2"
        >
          <Text
            color="$white"
            fontSize="$xs"
            fontWeight="$semibold"
            textAlign="center"
          >
            {exposure > 0 ? '+' : ''}{exposure.toFixed(1)}
          </Text>
        </Box>

        <GestureDetector gesture={panGesture}>
          <RNPressable
            style={[
              styles.sliderTrack,
              { height: sliderHeight },
              disabled && styles.sliderTrackDisabled
            ]}
            onPress={handleSliderPress}
          >
            <Box
              position="absolute"
              width={4}
              height="100%"
              bg="rgba(255,255,255,0.3)"
              borderRadius="$full"
              left="50%"
              transform={[{ translateX: -2 }]}
            />
            
            <Box
              position="absolute"
              width={8}
              height={2}
              bg="rgba(255,255,255,0.6)"
              borderRadius="$full"
              left="50%"
              top="50%"
              transform={[{ translateX: -4 }, { translateY: -1 }]}
            />

            <Box
              position="absolute"
              width={16}
              height={16}
              bg={disabled ? "rgba(255,255,255,0.3)" : "$white"}
              borderRadius="$full"
              borderWidth={2}
              borderColor={disabled ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.2)"}
              left="50%"
              transform={[{ translateX: -8 }]}
              style={{ top: Math.max(0, Math.min(sliderHeight - 16, indicatorTop)) }}
            />
          </RNPressable>
        </GestureDetector>

        <VStack alignItems="center" space="xs" mt="$2">
          <Text color="rgba(255,255,255,0.7)" fontSize={10}>☀️</Text>
          <Text color="rgba(255,255,255,0.7)" fontSize={8}>0</Text>
          <Text color="rgba(255,255,255,0.7)" fontSize={10}>🌙</Text>
        </VStack>
      </VStack>
    </Animated.View>
  );
}

function QuickZoomButtons({ 
  currentZoom, 
  onZoomChange, 
  disabled 
}: { 
  currentZoom: number;
  onZoomChange: (zoom: number) => void;
  disabled: boolean;
}) {
  const zoomLevels = [1, 2, 3];

  return (
    <VStack
      position="absolute"
      right={20}
      top="45%"
      space="xs"
      zIndex={1000}
      transform={[{ translateY: -40 }]}
    >
      {zoomLevels.map((zoomLevel) => {
        const isActive = Math.abs(currentZoom - zoomLevel) < 0.1;
        
        return (
          <Pressable
            key={zoomLevel}
            onPress={() => !disabled && onZoomChange(zoomLevel)}
            bg={
              isActive 
                ? "rgba(255,255,255,0.9)" 
                : disabled 
                ? "rgba(0,0,0,0.3)" 
                : "rgba(0,0,0,0.6)"
            }
            borderRadius="$full"
            width={36}
            height={36}
            justifyContent="center"
            alignItems="center"
            disabled={disabled}
            $pressed={{
              bg: isActive 
                ? "rgba(255,255,255,0.7)" 
                : "rgba(255,255,255,0.3)",
            }}
          >
            <Text
              color={
                isActive 
                  ? "$black" 
                  : disabled 
                  ? "$gray400" 
                  : "$white"
              }
              fontSize="$xs"
              fontWeight={isActive ? "$bold" : "$medium"}
            >
              {zoomLevel}x
            </Text>
          </Pressable>
        );
      })}
    </VStack>
  );
}

function ZoomIndicator({ 
  zoom, 
  maxZoom, 
  visible 
}: { 
  zoom: number;
  maxZoom: number;
  visible: boolean;
}) {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacityAnim]);

  if (!visible) return null;

  const zoomPercentage = Math.round(((zoom - 1) / (maxZoom - 1)) * 100);

  return (
    <Animated.View
      style={[
        styles.zoomIndicator,
        { opacity: opacityAnim }
      ]}
      pointerEvents="none"
    >
      <Box
        bg="rgba(0,0,0,0.7)"
        borderRadius="$lg"
        px="$3"
        py="$2"
      >
        <Text
          color="$white"
          fontSize="$sm"
          fontWeight="$semibold"
          textAlign="center"
        >
          {zoom.toFixed(1)}x
        </Text>
        <Box
          width={60}
          height={3}
          bg="rgba(255,255,255,0.3)"
          borderRadius="$full"
          mt="$1"
        >
          <Box
            width={`${zoomPercentage}%`}
            height="100%"
            bg="$white"
            borderRadius="$full"
          />
        </Box>
      </Box>
    </Animated.View>
  );
}

function GridOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
    >
      <Box position="absolute" left="33.33%" top={0} bottom={0} width={1} bg="rgba(255,255,255,0.3)" />
      <Box position="absolute" left="66.66%" top={0} bottom={0} width={1} bg="rgba(255,255,255,0.3)" />
      <Box position="absolute" top="33.33%" left={0} right={0} height={1} bg="rgba(255,255,255,0.3)" />
      <Box position="absolute" top="66.66%" left={0} right={0} height={1} bg="rgba(255,255,255,0.3)" />
    </Box>
  );
}

function FocusIndicator({ 
  position, 
  visible, 
  onAnimationComplete 
}: { 
  position: { x: number; y: number } | null;
  visible: boolean;
  onAnimationComplete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && position) {
      scaleAnim.setValue(1.5);
      opacityAnim.setValue(1);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(onAnimationComplete, 0);
      });
    }
  }, [visible, position, scaleAnim, opacityAnim]);

  if (!visible || !position) return null;

  return (
    <Animated.View
      style={[
        styles.focusIndicator,
        {
          left: position.x - 35,
          top: position.y - 35,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Box
        width={70}
        height={70}
        borderWidth={2}
        borderColor="$white"
        borderRadius="$md"
        bg="transparent"
      />
    </Animated.View>
  );
}

function TimerCountdown({ 
  seconds, 
  onComplete 
}: { 
  seconds: number;
  onComplete: () => void;
}) {
  const [currentSecond, setCurrentSecond] = useState(seconds);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (currentSecond > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        setCurrentSecond(currentSecond - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      onComplete();
    }
  }, [currentSecond, onComplete]);

  if (currentSecond <= 0) return null;

  return (
    <Center
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(0,0,0,0.7)"
      zIndex={2000}
      pointerEvents="none"
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text
          color="$white"
          fontSize={80}
          fontWeight="$bold"
          textAlign="center"
        >
          {currentSecond}
        </Text>
      </Animated.View>
    </Center>
  );
}

function PhotoPreview({ 
  photos, 
  onPress,
  visible
}: { 
  photos: Array<{ id: string; uri: string; timestamp: number; cameraId: string | null; friendGroupKey?: string }>;
  onPress: (photoId: string, cameraId: string | null, friendGroupKey?: string) => void;
  visible: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && photos.length > 0) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, photos.length]);

  console.log('📸 [PHOTO_PREVIEW] Render check:', {
    visible,
    photosLength: photos.length,
    photoIds: photos.map(p => p.id),
    photoUris: photos.map(p => p.uri.substring(0, 50) + '...')
  });

  if (!visible || photos.length === 0) {
    console.log('📸 [PHOTO_PREVIEW] Not rendering - visible:', visible, 'photos:', photos.length);
    return null;
  }

  // Sort by timestamp to ensure latest photo is actually the most recent
  const sortedPhotos = [...photos].sort((a, b) => a.timestamp - b.timestamp);

  const latestPhoto = sortedPhotos[sortedPhotos.length - 1];
  const previousPhotos = sortedPhotos.slice(Math.max(0, sortedPhotos.length - 3), sortedPhotos.length - 1).reverse();

  return (
    <Animated.View
      style={[
        styles.photoPreviewContainer,
        {
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {previousPhotos.map((photo, index) => (
        <Box
          key={photo.id}
          style={[
            styles.photoPreviewStack,
            {
              bottom: (previousPhotos.length - index) * 4,
              left: (previousPhotos.length - index) * 4,
              zIndex: index,
              opacity: 0.3 + (index * 0.2),
            },
          ]}
          pointerEvents="none" // Not clickable - just visual decoration
        >
          <ExpoImage
            source={{ uri: photo.uri }}
            style={styles.photoPreviewImage}
            contentFit="cover"
            transition={200}
          />
        </Box>
      ))}
      
      <Pressable
        style={[styles.photoPreviewMain, { 
          opacity: 1, // Ensure main photo is fully opaque
          backgroundColor: '#000', // Block stacked photos from showing through
          zIndex: 10 // Ensure main photo is on top
        }]}
        onPress={() => onPress(latestPhoto.id, latestPhoto.cameraId, latestPhoto.friendGroupKey)}
        $pressed={{ opacity: 0.8 }}
      >
        <ExpoImage
          source={{ uri: latestPhoto.uri || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }}
          style={styles.photoPreviewImage}
          contentFit="cover"
          transition={200}
          onError={() => {
            console.warn(`❌ [PHOTO_PREVIEW] Failed to load latest photo ${latestPhoto.id}`);
            console.warn(`❌ [PHOTO_PREVIEW] URI:`, latestPhoto.uri);
            console.warn(`❌ [PHOTO_PREVIEW] Camera ID:`, latestPhoto.cameraId);
            console.warn(`❌ [PHOTO_PREVIEW] Friend Group:`, latestPhoto.friendGroupKey);
          }}
          onLoad={() => {
            console.log(`✅ [PHOTO_PREVIEW] Loaded latest photo ${latestPhoto.id}`);
          }}
        />
      </Pressable>
    </Animated.View>
  );
}

export function CameraPicker({
  cams,
  selected,
  onSelect,
  disabled,
  elementRef,
}: {
  cams: { cameraId: string; name: string }[];
  selected: string | null;
  onSelect: (val: string | null) => void;
  disabled?: boolean;
  elementRef?: React.RefObject<any>;
}) {
  const [open, setOpen] = useState(false);

  const showModal = () => {
    if (disabled) return;
    setOpen(true);
  };

  return (
    <>
      <Pressable
        ref={elementRef}
        onPress={showModal}
        position="absolute"
        top={50}
        right={20}
        bg={disabled ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.6)"}
        px="$3"
        py="$2"
        borderRadius="$xl"
        zIndex={1000}
        disabled={disabled}
      >
        <HStack alignItems="center" space="xs">
          <Text
            color={disabled ? "$gray400" : "$white"}
            fontSize="$xs"
            fontWeight="$medium"
            marginTop={-1.8}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selected
              ? cams.find((c) => c.cameraId === selected)?.name ?? "Camera"
              : "Face-match"}
          </Text>
          <Text
            color={disabled ? "$gray400" : "$white"}
            fontSize="$xs"
            marginTop={1.8}
          >
            ⏷
          </Text>
        </HStack>
      </Pressable>

      <CameraPickerModal
        isOpen={open && !disabled}
        onClose={() => setOpen(false)}
        cameras={cams}
        onSelect={onSelect}
        selectedCameraId={selected}
      />
    </>
  );
}

export default function CameraScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  // Get navigation params (from face-preview return)
  const params = useLocalSearchParams();

  // Refs
  const cameraRef = useRef<Camera>(null);
  const zoomUpdateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exposureTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Walkthrough element refs
  const captureButtonRef = useWalkthroughElement('camera-capture-button');
  const cameraSelectorRef = useWalkthroughElement('camera-selector');
  const cameraFlipButtonRef = useWalkthroughElement('camera-flip-button');
  const recentPhotosRef = useWalkthroughElement('recent-photos-strip');

  // Camera permissions
  const { hasPermission: cameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();

  // Basic camera state
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [showGrid, setShowGrid] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  
  // Camera recovery state
  const [isActive, setIsActive] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  const appState = useRef(AppState.currentState);
  const isFocused = useRef(true);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const baseZoom = useSharedValue(1);

  // Exposure state
  const [exposure, setExposure] = useState(0);
  const [showExposureSlider, setShowExposureSlider] = useState(false);

  // Focus state
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [showFocusIndicator, setShowFocusIndicator] = useState(false);

  // Timer state
  const [timerMode, setTimerMode] = useState<0 | 3 | 5 | 10>(0);

  // Onboarding state
  const [showAutoSyncModal, setShowAutoSyncModal] = useState(false);
  const [permissionInfo, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions({ writeOnly: true });
  const [notificationPromptHandled, setNotificationPromptHandled] = useState(false);
  const [mediaPermissionRequested, setMediaPermissionRequested] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Face enrollment state
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [faceEnrollmentBusy, setFaceEnrollmentBusy] = useState(false);

  // Processing state for modal
  const [busy, setBusy] = useState(false);
  const [processingStage, setProcessingStage] = useState<
    "uploading" | "analyzing" | "matching" | null
  >(null);

  const [showFlash, setShowFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rapidCaptureFlash, setRapidCaptureFlash] = useState(false);
  const [isNavigatingToSettings, setIsNavigatingToSettings] = useState(false);
  const lastCaptureTime = useRef(0);

  const uploadQueue = useUploadQueue();

  // Camera setup
  const device = useCameraDevice(cameraPosition);
  const frontDevice = useCameraDevice('front'); // Always call this hook for face enrollment
  const maxZoom = 3;

  // Use a safe format selection to avoid color space crashes
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } }, // 1080p for good quality without being too heavy
    { fps: 30 }, // Standard 30fps
  ]) || device?.formats[0]; // Fallback to first available format if preferred isn't available

  // Format for front camera (face enrollment)
  const frontFormat = useCameraFormat(frontDevice, [
    { videoResolution: { width: 1920, height: 1080 } },
    { fps: 30 },
  ]) || frontDevice?.formats[0];

  // Hooks
  const { user, profile, refreshUser } = useAuth();
  const userId = user?.username;
  const { data: cams = [] } = useUserCameraMemberships(userId);
  const registerPushNotifications = useRegisterForPushNotifications();
  const uploadPhoto = useUploadPhoto();

  const { autoShareFaces, autoSyncToDevice, isLoaded: preferencesLoaded, loadPreferences, setAutoSyncToDevice, setAutoShareFaces } = usePreferencesStore();
  const { photos: recentPhotos, addPhoto: addRecentPhoto, updatePhotoFriendGroup, loadPhotos: loadRecentPhotos, isLoaded: recentPhotosLoaded, resetForNewUser: resetPhotosForNewUser } = useRecentPhotosStore();
  const processedModalItems = useRef(new Set<string>());

  const activeModalItem = useMemo(() => 
    uploadQueue.getActiveModalItem(), 
    [uploadQueue.queue]
  );

  // completedModalItem removed - now using callback mechanism instead

  // Load preferences and recent photos when component mounts or user changes
  useEffect(() => {
    if (userId && !preferencesLoaded) {
      loadPreferences(userId);
    }
  }, [userId, preferencesLoaded, loadPreferences]);

  useEffect(() => {
    if (userId && !recentPhotosLoaded) {
      loadRecentPhotos(userId);
    }
  }, [userId, recentPhotosLoaded, loadRecentPhotos]);

  // Handle iOS notification permission request
  const requestNotificationPermission = useCallback(async () => {
    if (!userId || !profile) return;

    try {
      // This will show the native iOS notification permission dialog
      await registerPushNotifications.mutateAsync({ profile });
    } catch (error) {
      console.log('[NOTIFICATIONS] Permission failed (non-blocking):', error);
    } finally {
      // Regardless of permission result, move to auto-sync modal
      setNotificationPromptHandled(true);
      setShowAutoSyncModal(true);
    }
  }, [userId, profile, registerPushNotifications]);

  // Check onboarding status and show prompts
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!userId) return;

      try {
        // Check if user just completed profile step (coming from onboarding)
        const profileHandled = await AsyncStorage.getItem(`profile_handled_${userId}`);
        const autoSyncHandled = await AsyncStorage.getItem(`auto_sync_handled_${userId}`);

        if (profileHandled && !autoSyncHandled && !notificationPromptHandled) {
          // User just came from profile step, show auto-sync modal first
          setShowAutoSyncModal(true);
          // Then request iOS notification permission
          requestNotificationPermission();
        }
      } catch (error) {
        console.error('[CAMERA] Error checking onboarding status:', error);
      }
    };

    checkOnboardingStatus();
  }, [userId, notificationPromptHandled]);

  // Handle auto-sync modal completion
  const handleAutoSyncComplete = useCallback(async () => {
    if (!userId) return;

    try {
      // Save auto-sync completion
      await AsyncStorage.setItem(`auto_sync_handled_${userId}`, 'true');
      setShowAutoSyncModal(false);

      console.log('[AUTO_SYNC] Auto-sync modal completed, proceeding to camera');
    } catch (error) {
      console.error('[AUTO_SYNC] Failed to save completion:', error);
    }
  }, [userId]);

  // Face enrollment callbacks (from original onboarding)
  const takeSelfie = useCallback(async () => {
    console.log("Face enrollment: Take picture attempt:", {
      cameraRef: !!cameraRef.current,
      cameraReady,
      device: !!device
    });

    if (!cameraRef.current || faceEnrollmentBusy || !cameraReady) {
      console.log("Face enrollment: Take picture blocked - camera not ready");
      return;
    }

    setFaceEnrollmentBusy(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
      });

      const { uri } = await ImageManipulator.manipulateAsync(
        `file://${photo.path}`,
        [{ resize: { width: 720 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Show preview so user can confirm before uploading
      setPreviewUri(uri);
    } catch (err) {
      console.error("Face enrollment: Camera capture failed", err);
      Alert.alert("Oops", "Could not capture photo – please try again.");
    } finally {
      setFaceEnrollmentBusy(false);
    }
  }, [faceEnrollmentBusy, cameraReady, device]);

  const retakeSelfie = useCallback(() => setPreviewUri(null), []);

  const uploadAndFinishEnrollment = useCallback(async () => {
    if (!previewUri || faceEnrollmentBusy) return;
    setFaceEnrollmentBusy(true);

    try {
      const { username } = await getCurrentUser();
      const rawKey = `onboard/${username}/${uuidv4()}.jpg`;

      await uploadData({
        key: rawKey,
        data: await fetch(previewUri).then((r) => r.blob()),
        options: { accessLevel: "protected", contentType: "image/jpeg" },
      }).result;

      const session = await fetchAuthSession();
      const identityId = session.identityId;
      const s3Key = `protected/${identityId}/${rawKey}`;

      console.log("Face enrollment S3 key:", s3Key);

      const client = generateClient();
      await client.graphql({
        query: enrollUserFace,
        variables: { userId: username, s3Key },
      });

      // Refresh user profile to get updated faceCount
      await refreshUser();

      setFaceEnrollmentBusy(false);

      // Navigate to camera to reload with updated profile (like original onboarding)
      console.log("Face enrollment completed successfully");
      router.replace("/(tabs)/camera");
    } catch (err) {
      console.error("Face enrollment error", err);
      Alert.alert("Something went wrong", "Please try again.");
      setFaceEnrollmentBusy(false);
    }
  }, [previewUri, faceEnrollmentBusy, refreshUser]);

  // Reset stores when user changes
  useEffect(() => {
    if (userId) {
      resetPhotosForNewUser(userId);
      loadRecentPhotos(userId);
      loadPreferences(userId);
    }
  }, [userId, resetPhotosForNewUser, loadRecentPhotos, loadPreferences]);

  // Determine if we should use background processing
  const shouldUseBackgroundProcessing = useMemo(() => {
    if (selectedCam) {
      return true;
    } else {
      return autoShareFaces;
    }
  }, [selectedCam, autoShareFaces]);

  // Create stable callback reference
  const handleModalItemCompletedRef = useRef<(item: QueueItem) => void>(() => {});
  
  // Update callback with current values
  handleModalItemCompletedRef.current = (item: QueueItem) => {
    console.log('🎭 Modal item completed callback triggered:', item.id);
    
    // Always ensure modal state is reset when completion callback is called
    if (busy) {
      setBusy(false);
      setProcessingStage(null);
    }
    
    if (!item.faceProcessingResult) {
      console.log('🎭 No results, removing item and closing modal');
      uploadQueue.removeItem(item.id);
      return;
    }
    
    // Prevent duplicate processing
    if (processedModalItems.current.has(item.id)) {
      console.log('🎭 Item already processed, skipping:', item.id);
      return;
    }
    
    processedModalItems.current.add(item.id);
    
    const result = item.faceProcessingResult;
    
    if (result.photoId && result.photoId !== 'failed') {
      let friendGroupKey: string | undefined;
      if (!item.selectedCam && result.matches?.length > 0) {
        const friendIds = result.matches.map((m: any) => m.userId).sort();
        friendGroupKey = friendIds.join(',');
      }

      console.log('🖼️ [PHOTO_PREVIEW] Adding modal photo:', result.photoId, 'friendGroupKey:', friendGroupKey);
      console.log('🖼️ [PHOTO_PREVIEW] Modal photo URI:', item.photoUri);

      if (userId) {
        addRecentPhoto({
          id: result.photoId,
          uri: item.photoUri || '',
          timestamp: Date.now(),
          cameraId: item.selectedCam,
          friendGroupKey
        }, userId);
      }
    }
    
    // Remove item from queue immediately after processing
    uploadQueue.removeItem(item.id);
    
    // Success message for shared camera photos
    if (item.selectedCam) {
      showMessage({
        message: "📷 Photo shared!",
        description: `Successfully uploaded to ${item.selectedCam}`,
        type: "success",
        duration: 2000,
      });
      setTimeout(() => {
        processedModalItems.current.delete(item.id);
      }, 100);
      return;
    }
    
    if (result.processingFailed) {
      showMessage({
        message: "⚠️ Face recognition failed",
        description: "Photo uploaded successfully but face processing failed.",
        type: "warning",
        duration: 2000,
      });
      setTimeout(() => {
        processedModalItems.current.delete(item.id);
      }, 100);
      return;
    }
    
    if (result.facesDetected === 0 || result.friendsMatched === 0) {
      let message, description;
      if (result.facesDetected === 0) {
        message = "📸 Photo saved!";
        description = "No faces detected in the photo.";
      } else {
        message = "📸 Photo saved!"; 
        description = "Faces detected but no friend matches found.";
      }

      showMessage({
        message,
        description,
        type: "info",
        duration: 2000,
      });
      
      setTimeout(() => {
        processedModalItems.current.delete(item.id);
      }, 100);
      return;
    }

    setTimeout(() => {
      processedModalItems.current.delete(item.id);
    }, 100);
    
    router.push({
      pathname: "/photo/face-preview" as any,
      params: { 
        data: JSON.stringify(result),
        photoUri: item.photoUri || ''
      } as any,
    });
  };

  // Set the callback on mount with stable reference
  useEffect(() => {
    const stableCallback = (item: QueueItem) => {
      if (handleModalItemCompletedRef.current) {
        handleModalItemCompletedRef.current(item);
      }
    };
    
    uploadQueue.setModalCompletedCallback(stableCallback);
  }, []);

  // Derived state - modal processing only when not using background processing
  const isModalProcessing = busy || processingStage !== null || uploadPhoto.isPending || timerActive;
  const shouldShowModal = !shouldUseBackgroundProcessing && isModalProcessing;
  
  // Camera is disabled during timer or modal processing
  const isCameraDisabled = timerActive || shouldShowModal;

  // More permissive capture button - only disable for hardware/safety reasons
  const isCaptureDisabled = useMemo(() => {
    return !cameraReady || 
           timerActive || 
           isCapturing ||
           shouldShowModal;  // Disable during modal processing
  }, [cameraReady, timerActive, isCapturing, shouldShowModal]);

  // Camera recovery: Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 [CAMERA] AppState change:', appState.current, '->', nextAppState);
      
      if (appState.current === 'background' && nextAppState === 'active') {
        console.log('🔄 [CAMERA] App resumed from background, restarting camera');
        // Small delay to ensure app is fully active
        setTimeout(() => {
          if (isFocused.current && cameraPermission) {
            setIsActive(false);
            setTimeout(() => {
              setIsActive(true);
              setCameraKey(prev => prev + 1);
            }, 25);
          }
        }, 100);
      } else if (nextAppState === 'background') {
        console.log('🔄 [CAMERA] App going to background, deactivating camera');
        setIsActive(false);
      } else if (nextAppState === 'active') {
        console.log('🔄 [CAMERA] App becoming active, activating camera');
        if (isFocused.current && cameraPermission) {
          setIsActive(true);
        }
      }
      
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [cameraPermission]);

  // Camera recovery: Handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      console.log('📱 [CAMERA] Screen focused');
      isFocused.current = true;
      
      // Only restart camera if we're returning from background, not during in-app navigation
      // The AppState listener above already handles background->active transitions with camera resets
      if (cameraPermission && AppState.currentState === 'active') {
        setIsActive(true);
        // Don't reset camera key here - let AppState handler manage camera resets
        // This prevents flickering during in-app navigation
      }

      return () => {
        console.log('📱 [CAMERA] Screen unfocused');
        isFocused.current = false;
        setIsActive(false);
      };
    }, [cameraPermission])
  );

  // Restore modal on app resume and handle completion fallback
  useEffect(() => {
    if (activeModalItem && !busy) {
      setBusy(true);
      setProcessingStage(activeModalItem.status === 'processing' ? "analyzing" : "uploading");
    }
    
    // Fallback: if there's no active modal item but we're still showing busy state
    if (!activeModalItem && busy) {
      console.log('🎭 No active modal item but showing busy state - checking for completed items');
      
      // Look for recently completed modal items that might have been missed
      const recentCompletedModalItem = uploadQueue.queue.find(item => 
        item.isModalUpload && 
        item.status === 'completed' && 
        item.faceProcessingResult &&
        !processedModalItems.current.has(item.id) &&
        Date.now() - item.timestamp < 10000 // Within last 10 seconds
      );
      
      if (recentCompletedModalItem) {
        console.log('🎭 Found missed completed modal item, triggering callback:', recentCompletedModalItem.id);
        handleModalItemCompletedRef.current(recentCompletedModalItem);
      } else {
        console.log('🎭 No completed modal items found, resetting busy state');
        setBusy(false);
        setProcessingStage(null);
      }
    }
  }, [activeModalItem?.id, busy, uploadQueue.queue]);

  // Note: Modal completion is now handled by the callback mechanism above
  // This effect was redundant and could cause duplicate processing

  // Track completed background uploads
  useEffect(() => {
    const completedItems = uploadQueue.queue.filter(item => 
      item.status === 'completed' && 
      !item.isModalUpload && 
      item.faceProcessingResult?.photoId &&
      item.faceProcessingResult.photoId !== 'failed'
      // Note: Photos with processingFailed=true should still show in preview
    );
    
    console.log('🖼️ [PHOTO_PREVIEW] Background completed items:', completedItems.length);
    console.log('🖼️ [PHOTO_PREVIEW] All queue items:', uploadQueue.queue.map(item => ({
      id: item.id.slice(-8),
      status: item.status,
      isModal: item.isModalUpload,
      selectedCam: item.selectedCam,
      hasResult: !!item.faceProcessingResult,
      photoId: item.faceProcessingResult?.photoId?.slice(-8),
      processingFailed: item.faceProcessingResult?.processingFailed
    })));
    
    completedItems.forEach(item => {
      // For face-match photos, extract friendGroupKey from matches
      let friendGroupKey: string | undefined;
      if (!item.selectedCam && item.faceProcessingResult!.matches?.length > 0) {
        // Create friendGroupKey from matched friend IDs (sorted for consistency)
        const friendIds = item.faceProcessingResult!.matches.map(m => m.userId).sort();
        friendGroupKey = friendIds.join(',');
      }

      console.log('🖼️ [PHOTO_PREVIEW] Adding background photo:', item.faceProcessingResult!.photoId, 'cameraId:', item.selectedCam, 'friendGroupKey:', friendGroupKey);
      if (userId) {
        addRecentPhoto({
          id: item.faceProcessingResult!.photoId,
          uri: item.photoUri,
          timestamp: Date.now(),
          cameraId: item.selectedCam,
          friendGroupKey
        }, userId);
      }
    });
  }, [uploadQueue.queue, addRecentPhoto, userId]);

  // Handle shared photo from face-preview screen
  useEffect(() => {
    const sharedPhotoId = params.sharedPhotoId as string;
    const sharedPhotoUri = params.sharedPhotoUri as string;
    const friendGroupKey = params.friendGroupKey as string;
    
    if (sharedPhotoId) {
      console.log('🖼️ [PHOTO_PREVIEW] Updating shared photo from face-preview:', sharedPhotoId, 'friendGroupKey:', friendGroupKey);
      
      // Check if photo already exists in the store
      const existingPhoto = recentPhotos.find(p => p.id === sharedPhotoId);
      
      if (existingPhoto && userId) {
        // Photo exists - only update friendGroupKey
        console.log('🖼️ [PHOTO_PREVIEW] Updating friendGroupKey for existing photo');
        updatePhotoFriendGroup(sharedPhotoId, friendGroupKey || undefined, userId);
      } else if (userId) {
        // Photo doesn't exist - add it
        addRecentPhoto({
          id: sharedPhotoId,
          uri: sharedPhotoUri,
          timestamp: Date.now(),
          cameraId: null, // Face-match photo
          friendGroupKey: friendGroupKey || undefined
        }, userId);
      }
      
      // Clear the params to avoid re-adding on re-renders
      router.setParams({ sharedPhotoId: '', sharedPhotoUri: '', friendGroupKey: '' });
    }
  }, [params.sharedPhotoId, params.sharedPhotoUri, params.friendGroupKey, recentPhotos, addRecentPhoto, updatePhotoFriendGroup, router, userId]);

  // Stage progression with immediate status monitoring
  useEffect(() => {
    if (!activeModalItem || !busy) return;

    if (activeModalItem.status === 'pending' && processingStage !== "uploading") {
      setProcessingStage("uploading");
    } else if (activeModalItem.status === 'processing') {
      if (processingStage === "uploading") {
        const timer1 = setTimeout(() => {
          if (busy && activeModalItem.status === 'processing') {
            setProcessingStage("analyzing");
          }
        }, 800);

        const timer2 = setTimeout(() => {
          if (busy && activeModalItem.status === 'processing') {
            setProcessingStage("matching");
          }
        }, 2000);

        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }
  }, [activeModalItem?.id, activeModalItem?.status, busy, processingStage]);

  // Combined background processing effects
  useEffect(() => {
    if (!shouldUseBackgroundProcessing) {
      // Only clean up truly stuck items (older than 2 minutes)
      const cleanupInterval = setInterval(() => {
        const activeModal = uploadQueue.getActiveModalItem();
        
        if (activeModal) {
          const age = Date.now() - activeModal.timestamp;
          
          if (age > 120000 && activeModal.status === 'processing') {
            console.warn('Modal item stuck, removing from queue');
            uploadQueue.removeItem(activeModal.id);
            // Don't reset busy state here - let completion callback handle it
          }
        }
      }, 30000); // Check every 30 seconds instead of 10ms

      return () => clearInterval(cleanupInterval);
    } else {
      // Reset modal state when switching to background mode
      if (busy) {
        setBusy(false);
        setProcessingStage(null);
        
        const activeModal = uploadQueue.getActiveModalItem();
        if (activeModal) {
          uploadQueue.removeItem(activeModal.id);
        }
      }
    }
  }, [shouldUseBackgroundProcessing, busy, uploadQueue]);

  // Camera ready and zoom sync effects
  useEffect(() => {
    if (device) {
      setZoom(1);
      setExposure(0);
      baseZoom.value = 1;
      const timer = setTimeout(() => {
        setCameraReady(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setCameraReady(false);
    }
  }, [device]);

  useEffect(() => {
    baseZoom.value = zoom;
  }, [zoom, baseZoom]);

  // Clean up old completed items every 30 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      uploadQueue.clearCompleted();
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, [uploadQueue]);

  // Component cleanup
  useEffect(() => {
    return () => {
      // Clean up timeouts
      if (zoomUpdateTimeout.current) {
        clearTimeout(zoomUpdateTimeout.current);
      }
      if (exposureTimeout.current) {
        clearTimeout(exposureTimeout.current);
      }
      
      // Clean up processed items and reset state
      processedModalItems.current.clear();
      if (busy) {
        setBusy(false);
        setProcessingStage(null);
      }
    };
  }, []);

  // Callback functions
  const handleFocusAnimationComplete = useCallback(() => {
    setShowFocusIndicator(false);
  }, []);

  const updateZoom = useCallback((newZoom: number) => {
    setZoom(newZoom);
    
    if (zoomUpdateTimeout.current) {
      clearTimeout(zoomUpdateTimeout.current);
    }
    
    setShowZoomIndicator(true);
    
    zoomUpdateTimeout.current = setTimeout(() => {
      setShowZoomIndicator(false);
      zoomUpdateTimeout.current = null;
    }, 2000);
  }, []);

  const saveZoom = useCallback((finalZoom: number) => {
    setZoom(finalZoom);
  }, []);

  const handleQuickZoom = useCallback((targetZoom: number) => {
    setZoom(targetZoom);
    baseZoom.value = targetZoom;
    
    setShowZoomIndicator(true);
    if (zoomUpdateTimeout.current) {
      clearTimeout(zoomUpdateTimeout.current);
    }
    zoomUpdateTimeout.current = setTimeout(() => {
      setShowZoomIndicator(false);
      zoomUpdateTimeout.current = null;
    }, 1500);
  }, [baseZoom]);

  const handleExposureChange = useCallback((newExposure: number) => {
    setExposure(newExposure);
    
    if (exposureTimeout.current) {
      clearTimeout(exposureTimeout.current);
    }
    
    exposureTimeout.current = setTimeout(() => {
      setShowExposureSlider(false);
      exposureTimeout.current = null;
    }, 3000);
  }, []);

  const toggleExposureSlider = useCallback(() => {
    if (isCameraDisabled) return;
    setShowExposureSlider(prev => !prev);
    
    if (!showExposureSlider) {
      if (exposureTimeout.current) {
        clearTimeout(exposureTimeout.current);
      }
      exposureTimeout.current = setTimeout(() => {
        setShowExposureSlider(false);
        exposureTimeout.current = null;
      }, 5000);
    }
  }, [isCameraDisabled, showExposureSlider]);

  const handleCameraTap = useCallback(async (event: any) => {
    if (isCameraDisabled || !cameraReady || !cameraRef.current || showFocusIndicator) return;

    const { locationX, locationY } = event.nativeEvent;
    const focusX = locationX / screenWidth;
    const focusY = locationY / screenHeight;

    try {
      if (device?.supportsFocus) {
        await cameraRef.current.focus({ x: focusX, y: focusY });
      }
      
      setFocusPoint({ x: focusX, y: focusY });
      setShowFocusIndicator(true);
    } catch (error) {
      console.warn("Focus failed:", error);
      setFocusPoint({ x: focusX, y: focusY });
      setShowFocusIndicator(true);
    }
  }, [isCameraDisabled, cameraReady, showFocusIndicator, device]);

  const cycleTimerMode = useCallback(() => {
    if (isCameraDisabled) return;
    
    setTimerMode(current => {
      switch (current) {
        case 0: return 3;
        case 3: return 5;
        case 5: return 10;
        case 10: return 0;
        default: return 0;
      }
    });
  }, [isCameraDisabled]);

  const capturePhoto = useCallback(async () => {
    console.log('🔍 [DEBUG] CAPTURE BUTTON PRESSED - starting capture function');
    if (!cameraRef.current || !cameraReady || !device) {
      console.log('🔍 [DEBUG] CAPTURE BLOCKED - camera:', !!cameraRef.current, 'ready:', cameraReady, 'device:', !!device);
      return;
    }

    const now = Date.now();
    if (now - lastCaptureTime.current < 20) {
      return;
    }

    if (isCapturing) {
      return;
    }

    // Automatically switch to background processing if modal is active
    let useBackgroundForThisCapture = shouldUseBackgroundProcessing;
    let showRapidFeedback = false;
    
    if (!shouldUseBackgroundProcessing) {
      const existingModalItem = uploadQueue.getActiveModalItem();
      if (existingModalItem || busy) {
        useBackgroundForThisCapture = true;
        showRapidFeedback = true;
      }
    }

    setIsCapturing(true);
    lastCaptureTime.current = now;
    
    try {
      setShowFlash(true);

      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
        flash: flash,
      });

      setTimeout(() => setShowFlash(false), 350);

      // Use original photo path - let usePhotoMutations handle all processing
      const photoUri = `file://${photo.path}`;

      // Only save to album if auto-sync is enabled (setting already ensures permission is granted)
      if (autoSyncToDevice) {
        try {
          const assetId = await photoAlbumService.savePhotoToAlbum(photoUri, {
            title: selectedCam ? `Shared Event: ${selectedCam}` : "Face-match Photo",
            description: "Photo taken with PhomoCam",
          });
          
          // Mark as processed to prevent it from appearing in synced photo review
          if (assetId) {
            const processedKey = `${STORAGE_KEYS.PHOTO_PROCESSED_PREFIX}${assetId}`;
            await AsyncStorage.setItem(
              processedKey,
              JSON.stringify({
                processedAt: new Date().toISOString(),
                source: 'camera_capture',
                cameraType: selectedCam ? 'shared_camera' : 'face_match',
                status: 'captured_from_app'
              })
            );
            console.log(`🔒 Marked camera photo ${assetId} as processed to exclude from sync`);
          }
        } catch (albumError) {
          console.warn("Failed to save to album:", albumError);
        }
      } else {
        console.log(`📱 Skipping album save - auto-sync is disabled`);
      }

      if (useBackgroundForThisCapture) {
        console.log('🔍 [DEBUG] Using BACKGROUND processing - showing flash message');
        const queueId = uploadQueue.addToQueue(photoUri, selectedCam);
        
        if (showRapidFeedback) {
          setRapidCaptureFlash(true);
          setTimeout(() => setRapidCaptureFlash(false), 1000);
        }
        
        if (!queueId) {
          return;
        }
        
        // Show flash message for background processing with sync status
        const cameraName = selectedCam ? (cams.find((c) => c.cameraId === selectedCam)?.name ?? selectedCam) : null;
        const syncStatus = autoSyncToDevice ? " • Saving to device" : "";
        showMessage({
          message: selectedCam ? "📷 Photo captured!" : "📸 Photo captured!",
          description: selectedCam ? `Uploading to ${cameraName}...${syncStatus}` : `Processing faces...${syncStatus}`,
          type: "info",
          duration: 2000,
        });
        
        return;
      }

      const queueId = uploadQueue.addToQueue(photoUri, selectedCam, { isModalUpload: true });

      if (!queueId) {
        showMessage({
          message: "Queue Full",
          description: "Too many uploads in progress. Please wait and try again.",
          type: "warning",
          duration: 2000,
        });
        return;
      }

      setBusy(true);
      setProcessingStage("uploading");

    } catch (err) {
      console.error(err);
      setProcessingStage(null);
      setBusy(false);
      showMessage({
        message: "❌ Photo capture failed",
        description: "Could not take photo. Please try again.",
        type: "danger",
        duration: 2000,
      });
    } finally {
      setTimeout(() => {
        setIsCapturing(false);
      }, 10);
    }
  }, [selectedCam, uploadQueue, flash, busy, cameraReady, device, shouldUseBackgroundProcessing, isCapturing, autoSyncToDevice, cams]);
  
  const handleTimerComplete = useCallback(() => {
    setTimerActive(false);
    setTimerSeconds(0);
    capturePhoto();
  }, [capturePhoto]);

  const startTimer = useCallback(() => {
    if (timerMode === 0) {
      capturePhoto();
    } else {
      setTimerActive(true);
      setTimerSeconds(timerMode);
    }
  }, [timerMode, capturePhoto]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || !device || timerActive || isCapturing) {
      return;
    }

    startTimer();
  }, [cameraReady, device, timerActive, startTimer, isCapturing]);

  const handlePhotoPreviewPress = useCallback((photoId: string, cameraId: string | null, friendGroupKey?: string) => {
    if (isNavigatingToSettings) return;
    setIsNavigatingToSettings(true);
    
    setTimeout(() => {
      if (cameraId) {
        // Camera photo - navigate with cameraId
        router.push({
          pathname: `/photo/${photoId}` as any,
          params: { cameraId },
        });
      } else if (friendGroupKey) {
        // Face-match photo with friends - navigate with friendGroupKey
        router.push({
          pathname: `/photo/${photoId}` as any,
          params: { friendGroupKey },
        });
      } else {
        // Face-match photo without friends - simple navigation
        router.push(`/photo/${photoId}` as any);
      }
    }, 10);
    
    setTimeout(() => setIsNavigatingToSettings(false), 2000);
  }, [router, isNavigatingToSettings]);

  const pinchGesture = useMemo(() => 
    Gesture.Pinch()
      .onUpdate((event) => {
        'worklet';
        const newZoom = Math.max(1, Math.min(3, baseZoom.value * event.scale));
        runOnJS(updateZoom)(newZoom);
      })
      .onEnd((event) => {
        'worklet';
        const finalZoom = Math.max(1, Math.min(3, baseZoom.value * event.scale));
        baseZoom.value = finalZoom;
        runOnJS(saveZoom)(finalZoom);
      })
  , [updateZoom, saveZoom]);

  if (cameraPermission === undefined) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack space="md" alignItems="center">
          <Spinner size="large" />
          <Text color={isDark ? "#fff" : "#000"} fontSize="$md">
            Checking permissions...
          </Text>
        </VStack>
      </Center>
    );
  }

  // Camera permission check - show permission screen if denied
  if (cameraPermission === false) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"} px="$6">
        <VStack space="lg" alignItems="center">
          <Text
            color={isDark ? "#fff" : "#000"}
            fontSize="$md"
            textAlign="center"
            lineHeight="$lg"
          >
            PhomoCam needs camera access to take photos. This allows you to capture
            moments and share them with friends.
          </Text>

          {!permissionRequested ? (
            <Button
              bg="#007AFF"
              borderRadius="$lg"
              px="$6"
              h={48}
              onPress={async () => {
                setPermissionRequested(true);
                await requestCameraPermission();
              }}
              $pressed={{ bg: "#0056CC" }}
            >
              <ButtonText color="$white" fontWeight="$semibold">
                Continue
              </ButtonText>
            </Button>
          ) : (
            <VStack space="md" alignItems="center">
              <Text
                color={isDark ? "#999" : "#666"}
                fontSize="$sm"
                textAlign="center"
                lineHeight="$md"
              >
                Camera permission was denied. Please enable it in Settings to
                use the camera.
              </Text>

              <Button
                bg="#666"
                borderRadius="$lg"
                px="$6"
                h={40}
                onPress={() => Linking.openSettings()}
                $pressed={{ bg: "#555" }}
              >
                <ButtonText color="$white" fontWeight="$medium">
                  Open Settings
                </ButtonText>
              </Button>
            </VStack>
          )}
        </VStack>
      </Center>
    );
  }

  // Show auto-sync modal after camera permission is granted
  if (cameraPermission && showAutoSyncModal) {
    return (
      <Modal isOpen={true} onClose={() => {}} closeOnOverlayClick={false}>
        <ModalBackdrop />
        <ModalContent
          maxWidth="$96"
          width="90%"
          bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
          borderRadius="$xl"
        >
          <ModalBody p="$6">
            <VStack space="xl" alignItems="center" mt="$4">
              <Box
                width={80}
                height={80}
                borderRadius="$full"
                bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize={40}>📲</Text>
              </Box>

              <VStack space="md" alignItems="center">
                <Text
                  fontSize="$xl"
                  fontWeight="$bold"
                  color={isDark ? "$textDark50" : "$textLight900"}
                  textAlign="center"
                >
                  Photo Settings
                </Text>
                <Text
                  fontSize="$md"
                  color={isDark ? "$textDark200" : "$textLight700"}
                  textAlign="center"
                  lineHeight="$lg"
                >
                  Configure how you want to handle photos. You can change these anytime in settings.
                </Text>
              </VStack>

              {/* Auto-sync setting */}
              <Box
                width="100%"
                bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                borderRadius="$lg"
                p="$4"
              >
                {permissionInfo?.status === 'granted' ? (
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack flex={1} mr="$3">
                      <Text
                        fontSize="$md"
                        fontWeight="$semibold"
                        color={isDark ? "$textDark50" : "$textLight900"}
                        lineHeight="$lg"
                      >
                        Auto-sync to Camera Roll
                      </Text>
                      <Text
                        fontSize="$md"
                        color={isDark ? "$textDark300" : "$textLight600"}
                        lineHeight="$md"
                        mt="$1"
                      >
                        Save shared photos to your device
                      </Text>
                    </VStack>
                    <Switch
                      value={autoSyncToDevice}
                      onValueChange={async () => {
                        if (!userId) return;

                        try {
                          await setAutoSyncToDevice(!autoSyncToDevice, userId);
                        } catch (error) {
                          console.error("Failed to save autoSyncToDevice:", error);
                        }
                      }}
                      trackColor={{
                        false: isDark ? "#374151" : "#d1d5db",
                        true: "#3b82f6"
                      }}
                      thumbColor="#ffffff"
                    />
                  </HStack>
                ) : (
                  <VStack space="md" alignItems="center">
                    <Text
                      fontSize="$md"
                      fontWeight="$semibold"
                      color={isDark ? "$textDark50" : "$textLight900"}
                      textAlign="center"
                    >
                      Auto-sync to Camera Roll
                    </Text>
                    <Text
                      fontSize="$sm"
                      color={isDark ? "$textDark300" : "$textLight600"}
                      textAlign="center"
                      lineHeight="$sm"
                    >
                      Enable to auto save photos shared with you
                    </Text>

                    {!mediaPermissionRequested ? (
                      <Button
                        bg="$primary600"
                        borderRadius="$md"
                        h={40}
                        px="$4"
                        onPress={async () => {
                          setMediaPermissionRequested(true);
                          try {
                            const result = await requestMediaPermission();

                            if (result.status === 'granted' && userId) {
                              await setAutoSyncToDevice(true, userId);
                              console.log('[AUTO_SYNC] Auto-sync enabled with permission');
                            } else {
                              console.log('[AUTO_SYNC] Permission denied or limited');
                            }
                          } catch (error) {
                            console.error('[AUTO_SYNC] Error requesting permission:', error);
                          }
                        }}
                      >
                        <ButtonText color="$white" fontSize="$sm">
                          Enable Auto-sync
                        </ButtonText>
                      </Button>
                    ) : (
                      <VStack space="sm" alignItems="center" mb={5}>
                        <Text
                          fontSize="$sm"
                          color={isDark ? "$textDark400" : "$textLight500"}
                          textAlign="center"
                        >
                          Permission denied, enable in Settings.
                        </Text>
                        <Button
                          bg="$gray600"
                          borderRadius="$md"
                          h={36}
                          px="$3"
                          onPress={() => Linking.openSettings()}
                        >
                          <ButtonText color="$white" fontSize="$sm">
                            Open Settings
                          </ButtonText>
                        </Button>
                      </VStack>
                    )}
                  </VStack>
                )}
              </Box>

              {/* Auto-share setting */}
              <Box
                width="100%"
                bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                borderRadius="$lg"
                p="$4"
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack flex={1} mr="$3">
                    <Text
                      fontSize="$md"
                      fontWeight="$semibold"
                      color={isDark ? "$textDark50" : "$textLight900"}
                      lineHeight="$lg"
                    >
                      Auto-share with Friends
                    </Text>
                    <Text
                      fontSize="$md"
                      color={isDark ? "$textDark300" : "$textLight600"}
                      lineHeight="$md"
                      mt="$1"
                    >
                      Automatically share photos when friends are detected
                    </Text>
                  </VStack>
                  <Switch
                    value={autoShareFaces}
                    onValueChange={async () => {
                      if (!userId) return;

                      try {
                        await setAutoShareFaces(!autoShareFaces, userId);
                      } catch (error) {
                        console.error("Failed to save autoShareFaces:", error);
                      }
                    }}
                    trackColor={{
                      false: isDark ? "#374151" : "#d1d5db",
                      true: "#3b82f6"
                    }}
                    thumbColor="#ffffff"
                  />
                </HStack>
              </Box>

              <Button
                bg="$primary600"
                borderRadius="$lg"
                h={48}
                width="100%"
                onPress={handleAutoSyncComplete}
                justifyContent="center"
                alignItems="center"
              >
                <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
                  Continue to Camera
                </ButtonText>
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  // Show face enrollment when faceCount is 0 - full screen camera like original onboarding
  if (cameraPermission && !showAutoSyncModal && (profile?.faceCount === 0 || previewUri)) {
    if (!previewUri) {
      // Camera view for taking selfie
      return (
        <Box flex={1} bg="$black">
          {device && frontDevice ? (
            <Camera
              ref={cameraRef}
              style={styles.camera}
              device={frontDevice}
              isActive={true}
              photo={true}
              format={frontFormat}
              photoQualityBalance="balanced"
            />
          ) : (
            <Center flex={1}>
              <Spinner size="large" color="$white" />
            </Center>
          )}

          {/* UI Overlay */}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            {/* Top instructions */}
            <Box
              position="absolute"
              top={40}
              left={0}
              right={0}
              px="$6"
            >
              <VStack space="md" alignItems="center">
                <Text
                  fontSize="$3xl"
                  fontWeight="$bold"
                  color="$white"
                  textAlign="center"
                  style={{
                    textShadowColor: 'rgba(0,0,0,0.75)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 4,
                  }}
                >
                  Take a Selfie
                </Text>
                <Text
                  fontSize="$md"
                  color="$white"
                  textAlign="center"
                  px="$4"
                  style={{
                    textShadowColor: 'rgba(0,0,0,0.75)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }}
                >
                  We need a photo of your face to identify you in future photos
                </Text>
              </VStack>
            </Box>

            {/* Face overlay guide */}
            <Center flex={1}>
              <Box
                width={280}
                height={380}
                borderRadius={140}
                borderWidth={3}
                borderColor="rgba(255, 255, 255, 0.5)"
                bg="transparent"
                style={{
                  borderStyle: 'dashed',
                }}
              />
            </Center>

            {/* Bottom button */}
            <Box position="absolute" bottom={40} width="100%" alignItems="center">
              <TouchableOpacity
                style={[
                  styles.snapBtn,
                  (faceEnrollmentBusy || !cameraReady) && styles.snapBtnDisabled
                ]}
                onPress={takeSelfie}
                disabled={faceEnrollmentBusy || !cameraReady}
              />
            </Box>
          </Box>
        </Box>
      );
    } else {
      // Preview view with retake/use buttons - full screen with overlaid UI
      return (
        <Box flex={1} bg="$black">
          {/* Full screen preview image */}
          <ExpoImage
            source={{ uri: previewUri }}
            style={{ flex: 1 }}
            contentFit="cover"
          />

          {/* UI Overlay */}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            {/* Top text */}
            <Box
              position="absolute"
              top={40}
              left={0}
              right={0}
              px="$6"
            >
              <Text
                fontSize="$3xl"
                fontWeight="$bold"
                color="$white"
                textAlign="center"
                style={{
                  textShadowColor: 'rgba(0,0,0,0.75)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4,
                }}
              >
                Review Your Photo
              </Text>
            </Box>

            {/* Bottom buttons */}
            <Box position="absolute" bottom={40} left={0} right={0} px="$6">
              <HStack space="md" width="100%">
                <Button
                  bg="rgba(100, 100, 100, 0.8)"
                  borderRadius="$lg"
                  h={56}
                  flex={1}
                  onPress={retakeSelfie}
                  disabled={faceEnrollmentBusy}
                  $pressed={{ bg: "rgba(80, 80, 80, 0.9)" }}
                >
                  <ButtonText color="$white" fontWeight="$semibold" fontSize="$lg">
                    Retake
                  </ButtonText>
                </Button>
                <Button
                  bg="rgba(59, 130, 246, 0.9)"
                  borderRadius="$lg"
                  h={56}
                  flex={1}
                  onPress={uploadAndFinishEnrollment}
                  disabled={faceEnrollmentBusy}
                  $pressed={{ bg: "rgba(37, 99, 235, 0.95)" }}
                >
                  {faceEnrollmentBusy ? (
                    <Spinner size="small" color="$white" />
                  ) : (
                    <ButtonText color="$white" fontWeight="$semibold" fontSize="$lg">
                      Use This Photo
                    </ButtonText>
                  )}
                </Button>
              </HStack>
            </Box>
          </Box>
        </Box>
      );
    }
  }

  if (!device) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack space="md" alignItems="center">
          <Spinner size="large" />
          <Text color={isDark ? "#fff" : "#000"} fontSize="$md">
            Loading camera...
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box flex={1} bg="$black">
      <GestureDetector gesture={pinchGesture}>
        <RNPressable
          style={styles.camera}
          onPress={handleCameraTap}
          disabled={isCameraDisabled}
        >
          <Camera
            key={cameraKey}
            ref={cameraRef}
            style={styles.camera}
            device={device}
            isActive={isActive && cameraPermission}
            photo={true}
            photoQualityBalance="balanced"
            zoom={zoom}
            exposure={exposure}
            format={format}
            videoHdr={false}
            photoHdr={false}
            onInitialized={() => {
              console.log('📷 [CAMERA] Camera initialized successfully');
              setCameraReady(true);
            }}
            onError={(error) => {
              console.error("❌ [CAMERA] Camera error:", error);
              setCameraReady(false);
              // Auto-recovery on error
              setTimeout(() => {
                console.log('🔄 [CAMERA] Auto-recovering from error');
                setCameraKey(prev => prev + 1);
              }, 1000);
            }}
          />
        </RNPressable>
      </GestureDetector>

      <CameraFlash visible={showFlash} />

      <RapidCaptureIndicator visible={rapidCaptureFlash} />

      <GridOverlay visible={showGrid && !isCameraDisabled && !timerActive} />
        
      <ZoomIndicator
        zoom={zoom}
        maxZoom={maxZoom}
        visible={showZoomIndicator}
      />

      <FocusIndicator
        position={focusPoint ? { 
          x: focusPoint.x * screenWidth, 
          y: focusPoint.y * screenHeight 
        } : null}
        visible={showFocusIndicator}
        onAnimationComplete={handleFocusAnimationComplete}
      />

      <ExposureSlider
        exposure={exposure}
        onExposureChange={handleExposureChange}
        visible={showExposureSlider}
        disabled={isCameraDisabled}
      />

      <BackgroundUploadIndicator
        activeStats={uploadQueue.activeStats}
        visible={shouldUseBackgroundProcessing}
        showingModal={busy}
      />

      {timerActive && (
        <TimerCountdown
          seconds={timerSeconds}
          onComplete={handleTimerComplete}
        />
      )}

      <CameraPicker
        cams={cams}
        selected={selectedCam}
        onSelect={setSelectedCam}
        disabled={isCameraDisabled}
        elementRef={cameraSelectorRef}
      />

      {preferencesLoaded && (
        <Pressable
          position="absolute"
          bottom={100}
          right={selectedCam === null ? 22 : 24}
          bg="rgba(0,0,0,0.4)"
          px="$2"
          py="$1"
          borderRadius="$md"
          zIndex={500}
          disabled={isNavigatingToSettings}
          opacity={isNavigatingToSettings ? 0.6 : 1}
          onPress={() => {
            if (isNavigatingToSettings) return;
            setIsNavigatingToSettings(true);
            router.push({
              pathname: "/settingsModal" as any,
              params: { openPreferences: "true" } as any,
            });
            // Reset after navigation completes
            setTimeout(() => setIsNavigatingToSettings(false), 1000);
          }}
          $pressed={{
            bg: "rgba(0,0,0,0.6)",
          }}
        >
          {selectedCam === null ? (
            <HStack space="xs" alignItems="center">
              <VStack space="xs" alignItems="center">
                <Text color="$white" fontSize="$2xs" textAlign="center">
                  Auto Share: {autoShareFaces ? "On" : "Off"}
                </Text>
                <Text color="$white" fontSize="$2xs" textAlign="center">
                  Auto Sync: {autoSyncToDevice ? "On" : "Off"}
                </Text>
              </VStack>
              <Text color="$white" fontSize="$2xs">⚙️</Text>
            </HStack>
          ) : (
            <Text color="$white" fontSize="$2xs" textAlign="center">
              Auto Sync: {autoSyncToDevice ? "On" : "Off"} ⚙️
            </Text>
          )}
        </Pressable>
      )}

      <QuickZoomButtons
        currentZoom={zoom}
        onZoomChange={handleQuickZoom}
        disabled={isCameraDisabled}
      />

      <HStack position="absolute" top={50} left={20} space="md" zIndex={1000}>
        <Pressable
          onPress={() => !isCameraDisabled && setShowGrid(!showGrid)}
          bg={showGrid ? "rgba(255,255,255,0.3)" : isCameraDisabled ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.6)"}
          px="$2"
          py="$1"
          borderRadius="$md"
          disabled={isCameraDisabled}
        >
          <Text
            color={isCameraDisabled ? "$gray400" : "$white"}
            fontSize="$xs"
            fontWeight="$medium"
          >
            Grid
          </Text>
        </Pressable>

        <Pressable
          onPress={cycleTimerMode}
          bg={timerMode > 0 ? "rgba(255,255,255,0.3)" : isCameraDisabled ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.6)"}
          px="$2"
          py="$1"
          borderRadius="$md"
          disabled={isCameraDisabled}
        >
          <Text
            color={isCameraDisabled ? "$gray400" : "$white"}
            fontSize="$xs"
            fontWeight="$medium"
          >
            {timerMode === 0 ? "Timer" : `${timerMode}s`}
          </Text>
        </Pressable>

        <Pressable
          onPress={toggleExposureSlider}
          bg={showExposureSlider ? "rgba(255,255,255,0.3)" : isCameraDisabled ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.6)"}
          px="$2"
          py="$1"
          borderRadius="$md"
          disabled={isCameraDisabled}
        >
          <Text
            color={isCameraDisabled ? "$gray400" : "$white"}
            fontSize="$xs"
            fontWeight="$medium"
          >
            {exposure !== 0 ? `${exposure > 0 ? '+' : ''}${exposure.toFixed(1)}` : 'EV'}
          </Text>
        </Pressable>
      </HStack>

      <Box position="absolute" bottom={40} width="100%" alignItems="center" zIndex={1000}>
        <Pressable
          ref={cameraFlipButtonRef}
          position="absolute"
          left={45}
          bottom={20}
          onPress={() =>
            !isCameraDisabled &&
            setCameraPosition((p) => (p === "back" ? "front" : "back"))
          }
          p="$2"
          borderRadius="$md"
          bg="transparent"
          disabled={isCameraDisabled}
          $pressed={{ bg: "rgba(255,255,255,0.3)" }}
        >
          {(state) => (
            <Text
              color={state.pressed ? "$gray500" : isCameraDisabled ? "$gray400" : "$white"}
              fontSize="$md"
              fontWeight="$medium"
            >
              Flip
            </Text>
          )}
        </Pressable>

        <Pressable
          position="absolute"
          right={30}
          bottom={20}
          onPress={() =>
            !isCameraDisabled &&
            setFlash((prev) => (prev === "off" ? "on" : "off"))
          }
          p="$2"
          borderRadius="$md"
          bg="transparent"
          disabled={isCameraDisabled}
          $pressed={{ bg: "rgba(255,255,255,0.3)" }}
        >
          {(state) => (
            <Text
              color={state.pressed ? "$gray500" : isCameraDisabled ? "$gray400" : "$white"}
              fontSize="$md"
              fontWeight="$medium"
            >
              Flash: {flash}
            </Text>
          )}
        </Pressable>

        <TouchableOpacity
          ref={captureButtonRef}
          style={[
            styles.snapBtn,
            isCaptureDisabled && styles.snapBtnDisabled,
            timerMode > 0 && styles.snapBtnTimer,
          ]}
          onPress={takePicture}
          disabled={isCaptureDisabled}
        >
          {timerMode > 0 && !timerActive && (
            <Text style={styles.timerText}>{timerMode}</Text>
          )}
        </TouchableOpacity>
      </Box>

      <Box ref={recentPhotosRef} left={14} bottom={-10}>
        <PhotoPreview
          photos={recentPhotos}
          onPress={handlePhotoPreviewPress}
          visible={!isCameraDisabled && !timerActive}
        />
      </Box>

      <Modal
        isOpen={shouldShowModal && !timerActive}
        onClose={() => {}}
        closeOnOverlayClick={false}
        avoidKeyboard={false}
      >
        <ModalBackdrop bg="rgba(0,0,0,0.9)" />
        <ModalContent
          bg="transparent"
          width="100%"
          height="100%"
          borderRadius={0}
          maxWidth="100%"
          maxHeight="100%"
          m="$0"
          p="$0"
        >
          <ModalBody p="$0" flex={1}>
            <Box
              flex={1}
              justifyContent="center"
              alignItems="center"
              style={{ marginTop: screenHeight * 0.35 }}
            >
              <VStack space="lg" alignItems="center">
                <Spinner size="large" color="$white" />
                {processingStage && (
                  <VStack space="md" alignItems="center">
                    <Text
                      color="$white"
                      fontSize="$xl"
                      fontWeight="$semibold"
                      textAlign="center"
                    >
                      {processingStage === "uploading" && "📤 Uploading Photo"}
                      {processingStage === "analyzing" && "🔍 Analyzing Image"}
                      {processingStage === "matching" && "🤝 Finding Friends"}
                    </Text>
                    <Text
                      color="rgba(255,255,255,0.8)"
                      fontSize="$md"
                      textAlign="center"
                      px="$6"
                    >
                      {processingStage === "uploading" && "Securing your moment..."}
                      {processingStage === "analyzing" && "Looking for familiar faces..."}
                      {processingStage === "matching" && "Matching with your connections..."}
                    </Text>
                    <Text
                      color="rgba(255,255,255,0.6)"
                      fontSize="$sm"
                      textAlign="center"
                      px="$8"
                      mt="$2"
                    >
                      Please wait, this may take a moment...
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>

      {shouldShowModal && !timerActive && (
        <Box
          style={{
            position: "absolute",
            top: -1000,
            left: -100,
            width: screenWidth + 200,
            height: screenHeight + 2000,
            backgroundColor: "rgba(0,0,0,0.1)",
            zIndex: 999999,
            pointerEvents: "auto",
          }}
        />
      )}
    </Box>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  snapBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: "#fff",
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapBtnDisabled: {
    backgroundColor: "#ccc",
    borderColor: "#999",
  },
  snapBtnTimer: {
    borderColor: "#ffaa00",
    backgroundColor: "#fff",
  },
  timerText: {
    color: "#ffaa00",
    fontSize: 18,
    fontWeight: "bold",
  },
  focusIndicator: {
    position: 'absolute',
    width: 70,
    height: 70,
    zIndex: 1500,
  },
  zoomIndicator: {
    position: 'absolute',
    top: 120,
    left: 20,
    zIndex: 1500,
  },
  exposureSlider: {
    position: 'absolute',
    left: 20,
    top: '35%',
    zIndex: 1500,
  },
  sliderTrack: {
    width: 30,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderTrackDisabled: {
    opacity: 0.5,
  },
  backgroundIndicator: {
    position: 'absolute',
    top: 120,
    right: 20,
    zIndex: 1500,
  },
  photoPreviewContainer: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    zIndex: 1500,
  },
  photoPreviewMain: {
    width: 60,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  photoPreviewStack: {
    position: 'absolute',
    width: 60,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
});