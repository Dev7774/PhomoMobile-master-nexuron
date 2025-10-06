import React, { useState, useCallback } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useMyProfile } from '@/src/hooks/useProfileQueries';
import { useUpdateProfilePhoto } from '@/src/hooks/useProfileMutations';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Box,
  VStack,
  Text,
  Button,
  ButtonText,
  Center,
  Heading,
  Pressable,
  Spinner,
} from '@gluestack-ui/themed';

export default function ProfilePictureScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const updateProfilePhoto = useUpdateProfilePhoto();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const pickProfilePicture = useCallback(async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: false,
      });

      if (pickerResult.canceled || pickerResult.assets.length === 0) return;

      const imageAsset = pickerResult.assets[0];
      const uri = imageAsset.uri;

      // Validate
      if (!uri || !imageAsset.width || !imageAsset.height) {
        Alert.alert("Error", "Invalid image selected. Please try another image.");
        return;
      }

      // Check if file exists
      try {
        const response = await fetch(uri);
        if (!response.ok) throw new Error('File not accessible');
      } catch {
        Alert.alert(
          "File Not Available",
          "This photo may have been deleted or is not downloaded. Please select a different photo."
        );
        return;
      }

      setPreviewImageUri(uri);
    } catch (error) {
      console.warn("Error picking profile photo:", error);
      Alert.alert("Error", "Could not pick photo.");
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!previewImageUri || !user?.username) return;

    try {
      await updateProfilePhoto.mutateAsync({ imageUri: previewImageUri });
      await AsyncStorage.setItem(`profile_handled_${user.username}`, 'true');
      router.replace('/(tabs)/camera');
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      Alert.alert("Upload Failed", "Could not update profile photo.");
    }
  }, [previewImageUri, updateProfilePhoto, user?.username, router]);

  const handleSkip = useCallback(async () => {
    if (!user?.username) return;
    await AsyncStorage.setItem(`profile_handled_${user.username}`, 'true');
    router.replace('/(tabs)/camera');
  }, [user?.username, router]);

  return (
    <Box flex={1} bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}>
      <Center flex={1} px="$6">
        <VStack space="xl" alignItems="center" maxWidth={400}>
          <Box
            width={100}
            height={100}
            borderRadius="$full"
            bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
            justifyContent="center"
            alignItems="center"
          >
            <Text fontSize={40}>📸</Text>
          </Box>

          <VStack space="lg" alignItems="center">
            <Heading
              size="xl"
              color={isDark ? "$textDark50" : "$textLight900"}
              textAlign="center"
              fontWeight="$bold"
            >
              Choose Your Profile Picture
            </Heading>

            <Text
              color={isDark ? "$textDark200" : "$textLight700"}
              fontSize="$md"
              textAlign="center"
              lineHeight="$lg"
            >
              Add a photo so friends can recognize you. You can change this anytime in settings.
            </Text>
          </VStack>

          {/* Profile Picture */}
          <Pressable
            onPress={pickProfilePicture}
            borderRadius="$full"
            overflow="hidden"
            disabled={updateProfilePhoto.isPending}
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
              >
                {previewImageUri || profile?.profilePhotoKey ? (
                  <ExpoImage
                    source={{ uri: previewImageUri || profile?.profilePhotoKey || undefined }}
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
                    <Text color={isDark ? "#999" : "#666"} fontSize="$6xl">
                      👤
                    </Text>
                  </Box>
                )}
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
              </Box>
            )}
          </Pressable>

          {/* Loading Overlay */}
          {updateProfilePhoto.isPending && (
            <VStack space="md" alignItems="center">
              <Spinner size="large" color={isDark ? "$primary400" : "$primary600"} />
              <Text color={isDark ? "$textDark300" : "$textLight600"} fontSize="$md">
                Uploading...
              </Text>
            </VStack>
          )}

          {/* Buttons */}
          <VStack space="lg" width="100%">
            {!previewImageUri && !profile?.profilePhotoKey && (
              <Button
                bg="$primary600"
                borderRadius="$lg"
                h={56}
                onPress={pickProfilePicture}
              >
                <ButtonText color="$white" fontWeight="$semibold" fontSize="$lg">
                  Choose Profile Photo
                </ButtonText>
              </Button>
            )}

            {(previewImageUri || profile?.profilePhotoKey) && (
              <Button
                bg="$primary600"
                borderRadius="$lg"
                h={56}
                disabled={updateProfilePhoto.isPending}
                onPress={previewImageUri ? handleUpload : handleSkip}
              >
                <ButtonText color="$white" fontWeight="$semibold" fontSize="$lg">
                  {previewImageUri ? "Use This Photo" : "Continue"}
                </ButtonText>
              </Button>
            )}

            <Button variant="link" h={44} onPress={handleSkip}>
              <ButtonText color={isDark ? "$textDark400" : "$textLight600"} fontSize="$md">
                Skip for now
              </ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Center>
    </Box>
  );
}