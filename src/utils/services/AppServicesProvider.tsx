import React, { useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useWalkthrough } from '../../context/WalkthroughContext';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useUploadQueueStore } from '../../stores/uploadQueueStore';
import { useCameraPermission } from 'react-native-vision-camera';
import { photoSyncService } from '../icloudsync/photoSyncService';
import { pushNotificationService } from '../pushNotifications/pushNotificationService';
import { queueProcessor } from '../../background/queueProcessor';
import { registerPhotoSyncTask } from '../../background/PhotoSyncTask';
import { useCameraSubscriptions } from '../../hooks/useCameraSubscriptions';
import { usePhotoSubscriptions } from '../../hooks/usePhotoSubscriptions';
import { useUploadPhoto, useShareFaceMatchedPhoto, useShareEventMatchedPhoto } from '../../hooks/usePhotoMutations';
import { useRegisterForPushNotifications } from '../../hooks/usePushNotifications';
import { useNotificationHandler } from '../../hooks/useNotificationHandler';
import { useDeepLinkHandler } from '../../hooks/useDeepLinkHandler';
import { usePathname } from 'expo-router';
import { photoCacheDB } from './PhotoCacheDB';
import { WalkthroughOverlay } from '../../../components/walkthrough/WalkthroughOverlay';
import { getUrl } from "aws-amplify/storage";

interface AppServicesProviderProps {
  children: React.ReactNode;
}

