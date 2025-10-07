import React, { useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme, Platform, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from "../context/AuthContext";
import { WalkthroughProvider } from "../src/context/WalkthroughContext";
import { usePathname } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import { configureImageCache } from "../src/utils/services/imageCacheConfig";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { pushNotificationService } from "../src/utils/pushNotifications/pushNotificationService";
import { useDeepLinkHandler } from "../src/hooks/useDeepLinkHandler";
import FlashMessage from "react-native-flash-message";
import { AppServicesProvider } from "../src/utils/services/AppServicesProvider";
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GluestackUIProvider,
  Box,
  VStack,
  Text,
  Center,
  HStack,
  Heading
} from '@gluestack-ui/themed';
import { gluestackUIConfig } from '../gluestack-ui.config';

import { Amplify } from "aws-amplify";
import amplifyconfig from "../amplifyconfiguration.json";

// Custom header component for onboarding screens with progress bar
const OnboardingHeader = ({ title, progress }: { title: string; progress: number }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <Box
      bg={isDark ? "$backgroundDark950" : "$backgroundLight0"}
      pt={insets.top}
      pb="$3"
      px="$6"
      borderBottomWidth="$1"
      borderBottomColor={isDark ? "$borderDark800" : "$borderLight200"}
    >
      <VStack space="sm">
        {/* Progress Bar */}
        <Box
          height={3}
          bg={isDark ? "$gray800" : "$gray200"}
          borderRadius="$full"
          mt="$2"
        >
          <Box
            height="100%"
            width={`${progress}%`}
            bg="$primary600"
            borderRadius="$full"
          />
        </Box>

        {/* Title */}
        <Heading
          size="md"
          color={isDark ? "$textDark50" : "$textLight900"}
          textAlign="center"
          fontWeight="$bold"
        >
          {title}
        </Heading>
      </VStack>
    </Box>
  );
};

Amplify.configure(amplifyconfig);

