import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useMyProfile } from '../../src/hooks/useProfileQueries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Center, VStack, Spinner, Text } from '@gluestack-ui/themed';
import { useColorScheme } from 'react-native';

// Helper to get user-specific storage keys
const getOnboardingKey = (username: string, step: string) =>
  `${step}_${username}`;

export async function getOnboardingProgress(username: string) {
  try {
    const steps = {
      terms: await AsyncStorage.getItem(getOnboardingKey(username, 'terms_accepted')) === 'true',
      privacy: await AsyncStorage.getItem(getOnboardingKey(username, 'privacy_accepted')) === 'true',
      profile: await AsyncStorage.getItem(getOnboardingKey(username, 'profile_handled')) === 'true',
    };
    return steps;
  } catch (error) {
    console.error('[ONBOARDING] Failed to get progress:', error);
    return {
      terms: false,
      privacy: false,
      profile: false,
    };
  }
}

export default function OnboardingIndex() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { data: profileData } = useMyProfile();
  const [isChecking, setIsChecking] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const checkProgress = async () => {
      if (!user?.username) return;

      try {
        // Get saved progress
        const progress = await getOnboardingProgress(user.username);

        // If face is enrolled, skip entire onboarding
        if (profile?.faceCount && profile.faceCount > 0) {
          console.log('[ONBOARDING] User already has face enrolled, completing onboarding');
          router.replace('/(tabs)/camera');
          return;
        }

        // Route to next incomplete step
        if (!progress.terms) {
          router.replace('/onboard/terms');
        } else if (!progress.privacy) {
          router.replace('/onboard/privacy');
        } else if (!progress.profile) {
          // Check if user has profile photo
          if (profileData?.profilePhotoKey) {
            await AsyncStorage.setItem(getOnboardingKey(user.username, 'profile_handled'), 'true');
            router.replace('/(tabs)/camera');
          } else {
            router.replace('/onboard/profile');
          }
        } else {
          // All onboarding steps completed, go to camera
          router.replace('/(tabs)/camera');
        }
      } catch (error) {
        console.error('[ONBOARDING] Error checking progress:', error);
        // Default to first step on error
        router.replace('/onboard/terms');
      } finally {
        setIsChecking(false);
      }
    };

    checkProgress();
  }, [user?.username, profile?.faceCount, profileData, router]);

  if (isChecking) {
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
            Loading onboarding...
          </Text>
        </VStack>
      </Center>
    );
  }

  return null; // Router will handle navigation
}