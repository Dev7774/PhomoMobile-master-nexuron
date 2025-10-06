import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Pressable,
} from '@gluestack-ui/themed';
import { useWalkthrough } from '@/src/context/WalkthroughContext';
import { useRouter } from 'expo-router';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface HighlightedArea {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

interface WalkthroughOverlayProps {
  visible: boolean;
}

export const WalkthroughOverlay: React.FC<WalkthroughOverlayProps> = ({ visible }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    skipWalkthrough,
    getElementRef,
    currentFlow,
  } = useWalkthrough();

  const [highlightedArea, setHighlightedArea] = useState<HighlightedArea | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Calculate highlighted area from target element
  useEffect(() => {
    if (!currentStep) return;

    if (!currentStep.targetElement) {
      setHighlightedArea(null);
      // For center positioned tooltips, set position immediately
      calculateTooltipPosition(0, 0, 0, 0);
      return;
    }

    const elementRef = getElementRef(currentStep.targetElement);
    if (!elementRef?.current) {
      setHighlightedArea(null);
      // Fallback to center position
      calculateTooltipPosition(0, 0, 0, 0);
      return;
    }

    // Measure the target element
    elementRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      
      const padding = currentStep.highlightConfig?.padding || 8;
      const borderRadius = currentStep.highlightConfig?.type === 'circle' 
        ? Math.max(width, height) / 2 + padding
        : currentStep.highlightConfig?.type === 'rounded' 
        ? 12 
        : 0;

      setHighlightedArea({
        x: pageX - padding,
        y: pageY - padding,
        width: width + (padding * 2),
        height: height + (padding * 2),
        borderRadius,
      });

      // Calculate tooltip position
      calculateTooltipPosition(pageX, pageY, width, height);
    });
  }, [currentStep, getElementRef]);

  const calculateTooltipPosition = (elementX: number, elementY: number, elementWidth: number, elementHeight: number) => {
    if (!currentStep) return;

    const tooltipWidth = 300;
    const tooltipHeight = 200; // Estimated
    const margin = 20;

    let x = elementX;
    let y = elementY;

    switch (currentStep.tooltipConfig.position) {
      case 'top':
        x = elementX + (elementWidth / 2) - (tooltipWidth / 2);
        // Add extra offset for camera capture button to move it higher
        const extraOffset = currentStep.targetElement === 'camera-capture-button' ? 50 : 0;
        y = elementY - tooltipHeight - margin - extraOffset;
        break;
      case 'bottom':
        x = elementX + (elementWidth / 2) - (tooltipWidth / 2);
        y = elementY + elementHeight + margin;
        break;
      case 'left':
        x = elementX - tooltipWidth - margin;
        y = elementY + (elementHeight / 2) - (tooltipHeight / 2);
        
        // Move tooltip lower for "Manage Your Cameras" step
        if (currentStep.id === 'camera-list' || currentStep.id === 'adding-friends' || currentStep.id === 'navigate-to-profile' || currentStep.id === 'icloud-sync' || currentStep.id === 'settings' || currentStep.id === '') {
          y += 80;
        }
        break;
      case 'right':
        x = elementX + elementWidth + margin;
        y = elementY + (elementHeight / 2) - (tooltipHeight / 2);
        break;
      case 'center':
      default:
        x = (screenWidth / 2) - (tooltipWidth / 2);
        y = (screenHeight / 2) - (tooltipHeight / 2);
        break;
    }

    // Keep tooltip within screen bounds
    x = Math.max(margin, Math.min(x, screenWidth - tooltipWidth - margin));
    y = Math.max(margin, Math.min(y, screenHeight - tooltipHeight - margin));

    setTooltipPosition({ x, y });
  };

  // Animation effects
  useEffect(() => {
    if (visible && currentStep) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, currentStep]);

  if (!visible || !currentStep) {
    return null;
  }

  const showPrevious = currentStep.tooltipConfig.showPrevious !== false && currentStepIndex > 0;
  const showNext = currentStep.tooltipConfig.showNext !== false;
  const showSkip = currentStep.tooltipConfig.showSkip !== false;

  // Handle navigation before moving to next step
  const handleNextStep = async () => {
    if (currentStep?.navigationAction) {
      switch (currentStep.navigationAction.type) {
        case 'navigate':
          if (currentStep.navigationAction.target) {
            router.push(currentStep.navigationAction.target as any);
            
            // Wait for navigation to complete before proceeding
            if (currentStep.navigationAction.waitForLoad) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          break;
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
      }
    }
    
    await nextStep();
  };

  // Handle navigation before moving to previous step
  const handlePreviousStep = async () => {
    if (currentStepIndex <= 0 || !currentFlow) return;
    
    // Get the previous step from the flow
    const previousStepData = currentFlow.steps[currentStepIndex - 1];
    
    // Navigate to the previous step's screen if it's different from current
    if (previousStepData?.targetScreen && previousStepData.targetScreen !== currentStep?.targetScreen) {
      router.push(previousStepData.targetScreen as any);
      
      // Wait for navigation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Then go to the previous step
    previousStep();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Light background overlay - let users see the UI */}
        <Box style={StyleSheet.absoluteFill} bg="rgba(0,0,0,0.2)">
          {highlightedArea && (
            <Box
              style={{
                position: 'absolute',
                left: highlightedArea.x,
                top: highlightedArea.y,
                width: highlightedArea.width,
                height: highlightedArea.height,
                borderRadius: highlightedArea.borderRadius,
                backgroundColor: 'transparent',
                borderWidth: 3,
                borderColor: '#007AFF',
                shadowColor: '#007AFF',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 10,
              }}
            />
          )}
        </Box>

        {/* Tooltip */}
        {tooltipPosition ? (
          <Animated.View
            style={[
              styles.tooltip,
              {
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Box
              bg={isDark ? '$backgroundDark900' : '$backgroundLight50'}
              borderRadius="$xl"
              p="$6"
              borderWidth="$1"
              borderColor={isDark ? '$borderDark400' : '$borderLight300'}
              shadowColor="$shadowColor"
              shadowOffset={{ width: 0, height: 8 }}
              shadowOpacity={0.25}
              shadowRadius={16}
              maxWidth={300}
            >
              <VStack space="lg">
                {/* Progress indicator */}
                <HStack justifyContent="space-between" alignItems="center">
                  <Text
                    color={isDark ? '$textDark400' : '$textLight600'}
                    fontSize="$sm"
                    fontWeight="$medium"
                  >
                    Step {currentStepIndex + 1} of {totalSteps}
                  </Text>
                  
                  {/* Progress bar */}
                  <Box flex={1} ml="$4">
                    <Box
                      height={4}
                      bg={isDark ? '$backgroundDark700' : '$backgroundLight200'}
                      borderRadius="$full"
                    >
                      <Box
                        height={4}
                        bg="$primary600"
                        borderRadius="$full"
                        width={`${((currentStepIndex + 1) / totalSteps) * 100}%`}
                      />
                    </Box>
                  </Box>
                </HStack>

                {/* Content */}
                <VStack space="md">
                  <Text
                    color={isDark ? '$textDark50' : '$textLight900'}
                    fontSize="$lg"
                    fontWeight="$bold"
                    lineHeight="$lg"
                  >
                    {currentStep.title}
                  </Text>
                  
                  <Text
                    color={isDark ? '$textDark200' : '$textLight700'}
                    fontSize="$md"
                    lineHeight="$lg"
                  >
                    {currentStep.content}
                  </Text>
                </VStack>

                {/* Actions */}
                <HStack space="md" justifyContent="space-between" alignItems="center">
                  <HStack space="sm">
                    {showPrevious && (
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={handlePreviousStep}
                        borderColor={isDark ? '$borderDark400' : '$borderLight400'}
                      >
                        <ButtonText
                          color={isDark ? '$textDark300' : '$textLight700'}
                          fontSize="$sm"
                        >
                          Previous
                        </ButtonText>
                      </Button>
                    )}
                    
                    {showSkip && (
                      <Pressable onPress={skipWalkthrough} p="$2">
                        <Text
                          color={isDark ? '$textDark400' : '$textLight600'}
                          fontSize="$sm"
                          textDecorationLine="underline"
                        >
                          Skip tour
                        </Text>
                      </Pressable>
                    )}
                  </HStack>

                  {showNext && (
                    <Button
                      bg="$primary600"
                      size="sm"
                      onPress={handleNextStep}
                      $pressed={{ bg: '$primary700' }}
                    >
                      <ButtonText color="$white" fontSize="$sm" fontWeight="$semibold">
                        {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
                      </ButtonText>
                    </Button>
                  )}
                </HStack>
              </VStack>
            </Box>
          </Animated.View>
        ) : (
          <Box 
            position="absolute" 
            top={100} 
            left={50} 
            bg="red" 
            p="$4" 
            borderRadius="$md"
            zIndex={2000}
          >
            <Text color="white">No tooltip position calculated</Text>
          </Box>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    zIndex: 1000,
  },
});