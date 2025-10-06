import React, { useState, useEffect, useMemo } from "react";
import { FlatList, useColorScheme, Alert } from "react-native";
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
  Pressable,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckIcon,
} from '@gluestack-ui/themed';
import { useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { useSearchUsers } from "@/src/hooks/usePhotoQueries";
import { useCreateCamera } from "@/src/hooks/useCameraMutations";
import { UserSearchSkeleton } from "@/components/SkeletonLoaders";

// UserItem type is already defined in usePhotoQueries.ts
interface UserItem {
  id: string;
  displayName?: string | null;
  profilePhotoKey?: string | null;
  profilePhotoUrl?: string | null;
}

export default function NewCameraScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // TanStack Query hooks
  const { data: searchResults = [], isLoading: searching } = useSearchUsers(search);
  const createCameraMutation = useCreateCamera();



  const toggle = (uid: string) =>
    setSelected((prev) => {
      const c = new Set(prev);
      c.has(uid) ? c.delete(uid) : c.add(uid);
      return c;
    });

  const createCam = async () => {
    if (!name) {
      Alert.alert("Error", "Please enter an event name");
      return;
    }
    
    try {
      const inviteUserIds = Array.from(selected);
      await createCameraMutation.mutateAsync({
        name,
        inviteUserIds,
      });
      
      const message = inviteUserIds.length > 0 
        ? `Event "${name}" created with ${inviteUserIds.length} invite${inviteUserIds.length === 1 ? '' : 's'}!`
        : `Event "${name}" created successfully!`;
      
      Alert.alert(
        "Event Created!", 
        message,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      console.error("Error creating camera:", err);
      Alert.alert(
        "Error", 
        "Failed to create event. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const renderItem = ({ item }: { item: UserItem }) => {
    const isSelected = selected.has(item.id);

    return (
      <Pressable
        onPress={() => toggle(item.id)}
        $pressed={{
          bg: isDark ? "$backgroundDark800" : "$backgroundLight100",
        }}
      >
        <Box
          px="$4"
          py="$4"
          borderBottomWidth="$1"
          borderBottomColor={isDark ? "$borderDark700" : "$borderLight200"}
          bg={isSelected ? (isDark ? "$primary950" : "$primary50") : "transparent"}
        >
          <HStack space="md" alignItems="center">
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

            {/* Profile Photo */}
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
            </VStack>
          </HStack>
        </Box>
      </Pressable>
    );
  };


  return (
    <Box flex={1} bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}>
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
          Create New Event
        </Heading>
        <Text
          fontSize="$sm"
          color={isDark ? "$textDark300" : "$textLight600"}
          textAlign="center"
          mt="$1"
        >
          Name your event and invite users to join
        </Text>
      </Box>

      <VStack flex={1} space="md" p="$4">
        {/* Camera Name Input */}
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
            placeholder="Event name"
            placeholderTextColor={isDark ? "$textDark400" : "$textLight500"}
            color={isDark ? "$textDark50" : "$textLight900"}
            value={name}
            onChangeText={setName}
            fontSize="$md"
            py="$2"
            px="$3"
            returnKeyType="done"
          />
        </Input>

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
            placeholder="Search users to invite..."
            placeholderTextColor={isDark ? "$textDark400" : "$textLight500"}
            color={isDark ? "$textDark50" : "$textLight900"}
            value={search}
            onChangeText={setSearch}
            fontSize="$md"
            py="$2"
            px="$4"
            autoCorrect={false}
            autoComplete="off"
          />
        </Input>

        {/* Loading / Searching Indicator */}
        {searching && (
          <UserSearchSkeleton count={4} />
        )}

        {/* User List */}
        <Box flex={1} borderRadius="$lg" overflow="hidden" borderWidth="$1" borderColor={isDark ? "$borderDark700" : "$borderLight300"}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              search.length < 2 ? (
                <Center py="$16">
                  <Text
                    fontSize="$md"
                    color={isDark ? "$textDark300" : "$textLight600"}
                    fontStyle="italic"
                  >
                    Start typing to search users
                  </Text>
                </Center>
              ) : !searching ? (
                <Center py="$16">
                  <Text
                    fontSize="$md"
                    color={isDark ? "$textDark300" : "$textLight600"}
                    fontStyle="italic"
                  >
                    No users found matching "{search}"
                  </Text>
                </Center>
              ) : null
            }
            contentContainerStyle={{ flexGrow: 1 }}
          />
        </Box>

        {/* Selected count */}
        {selected.size > 0 && (
          <Center mt="$2">
            <Text
              fontSize="$sm"
              color={isDark ? "$primary400" : "$primary600"}
              fontWeight="$semibold"
            >
              {selected.size} user{selected.size === 1 ? "" : "s"} selected
            </Text>
          </Center>
        )}

        {/* Create Button */}
        <Button
          mt="$6"
          mb="$6"
          bg="$primary600"
          borderRadius="$lg"
          h={56}
          onPress={createCam}
          isDisabled={!name || searching || createCameraMutation.isPending}
          $pressed={{ bg: "$primary700" }}
          $disabled={{
            bg: isDark ? "$backgroundDark700" : "$backgroundLight200",
            opacity: 0.6,
          }}
        >
          <ButtonText color="$white" fontSize="$lg" fontWeight="$semibold">
            {createCameraMutation.isPending ? "Creating..." : "Create Event"}
          </ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}