export function AppServicesProvider({ children }: AppServicesProviderProps) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { hasPermission: cameraPermission } = useCameraPermission();

  // Hooks for mutations
  const uploadPhoto = useUploadPhoto();
  const shareFaceMatchedPhotoMutation = useShareFaceMatchedPhoto();
  const shareEventMatchedPhotoMutation = useShareEventMatchedPhoto();
  const registerPushNotifications = useRegisterForPushNotifications();

  // Store hooks
  const {
    isLoaded: preferencesLoaded,
    loadPreferences,
    autoSyncToDevice,
    setAutoSyncToDevice
  } = usePreferencesStore();
  const handleAppStateChange = useUploadQueueStore(state => state.handleAppStateChange);

  // Permissions
  const [permissionInfo] = ImagePicker.useMediaLibraryPermissions({ writeOnly: true });

  // Compute auth state
  const isAuthenticated = !!(user && profile && profile.faceCount && profile.faceCount > 0);
  const userId = user?.username || undefined;

  // Photo sync state
  const [syncingToAlbum, setSyncingToAlbum] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isInvalidatingQueries, setIsInvalidatingQueries] = useState(false);
  const [photoSyncTrigger, setPhotoSyncTrigger] = useState(0);

  // Walkthrough state
  const {
    startWalkthrough,
    isActive: walkthroughActive,
    registerFlow,
    isFlowCompleted,
    isFlowSkipped,
    skipWalkthrough,
    getElementRef
  } = useWalkthrough();
  const walkthroughStartedRef = useRef(false);
  const walkthroughTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set up notification handlers
  useNotificationHandler(!!(user && profile));

  // Set up deep link handling
  useDeepLinkHandler(userId);

  // Initialize subscriptions
  useCameraSubscriptions(isAuthenticated, userId);
  usePhotoSubscriptions(isAuthenticated, userId);

  // Load preferences and initialize cache when user is authenticated
  useEffect(() => {
    if (userId && !preferencesLoaded) {
      loadPreferences(userId);

      // Initialize photo cache database for instant URL loading
      photoCacheDB.init().then(() => {
        console.log('✅ [APP_SERVICES] PhotoCacheDB initialized for user:', userId);

        // Clean up old entries on startup (non-blocking)
        photoCacheDB.cleanup().catch(error => {
          console.warn('⚠️ [APP_SERVICES] Cache cleanup failed (non-critical):', error);
        });
      }).catch(error => {
        console.error('❌ [APP_SERVICES] Failed to initialize PhotoCacheDB:', error);
      });
    }
  }, [userId, preferencesLoaded, loadPreferences]);

  // Initialize queue processor
  useEffect(() => {
    if (user && profile && profile.faceCount && profile.faceCount > 0 && preferencesLoaded) {
      queueProcessor.initialize(uploadPhoto, shareFaceMatchedPhotoMutation, shareEventMatchedPhotoMutation);

      if (AppState.currentState === 'active') {
        queueProcessor.start();
      }
    }
  }, [user, profile, preferencesLoaded, uploadPhoto, shareFaceMatchedPhotoMutation, shareEventMatchedPhotoMutation]);

  // Handle app state changes
  useEffect(() => {
    let backgroundTimeout: ReturnType<typeof setTimeout> | null = null;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
      handleAppStateChange(nextAppState);

      if (nextAppState === 'active') {
        pushNotificationService.clearBadgeCount();

        if (backgroundTimeout) {
          clearTimeout(backgroundTimeout);
          backgroundTimeout = null;
        }
        if (user && profile && profile.faceCount && profile.faceCount > 0) {
          queueProcessor.start();
        }
      } else if (nextAppState === 'background') {
        if (syncingToAlbum) {
          console.log('🛑 App backgrounded during auto-sync - resetting state');
          setSyncingToAlbum(false);
        }

        backgroundTimeout = setTimeout(() => {
          if (AppState.currentState === 'background') {
            queueProcessor.stop();
          }
          backgroundTimeout = null;
        }, 30000);
      }
    });

    return () => {
      subscription?.remove();
      if (backgroundTimeout) {
        clearTimeout(backgroundTimeout);
      }
      queueProcessor.destroy();
    };
  }, [handleAppStateChange, user, profile, syncingToAlbum]);

  // Register photo sync task
  useEffect(() => {
    if (user && profile && profile.faceCount && profile.faceCount > 0) {
      registerPhotoSyncTask();
    }
  }, [user, profile]);

  // Register for push notifications (once per session)
  useEffect(() => {
    let hasRegistered = false;

    const checkAndRegister = async () => {
      if (user && profile && profile.faceCount && profile.faceCount > 0 && !registerPushNotifications.isPending && !hasRegistered) {
        const notificationChoiceKey = `notification_choice_made_${user.username}`;
        const notificationChoice = await AsyncStorage.getItem(notificationChoiceKey);

        if (notificationChoice === 'true') {
          console.log("[APP_SERVICES] User already made notification choice, skipping");
          return;
        }

        console.log("[APP_SERVICES] Registering for push notifications");
        hasRegistered = true;
        registerPushNotifications.mutate({ profile });

        await AsyncStorage.setItem(notificationChoiceKey, 'true');
      }
    };

    checkAndRegister();
  }, [user?.username, profile?.id, profile?.faceCount]);

  // Handle permission revocation
  useEffect(() => {
    if (userId && permissionInfo?.status === 'denied' && autoSyncToDevice) {
      console.log('[APP_SERVICES] Auto-sync permission revoked globally, disabling toggle');
      setAutoSyncToDevice(false, userId);
    }
  }, [permissionInfo?.status, autoSyncToDevice, userId, setAutoSyncToDevice]);

  // Register walkthrough flow
  useEffect(() => {
    const registerMainFlow = async () => {
      try {
        const { mainOnboardingFlow } = await import('../../walkthrough/flows');
        console.log('[WALKTHROUGH] Registering main onboarding flow');
        registerFlow(mainOnboardingFlow);
      } catch (error) {
        console.error('[WALKTHROUGH] Failed to import flows:', error);
      }
    };

    registerMainFlow();
  }, [registerFlow]);

  // Trigger walkthrough after onboarding
  useEffect(() => {
    const checkAndStartWalkthrough = async () => {
      const needsOnboarding = profile && profile.faceCount === 0;

      if (user && profile && profile.faceCount && profile.faceCount > 0 && !needsOnboarding) {
        const isOnCameraTab = pathname === '/(tabs)/camera' || pathname === '/camera' || pathname === '/(tabs)' || pathname.includes('/camera') || pathname === '/';

        if (!isFlowCompleted('main-onboarding') && !isFlowSkipped('main-onboarding') && isOnCameraTab) {
          const walkthroughShownKey = `walkthrough_shown_${user.username}`;
          const walkthroughShown = await AsyncStorage.getItem(walkthroughShownKey);

          if (!walkthroughShown && !walkthroughStartedRef.current && cameraPermission) {
            // Check if key walkthrough elements are registered
            const captureButtonRef = getElementRef('camera-capture-button');
            const cameraSelectorRef = getElementRef('camera-selector');
            console.log('[WALKTHROUGH] Element refs - captureButton:', !!captureButtonRef, 'cameraSelector:', !!cameraSelectorRef);

            if (captureButtonRef && cameraSelectorRef) {
              console.log('[WALKTHROUGH] Elements ready, starting walkthrough immediately');
              walkthroughStartedRef.current = true;

              if (walkthroughTimeoutRef.current) {
                clearTimeout(walkthroughTimeoutRef.current);
              }

              try {
                const started = await startWalkthrough('main-onboarding');
                console.log('[WALKTHROUGH] Walkthrough started:', started);
                if (started) {
                  await AsyncStorage.setItem(walkthroughShownKey, 'true');
                } else {
                  walkthroughStartedRef.current = false;
                }
              } catch (error) {
                console.error('[WALKTHROUGH] Error starting walkthrough:', error);
                walkthroughStartedRef.current = false;
              }
            } else {
              console.log('[WALKTHROUGH] Elements not ready, waiting...');
              // Elements not ready yet, try again on next render
              walkthroughStartedRef.current = false;
            }
          }
        } else {
          walkthroughStartedRef.current = false;
        }
      }
    };

    checkAndStartWalkthrough();

    return () => {
      if (walkthroughTimeoutRef.current) {
        clearTimeout(walkthroughTimeoutRef.current);
      }
    };
  }, [user, profile, pathname, isFlowCompleted, isFlowSkipped, startWalkthrough, cameraPermission]);

  // Stop walkthrough if camera permission revoked
  useEffect(() => {
    const checkCameraPermissionForActiveWalkthrough = async () => {
      if (walkthroughActive && user && profile && profile.faceCount && profile.faceCount > 0) {
        try {
          if (!cameraPermission) {
            console.log('[WALKTHROUGH] Camera permission revoked during active walkthrough, stopping...');
            skipWalkthrough();
          }
        } catch (error) {
          console.warn('[WALKTHROUGH] Error checking camera permission:', error);
        }
      }
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (walkthroughActive) {
      checkCameraPermissionForActiveWalkthrough();
      intervalId = setInterval(checkCameraPermissionForActiveWalkthrough, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [walkthroughActive, user, profile, skipWalkthrough, cameraPermission]);

  // Photo sync timeout recovery
  useEffect(() => {
    if (!syncingToAlbum) return;

    console.log('🕐 Auto-sync timeout watchdog started (5 minutes)');
    const timeout = setTimeout(() => {
      console.warn('⚠️ Auto-sync timeout - resetting stuck state');
      setSyncingToAlbum(false);
    }, 300000);

    return () => clearTimeout(timeout);
  }, [syncingToAlbum]);

  // Listen for photo query updates to trigger sync
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const handleQueryUpdate = () => {
      if (isInvalidatingQueries) {
        console.log('📸 [SYNC_TRIGGER] Skipping sync - currently invalidating queries');
        return;
      }

      if (appState !== 'active') {
        console.log('📸 [SYNC_TRIGGER] Skipping sync - app not active');
        return;
      }

      console.log('📸 [SYNC_TRIGGER] Photo queries updated, triggering sync');
      setPhotoSyncTrigger(prev => prev + 1);
    };

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey) {
        const queryKey = event.query.queryKey;
        const [firstKey, secondKey] = queryKey;

        const isPhotoQuery = (
          (firstKey === 'myPhotos' && secondKey === userId) ||
          (firstKey === 'userCameras' && secondKey === userId) ||
          (firstKey === 'infiniteMultiSharedCameraPhotos' && secondKey === userId) ||
          (firstKey === 'sharedPhotos' && secondKey === userId) ||
          (firstKey === 'photoRecipients' && secondKey === userId) ||
          firstKey === 'sharedCameraPhotos' ||
          firstKey === 'infiniteSingleSharedCameraPhotos' ||
          firstKey === 'cameraPhotos'
        );

        if (isPhotoQuery) {
          handleQueryUpdate();
        }
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, userId, queryClient, appState, isInvalidatingQueries]);

  // Cancel sync when auto-sync is disabled
  useEffect(() => {
    if (!autoSyncToDevice && syncingToAlbum) {
      console.log('🛑 Auto-sync disabled mid-process - cancelling');
      setSyncingToAlbum(false);
    }
  }, [autoSyncToDevice, syncingToAlbum]);

  // Photo sync from PhomoCam to device
  useEffect(() => {
    const syncPhotosToAlbum = async () => {
      if (syncingToAlbum) return;

      if (appState !== 'active') {
        console.log("📱 Skipping photo sync - app not in active state");
        return;
      }

      if (!autoSyncToDevice) {
        console.log("📱 Skipping photo sync - auto-sync disabled");
        return;
      }

      try {
        setSyncingToAlbum(true);
        console.log("🔄 Starting photo album sync...");
        const result = await photoSyncService.syncReceivedPhotosToAlbum(() => autoSyncToDevice);

        if (result.newPhotosSynced > 0) {
          console.log(`✅ Synced ${result.newPhotosSynced} new photos to album`);

          setIsInvalidatingQueries(true);

          queryClient.invalidateQueries({ queryKey: ['myPhotos', userId] });
          queryClient.invalidateQueries({ queryKey: ['userCameras', userId] });
          queryClient.invalidateQueries({ queryKey: ['infiniteMultiSharedCameraPhotos', userId] });
          queryClient.invalidateQueries({ queryKey: ['sharedPhotos', userId] });
          queryClient.invalidateQueries({ queryKey: ['photoRecipients', userId] });
          queryClient.invalidateQueries({ queryKey: ['sharedCameraPhotos'] });
          queryClient.invalidateQueries({ queryKey: ['infiniteSingleSharedCameraPhotos'] });
          queryClient.invalidateQueries({ queryKey: ['cameraPhotos'] });

          setIsInvalidatingQueries(false);
        }

        if (result.errors.length > 0) {
          console.warn("⚠️ Some photos failed to sync:", result.errors);
        }
      } catch (error) {
        console.error("❌ Photo album sync failed:", error);
      } finally {
        setSyncingToAlbum(false);
      }
    };

    if (isAuthenticated && preferencesLoaded) {
      const timeoutId = setTimeout(syncPhotosToAlbum, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated, preferencesLoaded, autoSyncToDevice, photoSyncTrigger, appState, userId, queryClient]);

  // URL refresh system - proactively refresh expiring URLs
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const refreshExpiredUrls = async () => {
      try {
        const photosNeedingRefresh = await photoCacheDB.getPhotosNeedingRefresh(5); // 5 minute buffer for 15-minute URLs

        if (photosNeedingRefresh.length > 0) {
          console.log(`🔄 [URL_REFRESH] Found ${photosNeedingRefresh.length} photos needing URL refresh`);

          // Process in batches of 100 to avoid overwhelming AWS
          const BATCH_SIZE = 100;
          let totalSuccesses = 0;
          let totalFailures = 0;

          for (let i = 0; i < photosNeedingRefresh.length; i += BATCH_SIZE) {
            const batch = photosNeedingRefresh.slice(i, i + BATCH_SIZE);
            console.log(`🔄 [URL_REFRESH] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(photosNeedingRefresh.length / BATCH_SIZE)} (${batch.length} photos)`);

            const refreshOperations: Promise<void>[] = [];

            for (const photo of batch) {
              // Refresh full URL if it exists and needs refreshing (database already filtered by expiry)
              if (photo.fullUrl && photo.s3Key && photo.ownerIdentityId) {
                refreshOperations.push(
                  (getUrl as (input: { key: string; options: { accessLevel: string; targetIdentityId: string } }) => Promise<{ url: URL }>)({
                    key: photo.s3Key,
                    options: {
                      accessLevel: "protected",
                      targetIdentityId: photo.ownerIdentityId,
                    },
                  }).then(({ url }) => photoCacheDB.updatePhotoUrl(photo.id, 'full', url.toString()))
                );
              }

              // Refresh thumb URL if it exists and needs refreshing (database already filtered by expiry)
              if (photo.thumbUrl && photo.thumbKey && photo.ownerIdentityId) {
                refreshOperations.push(
                  (getUrl as (input: { key: string; options: { accessLevel: string; targetIdentityId: string } }) => Promise<{ url: URL }>)({
                    key: photo.thumbKey,
                    options: {
                      accessLevel: "protected",
                      targetIdentityId: photo.ownerIdentityId,
                    },
                  }).then(({ url }) => photoCacheDB.updatePhotoUrl(photo.id, 'thumb', url.toString()))
                );
              }
            }

            // Execute batch in parallel
            if (refreshOperations.length > 0) {
              const results = await Promise.allSettled(refreshOperations);
              const batchFailures = results.filter(r => r.status === 'rejected').length;
              const batchSuccesses = results.length - batchFailures;

              totalSuccesses += batchSuccesses;
              totalFailures += batchFailures;

              console.log(`✅ [URL_REFRESH] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${batchSuccesses} succeeded, ${batchFailures} failed`);

              if (batchFailures > 0) {
                results.forEach((result, index) => {
                  if (result.status === 'rejected') {
                    console.warn(`⚠️ [URL_REFRESH] Batch operation ${index} failed:`, result.reason);
                  }
                });
              }
            }

            // Small delay between batches to be nice to AWS
            if (i + BATCH_SIZE < photosNeedingRefresh.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          console.log(`🎉 [URL_REFRESH] All batches complete: ${totalSuccesses} total successes, ${totalFailures} total failures`);
        }
      } catch (error) {
        console.error('❌ [URL_REFRESH] URL refresh failed:', error);
      }
    };

    // Run immediately, then every 10 minutes (URLs expire in 15 minutes)
    refreshExpiredUrls();
    const intervalId = setInterval(refreshExpiredUrls, 10 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, userId]);

  return (
    <>
      {children}
      <WalkthroughOverlay visible={walkthroughActive} />
    </>
  );
}