export {
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

const getSplashIcon = (isDark: boolean) => {
  switch (Platform.OS) {
    case 'web':
      try {
        return require("../assets/images/favicon.png");
      } catch {
        return require("../assets/images/icon.png");
      }
    case 'android':
    case 'ios':
    default:
      try {
        return isDark 
          ? require("../assets/images/splash-icon-dark.png")
          : require("../assets/images/icon_copy.png");
      } catch {
        return require("../assets/images/icon.png");
      }
  }
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Configure image cache on app startup
  useEffect(() => {
    configureImageCache();
    console.log('Image cache configured for S3 URLs');
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Clear badge count when app initially loads
      pushNotificationService.clearBadgeCount();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WalkthroughProvider>
              <GluestackUIProvider config={gluestackUIConfig}>
                <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
                  <AuthGuard>
                    <Stack
                    screenOptions={{
                      gestureEnabled: true,
                      gestureDirection: 'horizontal',
                      // iOS-style slide animation
                      animation: 'slide_from_right',
                      animationTypeForReplace: 'push',
                    }}
                  >
                    <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
                    <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
                    
                    <Stack.Screen
                      name="user/[userId]"
                      options={({ navigation, route }) => {
                        const state = navigation.getState();
                        const index = state.routes.findIndex((r: { key: string }) => r.key === route.key);
                        const prevRoute = index > 0 ? state.routes[index - 1] : null;
                        
                        // Check if this is from me tab
                        const params = route.params as { from?: string } | undefined;
                        const isFromMeTab = params?.from === 'me';

                        let backTitle = "Back";
                        if (isFromMeTab) {
                          backTitle = "My Profile";
                        } else if (prevRoute) {
                          if (prevRoute.name === "camera/[camId]/index") {
                            backTitle = "Members";
                          } else if (prevRoute.name === "(tabs)" || prevRoute.name === "index") {
                            backTitle = "Album";
                          } else if (prevRoute.name === "friendsModal") {
                            backTitle = "Friends";
                          }
                        }

                        return {
                          headerTitle: "Profile",
                          headerBackTitle: backTitle,
                        };
                      }}
                      listeners={({ navigation }) => ({
                        focus: () => {
                          const state = navigation.getState();
                          const seen = new Set();
                          const newRoutes = state.routes.filter((r: { name: any; params: any; }) => {
                            const id = `${r.name}:${JSON.stringify(r.params)}`;
                            if (seen.has(id)) return false;
                            seen.add(id);
                            return true;
                          });

                          if (newRoutes.length !== state.routes.length) {
                            navigation.reset({
                              ...state,
                              routes: newRoutes,
                              index: newRoutes.length - 1,
                            });
                          }
                        },
                      })}
                    />
                    
                    <Stack.Screen
                      name="camera/new"
                      options={{
                        headerTitle: "Create Event",
                      }}
                    />

                    <Stack.Screen
                      name="camera/[camId]/index"
                      options={({ route }) => {
                        const params = route.params as { from?: string } | undefined;
                        const isFromMeTab = params?.from === 'me';
                        
                        return {
                          headerTitle: "Members",
                          headerBackTitle: isFromMeTab ? "My Profile" : "Back",
                        };
                      }}
                    />
                    
                    <Stack.Screen
                      name="cameraModal"
                      options={({ route }) => {
                        const params = route.params as { from?: string } | undefined;
                        const isFromMeTab = params?.from === 'me';
                        
                        return {
                          headerTitle: "Event Management",
                          headerBackTitle: isFromMeTab ? "My Profile" : "Camera",
                        };
                      }}
                    />

                    <Stack.Screen
                      name="camera/[camId]/invite"
                      options={({ navigation, route }) => {
                        const state = navigation.getState();
                        const index = state.routes.findIndex((r: { key: string }) => r.key === route.key);
                        const prevRoute = index > 0 ? state.routes[index - 1] : null;
                        
                        let backTitle = "Back";
                        if (prevRoute) {
                          // Check if coming from me tab via camera/[camId] screen
                          if (prevRoute.name === "camera/[camId]/index") {
                            const prevParams = prevRoute.params as { from?: string } | undefined;
                            if (prevParams?.from === 'me') {
                              backTitle = "My Profile";
                            } else {
                              backTitle = "Members";
                            }
                          } else if (prevRoute.name === "(tabs)" && prevRoute.state) {
                            const tabState = prevRoute.state;
                            const activeIndex = tabState.index ?? 0;
                            const activeTabRoute = tabState.routes ? tabState.routes[activeIndex] : null;
                            if (activeTabRoute?.name === "me") {
                              backTitle = "My Profile";
                            }
                          }
                        }
                        
                        return {
                          headerTitle: "Invite Friends",
                          headerBackTitle: backTitle,
                        };
                      }}
                    />
                    
                    <Stack.Screen
                      name="photo/[id]"
                      options={({ navigation, route }) => {
                        const state = navigation.getState();
                        const currentIndex = state.routes.findIndex((r: { key: string; }) => r.key === route.key);
                        
                        // Check if this is from a shared camera notification
                        const params = route.params as { cameraId?: string; friendId?: string } | undefined;
                        const isFromCameraNotification = !!params?.cameraId;
                        
                        let backTitle = "Back";

                        if (isFromCameraNotification) {
                          backTitle = "Album";
                        } else if (currentIndex > 0) {
                          const prevRoute = state.routes[currentIndex - 1];

                          if (prevRoute.name === "(tabs)" && prevRoute.state) {
                            const tabState = prevRoute.state;
                            const activeIndex = tabState.index ?? 0;
                            const activeTabRoute = tabState.routes ? tabState.routes[activeIndex] : null;

                            if (activeTabRoute) {
                              if (activeTabRoute.name === "album") {
                                backTitle = "Album";
                              }
                              // Removed "My Profile" case since me.tsx no longer shows photos
                            }
                          } else if (prevRoute.name === "user/[userId]") {
                            backTitle = "Profile";
                          }
                        }

                        return {
                          headerTitle: "Photo",
                          headerBackTitle: backTitle,
                        };
                      }}
                      listeners={({ navigation, route }) => ({
                        beforeRemove: (e) => {
                          // Check if this is from a camera notification and handle custom back navigation
                          const params = route.params as { cameraId?: string; friendId?: string } | undefined;
                          const isFromCameraNotification = !!params?.cameraId;
                          
                          if (isFromCameraNotification && e.data.action.type === 'GO_BACK') {
                            // Prevent default back and navigate to album with camera context
                            e.preventDefault();
                            navigation.navigate('(tabs)' as any, { 
                              screen: 'album',
                              params: { cameraId: params.cameraId }
                            });
                          }
                        },
                      })}
                    />
                    
                    <Stack.Screen
                      name="photo/face-preview"
                      options={{
                        headerTitle: "Share Photo",
                        headerBackTitle: "Camera",
                      }}
                    />
                    
                    <Stack.Screen
                      name="settingsModal"
                      options={({ route }) => {
                        const params = route.params as { openPreferences?: string } | undefined;
                        const isFromCamera = params?.openPreferences === "true";
                        
                        return {
                          headerTitle: "Settings",
                          headerBackTitle: isFromCamera ? "Camera" : "My Profile",
                        };
                      }}
                    />
                    
                    <Stack.Screen
                      name="friendsModal"
                      options={{
                        headerTitle: "Friends",
                        headerBackTitle: "Album",
                      }}
                    />
                    
                    <Stack.Screen
                      name="syncedPhotosReview"
                      options={({ route }) => {
                        const params = route.params as { source?: string } | undefined;
                        const isFromNotification = params?.source === 'notification';
                        
                        return {
                          headerTitle: "Photos Synced",
                          headerBackTitle: "My Profile",
                          headerLeft: isFromNotification ? () => null : undefined,
                          gestureEnabled: !isFromNotification,
                        };
                      }}
                    />
                    
                    <Stack.Screen
                      name="onboard/index"
                      options={{
                        headerShown: false,
                        gestureEnabled: false,
                      }}
                    />

                    <Stack.Screen
                      name="onboard/terms"
                      options={{
                        header: () => <OnboardingHeader title="Terms of Service" progress={33.33} />,
                        gestureEnabled: false,
                      }}
                    />

                    <Stack.Screen
                      name="onboard/privacy"
                      options={{
                        header: () => <OnboardingHeader title="Privacy Policy" progress={66.67} />,
                        gestureEnabled: false,
                      }}
                    />

                    <Stack.Screen
                      name="onboard/profile"
                      options={{
                        header: () => <OnboardingHeader title="Profile Picture" progress={100} />,
                        gestureEnabled: false,
                      }}
                    />
                    
                    <Stack.Screen
                      name="login"
                      options={{ headerShown: false, gestureEnabled: false }}
                    />
                    
                    <Stack.Screen
                      name="legal/terms"
                      options={{
                        headerTitle: "Terms of Service",
                        headerBackTitle: "Settings",
                      }}
                    />
                    
                    <Stack.Screen
                      name="legal/privacy"
                      options={{
                        headerTitle: "Privacy Policy",
                        headerBackTitle: "Settings",
                      }}
                    />
                  </Stack>
                </AuthGuard>
              </ThemeProvider>
            </GluestackUIProvider>
          </WalkthroughProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
      <FlashMessage 
        position="top" 
        floating={true}
        autoHide={true}
        hideOnPress={false}
      />
    </View>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const userId = user?.username || undefined;

  // Debounce loading state to prevent flicker
  const [stableLoading, setStableLoading] = useState(isLoading);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      // Immediately show loading if we're loading
      setStableLoading(true);
    } else {
      // Delay hiding loading to prevent flicker
      timeoutId = setTimeout(() => {
        setStableLoading(false);
      }, 100);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading]);

  // Set up deep link handling for invite URLs
  const { isProcessingInvite } = useDeepLinkHandler(userId);

  // Check if user needs onboarding
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const needsOnboarding = profile && profile.faceCount === 0 && profileCompleted === false;
  const onboardingCheckComplete = profile !== undefined && profileCompleted !== null;

  // Check if user completed profile step
  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!user?.username) return;

      try {
        const profileHandled = await AsyncStorage.getItem(`profile_handled_${user.username}`);
        setProfileCompleted(profileHandled === 'true');
      } catch (error) {
        console.error('[AUTH_GUARD] Error checking profile completion:', error);
        setProfileCompleted(false);
      }
    };

    checkProfileCompletion();
  }, [user?.username]);

  useEffect(() => {
    if (needsOnboarding && !pathname.startsWith("/onboard")) {
      router.replace("/onboard");
    }
  }, [needsOnboarding, pathname, router]);



  // Handle redirect to login - must be after all hooks but before early returns
  useEffect(() => {
    console.log(`[AUTH_GUARD] State: user=${!!user}, isLoading=${isLoading}, pathname=${pathname}`);
    if (!user && !isLoading && pathname !== '/login') {
      console.log('[AUTH_GUARD] Redirecting to login screen');
      router.replace('/login' as any);
    }
  }, [user, isLoading, pathname, router]);

  if (stableLoading || (user && !onboardingCheckComplete) || isProcessingInvite) {
    return (
      <Center flex={1} bg={isDark ? "#000" : "#fff"}>
        <VStack space="lg" alignItems="center">
          <Box
            width={Platform.OS === 'web' ? 100 : 120}
            height={Platform.OS === 'web' ? 100 : 120}
            borderRadius={Platform.OS === 'android' ? "$full" : "$2xl"}
            overflow="hidden"
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 8 }}
            shadowOpacity={0.25}
            shadowRadius={16}
            bg={Platform.OS === 'web' ? "transparent" : undefined}
          >
            <ExpoImage
              source={getSplashIcon(isDark)}
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit={Platform.OS === 'android' ? "cover" : "contain"}
            />
          </Box>
          
          {Platform.OS === 'web' ? (
            <Box
              width={40}
              height={40}
              borderRadius="$full"
              borderWidth={3}
              borderColor={isDark ? "#333" : "#ddd"}
              borderTopColor={isDark ? "#60a5fa" : "#007AFF"}
              $web={{
                animationName: "spin",
                animationDuration: "1s",
                animationIterationCount: "infinite",
                animationTimingFunction: "linear",
              }}
            />
          ) : (
            <Text 
              fontSize="$md" 
              color={isDark ? "#999" : "#666"}
              fontWeight="$medium"
              opacity={0.8}
            >
              {isProcessingInvite ? "Joining event..." : "Loading..."}
            </Text>
          )}
        </VStack>
      </Center>
    );
  }

  if (!user && pathname === '/login') {
    // Allow login screen to render when user is not authenticated
    return <>{children}</>;
  }

  if (!user) {
    return null; // Router will redirect to login
  }

  // If user needs onboarding, router.replace will handle the redirect
  if (needsOnboarding && !pathname.startsWith("/onboard")) {
    return null; // Prevent rendering while redirecting
  }

  return (
    <AppServicesProvider>
      {children}
    </AppServicesProvider>
  );
}