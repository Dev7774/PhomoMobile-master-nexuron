import React from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginForm } from '../components/auth/LoginForm';
import { router } from 'expo-router';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  console.log('🔐 [LOGIN] Login screen rendered');

  const handleLoginSuccess = async () => {
    console.log('🔐 [LOGIN] Login successful, refreshing user and redirecting');
    // Hub listener will handle auth state refresh on signedIn event
    // Navigate to the main app
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <LoginForm onSuccess={handleLoginSuccess} />
    </SafeAreaView>
  );
}