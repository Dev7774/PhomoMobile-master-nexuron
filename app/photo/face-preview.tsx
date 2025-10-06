/* app/photo/face-preview.tsx */
import React, { useState, useEffect } from "react";
import {
  FlatList,
  Alert,
  useColorScheme,
} from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Center,
  Spinner,
  Heading,
  Badge,
  BadgeText,
  Pressable,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckIcon,
} from '@gluestack-ui/themed';
import { useLocalSearchParams, router } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { useShareFaceMatchedPhoto } from "@/src/hooks/usePhotoMutations";
import { useUserProfile } from "@/src/hooks/useUserQueries";
import { FacePreviewSkeleton } from "@/components/SkeletonLoaders";
import { getCachedPhotoUrl } from "@/src/hooks/usePhotoQueries";

type FaceMatch = {
  userId: string;
  confidence: number;
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

type PreviewData = {
  photoId: string;
  s3Key: string;
  ownerIdentityId: string;
  facesDetected: number;
  friendsMatched: number;
  matches: FaceMatch[];
};

type UserProfile = {
  id: string;
  displayName: string;
  profilePhotoUrl: string | null;
};

export default function FacePreviewScreen() {
  const params = useLocalSearchParams();
  const sharePhotoMutation = useShareFaceMatchedPhoto();
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [imageLayout, setImageLayout] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  /* parse preview data from route params */
  const previewData: PreviewData = JSON.parse(params.data as string);
  const originalPhotoUri = params.photoUri as string;  // Store the original local photo URI

  /* fetch user profiles using TanStack Query hook */
  const userIds = previewData.matches.map(match => match.userId);
  const userQueries = userIds.map(userId => useUserProfile(userId));
  
  // Aggregate the results
  const loadingProfiles = userQueries.some(query => query.isLoading);
  const userProfiles = new Map<string, UserProfile>();
  
  userQueries.forEach((query, index) => {
    if (query.data) {
      userProfiles.set(userIds[index], {
        id: query.data.id,
        displayName: query.data.displayName || "Unnamed",
        profilePhotoUrl: query.data.profilePhotoUrl || null,
      });
    }
  });

  console.log("🎭 Face Preview - Data received:", previewData);


  /* load photo URL and initialize selected friends */
  useEffect(() => {
    (async () => {
      try {
        console.log("🎭 Loading photo with s3Key:", previewData.s3Key);

        // Extract the actual file path from the full s3Key
        // s3Key format: "protected/us-east-1:abc.../faces/user/original/file.jpg"
        // We need just: "faces/user/original/file.jpg"
        let cleanKey = previewData.s3Key;
        if (cleanKey.startsWith('protected/')) {
          // Remove "protected/" and the identity ID part
          const parts = cleanKey.split('/');
          if (parts.length >= 3) {
            cleanKey = parts.slice(2).join('/'); // Skip "protected" and identity ID
          }
        }

        /* get cached photo URL using existing function */
        const photoUrlString = await getCachedPhotoUrl(
          previewData.photoId,
          previewData.ownerIdentityId,
          cleanKey,
          null, // no thumbKey for face preview
          true, // preferFull = true for face preview
          null, // no cameraId for face preview
          null  // no ownerId for face preview
        );

        console.log("🎭 Photo URL loaded:", photoUrlString);
        setPhotoUrl(photoUrlString);

        /* pre-select all matched friends */
        const matchedUserIds = new Set(previewData.matches.map((m) => m.userId));
        setSelectedFriends(matchedUserIds);

        console.log("🎭 Pre-selected friends:", Array.from(matchedUserIds));
      } catch (err) {
        console.error("🎭 Error loading photo:", err);
        Alert.alert("Error", "Could not load photo");
      }
    })();
  }, []);

  /* toggle friend selection */
  const toggleFriend = (userId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedFriends(newSelected);
    console.log("🎭 Friend toggled:", userId, "Selected:", Array.from(newSelected));
  };

  /* confirm and share photo */
  const confirmShare = async () => {
    try {
      await sharePhotoMutation.mutateAsync({
        photoId: previewData.photoId,
        selectedTargets: Array.from(selectedFriends),
        matches: previewData.matches,
      });

      const message = selectedFriends.size === 0 
        ? "Photo saved without sharing"
        : `Shared with ${selectedFriends.size} friend${selectedFriends.size > 1 ? "s" : ""}`;

      Alert.alert(
        "Photo Saved!",
        message,
        [{ text: "OK", onPress: () => {
          // Pass shared photo info back to camera for preview
          const friendIds = Array.from(selectedFriends).sort();
          const friendGroupKey = friendIds.length > 0 ? friendIds.join(',') : undefined;
          
          // Navigate back to camera with the shared photo data
          // Using router.back() since we came from camera via router.push()
          router.back();
          
          // Set params for the camera screen to handle the shared photo
          // We need a slight delay to ensure navigation completes first
          setTimeout(() => {
            router.setParams({
              sharedPhotoId: previewData.photoId,
              sharedPhotoUri: originalPhotoUri || '',  // Pass the original local photo URI
              friendGroupKey: friendGroupKey
            });
          }, 100);
        }}]
      );
    } catch (err) {
      console.error("🎭 Error sharing photo:", err);
      Alert.alert("Error", "Could not save photo. Please try again.");
    }
  };

  /* render face overlay boxes */
  const renderFaceOverlays = () => {
    if (!imageLayout) return null;

    return previewData.matches.map((match, index) => {
      // Check if boundingBox exists - some face matches might not have coordinates
      if (!match.boundingBox) {
        console.log("🎭 Face match without boundingBox:", match);
        return null;
      }

      const isSelected = selectedFriends.has(match.userId);
      const box = match.boundingBox;
      const userProfile = userProfiles.get(match.userId);

      /* convert relative coordinates to absolute pixels */
      const left = box.left * imageLayout.width;
      const top = box.top * imageLayout.height;
      const width = box.width * imageLayout.width;
      const height = box.height * imageLayout.height;

      return (
        <Box
          key={`${match.userId}-${index}`}
          position="absolute"
          left={left}
          top={top}
          width={width}
          height={height}
          borderWidth="$2"
          borderColor={isSelected ? "$primary600" : "$error600"}
          borderRadius="$sm"
          bg={isSelected ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)"}
        >
          <Box
            position="absolute"
            top={-35}
            left={0}
            bg="rgba(0, 0, 0, 0.8)"
            px="$2"
            py="$1"
            borderRadius="$sm"
            minWidth={120}
          >
            <HStack space="xs" alignItems="center">
              {/* Profile Photo */}
              <Box
                width={20}
                height={20}
                borderRadius="$full"
                bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                borderWidth="$1"
                borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                overflow="hidden"
              >
                {userProfile?.profilePhotoUrl ? (
                  <ExpoImage
                    source={{ uri: userProfile.profilePhotoUrl }}
                    style={{ width: "100%", height: "100%", borderRadius: 9 }}
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
                      <Text fontSize="$2xs">👤</Text>
                    </Box>
                  </Center>
                )}
              </Box>
              
              {/* Name and Confidence */}
              <VStack space="sm">
                <Text 
                  color="$white" 
                  fontSize="$xs"
                  fontWeight="$medium"
                  numberOfLines={1}
                >
                  {userProfile?.displayName || match.userId}
                </Text>
                <Text 
                  color="$white" 
                  fontSize="$2xs"
                  opacity={0.8}
                >
                  {Math.round(match.confidence)}% confident
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Box>
      );
    }).filter(Boolean); // Remove null entries
  };

  if (!photoUrl || loadingProfiles) {
    return <FacePreviewSkeleton />;
  }

  return (
    <Box 
      flex={1} 
      bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
    >
      {/* Header - Fixed */}
      <Box
        pt="$6"
        pb="$4"
        px="$5"
        borderBottomWidth="$1"
        borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
        bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
      >
        <Center>
          <Heading 
            size="lg" 
            fontWeight="$semibold"
            color={isDark ? "$textDark50" : "$textLight900"}
          >
            Face Recognition
          </Heading>
        </Center>
      </Box>

      {/* Detection results - Fixed, centered text */}
      <Box
        mx="$5"
        mt="$4"
        mb="$4"
        p="$4"
        bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
        borderRadius="$lg"
        borderWidth="$1"
        borderColor={isDark ? "$borderDark700" : "$borderLight200"}
      >
        <VStack space="sm" alignItems="center">
          <HStack alignItems="center" space="sm">
            <Text fontSize="$2xl">🎯</Text>
            <Heading
              size="md"
              fontWeight="$semibold"
              color={isDark ? "$textDark50" : "$textLight900"}
              textAlign="center"
            >
              Detection Results
            </Heading>
          </HStack>
          
          <VStack space="xs" alignItems="center">
            <HStack alignItems="center" space="sm" justifyContent="center">
              <Badge bg="$primary600" borderRadius="$md">
                <BadgeText color="$white" fontSize="$xs" fontWeight="$semibold">
                  {previewData.facesDetected}
                </BadgeText>
              </Badge>
              <Text 
                fontSize="$sm"
                color={isDark ? "$textDark200" : "$textLight700"}
                textAlign="center"
              >
                face{previewData.facesDetected !== 1 ? "s" : ""} detected
              </Text>
            </HStack>
            
            <HStack alignItems="center" space="sm" justifyContent="center">
              <Badge bg="$success600" borderRadius="$md">
                <BadgeText color="$white" fontSize="$xs" fontWeight="$semibold">
                  {previewData.friendsMatched}
                </BadgeText>
              </Badge>
              <Text 
                fontSize="$sm"
                color={isDark ? "$textDark200" : "$textLight700"}
                textAlign="center"
              >
                friend{previewData.friendsMatched !== 1 ? "s" : ""} matched
              </Text>
            </HStack>
          </VStack>
        </VStack>
      </Box>

      {/* Photo Preview - Added, only show when photo is loaded */}
      {photoUrl && (
        <Box
          mx="$5"
          mb="$4"
          borderRadius="$lg"
          overflow="hidden"
          shadowColor="$shadowColor"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.1}
          shadowRadius={8}
          alignSelf="center"
          position="relative"
        >
          <ExpoImage
            source={{ uri: photoUrl }}
            style={{
              width: 250,
              height: 200,
              borderRadius: 8,
            }}
            contentFit="cover"
            transition={200}
            onLoad={() => {
              setImageLayout({
                width: 250,
                height: 200,
              });
            }}
          />
          {/* Face overlays */}
          {renderFaceOverlays()}
        </Box>
      )}

      {/* Share With Header - Fixed, centered */}
      {previewData.matches.length > 0 && (
        <Box mx="$5" mb="$3">
          <Center>
            <HStack alignItems="center" space="sm">
              <Text fontSize="$xl">👥</Text>
              <Heading
                size="md"
                fontWeight="$semibold"
                color={isDark ? "$textDark50" : "$textLight900"}
                textAlign="center"
              >
                Share With:
              </Heading>
            </HStack>
          </Center>
        </Box>
      )}

      {/* Friends List - Scrollable only */}
      {previewData.matches.length > 0 && (
        <Box mx="$5" mb="$6" height={150}>
          <FlatList
            data={previewData.matches}
            keyExtractor={(item, index) => `${item.userId}-${index}`}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: match }) => {
              const isSelected = selectedFriends.has(match.userId);
              const userProfile = userProfiles.get(match.userId);
              return (
                <Pressable
                  onPress={() => toggleFriend(match.userId)}
                  bg={isSelected 
                    ? (isDark ? "$primary950" : "$primary50") 
                    : (isDark ? "$backgroundDark800" : "$backgroundLight50")
                  }
                  p="$3"
                  borderRadius="$lg"
                  borderWidth="$1"
                  borderColor={isSelected 
                    ? "$primary600" 
                    : (isDark ? "$borderDark700" : "$borderLight200")
                  }
                  mb="$2"
                  $pressed={{
                    bg: isSelected 
                      ? (isDark ? "$primary900" : "$primary100") 
                      : (isDark ? "$backgroundDark700" : "$backgroundLight100"),
                  }}
                >
                  <HStack alignItems="center" justifyContent="space-between">
                    <HStack alignItems="center" space="md" flex={1}>
                      {/* Profile Photo */}
                      <Box
                        width={40}
                        height={40}
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
                        {userProfile?.profilePhotoUrl ? (
                          <ExpoImage
                            source={{ uri: userProfile.profilePhotoUrl }}
                            style={{ width: "100%", height: "100%", borderRadius: 18 }}
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
                              <Text fontSize="$sm">👤</Text>
                            </Box>
                          </Center>
                        )}
                      </Box>

                      {/* User Info */}
                      <VStack flex={1}>
                        <Text 
                          fontSize="$md"
                          fontWeight="$medium"
                          color={isDark ? "$textDark50" : "$textLight900"}
                          numberOfLines={1}
                        >
                          {userProfile?.displayName || match.userId}
                        </Text>
                        <HStack alignItems="center" space="xs" mt="$1">
                          <Badge 
                            bg={match.confidence >= 90 ? "$success600" : 
                                match.confidence >= 70 ? "$warning600" : "$error600"} 
                            borderRadius="$sm"
                          >
                            <BadgeText 
                              color="$white" 
                              fontSize="$2xs"
                              fontWeight="$semibold"
                            >
                              {Math.round(match.confidence)}%
                            </BadgeText>
                          </Badge>
                          <Text 
                            fontSize="$xs"
                            color={isDark ? "$textDark300" : "$textLight600"}
                          >
                            confident
                          </Text>
                        </HStack>
                      </VStack>
                    </HStack>

                    <Checkbox
                      value={""}
                      size="md"
                      isChecked={isSelected}
                      onChange={() => toggleFriend(match.userId)}
                      borderColor={isSelected ? "$primary600" : (isDark ? "$borderDark400" : "$borderLight300")}
                    >
                      <CheckboxIndicator mr="$0">
                        <CheckboxIcon as={CheckIcon} />
                      </CheckboxIndicator>
                    </Checkbox>
                  </HStack>
                </Pressable>
              );
            }}
          />
        </Box>
      )}

      {/* Share button - Fixed */}
      <Box mx="$5" mb="$4">
        <Button
          bg="$primary600"
          h={56}
          onPress={confirmShare}
          isDisabled={sharePhotoMutation.isPending}
          borderRadius="$xl"
          $pressed={{
            bg: "$primary700",
          }}
          $disabled={{
            bg: isDark ? "$backgroundDark700" : "$backgroundLight200",
            opacity: 0.6,
          }}
        >
          {sharePhotoMutation.isPending ? (
            <Spinner color="$white" size="small" />
          ) : (
            <ButtonText 
              color="$white" 
              fontWeight="$bold"
              fontSize="$lg"
              textAlign="center"
            >
              {selectedFriends.size === 0 
                ? "Save Photo" 
                : `Share with ${selectedFriends.size} friend${selectedFriends.size !== 1 ? "s" : ""}`
              }
            </ButtonText>
          )}
        </Button>
      </Box>
    </Box>
  );
}