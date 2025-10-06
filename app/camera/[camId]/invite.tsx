import React, { useState, useMemo } from "react";
import { FlatList, useColorScheme, RefreshControl, Alert } from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  InputField,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { useSearchUsers } from "@/src/hooks/usePhotoQueries";
import { useCameraMembers } from "@/src/hooks/useCameraQueries";
import { useSendCameraInvites } from "@/src/hooks/useCameraMutations";
import { UserSearchSkeleton } from "@/components/SkeletonLoaders";

// UserItem type is already defined in usePhotoQueries.ts
interface UserItem {
  id: string;
  displayName?: string | null;
  profilePhotoKey?: string | null;
  profilePhotoUrl?: string | null;
}

export default function CameraInvite() {
  const { camId } = useLocalSearchParams<{ camId: string }>();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // TanStack Query hooks
  const { data: searchResults = [], isLoading: searching } = useSearchUsers(search);
  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useCameraMembers(camId!);
  const sendInvitesMutation = useSendCameraInvites();
  
  // Convert members array to Map for easy lookup
  const existingMembers = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.userId, member.role);
    });
    return map;
  }, [members]);


  // Handle refresh
  const onRefresh = async () => {
    await refetchMembers();
  };

  const toggle = (uid: string) =>
    setSelected((prev) => {
      const c = new Set(prev);
      c.has(uid) ? c.delete(uid) : c.add(uid);
      return c;
    });

  const sendInvites = async () => {
    const userIds = Array.from(selected);
    
    try {
      await sendInvitesMutation.mutateAsync({
        cameraId: camId!,
        userIds,
      });
      
      console.log(`Successfully sent ${userIds.length} invites`);
      Alert.alert(
        "Invites Sent!", 
        `Successfully sent ${userIds.length} invite${userIds.length === 1 ? '' : 's'}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      console.error("Failed to send invites:", err);
      Alert.alert(
        "Error", 
        "Failed to send invites. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  /* get role badge styling */
  const getRoleBadgeProps = (role: string) => {
    switch (role) {
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

  // Render user item: disable if already existing member
  const renderItem = ({ item }: { item: UserItem }) => {
    const role = existingMembers.get(item.id);
    const disabled = !!role;
    const isSelected = selected.has(item.id);
    const roleBadgeProps = role ? getRoleBadgeProps(role) : null;

    return (
      <Pressable 
        onPress={() => !disabled && toggle(item.id)}
        disabled={disabled}
        $pressed={{
          bg: isDark ? "$backgroundDark800" : "$backgroundLight100"
        }}
      >
        <Box
          px="$4"
          py="$4"
          borderBottomWidth="$1"
          borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
          opacity={disabled ? 0.6 : 1}
          bg={isSelected ? (isDark ? "$primary950" : "$primary50") : "transparent"}
        >
          <HStack space="md" alignItems="center">
            {/* Checkbox for selection */}
            {!disabled && (
              <Checkbox
                size="md"
                value={item.id}
                isChecked={isSelected}
                onChange={() => toggle(item.id)}
                borderColor={isDark ? "$borderDark400" : "$borderLight300"}
              >
                <CheckboxIndicator mr="$2">
                  <CheckboxIcon as={CheckIcon} />
                </CheckboxIndicator>
              </Checkbox>
            )}

            {/* Profile Photo - Same styling as other screens */}
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

            {/* User Info */}
            <VStack flex={1}>
              <Text 
                fontSize="$lg"
                fontWeight="$medium"
                color={isDark ? "$textDark50" : "$textLight900"}
                numberOfLines={1}
              >
                {item.displayName ?? "Unnamed"}
              </Text>
              {disabled && (
                <Text 
                  fontSize="$sm"
                  color={isDark ? "$textDark400" : "$textLight500"}
                >
                  {role === 'INVITED' ? 'Already invited' : 'Already a member'}
                </Text>
              )}
            </VStack>

            {/* Role Badge for existing members */}
            {roleBadgeProps && (
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
                  {role!.toLowerCase()}
                </BadgeText>
              </Badge>
            )}
          </HStack>
        </Box>
      </Pressable>
    );
  };

  if (loadingMembers) {
    return (
      <Center 
        flex={1} 
        bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
      >
        <VStack space="lg" alignItems="center">
          <Spinner size="large" color={isDark ? "$primary400" : "$primary600"} />
          <Text 
            color={isDark ? "$textDark300" : "$textLight600"} 
            fontSize="$md"
          >
            Loading current members...
          </Text>
        </VStack>
      </Center>
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
      >
        <Heading 
          size="xl" 
          fontWeight="$bold"
          color={isDark ? "$textDark50" : "$textLight900"}
          textAlign="center"
        >
          Invite People
        </Heading>
        
        <Text 
          fontSize="$sm"
          color={isDark ? "$textDark300" : "$textLight600"}
          textAlign="center"
          mt="$1"
        >
          Search and invite people to join this event
        </Text>
      </Box>

      <VStack flex={1} space="md" p="$4">
        {/* Search Input */}
        <Input
          borderWidth="$1"
          borderColor={isDark ? "$borderDark400" : "$borderLight300"}
          borderRadius="$lg"
          bg={isDark ? "$backgroundDark800" : "$backgroundLight0"}
          $focus={{
            borderColor: "$primary600",
            shadowColor: "$primary600",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          }}
        >
          <InputField
            placeholder="Search users by name..."
            placeholderTextColor={isDark ? "$textDark400" : "$textLight500"}
            color={isDark ? "$textDark50" : "$textLight900"}
            value={search}
            onChangeText={setSearch}
            fontSize="$md"
            py="$2"
            px="$4"
          />
        </Input>

        {/* Loading and Status Messages */}
        {searching && (
          <UserSearchSkeleton count={4} />
        )}

        {/* Results List */}
        <Box flex={1}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
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
              search.length < 2 ? (
                <Center py="$16">
                  <VStack space="lg" alignItems="center">
                    <Box
                      width={80}
                      height={80}
                      borderRadius="$full"
                      bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text fontSize="$3xl">🔍</Text>
                    </Box>
                    
                    <VStack space="sm" alignItems="center">
                      <Heading
                        size="lg"
                        color={isDark ? "$textDark100" : "$textLight900"}
                        textAlign="center"
                      >
                        Search for Users
                      </Heading>
                    </VStack>
                  </VStack>
                </Center>
              ) : !searching ? (
                <Center py="$16">
                  <VStack space="lg" alignItems="center">
                    <Box
                      width={80}
                      height={80}
                      borderRadius="$full"
                      bg={isDark ? "$backgroundDark800" : "$backgroundLight100"}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text fontSize="$3xl">😔</Text>
                    </Box>
                    
                    <VStack space="sm" alignItems="center">
                      <Heading
                        size="lg"
                        color={isDark ? "$textDark100" : "$textLight900"}
                        textAlign="center"
                      >
                        No Users Found
                      </Heading>
                      <Text 
                        fontSize="$md"
                        color={isDark ? "$textDark300" : "$textLight600"}
                        textAlign="center"
                        px="$8"
                      >
                        No users found matching "{search}"
                      </Text>
                    </VStack>
                  </VStack>
                </Center>
              ) : null
            }
            contentContainerStyle={
              searchResults.length === 0 ? { flexGrow: 1 } : { paddingBottom: 20 }
            }
          />
        </Box>

        {/* Selected Count */}
        {selected.size > 0 && (
          <Center mb="$px">
            <Text 
              fontSize="$sm"
              color={isDark ? "$textDark300" : "$textLight600"}
            >
              {selected.size} user{selected.size === 1 ? "" : "s"} selected
            </Text>
          </Center>
        )}

        {/* Send Invites Button */}
        <Button
          mt="$8"
          mb="$8"
          bg="$primary600"
          borderRadius="$lg"
          h={56}
          onPress={sendInvites}
          isDisabled={selected.size === 0 || loadingMembers || searching || sendInvitesMutation.isPending}
          $pressed={{
            bg: "$primary700",
          }}
          $disabled={{
            bg: isDark ? "$backgroundDark700" : "$backgroundLight200",
            opacity: 0.6,
          }}
        >
          <ButtonText 
            color="$white" 
            fontSize="$lg"
            fontWeight="$semibold"
          >
            {sendInvitesMutation.isPending ? "Sending..." : `Send ${selected.size} Invite${selected.size === 1 ? "" : "s"}`}
          </ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}