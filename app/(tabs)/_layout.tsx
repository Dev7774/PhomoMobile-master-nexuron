import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Tabs } from "expo-router";
import { Pressable } from '@gluestack-ui/themed';

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useWalkthroughElement } from "@/src/context/WalkthroughContext";

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

// Create a wrapper for tab icons that can accept refs
const TabBarIconWithRef = React.forwardRef<any, {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}>((props, ref) => {
  return (
    <Pressable ref={ref} p="$1">
      <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />
    </Pressable>
  );
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Walkthrough element refs
  const cameraListButtonRef = useWalkthroughElement('camera-list-button');
  const friendsButtonRef = useWalkthroughElement('friends-button');
  const settingsButtonRef = useWalkthroughElement('settings-button');
  const tabAlbumRef = useWalkthroughElement('tab-album');
  const tabMeRef = useWalkthroughElement('tab-me');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? "#007AFF" : Colors[colorScheme ?? "light"].tint,
        tabBarInactiveTintColor: isDark ? "#666" : "#999",
        tabBarStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].background,
          borderTopColor: isDark ? "#333" : "#e5e5e5",
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].background,
          borderBottomColor: isDark ? "#333" : "#e5e5e5",
          borderBottomWidth: 1,
        },
        headerTintColor: Colors[colorScheme ?? "light"].text,
        headerTitleStyle: {
          color: Colors[colorScheme ?? "light"].text,
          fontWeight: '600',
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="camera"
        options={{
          title: "Camera",
          tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
          headerRight: () => (
            <Link href="/cameraModal" asChild>
              <Pressable
                ref={cameraListButtonRef}
                mr="$4"
                p="$2"
                borderRadius="$full"
                $pressed={{
                  bg: isDark ? "#1a1a1a" : "#f0f0f0",
                  opacity: 0.7,
                }}
              >
                <FontAwesome
                  name="th-list"
                  size={24}
                  color={Colors[colorScheme ?? "light"].text}
                />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="album"
        options={{
          title: "Album",
          tabBarIcon: ({ color }) => <TabBarIcon name="photo" color={color} />,
          headerRight: () => (
            <Link href="/friendsModal" asChild>
              <Pressable
                ref={friendsButtonRef}
                mr="$4"
                p="$2"
                borderRadius="$full"
                $pressed={{
                  bg: isDark ? "#1a1a1a" : "#f0f0f0",
                  opacity: 0.7,
                }}
              >
                <FontAwesome
                  name="user"
                  size={24}
                  color={Colors[colorScheme ?? "light"].text}
                />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "My Profile",
          tabBarIcon: ({ color }) => <TabBarIcon name="user-circle" color={color} />,
          headerRight: () => (
            <Link href="/settingsModal" asChild>
              <Pressable
                ref={settingsButtonRef}
                mr="$4"
                p="$2"
                borderRadius="$full"
                $pressed={{
                  bg: isDark ? "#1a1a1a" : "#f0f0f0",
                  opacity: 0.7,
                }}
              >
                <FontAwesome
                  name="gear"
                  size={24}
                  color={Colors[colorScheme ?? "light"].text}
                />
              </Pressable>
            </Link>
          ),
        }}
      />
    </Tabs>
  );
}