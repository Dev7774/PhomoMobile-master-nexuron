/* app/settingsModal.tsx */
import React, { useState, useEffect } from "react";
import { ScrollView, KeyboardAvoidingView, Platform, useColorScheme } from "react-native";
import { 
  Box,
  VStack,
  Text,
  Button,
  ButtonText,
  HStack
} from '@gluestack-ui/themed';
import { fetchUserAttributes } from "aws-amplify/auth";
import { useAuth } from "@/context/AuthContext";
import { useLocalSearchParams } from "expo-router";
import PasswordSection from "@/components/sections/PasswordSection";
import EmailSection from "@/components/sections/EmailSection";
import FaceUpdateSection from "@/components/sections/FaceUpdateSection";
import PreferencesSection from "@/components/sections/PreferencesSection";
import LegalSection from "@/components/sections/LegalSection";
import AccountDeletionSection from "@/components/sections/AccountDeletionSection";
import { useUploadQueue } from "@/src/stores/uploadQueueStore";
import { useWalkthroughElement } from "@/src/context/WalkthroughContext";
import { useUpdatePushToken } from "@/src/hooks/usePushNotifications";
import { pushNotificationService } from "@/src/utils/pushNotifications/pushNotificationService";

export default function settingsModal() {
  const { signOut, user } = useAuth();
  const updatePushToken = useUpdatePushToken();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { openPreferences } = useLocalSearchParams();
  
  // Walkthrough element refs
  const faceUpdateSectionRef = useWalkthroughElement('face-update-section');
  
  const [thirdPartyProvider, setThirdPartyProvider] = useState<string | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);

  const { stats } = useUploadQueue();
  const hasActiveUploads = stats.pending > 0 || stats.processing > 0;
  const isSignOutDisabled = hasActiveUploads || faceUploading;

  useEffect(() => {
    async function checkThirdParty() {
      if (!user) return;
      try {
        const attributesRaw = await fetchUserAttributes();
        let attributes: Array<{ Name: string; Value: string }> = [];

        if (typeof attributesRaw === "string") {
          attributes = JSON.parse(attributesRaw);
        } else if (Array.isArray(attributesRaw)) {
          attributes = attributesRaw;
        } else if (typeof attributesRaw === "object" && attributesRaw !== null) {
          attributes = Object.entries(attributesRaw).map(([Name, Value]) => ({
            Name,
            Value: String(Value),
          }));
        }

        const identitiesAttr = attributes.find(attr => attr.Name === "identities");
        if (identitiesAttr) {
          const identities = JSON.parse(identitiesAttr.Value);
          if (identities && identities.length > 0) {
            setThirdPartyProvider(identities[0].providerName || null);
            return;
          }
        }

        setThirdPartyProvider(null);
      } catch {
        setThirdPartyProvider(null);
      }
    }

    checkThirdParty();
  }, [user]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <ScrollView 
        contentContainerStyle={{ 
          minHeight: "100%", 
        }} 
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: isDark ? "#000" : "#fff" }}
      >
        <Box flex={1} p="$5" bg={isDark ? "#000" : "#fff"}>
          {/* Header */}
          <Box
            bg={isDark ? "#1a1a1a" : "#f8f8f8"}
            borderRadius="$lg"
            p="$4"
            borderTopWidth="$1"
            borderTopColor={isDark ? "#333" : "#e5e5e5"}
            mb="$8"
          >
            <HStack justifyContent="space-between" alignItems="center">
              <Text 
                fontSize="$lg" 
                fontWeight="$medium"
                color={isDark ? "#fff" : "#000"}
              >
                Welcome, {user?.username || "User"}
              </Text>
              
              <Button
                bg={isSignOutDisabled ? (isDark ? "#444" : "#ccc") : "#ff3b30"}
                borderRadius="$lg"
                px="$4"
                py="$2"
                h={36}
                onPress={() => {
                  // Create cleanup function to pass to signOut
                  const cleanupPushToken = async () => {
                    // Clear push token from database
                    await updatePushToken.mutateAsync({ expoPushToken: null });
                  };
                  signOut(cleanupPushToken);
                }}
                disabled={isSignOutDisabled}
                $pressed={{
                  bg: isSignOutDisabled ? (isDark ? "#444" : "#ccc") : "#d70015",
                }}
              >
                <ButtonText 
                  color={isSignOutDisabled ? (isDark ? "#666" : "#999") : "$white"} 
                  fontSize="$sm" 
                  fontWeight="$semibold"
                >
                  {isSignOutDisabled ? (faceUploading ? "Face uploading..." : "Uploading...") : "Sign Out"}
                </ButtonText>
              </Button>
            </HStack>
          </Box>

          {(hasActiveUploads || faceUploading) && (
            <Box 
              bg={isDark ? "rgba(255, 165, 0, 0.15)" : "rgba(255, 165, 0, 0.1)"} 
              borderColor={isDark ? "#ff8c00" : "#ff8c00"}
              borderWidth="$1"
              borderRadius="$lg" 
              p="$4" 
              mb="$6"
            >
              <HStack alignItems="center" space="sm">
                <Text fontSize="$lg">📤</Text>
                <VStack flex={1}>
                  <Text 
                    fontSize="$sm" 
                    fontWeight="$semibold"
                    color={isDark ? "#ffb347" : "#e65100"}
                  >
                    {faceUploading ? "Uploading face photo..." : 
                     stats.processing > 0 ? "Uploading photos..." : `${stats.pending} photos queued for upload`}
                  </Text>
                  <Text 
                    fontSize="$xs" 
                    color={isDark ? "#cc8400" : "#bf360c"}
                    mt="$1"
                  >
                    Some features are temporarily disabled during photo uploads
                  </Text>
                </VStack>
              </HStack>
            </Box>
          )}

          <VStack space="lg">
            <EmailSection />
            <PasswordSection thirdPartyProvider={thirdPartyProvider} />
            <Box ref={faceUpdateSectionRef}>
              <FaceUpdateSection 
                user={user} 
                onUploadStateChange={setFaceUploading}
              />
            </Box>
            <PreferencesSection autoOpen={openPreferences === "true"} />
            <LegalSection />
            <AccountDeletionSection isFaceUploading={faceUploading} />
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}