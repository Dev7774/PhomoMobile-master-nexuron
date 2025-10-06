import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { generateClient } from 'aws-amplify/api';
import { acceptCameraInvite } from '../graphql/mutations';
import { getCurrentUser } from 'aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = generateClient();

export const useDeepLinkHandler = (userId?: string) => {
  const router = useRouter();
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);

  useEffect(() => {
    // Handle initial URL if app was closed and opened via link
    const handleInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('🔗 [DEEP_LINK] Initial URL:', initialUrl);
          await processInviteUrl(initialUrl);
        }
      } catch (error) {
        console.error('🔗 [DEEP_LINK] Error handling initial URL:', error);
      }
    };

    // Handle URL changes when app is already open
    const handleUrlChange = (url: string) => {
      console.log('🔗 [DEEP_LINK] URL change:', url);
      processInviteUrl(url);
    };

    // Set up listeners
    handleInitialUrl();
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrlChange(event.url);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const processInviteUrl = async (url: string) => {
    try {
      // Parse URL to extract token
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (!token) {
        console.log('🔗 [DEEP_LINK] No token found in URL');
        return;
      }

      console.log('🔗 [DEEP_LINK] Found invite token, processing...');
      setIsProcessingInvite(true);

      // Check if user is authenticated
      let currentUser;
      try {
        currentUser = await getCurrentUser();
      } catch (error) {
        console.log('🔗 [DEEP_LINK] User not authenticated, redirecting to login');

        // Store flag to indicate user came from invite link
        await AsyncStorage.setItem('cameFromInvite', 'true');

        // Store token for after login
        // You might want to use AsyncStorage here to persist the token
        router.push('/');
        return;
      }

      // User is authenticated, process the invite
      await processInviteToken(token);
      
    } catch (error) {
      console.error('🔗 [DEEP_LINK] Error processing invite URL:', error);
    } finally {
      setIsProcessingInvite(false);
    }
  };

  const processInviteToken = async (token: string) => {
    try {
      console.log('🔗 [DEEP_LINK] Calling acceptCameraInvite with token');
      
      // Use passed userId or get current user
      let finalUserId = userId;
      if (!finalUserId) {
        console.log('🔗 [DEEP_LINK] No userId parameter, getting current user');
        try {
          const currentUser = await getCurrentUser();
          finalUserId = currentUser.username;
          console.log('🔗 [DEEP_LINK] Got username from getCurrentUser:', finalUserId);
          console.log('🔗 [DEEP_LINK] Current user object:', currentUser);
        } catch (error) {
          console.error('🔗 [DEEP_LINK] Failed to get current user:', error);
          return;
        }
      }
      
      if (!finalUserId) {
        console.error('🔗 [DEEP_LINK] No userId available for accepting invite');
        return;
      }
      
      console.log('🔗 [DEEP_LINK] Using userId:', finalUserId);
      
      const result = await client.graphql({
        query: acceptCameraInvite,
        variables: { token, userId: finalUserId }
      });

      console.log('🔗 [DEEP_LINK] Accept invite result:', result.data.acceptCameraInvite);
      
      if (result.data.acceptCameraInvite.success) {
        const { cameraId, cameraName } = result.data.acceptCameraInvite;
        
        console.log('🔗 [DEEP_LINK] Successfully joined camera:', cameraName);
        
        // Small delay to ensure loading state clears before navigation
        setTimeout(() => {
          console.log('🔗 [DEEP_LINK] Navigating to camera:', cameraId);
          router.push(`/camera/${cameraId}`);
        }, 100);
        
      } else {
        console.error('🔗 [DEEP_LINK] Failed to accept invite:', result.data.acceptCameraInvite.message);
        // Navigate to main app on failure
        setTimeout(() => {
          router.push('/(tabs)/album');
        }, 100);
      }
      
    } catch (error) {
      console.error('🔗 [DEEP_LINK] Error accepting camera invite:', error);
      // Navigate to main app on error
      setTimeout(() => {
        router.push('/(tabs)/album');
      }, 100);
    }
  };

  return {
    isProcessingInvite
  };
};