import React, { useEffect, useState } from "react";
import { FlatList, useColorScheme, RefreshControl } from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Center,
  Heading,
  Badge,
  BadgeText,
  Pressable,
  Button,
  ButtonText,
} from '@gluestack-ui/themed';
import { useLocalSearchParams, router } from "expo-router";
import { getCurrentUser } from "aws-amplify/auth";
import { Image as ExpoImage } from "expo-image";
import { useCameraMembers, useCachedCameraName } from "@/src/hooks/useCameraQueries";
import { CameraMembersSkeleton } from "@/components/SkeletonLoaders";
import { useGenerateCameraInviteLink } from "@/src/hooks/useCameraMutations";
import { Share } from "lucide-react-native";

type Member = {
  userId: string;
  role: string;
  name: string;
  profilePhotoUrl: string | null;
};

export default function CameraMembersScreen() {
  const { camId } = useLocalSearchParams<{ camId: string }>();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // TanStack Query hooks
  const { 
    data: members = [], 
    isLoading: loading, 
    error, 
    refetch 
  } = useCameraMembers(camId!);
  const cameraName = useCachedCameraName(currentUserId, camId!) || `Camera ${camId}`;
  
  // Mutation hook for generating invite links
  const generateInviteLink = useGenerateCameraInviteLink();

  /* Get current user on mount */
  useEffect(() => {
    const getCurrentUserData = async () => {
      try {
        const { username: currentUser } = await getCurrentUser();
        setCurrentUserId(currentUser);
      } catch (err) {
        console.error("Failed to get current user:", err);
      }
    };
    getCurrentUserData();
  }, []);

  /* Handle refresh with TanStack Query */
  const onRefresh = async () => {
    await refetch();
  };

  /* Handle share button press */
  const handleShareCamera = () => {
    if (!currentUserId) return;
    
    generateInviteLink.mutate({
      cameraId: camId!,
      cameraName,
      inviterUserId: currentUserId,
      inviterName: currentUserId, // Using userId as display name
    });
  };

  /* get role badge styling */
  const getRoleBadgeProps = (role: string) => {
    switch (role) {
      case 'OWNER':
        return {
          bg: '$primary600',
          textColor: '$white'
        };
      case 'ADMIN':
        return {
          bg: '$orange500',
          textColor: '$white'
        };
      case 'INVITED':
        return {
          bg: '$yellow500',
          textColor: '$black'
        };
      case 'MEMBER':
        return {
          bg: isDark ? '$backgroundDark600' : '$backgroundLight300',
          textColor: isDark ? '$textDark200' : '$textLight700'
        };
      default:
        return {
          bg: isDark ? '$backgroundDark700' : '$backgroundLight200',
          textColor: isDark ? '$textDark200' : '$textLight700'
        };
    }
  };

  /* handle member press navigation */
  const handleMemberPress = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  /* render member row */
  const renderItem = ({ item }: { item: Member }) => {
    const roleBadgeProps = getRoleBadgeProps(item.role);
    const isCurrentUser = item.userId === currentUserId;
    
    return (
      <Pressable 
        onPress={() => handleMemberPress(item.userId)}
        $pressed={{
          bg: isDark ? "$backgroundDark800" : "$backgroundLight100"
        }}
      >
        <Box
          px="$4"
          py="$4"
          borderBottomWidth="$1"
          borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
        >
          <HStack space="md" alignItems="center" justifyContent="space-between">
            {/* Left side: Photo + Name */}
            <HStack space="md" alignItems="center" flex={1}>
              {/* Profile Photo - Same styling as album search */}
              <Box
                width={48}
                height={48}
                borderRadius="$full"
                bg={isDark ? "$backgroundDark100" : "$backgroundLight50"}
                borderWidth="$2"
                borderColor={isDark ? "$borderDark300" : "$borderLight200"}
                overflow="hidden"
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 4 }}
                shadowOpacity={0.15}
                shadowRadius={12}
              >
                {item.profilePhotoUrl ? (
                  <ExpoImage
                    source={{ uri: item.profilePhotoUrl }}
                    style={{ width: "100%", height: "100%", borderRadius: 22 }}
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
                      <Text fontSize="$md">👤</Text>
                    </Box>
                  </Center>
                )}
              </Box>

              {/* Member Info */}
              <VStack flex={1}>
                <HStack space="xs" alignItems="center">
                  <Text 
                    fontSize="$lg"
                    fontWeight="$medium"
                    color={isDark ? "$textDark50" : "$textLight900"}
                    numberOfLines={1}
                    flex={1}
                  >
                    {item.name}
                  </Text>
                  {isCurrentUser && (
                    <Text 
                      fontSize="$sm"
                      color={isDark ? "$primary400" : "$primary600"}
                      fontWeight="$medium"
                    >
                      (You)
                    </Text>
                  )}
                </HStack>
              </VStack>
            </HStack>

            {/* Right side: Role Badge - Show for everyone */}
            <Badge
              bg={roleBadgeProps.bg}
              borderRadius="$md"
              px="$3"
              py="$1"
            >
              <BadgeText 
                color={roleBadgeProps.textColor}
                fontSize="$xs"
                fontWeight="$semibold"
                textTransform="capitalize"
              >
                {item.role.toLowerCase()}
              </BadgeText>
            </Badge>
          </HStack>
        </Box>
      </Pressable>
    );
  };

  // Error state
  if (error && !loading) {
    return (
      <Center 
        flex={1} 
        bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
      >
        <VStack space="lg" alignItems="center" px="$8">
          <Text fontSize="$4xl">⚠️</Text>
          <Text 
            fontSize="$lg"
            color={isDark ? "$textDark50" : "$textLight900"}
            fontWeight="$medium"
            textAlign="center"
          >
            Failed to load members
          </Text>
          <Text 
            fontSize="$sm"
            color={isDark ? "$textDark300" : "$textLight600"}
            textAlign="center"
          >
            {error?.message || "Something went wrong"}
          </Text>
          <Pressable
            bg={isDark ? "$primary400" : "$primary600"}
            borderRadius="$lg"
            px="$6"
            py="$3"
            onPress={() => refetch()}
            $pressed={{
              bg: isDark ? "$primary500" : "$primary700",
            }}
          >
            <Text color="$white" fontWeight="$semibold">
              Try Again
            </Text>
          </Pressable>
        </VStack>
      </Center>
    );
  }

  if (loading) {
    return (
      <Box 
        flex={1} 
        bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
      >
        <CameraMembersSkeleton count={10} />
      </Box>
    );
  }

  return (
    <Box 
      flex={1} 
      bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
    >
      {/* Header */}
      <Box
        pt="$6"
        pb="$4"
        px="$4"
        borderBottomWidth="$1"
        borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
        bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
      >
        <HStack alignItems="center" justifyContent="space-between">
          <Box flex={1} />
          
          <VStack flex={2} alignItems="center">
            <Heading 
              size="xl" 
              fontWeight="$bold"
              color={isDark ? "$textDark50" : "$textLight900"}
              textAlign="center"
              numberOfLines={2}
            >
              {cameraName}
            </Heading>
            
            <Text 
              fontSize="$sm"
              color={isDark ? "$textDark300" : "$textLight600"}
              textAlign="center"
              mt="$1"
            >
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </VStack>
          
          <Box flex={1} alignItems="flex-end">
            <Button
              size="sm"
              variant="outline"
              borderColor={isDark ? "$borderDark600" : "$borderLight300"}
              bg="transparent"
              onPress={handleShareCamera}
              isDisabled={!currentUserId || generateInviteLink.isPending}
              $pressed={{
                bg: isDark ? "$backgroundDark800" : "$backgroundLight100",
              }}
            >
              <HStack space="xs" alignItems="center">
                <Share 
                  size={16} 
                  color={isDark ? "#a1a1aa" : "#71717a"} 
                />
                <ButtonText 
                  fontSize="$sm"
                  color={isDark ? "$textDark200" : "$textLight700"}
                >
                  {generateInviteLink.isPending ? "..." : "Share"}
                </ButtonText>
              </HStack>
            </Button>
          </Box>
        </HStack>
      </Box>

      {/* Members List */}
      <Box flex={1}>
        <FlatList
          data={members}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={isDark ? "$textDark300" : "$textLight600"}
            />
          }
          ListEmptyComponent={
            <Center py="$16">
              <VStack space="lg" alignItems="center">
                <Box
                  width={80}
                  height={80}
                  borderRadius="$full"
                  bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                  justifyContent="center"
                  alignItems="center"
                  shadowColor="$shadowColor"
                  shadowOffset={{ width: 0, height: 4 }}
                  shadowOpacity={0.1}
                  shadowRadius={12}
                >
                  <Text fontSize="$3xl">👥</Text>
                </Box>
                
                <VStack space="sm" alignItems="center">
                  <Heading
                    size="lg"
                    color={isDark ? "$textDark100" : "$textLight900"}
                    textAlign="center"
                  >
                    No Members Yet
                  </Heading>
                  <Text 
                    fontSize="$md"
                    color={isDark ? "$textDark300" : "$textLight600"}
                    textAlign="center"
                    px="$8"
                  >
                    Invite users to join this event
                  </Text>
                </VStack>
              </VStack>
            </Center>
          }
          contentContainerStyle={
            members.length === 0 ? { flexGrow: 1 } : { paddingBottom: 20 }
          }
        />
      </Box>
    </Box>
  );
}