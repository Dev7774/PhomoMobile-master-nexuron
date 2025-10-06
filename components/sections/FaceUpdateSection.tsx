/* components/FaceUpdateSection.tsx */
import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  Linking,
  Modal,
  useColorScheme
} from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Pressable,
  Spinner,
  Center
} from '@gluestack-ui/themed';
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/api";
import { updateUserFace } from "@/src/graphql/mutations";
import { useUploadQueue } from "@/src/stores/uploadQueueStore";
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Ionicons } from "@expo/vector-icons";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/context/AuthContext";

const client = generateClient();

interface FaceUpdateSectionProps {
  user: any;
  onUploadStateChange?: (isUploading: boolean) => void;
}

export default function FaceUpdateSection({ user, onUploadStateChange }: FaceUpdateSectionProps) {
  const { profile } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [faceDropdownOpen, setFaceDropdownOpen] = useState(false);
  const [faceUploading, setFaceUploading] = useState(false);
  const { hasPermission: cameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const [cameraVisible, setCameraVisible] = useState(false);
  const cameraRef = useRef<Camera | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const { stats } = useUploadQueue();
  const hasActiveUploads = stats.pending > 0 || stats.processing > 0;

  const device = useCameraDevice('front');

  const MAX_FACE_COUNT = 100;
  const reachedMaxFaces = (profile?.faceCount ?? 0) >= MAX_FACE_COUNT;

  const needsOnboarding = !profile?.faceCount || profile.faceCount === 0;
  const isFaceUpdateDisabled = hasActiveUploads || faceUploading || reachedMaxFaces || needsOnboarding;

  // Notify parent component about upload state changes
  useEffect(() => {
    onUploadStateChange?.(faceUploading);
  }, [faceUploading, onUploadStateChange]);

  /* ---------------- Camera ready effect ---------------- */
  useEffect(() => {
    if (device) {
      console.log("FaceUpdate: Camera device ready:", {
        deviceId: device.id,
        position: device.position,
        hasFlash: device.hasFlash,
      });
      const timer = setTimeout(() => {
        setCameraReady(true);
        console.log("FaceUpdate: Camera ready!");
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setCameraReady(false);
      console.log("FaceUpdate: Camera not ready, device:", !!device);
    }
  }, [device]);

  async function uploadFacePhoto(uri: string) {
    if (!user?.userId) {
      Alert.alert("User not logged in");
      return;
    }
    try {
      setFaceUploading(true);

      console.log("Starting face photo upload for user:", user.userId);

      const { username } = await getCurrentUser();
      const rawKey = `onboard/${username}/${uuidv4()}.jpg`;

      console.log("Uploading to S3 with rawKey:", rawKey);

      const response = await fetch(uri);
      const blob = await response.blob();

      await uploadData({
        key: rawKey,
        data: blob,
        options: { 
          accessLevel: "protected",
          contentType: "image/jpeg"
        },
      }).result;

      const session = await fetchAuthSession();
      const identityId = session.identityId;
      const s3Key = `protected/${identityId}/${rawKey}`;

      console.log("S3 upload successful, calling updateUserFace lambda with s3Key:", s3Key);

      const result = await client.graphql({
        query: updateUserFace,
        variables: { userId: username, s3Key },
      });

      const updateResult = result.data?.updateUserFace;
      
      console.log("updateUserFace result:", updateResult);

      if (updateResult?.success) {
        Alert.alert(
          "Success!", 
          `${updateResult.message}\nTotal faces: ${updateResult.newFaceCount}`
        );
        console.log("Face added successfully with faceId:", updateResult.faceId);
      } else {
        throw new Error(updateResult?.error || "Failed to add face");
      }
    } catch (err: any) {
      console.error("Upload failed", err);
      Alert.alert("Error", err.message || "Failed to add face");
    } finally {
      setFaceUploading(false);
    }
  }

  const handleUploadRekognitionPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (res.canceled || !res.assets?.[0]?.uri) return;

      const { uri } = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      await uploadFacePhoto(uri);
    } catch (err: any) {
      console.error("Upload failed", err);
      Alert.alert("Error", err.message || "Failed to add face");
    }
  };

  const handleShowCamera = async () => {
    if (!cameraPermission) {
      const permission = await requestCameraPermission();
      if (!permission) {
        Alert.alert(
          'Permission Required',
          'Camera access is required to take photos. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleCameraCapture = async () => {
    console.log("FaceUpdate: Take picture attempt:", { 
      cameraRef: !!cameraRef.current, 
      cameraReady, 
      device: !!device
    });
    
    if (!cameraRef.current || !cameraReady || !device) {
      console.log("FaceUpdate: Take picture blocked - camera not ready");
      return;
    }
    
    try {
      setFaceUploading(true);
      const photo = await cameraRef.current.takePhoto({ 
        enableShutterSound: false,
      });

      console.log('FaceUpdate: Photo taken:', photo);

      if (photo?.path) {
        setCameraVisible(false);

        const { uri } = await ImageManipulator.manipulateAsync(
          `file://${photo.path}`,
          [{ resize: { width: 720 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        await uploadFacePhoto(uri);
      }
    } catch (err) {
      console.error("FaceUpdate: Camera capture failed", err);
      Alert.alert("Error", "Failed to take photo");
    } finally {
      setFaceUploading(false);
    }
  };

  return (
    <Box>
      <Pressable
        onPress={() => setFaceDropdownOpen((prev) => !prev)}
        bg={isDark ? "#1a1a1a" : "#f0f0f0"}
        borderRadius="$lg"
        p="$4"
        $pressed={{
          bg: isDark ? "#2a2a2a" : "#e5e5e5",
        }}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <Text 
            fontWeight="$bold" 
            fontSize="$lg"
            color={isDark ? "#fff" : "#000"}
          >
            Update Your Face
          </Text>
          <Ionicons
            name={faceDropdownOpen ? "chevron-up" : "chevron-down"}
            size={24}
            color="#007AFF"
          />
        </HStack>
      </Pressable>

      {faceDropdownOpen && (
        <Box mt="$3" p="$4" borderRadius="$lg" bg={isDark ? "#0a0a0a" : "#f9f9f9"}>
          <VStack space="md">
            <Box 
              bg={isDark ? "#1a1a1a" : "#f5f5f5"}
              borderRadius="$md"
              p="$3"
            >
              <Text 
                fontSize="$sm"
                color={isDark ? "#ccc" : "#555"}
                lineHeight="$xs"
              >
                Add photos of yourself to help friends identify you in their shared photos. 
                Upload clear, well-lit photos where your face is clearly visible.
              </Text>
            </Box>

            {hasActiveUploads && !faceUploading && (
              <Box 
                bg={isDark ? "rgba(255, 165, 0, 0.15)" : "rgba(255, 165, 0, 0.1)"} 
                borderColor={isDark ? "#ff8c00" : "#ff8c00"}
                borderWidth="$1"
                p="$3" 
                borderRadius="$lg"
              >
                <HStack alignItems="center" space="sm">
                  <Text fontSize="$md">⏳</Text>
                  <VStack flex={1}>
                    <Text 
                      fontSize="$sm" 
                      fontWeight="$medium"
                      color={isDark ? "#ffb347" : "#e65100"}
                    >
                      {stats.processing > 0 ? "Photos uploading..." : `${stats.pending} photos in queue`}
                    </Text>
                    <Text 
                      fontSize="$xs" 
                      color={isDark ? "#cc8400" : "#bf360c"}
                      mt="$1"
                    >
                      Please wait for uploads to complete before updating your face
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            )}

            {needsOnboarding && !faceUploading && (
              <Box
                bg={isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)"}
                borderColor={isDark ? "#3b82f6" : "#3b82f6"}
                borderWidth="$1"
                p="$3"
                borderRadius="$lg"
              >
                <HStack alignItems="center" space="sm">
                  <Text fontSize="$md">📸</Text>
                  <VStack flex={1}>
                    <Text
                      fontSize="$sm"
                      fontWeight="$medium"
                      color={isDark ? "#93c5fd" : "#1d4ed8"}
                    >
                      Complete face enrollment first
                    </Text>
                    <Text
                      fontSize="$xs"
                      color={isDark ? "#60a5fa" : "#1e40af"}
                      mt="$1"
                    >
                      You need to complete your initial face setup in the camera before you can update it here
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            )}

            {faceUploading && (
              <Center py="$4">
                <Spinner 
                  size="large" 
                  color={isDark ? "#60a5fa" : "#007AFF"} 
                />
                <Text 
                  mt="$2" 
                  color={isDark ? "#999" : "#666"}
                  fontSize="$sm"
                >
                  Uploading your photo...
                </Text>
              </Center>
            )}

            {!faceUploading && reachedMaxFaces && (
              <Center py="$6" px="$4" bg={isDark ? "#222" : "#eee"} borderRadius="$lg">
                <Text
                  fontSize="$md"
                  fontWeight="$semibold"
                  color={isDark ? "#aaa" : "#666"}
                  textAlign="center"
                >
                  You have reached the maximum number of photos for face updates.{"\n"}
                  No more uploads are allowed.
                </Text>
              </Center>
            )}
            
            {!faceUploading && !reachedMaxFaces && (
              <VStack space="md">
                {/* Camera Button or Error Message */}
                {cameraPermission === false ? (
                  <Pressable 
                    onPress={() => {
                      Alert.alert(
                        'Camera Permission Required',
                        'Please enable camera access in Settings to take photos.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Settings', onPress: () => Linking.openSettings() }
                        ]
                      );
                    }}
                    bg="#ffebee"
                    borderColor="#f44336"
                    borderWidth="$2"
                    borderRadius="$lg"
                    p="$4"
                    $pressed={{
                      bg: "#ffcdd2",
                    }}
                  >
                    <Text 
                      color="#d32f2f"
                      fontSize="$sm"
                      fontWeight="$semibold"
                      textAlign="center"
                    >
                      ❌ Camera access denied - Tap to enable in Settings
                    </Text>
                  </Pressable>
                ) : (
                  <Button
                    variant="outline"
                    borderColor="#007AFF"
                    borderRadius="$lg"
                    h={48}
                    onPress={handleShowCamera}
                    disabled={isFaceUpdateDisabled}
                    $pressed={{
                      bg: isFaceUpdateDisabled ? "transparent" : (isDark ? "#0a1a2a" : "#f0f8ff"),
                    }}
                  >
                    <ButtonText color={isFaceUpdateDisabled ? (isDark ? "#666" : "#999") : "#007AFF"}  fontWeight="$semibold">
                      {needsOnboarding ? "Complete face enrollment first" : (hasActiveUploads ? "Photos uploading..." : "Take Photo with Camera")}
                    </ButtonText>
                  </Button>
                )}

                <Button
                  variant="outline"
                  borderColor="#007AFF"
                  borderRadius="$lg"
                  h={48}
                  onPress={handleUploadRekognitionPhoto}
                  disabled={isFaceUpdateDisabled}
                  $pressed={{
                    bg: isFaceUpdateDisabled ? "transparent" : (isDark ? "#0a1a2a" : "#f0f8ff"),
                  }}
                >
                  <ButtonText color={isFaceUpdateDisabled ? (isDark ? "#666" : "#999") : "#007AFF"} fontWeight="$semibold">
                    {needsOnboarding ? "Complete face enrollment first" : (hasActiveUploads ? "Photos uploading..." : "Choose Photo from Library")}
                  </ButtonText>
                </Button>
              </VStack>
            )}
          </VStack>
        </Box>
      )}

      <Modal visible={cameraVisible} animationType="slide" transparent={false}>
        <Box flex={1} bg="$black">
          {/* Header Instructions */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            zIndex={10}
            pt="$16"
            pb="$6"
            px="$6"
            bg="rgba(0,0,0,0.6)"
          >
            <VStack space="sm" alignItems="center">
              <Text
                fontSize="$lg"
                color="$white"
                textAlign="center"
                fontWeight="$bold"
              >
                Add Your Face Photo
              </Text>
              
              <Text 
                color="rgba(255,255,255,0.9)"
                fontSize="$sm"
                textAlign="center"
                lineHeight="$md"
              >
                Position your face in the center and tap the capture button
              </Text>
            </VStack>
          </Box>

          {device ? (
            <Camera
              ref={cameraRef}
              style={{ flex: 1 }}
              device={device}
              isActive={true}
              photo={true}
              photoQualityBalance="balanced"
              onInitialized={() => {
                console.log("FaceUpdate: Camera onInitialized called");
                setCameraReady(true);
              }}
              onError={(error) => {
                console.error("FaceUpdate: Camera error:", error);
                setCameraReady(false);
              }}
            />
          ) : (
            <Center flex={1}>
              <Spinner size="large" color="$white" />
              <Text color="$white" mt="$2">Loading camera...</Text>
            </Center>
          )}

          {/* Face Guide Overlay (same as onboarding) */}
          {cameraReady && !faceUploading && (
            <Box
              position="absolute"
              top="30%"
              left="50%"
              transform={[{ translateX: -120 }]}
              width={240}
              height={320}
              borderRadius="$full"
              borderWidth="$4"
              borderColor="rgba(255,255,255,0.5)"
              borderStyle="dashed"
              zIndex={5}
            />
          )}

          {/* Loading Overlay */}
          {faceUploading && (
            <Center
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="rgba(0,0,0,0.4)"
              zIndex={20}
            >
              <VStack space="md" alignItems="center">
                <Box
                  width={80}
                  height={80}
                  borderRadius="$full"
                  bg="rgba(0,0,0,0.8)"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Spinner size="large" color="$white" />
                </Box>
                <Text 
                  color="$white" 
                  fontSize="$md"
                  fontWeight="$medium"
                  textAlign="center"
                >
                  Uploading your photo...
                </Text>
              </VStack>
            </Center>
          )}

          <HStack
            justifyContent="space-around"
            p="$4"
            bg="$black"
            zIndex={10}
          >
            <Button
              bg="#ff3b30"
              borderRadius="$full"
              w={90}
              h={90}
              onPress={() => setCameraVisible(false)}
              disabled={faceUploading}
              $pressed={{
                bg: "#d70015",
              }}
            >
              <ButtonText color="$white" fontWeight="$bold" fontSize="$xs">
                Cancel
              </ButtonText>
            </Button>

            <Button
              bg={cameraReady && device ? "#007AFF" : "#555"}
              borderRadius="$full"
              w={90}
              h={90}
              disabled={!cameraReady || faceUploading || !device}
              onPress={handleCameraCapture}
              $pressed={{
                bg: cameraReady && device ? "#0056CC" : "#555",
              }}
            >
              <ButtonText color="$white" fontWeight="$bold" fontSize="$xs">
                Capture
              </ButtonText>
            </Button>
          </HStack>
        </Box>
      </Modal>
    </Box>
  );
}