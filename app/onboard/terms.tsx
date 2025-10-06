import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Box,
  VStack,
  Button,
  ButtonText,
} from '@gluestack-ui/themed';
import { TermsContent } from '@/src/utils/legalContent/TermsContent';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;

    if (isCloseToBottom && !hasReachedEnd) {
      setHasReachedEnd(true);
    }
  }, [hasReachedEnd]);

  const handleAccept = async () => {
    if (!hasReachedEnd || !user?.username) return;

    try {
      await AsyncStorage.setItem(`terms_accepted_${user.username}`, 'true');
      router.push('/onboard/privacy');
    } catch (error) {
      console.error('[TERMS] Failed to save acceptance:', error);
    }
  };

  return (
    <Box flex={1} bg="$white">
      {/* Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 24 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        {/* Content */}
        <Box px="$6">
          <TermsContent />
        </Box>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        p="$6"
        bg="$white"
        borderTopWidth={1}
        borderTopColor="$borderLight200"
      >
        <Button
          bg={hasReachedEnd ? "$primary600" : "$gray400"}
          borderRadius="$lg"
          h={56}
          onPress={handleAccept}
          disabled={!hasReachedEnd}
          opacity={hasReachedEnd ? 1 : 0.7}
        >
          <ButtonText
            color={hasReachedEnd ? "$white" : "$gray700"}
            fontWeight="$semibold"
            fontSize="$lg"
          >
            {hasReachedEnd ? "I Agree & Continue" : "Please read to the end"}
          </ButtonText>
        </Button>
      </Box>
    </Box>
  );
}