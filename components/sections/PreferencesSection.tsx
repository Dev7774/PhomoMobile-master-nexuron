/* components/PreferencesSection.tsx */
import React, { useState, useEffect } from "react";
import { Alert, Switch, useColorScheme, Linking } from "react-native";
import {
  Box,
  HStack,
  Text,
  Pressable,
} from '@gluestack-ui/themed';
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { usePreferencesStore } from "@/src/stores/preferencesStore";
import { useAuth } from "@/context/AuthContext";

interface PreferencesSectionProps {
  autoOpen?: boolean;
}

export default function PreferencesSection({ autoOpen = false }: PreferencesSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const userId = user?.username;
  
  const [sharingDropdownOpen, setSharingDropdownOpen] = useState(false);
  const [savingAutoShare, setSavingAutoShare] = useState(false);
  const [savingAutoSync, setSavingAutoSync] = useState(false);

  // Optimistic state for immediate UI feedback
  const [optimisticAutoShare, setOptimisticAutoShare] = useState<boolean | null>(null);
  const [optimisticAutoSync, setOptimisticAutoSync] = useState<boolean | null>(null);
  
  const [permissionInfo, requestPermission] = ImagePicker.useMediaLibraryPermissions({ writeOnly: true });
  
  const { 
    autoShareFaces, 
    autoSyncToDevice,
    isLoaded, 
    setAutoShareFaces, 
    setAutoSyncToDevice,
    loadPreferences 
  } = usePreferencesStore();

  useEffect(() => {
    if (userId) {
      loadPreferences(userId);
    }
  }, [loadPreferences, userId]);


  // Auto-open preferences if requested from camera
  useEffect(() => {
    if (autoOpen && isLoaded) {
      // Small delay to ensure component is mounted and preferences are loaded
      const timer = setTimeout(() => {
        setSharingDropdownOpen(true);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [autoOpen, isLoaded]);

  const handleToggleAutoShare = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const newValue = !autoShareFaces;

    try {
      setSavingAutoShare(true);
      // Optimistic update for immediate UI feedback
      setOptimisticAutoShare(newValue);

      await setAutoShareFaces(newValue, userId);

      // Clear optimistic state on success
      setOptimisticAutoShare(null);
    } catch (err) {
      console.error("Failed to save autoShareFaces:", err);
      Alert.alert("Error", "Failed to save your preference.");
      // Revert optimistic state on error
      setOptimisticAutoShare(null);
    } finally {
      setSavingAutoShare(false);
    }
  };


  const handleToggleAutoSync = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const newValue = !autoSyncToDevice;

    try {
      setSavingAutoSync(true);
      // Optimistic update for immediate UI feedback
      setOptimisticAutoSync(newValue);

      await setAutoSyncToDevice(newValue, userId);

      // Clear optimistic state on success
      setOptimisticAutoSync(null);
    } catch (err) {
      console.error("Failed to save autoSyncToDevice:", err);
      Alert.alert("Error", "Failed to save your preference.");
      // Revert optimistic state on error
      setOptimisticAutoSync(null);
    } finally {
      setSavingAutoSync(false);
    }
  };

  const handleOpenSettings = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    try {
      // If never asked before, request permission first
      if (permissionInfo?.status === 'undetermined') {
        const result = await requestPermission();
        
        if (result.status === 'granted') {
          console.log('Permission granted on first request, enabling auto-sync');
          // Immediately set toggle to true when permission granted
          await setAutoSyncToDevice(true, userId);
          return; // Don't need to open settings
        } else {
          console.log('Permission denied on first request, not opening settings');
          return; // Don't force them to settings after declining
        }
      }
      
      // Only open settings if previously denied (they tapped the message again)
      await Linking.openSettings();
    } catch (error) {
      console.error('Error handling settings:', error);
      Alert.alert('Error', 'Unable to open settings');
    }
  };

  return (
    <Box>
      <Pressable
        onPress={() => setSharingDropdownOpen((prev) => !prev)}
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
            Preferences
          </Text>
          <Ionicons
            name={sharingDropdownOpen ? "chevron-up" : "chevron-down"}
            size={24}
            color="#007AFF"
          />
        </HStack>
      </Pressable>

      {sharingDropdownOpen && (
        <Box mt="$3" p="$4" borderRadius="$lg" bg={isDark ? "#0a0a0a" : "#f9f9f9"}>
          {/* Auto-sync toggle or permission message */}
          {permissionInfo?.status === 'granted' ? (
            <HStack 
              justifyContent="space-between" 
              alignItems="center"
              px="$2"
              mb="$4"
            >
              <Box flex={1} mr="$4">
                <Text 
                  fontSize="$md" 
                  fontWeight="$medium"
                  color={isDark ? "#fff" : "#000"}
                  lineHeight="$lg"
                >
                  Auto-sync to Camera Roll
                </Text>
                <Text 
                  fontSize="$sm" 
                  color={isDark ? "#999" : "#666"}
                  mt="$1"
                >
                  Automatically save shared photos to your camera roll
                </Text>
              </Box>
              
              <Switch
                value={optimisticAutoSync !== null ? optimisticAutoSync : autoSyncToDevice}
                onValueChange={handleToggleAutoSync}
                disabled={savingAutoSync || !isLoaded}
                trackColor={{
                  false: isDark ? "#374151" : "#d1d5db",
                  true: "#3b82f6"
                }}
                thumbColor="#ffffff"
              />
            </HStack>
          ) : (
            <Pressable
              onPress={handleOpenSettings}
              bg="#ffebee"
              borderColor="#f44336"
              borderWidth="$2"
              borderRadius="$lg"
              p="$4"
              mb="$4"
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
                {permissionInfo?.status === 'undetermined' 
                  ? "❌ Photo library access required for syncing - Enable to allow this preference"
                  : "❌ Photo library access required for syncing - Tap to enable in Settings"}
              </Text>
            </Pressable>
          )}

          <HStack 
            justifyContent="space-between" 
            alignItems="center"
            px="$2"
          >
            <Box flex={1} mr="$4">
              <Text 
                fontSize="$md" 
                fontWeight="$medium"
                color={isDark ? "#fff" : "#000"}
                lineHeight="$lg"
              >
                Allow automatic face matching
              </Text>
              <Text 
                fontSize="$sm" 
                color={isDark ? "#999" : "#666"}
                mt="$1"
              >
                When enabled, your photo will be automatically shared with matched friends
              </Text>
            </Box>
            
            <Switch
              value={optimisticAutoShare !== null ? optimisticAutoShare : autoShareFaces}
              onValueChange={handleToggleAutoShare}
              disabled={savingAutoShare || !isLoaded}
              trackColor={{
                false: isDark ? "#374151" : "#d1d5db",
                true: "#3b82f6"
              }}
              thumbColor="#ffffff"
            />
          </HStack>
        </Box>
      )}
    </Box>
  );
}