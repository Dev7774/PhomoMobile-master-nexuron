import React from 'react';
import { Box, Button, ButtonText, Text, VStack } from '@gluestack-ui/themed';
import { useWalkthrough } from '@/src/context/WalkthroughContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';

export const WalkthroughDebug: React.FC = () => {
  const { user } = useAuth();
  const { 
    startWalkthrough,
    forceStartWalkthrough, 
    isActive, 
    currentStep, 
    currentFlow,
    isFlowCompleted,
    getElementRef,
    totalSteps,
    currentStepIndex
  } = useWalkthrough();

  const handleStartWalkthrough = async () => {
    console.log('[DEBUG] Force starting walkthrough');
    const result = await forceStartWalkthrough('main-onboarding');
    console.log('[DEBUG] Force start result:', result);
  };

  const handleResetWalkthrough = async () => {
    if (user?.username) {
      // Clear both the shown flag and completion status
      const walkthroughShownKey = `walkthrough_shown_${user.username}`;
      const completedKey = `walkthrough_completed_${user.username}`;
      
      await Promise.all([
        AsyncStorage.removeItem(walkthroughShownKey),
        AsyncStorage.removeItem(completedKey)
      ]);
      
      console.log('[DEBUG] Walkthrough completely reset for user:', user.username);
      console.log('[DEBUG] Please restart the app or reload to see the reset effect');
    }
  };

  if (__DEV__) {
    return (
      <Box
        position="absolute"
        top={100}
        right={10}
        bg="rgba(0,0,0,0.8)"
        p="$2"
        borderRadius="$md"
        zIndex={10000}
      >
        <VStack space="xs">
          <Text color="$white" fontSize="$xs">
            Walkthrough Debug
          </Text>
          <Text color="$white" fontSize="$xs">
            Active: {isActive ? 'Yes' : 'No'}
          </Text>
          <Text color="$white" fontSize="$xs">
            Step: {currentStepIndex + 1}/{totalSteps}
          </Text>
          <Text color="$white" fontSize="$xs">
            Current: {currentStep?.title?.substring(0, 15) || 'None'}
          </Text>
          <Text color="$white" fontSize="$xs">
            Completed: {isFlowCompleted('main-onboarding') ? 'Yes' : 'No'}
          </Text>
          <Text color="$white" fontSize="$xs">
            Target: {currentStep?.targetElement || 'None'}
          </Text>
          <Button size="xs" onPress={handleStartWalkthrough}>
            <ButtonText fontSize="$xs">Start</ButtonText>
          </Button>
          <Button size="xs" onPress={handleResetWalkthrough}>
            <ButtonText fontSize="$xs">Reset</ButtonText>
          </Button>
        </VStack>
      </Box>
    );
  }

  return null;
};