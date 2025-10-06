import { StatusBar } from "expo-status-bar";
import { Alert, FlatList, Platform, useColorScheme } from "react-native";
import { Image as ExpoImage } from "expo-image";
import React, { useCallback, useState, useRef } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Divider,
  Center,
  Pressable,
  Spinner,
} from '@gluestack-ui/themed';
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

// API Hooks
import { useCurrentUser } from "@/src/hooks/usePhotoQueries";
import { useAllFriendshipsWithProfiles } from "@/src/hooks/useUserQueries";
import { 
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest
} from "@/src/hooks/useUserMutations";
import { useCameraSubscriptions } from "@/src/hooks/useCameraSubscriptions";
import { usePhotoSubscriptions } from "@/src/hooks/usePhotoSubscriptions";
import { FriendsListSkeleton } from "@/components/SkeletonLoaders";

export default function friendsModal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [refreshing, setRefreshing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  // Get current user ID
  const { data: currentUserId, isLoading: userIdLoading } = useCurrentUser();

  // Fetch friendships with profile data
  const { 
    data: friendshipsWithProfiles = [], 
    isLoading: friendshipsLoading, 
    error: friendshipsError,
    refetch: refetchFriendships 
  } = useAllFriendshipsWithProfiles(currentUserId);

  // Enable subscriptions for real-time updates
  useCameraSubscriptions(!!currentUserId, currentUserId);
  usePhotoSubscriptions(!!currentUserId, currentUserId);

  // Mutations
  const acceptFriendRequestMutation = useAcceptFriendRequest();
  const declineFriendRequestMutation = useDeclineFriendRequest();
  const cancelFriendRequestMutation = useCancelFriendRequest();

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════

  const loading = userIdLoading || friendshipsLoading;
  const actionLoading = acceptFriendRequestMutation.isPending || 
                       declineFriendRequestMutation.isPending ||
                       cancelFriendRequestMutation.isPending;

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Focus effect for data refresh
  useFocusEffect(
    useCallback(() => {
      if (currentUserId && friendshipsWithProfiles.length === 0 && !friendshipsLoading) {
        console.log("🔄 [FRIENDS_MODAL] Refreshing friendships on focus");
        refetchFriendships();
      }
    }, [currentUserId, friendshipsWithProfiles.length, friendshipsLoading, refetchFriendships])
  );

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchFriendships();
    } catch (error) {
      console.error("Error refreshing friendships:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchFriendships]);

  // Friendship action handlers
  const acceptRequest = useCallback(async (friendshipId: string, version: number) => {
    try {
      await acceptFriendRequestMutation.mutateAsync({ 
        rowId: friendshipId, 
        rowVersion: version 
      });
    } catch (err) {
      console.error("Accept request error:", err);
      Alert.alert("Error", "Could not accept friend request");
    }
  }, [acceptFriendRequestMutation]);

  const declineRequest = useCallback(async (friendshipId: string, version: number) => {
    try {
      await declineFriendRequestMutation.mutateAsync({ 
        rowId: friendshipId, 
        rowVersion: version 
      });
    } catch (err) {
      console.error("Decline request error:", err);
      Alert.alert("Error", "Could not decline friend request");
    }
  }, [declineFriendRequestMutation]);

  const cancelRequest = useCallback(async (friendshipId: string, version: number, friendId: string) => {
    try {
      await cancelFriendRequestMutation.mutateAsync({
        rowId: friendshipId,
        rowVersion: version,
        friendId: friendId,
      });
    } catch (err) {
      console.error("Cancel request error:", err);
      Alert.alert("Error", "Could not cancel friend request");
    }
  }, [cancelFriendRequestMutation]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Function to render each friendship item in the list
  const renderItem = useCallback(({ item }: { item: any }) => {
    const { friendship, friendProfile, isIncoming, isOutgoing, otherUserId } = item;
    const { status, id, _version } = friendship;

    // Boolean flags for status
    const isAccepted = status === "ACCEPTED";
    const isPending = status === "PENDING";

    const handleNavigate = () => {
      if (isNavigatingRef.current || isNavigating) return;
      
      isNavigatingRef.current = true;
      setIsNavigating(true);
      
      setTimeout(() => {
        router.push(`/user/${otherUserId}`);
      }, 10);
      
      setTimeout(() => {
        isNavigatingRef.current = false;
        setIsNavigating(false);
      }, 2000);
    };

    // ✅ ACCEPTED FRIEND (entire box navigates)
    if (isAccepted) {
      return (
        <Pressable
          onPress={handleNavigate}
          $pressed={{ bg: isDark ? "$backgroundDark800" : "$backgroundLight100" }}
        >
          <Box
            bg={isDark ? "#1a1a1a" : "#f8f8f8"}
            borderRadius="$xl"
            p="$4"
            mb="$3"
            borderWidth="$1"
            borderColor={isDark ? "#333" : "#e5e5e5"}
            shadowColor="$black"
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.1}
            shadowRadius={4}
          >
            <HStack alignItems="center" space="md">
              {/* Profile Photo */}
              <Box
                width={60}
                height={60}
                borderRadius="$full"
                bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                borderWidth="$1"
                borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                overflow="hidden"
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 1 }}
                shadowOpacity={0.08}
                shadowRadius={3}
              >
                {friendProfile?.photoUrl ? (
                  <ExpoImage
                    source={{ uri: friendProfile.photoUrl }}
                    style={{ width: "100%", height: "100%", borderRadius: 999 }}
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
                      <Text color={isDark ? "#999" : "#666"} fontSize="$md">
                        👤
                      </Text>
                    </Box>
                  </Center>
                )}
              </Box>
              <VStack flex={1} space="xs">
                <Text
                  fontSize="$lg"
                  fontWeight="$semibold"
                  color={isDark ? "#fff" : "#000"}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {friendProfile?.displayName || otherUserId}
                </Text>
                <Text fontSize="$sm" color="#4ade80" fontWeight="$medium">
                  ✅ Friend
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Pressable>
      );
    }

    // 📩 INCOMING PENDING (buttons + clickable name)
    if (isIncoming && isPending) {
      return (
        <Box
          bg={isDark ? "#1a1a1a" : "#f8f8f8"}
          borderRadius="$xl"
          p="$4"
          mb="$3"
          borderWidth="$1"
          borderColor={isDark ? "#333" : "#e5e5e5"}
          shadowColor="$black"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.1}
          shadowRadius={4}
        >
          <VStack space="md" alignItems="center">
            {/* Centered content */}
            <VStack space="xs" alignItems="center" w="100%">
              <Box
                w={50}
                h={50}
                borderRadius={25}
                bg="#fef3c7"
                justifyContent="center"
                alignItems="center"
                mb="$2"
              >
                <Text fontSize="$xl">📩</Text>
              </Box>

              {/* Profile photo and username side by side */}
              <HStack space="md" alignItems="center" mb="$1">
                <Box
                  width={40}
                  height={40}
                  borderRadius="$full"
                  bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                  borderWidth="$1"
                  borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                  overflow="hidden"
                  shadowColor="$shadowColor"
                  shadowOffset={{ width: 0, height: 1 }}
                  shadowOpacity={0.08}
                  shadowRadius={3}
                >
                {friendProfile?.photoUrl ? (
                    <ExpoImage
                      source={{ uri: friendProfile.photoUrl }}
                      style={{ width: "100%", height: "100%", borderRadius: 999 }}
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
                        <Text color={isDark ? "#999" : "#666"} fontSize="$md">👤</Text>
                      </Box>
                    </Center>
                  )}
                </Box>

                <Pressable onPress={() => {
                  if (isNavigatingRef.current || isNavigating) return;
                  
                  isNavigatingRef.current = true;
                  setIsNavigating(true);
                  
                  setTimeout(() => {
                    router.push(`/user/${friendship.ownerId}`);
                  }, 10);
                  
                  setTimeout(() => {
                    isNavigatingRef.current = false;
                    setIsNavigating(false);
                  }, 2000);
                }}>
                  <Text
                    fontSize="$lg"
                    fontWeight="$semibold"
                    color={isDark ? "#fff" : "#000"}
                  >
                    {friendProfile?.displayName || otherUserId}
                  </Text>
                </Pressable>
              </HStack>

              <Text
                fontSize="$sm"
                color={isDark ? "#999" : "#666"}
                textAlign="center"
              >
                wants to be your friend
              </Text>
            </VStack>

            {/* Buttons outside the Pressable */}
            <HStack space="md" justifyContent="center">
              <Button
                variant="outline"
                borderColor="#ff3b30"
                borderRadius="$lg"
                px="$5"
                h={40}
                onPress={() => declineRequest(id, _version)}
                disabled={actionLoading}
                $pressed={{
                  bg: isDark ? "#1a0a0a" : "#fff0f0",
                }}
              >
                {actionLoading ? (
                  <Spinner size="small" color="#ff3b30" />
                ) : (
                  <ButtonText color="#ff3b30" fontSize="$sm" fontWeight="$semibold">
                    Decline
                  </ButtonText>
                )}
              </Button>

              <Button
                bg="#4ade80"
                borderRadius="$lg"
                px="$5"
                h={40}
                onPress={() => acceptRequest(id, _version)}
                disabled={actionLoading}
                $pressed={{
                  bg: "#22c55e",
                }}
              >
                {actionLoading ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <ButtonText color="$white" fontSize="$sm" fontWeight="$semibold">
                    Accept
                  </ButtonText>
                )}
              </Button>
            </HStack>
          </VStack>
        </Box>
      );
    }

    // 📤 OUTGOING PENDING (entire box navigates + red X to cancel)
    if (isOutgoing && isPending) {
      return (
        <Box
          bg={isDark ? "#1a1a1a" : "#f8f8f8"}
          borderRadius="$xl"
          p="$4"
          mb="$3"
          borderWidth="$1"
          borderColor={isDark ? "#333" : "#e5e5e5"}
          shadowColor="$black"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.1}
          shadowRadius={4}
          position="relative"
        >
          {/* Cancel Button - positioned absolutely in top right */}
          <Pressable
            onPress={() => cancelRequest(id, _version, friendship.friendId)}
            disabled={actionLoading}
            style={{
              position: "absolute",
              top: 26,
              right: 12,
              zIndex: 10,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? "rgba(255, 59, 48, 0.15)" : "rgba(255, 59, 48, 0.1)",
              justifyContent: "center",
              alignItems: "center",
            }}
            $pressed={{ 
              bg: isDark ? "rgba(255, 59, 48, 0.25)" : "rgba(255, 59, 48, 0.2)"
            }}
          >
            {actionLoading ? (
              <Spinner size="small" color="#ff3b30" />
            ) : (
              <Text fontSize="$md" color="#ff3b30" fontWeight="$bold">
                ✕
              </Text>
            )}
          </Pressable>

          {/* Main content - navigable */}
          <Pressable
            onPress={handleNavigate}
            $pressed={{ bg: isDark ? "$backgroundDark800" : "$backgroundLight100" }}
            style={{ flex: 1 }}
          >
            <HStack alignItems="center" space="md" pr="$10">
              <Box
                w={50}
                h={50}
                borderRadius={25}
                bg="#fef3c7"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="$xl">📤</Text>
              </Box>
              <VStack flex={1} space="xs">
                <Text
                  fontSize="$lg"
                  fontWeight="$semibold"
                  color={isDark ? "#fff" : "#000"}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {friendProfile?.displayName || otherUserId}
                </Text>
                <Text fontSize="$sm" color="#f59e0b" fontWeight="$medium">
                  ⏳ Friend request pending...
                </Text>
              </VStack>
            </HStack>
          </Pressable>
        </Box>
      );
    }
    return null;
  }, [isDark, actionLoading, acceptRequest, declineRequest, cancelRequest]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING & ERROR STATES
  // ═══════════════════════════════════════════════════════════════════════════

  if (friendshipsError && !friendshipsLoading) {
    return (
      <Box flex={1} bg={isDark ? "#000" : "#fff"}>
        <Center flex={1}>
          <VStack space="lg" alignItems="center" px="$8">
            <Text fontSize="$4xl">⚠️</Text>
            <Text 
              fontSize="$lg"
              color={isDark ? "#fff" : "#000"}
              fontWeight="$medium"
              textAlign="center"
            >
              Failed to load friendships
            </Text>
            <Text 
              fontSize="$sm"
              color={isDark ? "#999" : "#666"}
              textAlign="center"
            >
              {friendshipsError?.message || "Something went wrong"}
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
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack flex={1} p="$5" space="lg">
          <Center>
            <Text 
              fontSize="$2xl" 
              fontWeight="$bold"
              color={isDark ? "#fff" : "#000"}
              textAlign="center"
            >
              Your Friends & Requests
            </Text>
          </Center>
          <Box flex={1}>
            <FriendsListSkeleton count={6} />
          </Box>
        </VStack>
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Box flex={1} bg={isDark ? "#000" : "#fff"}>
      <VStack flex={1} p="$5" space="lg">
        {/* Header */}
        <Center>
          <Text 
            fontSize="$2xl" 
            fontWeight="$bold"
            color={isDark ? "#fff" : "#000"}
            textAlign="center"
          >
            Your Friends & Requests
          </Text>
        </Center>

        {/* Friends List */}
        <Box flex={1}>
          <FlatList
            data={friendshipsWithProfiles}
            keyExtractor={(item) => item.friendship.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <Center py="$8">
                <VStack space="md" alignItems="center">
                  <Text fontSize="$4xl">👥</Text>
                  <Text 
                    fontSize="$lg"
                    color={isDark ? "#666" : "#999"}
                    textAlign="center"
                  >
                    No friends or requests yet.
                  </Text>
                  <Text 
                    fontSize="$sm"
                    color={isDark ? "#555" : "#666"}
                    textAlign="center"
                    px="$8"
                  >
                    Start by searching for friends in the Friends tab!
                  </Text>
                </VStack>
              </Center>
            }
            style={{ flex: 1 }}
          />
        </Box>

        {/* Divider */}
        <Divider 
          bg={isDark ? "#333" : "#e5e5e5"} 
          w="80%" 
          alignSelf="center"
        />
      </VStack>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </Box>
  );
}