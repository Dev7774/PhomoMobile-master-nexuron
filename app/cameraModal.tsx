import React, { useState, useRef, useCallback, useEffect } from "react";
import { 
  FlatList, 
  useColorScheme, 
  Alert, 
  RefreshControl, 
  Dimensions, 
  Animated, 
  PanResponder, 
  NativeScrollEvent, 
  NativeSyntheticEvent 
} from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Center,
  Heading,
  Spinner
} from '@gluestack-ui/themed';
import { useRouter } from "expo-router";
import { useCameraInvitesAndMemberships } from "@/src/hooks/useCameraQueries";
import { useAuth } from "@/context/AuthContext";
import { 
  useAcceptCameraInvite, 
  useDeclineCameraInvite 
} from "@/src/hooks/useCameraMutations";
import { CameraListSkeleton } from "@/components/SkeletonLoaders";

// Add drag constants
const screenHeight = Dimensions.get("window").height;
const COLLAPSED_HEIGHT = screenHeight * 0.45;
const EXPANDED_HEIGHT = screenHeight * 0.88;
const DRAG_HANDLE_HEIGHT = Math.min(Math.max(38, screenHeight * 0.04), 50);

export default function CameraModal() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set());
  const [isNavigating, setIsNavigating] = useState(false);

  // TanStack Query hooks
  const { user } = useAuth();
  const userId = user?.username;
  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch 
  } = useCameraInvitesAndMemberships(userId);
  const { invites = [], myCams = [] } = data || {};

  // Mutations
  const acceptInviteMutation = useAcceptCameraInvite();
  const declineInviteMutation = useDeclineCameraInvite();

  // Add drag state and animations
  const [isExpanded, setIsExpanded] = useState(false);

  // Animation values and refs - using translateY approach like me.tsx
  const animatedTranslateY = useRef(new Animated.Value(0)).current;
  const isScrollEnabled = useRef(true);
  const scrollOffset = useRef(0);
  const gestureStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const isDragging = useRef(false);

  // Interpolated opacity for camera invites fade animation
  const invitesOpacity = animatedTranslateY.interpolate({
    inputRange: [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), -100, 0],
    outputRange: [0, 0.7, 1],
    extrapolate: "clamp",
  });

  const gestureReady = useRef(false);

  useEffect(() => {
    currentTranslateY.current = isExpanded
      ? -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)
      : 0;
  }, [isExpanded]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy, dx } = gestureState;
        if (Math.abs(dy) < 5 || Math.abs(dx) > Math.abs(dy)) return false;
        if (dy < 0) return scrollOffset.current <= 5;
        if (dy > 0) return isExpanded || scrollOffset.current <= 5;
        return false;
      },
      onPanResponderGrant: () => {
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
        if (isExpanded) isScrollEnabled.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!gestureReady.current) {
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
        const { vy, dy } = gestureState;
        isScrollEnabled.current = true;
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
        setIsExpanded(shouldExpand);

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
        });
      },
    })
  ).current;

  const handleScrolly = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  /* Handle refresh with TanStack Query */
  const onRefresh = async () => {
    await refetch();
  };

  /* Accept invite with TanStack Query mutation */
  const accept = async (row: any) => {
    const inviteId = row.id;
    setProcessingInvites(prev => new Set(prev).add(inviteId));
    
    try {
      await acceptInviteMutation.mutateAsync({
        membershipId: row.id,
        version: row._version,
      });
      
      console.log(`✅ Invite accepted successfully: ${inviteId}`);
    } catch (err: any) {
      console.error("Accept invite error:", err);
      Alert.alert(
        "Error", 
        "Failed to accept invite. Please try again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => accept(row) }
        ]
      );
    } finally {
      setProcessingInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(inviteId);
        return newSet;
      });
    }
  };

  /* Decline invite with TanStack Query mutation */
  const decline = async (row: any) => {
    const inviteId = row.id;
    setProcessingInvites(prev => new Set(prev).add(inviteId));
    
    console.log("🔍 DECLINE ATTEMPT - Full record details:", {
      id: row.id,
      userId: row.userId,
      cameraId: row.cameraId,
      role: row.role,
      _version: row._version,
    });
    
    try {
      const result = await declineInviteMutation.mutateAsync({
        membershipId: row.id,
        version: row._version,
      });
      
      console.log(`✅ Invite declined successfully (${result.method}): ${inviteId}`);
    } catch (err: any) {
      console.error("❌ DECLINE FAILED:", err);
      Alert.alert(
        "Decline Failed", 
        `Unable to decline invite. This may be a permissions issue.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => decline(row) }
        ]
      );
    } finally {
      setProcessingInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(inviteId);
        return newSet;
      });
    }
  };


  const renderInvite = ({ item }: any) => {
    const isProcessing = processingInvites.has(item.id);
    
    return (
      <Box 
        bg={isDark ? "#1a1a1a" : "#f0f0f0"}
        borderRadius="$lg"
        p="$4"
        mb="$3"
        borderWidth="$1"
        borderColor={isDark ? "#333" : "#e5e5e5"}
        opacity={isProcessing ? 0.7 : 1}
      >
        <VStack space="md" alignItems="center">
          <HStack alignItems="center" space="md" justifyContent="center">
            <VStack alignItems="center">
              <Text 
                fontSize="$md" 
                fontWeight="$medium"
                color={isDark ? "#fff" : "#000"}
                textAlign="center"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                Event: {item.name}
              </Text>
              <Text 
                fontSize="$sm" 
                color={isDark ? "#999" : "#666"}
                textAlign="center"
              >
                You've been invited to join this event
              </Text>
            </VStack>
          </HStack>
          
          <HStack space="md" justifyContent="center">
            <Button
              variant="outline"
              borderColor="#ff3b30"
              borderRadius="$lg"
              px="$4"
              h={36}
              onPress={() => decline(item)}
              disabled={isProcessing}
              $pressed={{
                bg: isDark ? "#1a0a0a" : "#fff0f0",
              }}
            >
              {isProcessing ? (
                <Spinner size="small" color="#ff3b30" />
              ) : (
                <ButtonText color="#ff3b30" fontSize="$sm" fontWeight="$medium">
                  Decline
                </ButtonText>
              )}
            </Button>
            
            <Button
              bg="#4ade80"
              borderRadius="$lg"
              px="$4"
              h={36}
              onPress={() => accept(item)}
              disabled={isProcessing}
              $pressed={{
                bg: "#22c55e",
              }}
            >
              {isProcessing ? (
                <Spinner size="small" color="white" />
              ) : (
                <ButtonText color="$white" fontSize="$sm" fontWeight="$medium">
                  Accept
                </ButtonText>
              )}
            </Button>
          </HStack>
        </VStack>
      </Box>
    );
  };

  const renderCam = ({ item }: any) => (
    <Box 
      bg={isDark ? "#1a1a1a" : "#f0f0f0"}
      borderRadius="$lg"
      p="$4"
      mb="$3"
      borderWidth="$1"
      borderColor={isDark ? "#333" : "#e5e5e5"}
    >
      <VStack space="md" alignItems="center">
        <HStack alignItems="center" space="md" justifyContent="center">
          <VStack alignItems="center">
            <Text 
              fontSize="$md" 
              fontWeight="$medium"
              color={isDark ? "#fff" : "#000"}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            <Text 
              fontSize="$sm" 
              color="#4ade80"
              fontWeight="$medium"
            >
              {item.role === "ADMIN" ? "Owner" : "Member"}
            </Text>
          </VStack>
        </HStack>
        
        <HStack space="md" justifyContent="center">
          <Button
            variant="outline"
            borderColor="#007AFF"
            borderRadius="$lg"
            px="$4"
            h={36}
            disabled={isNavigating}
            opacity={isNavigating ? 0.6 : 1}
            onPress={() => {
              if (isNavigating) return;
              setIsNavigating(true);
              router.push(`/camera/${item.cameraId}/invite`);
              setTimeout(() => setIsNavigating(false), 1000);
            }}
            $pressed={{
              bg: isDark ? "#0a1a2a" : "#f0f8ff",
            }}
          >
            <ButtonText color="#007AFF" fontSize="$sm" fontWeight="$medium">
              Invite
            </ButtonText>
          </Button>
          
          <Button
            bg="#007AFF"
            borderRadius="$lg"
            px="$4"
            h={36}
            disabled={isNavigating}
            opacity={isNavigating ? 0.6 : 1}
            onPress={() => {
              if (isNavigating) return;
              setIsNavigating(true);
              router.push(`/camera/${item.cameraId}`);
              setTimeout(() => setIsNavigating(false), 1000);
            }}
            $pressed={{
              bg: "#0056CC",
            }}
          >
            <ButtonText color="$white" fontSize="$sm" fontWeight="$medium">
              See Members
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Box>
  );

  // Error state
  if (error && !loading) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack space="lg" alignItems="center" px="$8">
          <Text fontSize="$4xl">⚠️</Text>
          <Text 
            fontSize="$lg"
            color={isDark ? "#fff" : "#000"}
            fontWeight="$medium"
            textAlign="center"
          >
            Something went wrong
          </Text>
          <Text 
            fontSize="$sm"
            color={isDark ? "#999" : "#666"}
            textAlign="center"
          >
            {error?.message || "Failed to load events"}
          </Text>
          <Button
            bg="#007AFF"
            borderRadius="$lg"
            px="$6"
            h={44}
            onPress={() => refetch()}
            $pressed={{
              bg: "#0056CC",
            }}
          >
            <ButtonText color="$white" fontWeight="$semibold">
              Try Again
            </ButtonText>
          </Button>
        </VStack>
      </Center>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Box flex={1} bg={isDark ? "#000" : "#fff"}>
        {/* Invites Section */}
        <VStack p="$5" pb="$2">
          <Heading 
            size="lg" 
            color={isDark ? "#fff" : "#000"}
            fontWeight="$semibold"
            textAlign="center"
          >
            📩 Event Invites
          </Heading>
          
          <Box mt="$3">
            <CameraListSkeleton count={2} />
          </Box>
        </VStack>

        <Box flex={1} />

        {/* My Cameras Section */}
        <Box
          height={COLLAPSED_HEIGHT}
          overflow="hidden"
          bg={isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.98)"}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          elevation={8}
          shadowColor="#000"
          shadowOffset={{ width: 0, height: -4 }}
          shadowOpacity={isDark ? 0.4 : 0.15}
          shadowRadius={20}
          position="absolute"
          bottom={0}
          left={0}
          right={0}
        >
          {/* Header */}
          <Box
            bg={isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.95)"}
            pt="$2"
            borderTopLeftRadius="$3xl"
            borderTopRightRadius="$3xl"
          >
            <Box
              minHeight={DRAG_HANDLE_HEIGHT + 16}
              justifyContent="flex-start"
              alignItems="center"
              pt="$0"
              pb="$3"
              px="$3"
            >
              <Heading
                size="lg"
                textAlign="center"
                color={isDark ? "$textDark100" : "$textLight900"}
                fontWeight="$bold"
              >
                My Events
              </Heading>
            </Box>
          </Box>

          <Box mb={-28}/>

          {/* Divider */}
          <Box
            height={0.5}
            mx="$5"
            my="$3"
            bg={isDark ? "$borderDark600" : "$borderLight300"}
          />

          {/* Content */}
          <Box px="$5">
            <CameraListSkeleton count={2} />
          </Box>
        </Box>

        {/* Fixed Create New Camera Section */}
        <Box 
          position="absolute" 
          bottom={0}
          left={0}
          right={0}
          zIndex={20}
          bg={isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)"}
          borderTopWidth="$1"
          borderTopColor={isDark ? "#333" : "#e5e5e5"}
          p="$5"
          pt="$4"
          pb="$7"
        >
          <Button
            bg="#007AFF"
            borderRadius="$lg"
            w="100%"
            h={48}
            disabled={true}
            opacity={0.6}
            $pressed={{
              bg: "#0056CC",
            }}
          >
            <ButtonText color="$white" fontWeight="$semibold" fontSize="$md">
              Create New Event
            </ButtonText>
          </Button>
        </Box>
      </Box>
    );
  }

  /* ---------- render ---------- */
  return (
    <Box flex={1} bg={isDark ? "#000" : "#fff"}>
      {/* Invites Section with fade animation */}
      <Animated.View
        style={{
          opacity: invitesOpacity,
        }}
      >
        <VStack p="$5" pb="$2">
          <Heading 
            size="lg" 
            color={isDark ? "#fff" : "#000"}
            fontWeight="$semibold"
            textAlign="center"
          >
            📩 Event Invites
          </Heading>
          
          <Box height={screenHeight - COLLAPSED_HEIGHT - 180} mt="$3">
            <FlatList
              data={invites}
              keyExtractor={(item) => `${item.cameraId}:${item.userId}`}
              renderItem={renderInvite}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 20,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={false}
                  onRefresh={onRefresh}
                  tintColor={isDark ? "#999" : "#666"}
                />
              }
              ListEmptyComponent={
                <Center py="$1">
                  <Text 
                    color={isDark ? "#666" : "#999"}
                    fontSize="$sm"
                  >
                    No pending invites
                  </Text>
                </Center>
              }
            />
          </Box>
        </VStack>
      </Animated.View>

      <Box flex={1} />

      {/* Draggable My Cameras Section */}
      <Animated.View
        style={{
          height: EXPANDED_HEIGHT,
          transform: [{ translateY: animatedTranslateY }],
          overflow: "hidden",
          backgroundColor: isDark
            ? "rgba(0,0,0,0.95)"
            : "rgba(255,255,255,0.98)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 20,
          zIndex: isExpanded ? 15 : 2,
          position: "absolute",
          bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
          left: 0,
          right: 0,
        }}
        {...panResponder.panHandlers}
      >
        {/* Header */}
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
          <Box
            minHeight={DRAG_HANDLE_HEIGHT + 16}
            justifyContent="flex-start"
            alignItems="center"
            pt="$0"
            pb="$3"
            px="$3"
          >
            <HStack alignItems="center" justifyContent="center" w="100%" px="$4">
              <Heading
                size="lg"
                textAlign="center"
                color={isDark ? "$textDark100" : "$textLight900"}
                fontWeight="$bold"
              >
                My Events
              </Heading>
            </HStack>
          </Box>
        </Box>

        <Box mb={-28}/>

        {/* Divider */}
        <Box
          height={0.5}
          mx="$5"
          my="$3"
          bg={isDark ? "$borderDark600" : "$borderLight300"}
        />

        {/* Content */}
        <Box flex={1} px="$5" pb="$5">
          <FlatList
            data={myCams}
            keyExtractor={(item) => `${item.cameraId}:${item.userId}`}
            renderItem={renderCam}
            showsVerticalScrollIndicator={false}
            scrollEnabled={isScrollEnabled.current}
            onScroll={handleScrolly}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={onRefresh}
                tintColor={isDark ? "#999" : "#666"}
              />
            }
            ListEmptyComponent={
              <Center py="$4">
                <VStack space="sm" alignItems="center">
                  <Text 
                    color={isDark ? "#666" : "#999"}
                    fontSize="$sm"
                    textAlign="center"
                  >
                    No events yet
                  </Text>
                  <Text 
                    color={isDark ? "#555" : "#777"}
                    fontSize="$xs"
                    textAlign="center"
                  >
                    Create your first event below!
                  </Text>
                </VStack>
              </Center>
            }
            ListFooterComponent={null}
            contentContainerStyle={{
              paddingBottom: 80,
            }}
          />
        </Box>
      </Animated.View>

      {/* Fixed Create New Event Section */}
      <Box 
        position="absolute" 
        bottom={0}
        left={0}
        right={0}
        zIndex={20}
        bg={isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)"}
        borderTopWidth="$1"
        borderTopColor={isDark ? "#333" : "#e5e5e5"}
        shadowColor="#000"
        shadowOffset={{ width: 0, height: -2 }}
        shadowOpacity={isDark ? 0.3 : 0.1}
        shadowRadius={8}
        p="$5"
        pt="$4"
        pb="$7"
      >
        <Button
          bg="#007AFF"
          borderRadius="$lg"
          w="100%"
          h={48}
          disabled={isNavigating}
          opacity={isNavigating ? 0.6 : 1}
          onPress={() => {
            if (isNavigating) return;
            setIsNavigating(true);
            router.push("/camera/new");
            setTimeout(() => setIsNavigating(false), 1000);
          }}
          $pressed={{
            bg: "#0056CC",
          }}
          shadowColor="#007AFF"
          shadowOffset={{ width: 0, height: 4 }}
          shadowOpacity={0.3}
          shadowRadius={8}
        >
          <ButtonText color="$white" fontWeight="$semibold" fontSize="$md">
            Create New Event
          </ButtonText>
        </Button>
      </Box>
    </Box>
  );
}