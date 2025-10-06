/* components/sections/LegalSection.tsx */
import React, { useState } from "react";
import { useColorScheme } from "react-native";
import {
  Box,
  HStack,
  Text,
  Pressable,
  VStack,
} from '@gluestack-ui/themed';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface LegalSectionProps {}

export default function LegalSection({}: LegalSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const [legalDropdownOpen, setLegalDropdownOpen] = useState(false);

  const handleTermsPress = () => {
    router.push({
      pathname: '/legal/terms' as any,
    });
  };

  const handlePrivacyPress = () => {
    router.push({
      pathname: '/legal/privacy' as any,
    });
  };

  return (
    <Box
      bg={isDark ? "#1a1a1a" : "#f8f8f8"}
      borderRadius="$lg"
      borderTopWidth="$1"
      borderTopColor={isDark ? "#333" : "#e5e5e5"}
      overflow="hidden"
    >
      {/* Section Header */}
      <Pressable
        onPress={() => setLegalDropdownOpen(!legalDropdownOpen)}
        $pressed={{
          bg: isDark ? "#2a2a2a" : "#eeeeee",
        }}
      >
        <HStack
          alignItems="center"
          justifyContent="space-between"
          p="$4"
        >
          <HStack alignItems="center" space="md">
            <VStack>
              <Text
                fontSize="$lg"
                fontWeight="$semibold"
                color={isDark ? "#fff" : "#000"}
              >
                Legal & Privacy
              </Text>
            </VStack>
          </HStack>
          
          <Ionicons
            name={legalDropdownOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color={isDark ? "#999" : "#666"}
          />
        </HStack>
      </Pressable>

      {/* Dropdown Content */}
      {legalDropdownOpen && (
        <VStack
          space="xs"
          px="$4"
          pb="$1"
          bg={isDark ? "#222" : "#f0f0f0"}
        >
          {/* Terms of Service */}
          <Pressable
            onPress={handleTermsPress}
            borderRadius="$md"
            p="$3"
            $pressed={{
              bg: isDark ? "#333" : "#e0e0e0",
            }}
          >
            <HStack alignItems="center" justifyContent="space-between">
              <HStack alignItems="center" space="sm">
                <Text fontSize="$lg">📋</Text>
                <VStack>
                  <Text
                    fontSize="$md"
                    fontWeight="$medium"
                    color={isDark ? "#fff" : "#000"}
                  >
                    Terms of Service
                  </Text>
                  <Text
                    fontSize="$xs"
                    color={isDark ? "#999" : "#666"}
                  >
                    App usage terms and conditions
                  </Text>
                </VStack>
              </HStack>
              
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDark ? "#999" : "#666"}
              />
            </HStack>
          </Pressable>

          {/* Privacy Policy */}
          <Pressable
            onPress={handlePrivacyPress}
            borderRadius="$md"
            p="$3"
            $pressed={{
              bg: isDark ? "#333" : "#e0e0e0",
            }}
          >
            <HStack alignItems="center" justifyContent="space-between">
              <HStack alignItems="center" space="sm">
                <Text fontSize="$lg">🔒</Text>
                <VStack>
                  <Text
                    fontSize="$md"
                    fontWeight="$medium"
                    color={isDark ? "#fff" : "#000"}
                  >
                    Privacy Policy
                  </Text>
                  <Text
                    fontSize="$xs"
                    color={isDark ? "#999" : "#666"}
                  >
                    Data collection and usage
                  </Text>
                </VStack>
              </HStack>
              
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDark ? "#999" : "#666"}
              />
            </HStack>
          </Pressable>
        </VStack>
      )}
    </Box>
  );
}