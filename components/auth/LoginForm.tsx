import React, { useState, useEffect } from 'react';
import { useColorScheme, Platform, KeyboardAvoidingView, ScrollView, NativeModules, Dimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VStack,
  HStack,
  Box,
  Input,
  InputField,
  InputSlot,
  InputIcon,
  Button,
  ButtonText,
  Text,
  Pressable,
  Alert,
  AlertIcon,
  AlertText,
  InfoIcon,
  Heading,
} from '@gluestack-ui/themed';
import { Image as ExpoImage } from 'expo-image';
import { signIn, signUp, confirmSignUp, resendSignUpCode, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { Ionicons } from '@expo/vector-icons';
// Removed Picker; birthday uses a single masked input now

type AuthMode = 'signIn' | 'signUp' | 'confirmSignUp' | 'forgotPassword' | 'confirmReset';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>('signUp');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Birthday MM/DD/YYYY masked input
  const [birthday, setBirthday] = useState('');

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bottomSheetHeight = Math.round(Dimensions.get('window').height * 0.680);
  const heroHeight = Math.max(220, Math.round(Dimensions.get('window').height - bottomSheetHeight));

  // Age requirements by country based on GDPR Article 8
  // Most social apps follow these requirements for compliance
  const ageRequirements: Record<string, number> = {
    // 16 years (GDPR default)
    'AU': 16,
    'DE': 16, // Germany
    'HU': 16, // Hungary
    'LT': 16, // Lithuania  
    'LU': 16, // Luxembourg
    'SK': 16, // Slovakia
    'NL': 16, // Netherlands
    'HR': 16, // Croatia
    'RO': 16, // Romania
    'MT': 16, // Malta
    'SI': 16, // Slovenia

    // 15 years
    'FR': 15, // France
    'GR': 15, // Greece
    'PT': 15, // Portugal
    'CZ': 15, // Czech Republic

    // 14 years
    'AT': 14, // Austria
    'BG': 14, // Bulgaria
    'CY': 14, // Cyprus
    'IT': 14, // Italy
    'EE': 14, // Estonia
    'FI': 14, // Finland

    // 13 years (minimum allowed)
    'DK': 13, // Denmark
    'IE': 13, // Ireland
    'LV': 13, // Latvia
    'PL': 13, // Poland
    'ES': 13, // Spain
    'SE': 13, // Sweden
    'BE': 13, // Belgium
    'GB': 13, // United Kingdom
  };

  const getMinAge = () => {
    try {
      // Try to get device locale
      const deviceLocale = Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages[0]
        : NativeModules.I18nManager?.localeIdentifier;

      const countryCode = deviceLocale?.split('_')[1] || deviceLocale?.split('-')[1];

      // Return age requirement for country, default to 13 if not found
      return ageRequirements[countryCode || ''] || 13;
    } catch {
      return 13; // Default to 13 if locale detection fails
    }
  };

  // Birthday helpers: input mask + validation
  const formatBirthdayInput = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    return parts.join('/');
  };

  const parseBirthday = (value: string) => {
    const [mm, dd, yyyy] = value.split('/');
    if (mm?.length !== 2 || dd?.length !== 2 || yyyy?.length !== 4) return null;
    const month = parseInt(mm, 10);
    const day = parseInt(dd, 10);
    const year = parseInt(yyyy, 10);
    // Basic range checks
    if (year < new Date().getFullYear() - 100 || year > new Date().getFullYear()) return null;
    if (month < 1 || month > 12) return null;
    const maxDay = new Date(year, month, 0).getDate();
    if (day < 1 || day > maxDay) return null;
    const date = new Date(year, month - 1, day);
    // Prevent future dates
    if (date > new Date()) return null;
    return date;
  };

  const isOfMinAge = (value: string) => {
    const date = parseBirthday(value);
    if (!date) return false;
    const minAge = getMinAge();
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
    return age >= minAge;
  };

  useEffect(() => {
    const checkLoginFlags = async () => {
      try {
        const cameFromSignOut = await AsyncStorage.getItem('cameFromSignOut');
        const cameFromInvite = await AsyncStorage.getItem('cameFromInvite');
        const cameFromAccountDeletion = await AsyncStorage.getItem('cameFromAccountDeletion');

        if (cameFromAccountDeletion === 'true') {
          setMode('signUp'); // Account deleted - show sign up
          // Clear the flag immediately after reading
          await AsyncStorage.removeItem('cameFromAccountDeletion');
        } else if (cameFromSignOut === 'true') {
          setMode('signIn');
          // Clear the flag immediately after reading
          await AsyncStorage.removeItem('cameFromSignOut');
        } else if (cameFromInvite === 'true') {
          setMode('signIn');
          // Clear the flag immediately after reading
          await AsyncStorage.removeItem('cameFromInvite');
        }
      } catch (error) {
        console.log('Failed to check login flags:', error);
      }
    };

    checkLoginFlags();
  }, []);

  const getSplashIcon = (isDark: boolean) => {
    switch (Platform.OS) {
      case 'web':
        try {
          return require("../../assets/images/favicon.png");
        } catch {
          return require("../../assets/images/icon.png");
        }
      case 'android':
      case 'ios':
      default:
        try {
          return isDark
            ? require("../../assets/images/splash-icon-dark.png")
            : require("../../assets/images/splash-icon-light.png");
        } catch {
          return require("../../assets/images/icon.png");
        }
    }
  };

  const handleSignIn = async () => {
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn({
        username: username,
        password: password,
      });
      onSuccess();
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.name === 'UserNotConfirmedException') {
        setError('Please check your email and verify your account first');
        setMode('confirmSignUp');
      } else if (error.name === 'NotAuthorizedException') {
        setError('Incorrect username or password');
      } else if (error.name === 'UserNotFoundException') {
        setError('No account found with this username');
      } else {
        setError(error.message || 'Failed to sign in');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!birthday) {
      setError('Please enter your birthday');
      return;
    }

    if (!isOfMinAge(birthday)) {
      const minAge = getMinAge();
      setError(`You must be at least ${minAge} years old to create an account`);
      return;
    }

    if (username.length < 4) {
      setError('Username must be at least 4 characters long');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    // Confirm password is no longer shown for sign up; keep server-side policies only

    setIsLoading(true);
    setError(null);

    try {
      await signUp({
        username: username,
        password: password,
        options: {
          userAttributes: {
            email: email.trim().toLowerCase(),
          },
        },
      });
      setMode('confirmSignUp');
      setError(null);
    } catch (error: any) {
      console.error('Sign up error:', error);
      if (error.name === 'UsernameExistsException') {
        setError('An account with this username already exists');
      } else if (error.name === 'InvalidPasswordException') {
        setError('Password does not meet requirements');
      } else {
        setError(error.message || 'Failed to create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    if (!username || !verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await confirmSignUp({
        username: username,
        confirmationCode: verificationCode,
      });

      // Auto-sign in after successful verification
      await signIn({
        username: username,
        password: password,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Confirmation error:', error);
      if (error.name === 'CodeMismatchException') {
        setError('Invalid verification code');
      } else if (error.name === 'ExpiredCodeException') {
        setError('Verification code has expired');
      } else {
        setError(error.message || 'Failed to verify account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!username) {
      setError('Username is required to resend code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await resendSignUpCode({ username: username });
      setError(null);
    } catch (error: any) {
      console.error('Resend code error:', error);
      setError(error.message || 'Failed to resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 [RESET] Attempting password reset for username:', username);
      const result = await resetPassword({ username: username });
      console.log('🔄 [RESET] Reset password result:', result);
      setMode('confirmReset');
      setError(null);
    } catch (error: any) {
      console.error('Reset password error:', error);
      console.error('Reset password error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      });

      if (error.name === 'UserNotFoundException') {
        setError('No account found with this username');
      } else if (error.name === 'InvalidParameterException') {
        setError('Invalid username format');
      } else if (error.name === 'LimitExceededException') {
        setError('Too many reset attempts. Please try again later.');
      } else {
        setError(error.message || 'Failed to send reset code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!username || !verificationCode || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await confirmResetPassword({
        username: username,
        confirmationCode: verificationCode,
        newPassword: password,
      });
      setMode('signIn');
      setError(null);
      setVerificationCode('');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Confirm reset error:', error);
      if (error.name === 'CodeMismatchException') {
        setError('Invalid verification code');
      } else if (error.name === 'ExpiredCodeException') {
        setError('Verification code has expired');
      } else {
        setError(error.message || 'Failed to reset password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signIn':
        return 'Welcome to PhomoCam';
      case 'signUp':
        return 'Create Account';
      case 'confirmSignUp':
        return 'Verify Email';
      case 'forgotPassword':
        return 'Reset Password';
      case 'confirmReset':
        return 'Set New Password';
      default:
        return 'Sign In';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signIn':
        return 'Sign in with your username and password';
      case 'signUp':
        return 'Create a new account to get started';
      case 'confirmSignUp':
        return `We sent a 6-digit verification code to ${email}`;
      case 'forgotPassword':
        return 'Enter your username to receive a reset code';
      case 'confirmReset':
        return 'Enter the 6-digit code and your new password';
      default:
        return '';
    }
  };

  return (
    <Box flex={1} bg={isDark ? "#0a0a0a" : "#f2f2f2"}>
      <Box height={heroHeight} alignItems="center" justifyContent="center">
        <ExpoImage
          source={require("../../assets/images/loginbg.png")}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          contentFit="cover"
        />
        <VStack paddingBottom={50} space="sm">
          <ExpoImage
            source={require("../../assets/images/icon copy.png")}
            style={{ width: 160, height: 80 }}
            contentFit="cover"
          />

        </VStack>
        <Box
          position="absolute"
          bottom={0}
          width="89%"
          height="32%"
          borderRadius={40}
          overflow="hidden" // ✅ ensures rounded corners apply to content
        >
          <ExpoImage
            source={require("../../assets/images/shadow.png")}
            style={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              height: '100%',
              borderRadius: 40, // optional for extra safety
            }}
            contentFit="cover"
          />
        </Box>

      </Box>
      {/* Bottom Sheet container */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        height={bottomSheetHeight}
        bg={isDark ? "#000" : "#fff"}
        borderTopLeftRadius={Platform.OS === 'android' ? 40 : 40}
        borderTopRightRadius={Platform.OS === 'android' ? 40 : 40}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <VStack space="xl" flex={1} px="$6" py="$4">
              {/* Logo Section */}
              <VStack space="lg" alignItems="center">

                {getTitle() === "Create Account" ? (
                  <Box
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      flexDirection: "row",
                    }}
                  >
                    <Text
                      size="2xl"
                      color={isDark ? "#fff" : "#000"}
                      textAlign="center"
                    >
                      Create{"  "}
                    </Text>
                    <Text
                      size="2xl"
                      color={"blue"}
                      textAlign="center"
                    >
                      Account
                    </Text>
                  </Box>
                ) : getTitle() === "Welcome to PhomoCam" ? (
                  <Box
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      flexDirection: "row",
                    }}
                  >
                    <Text
                      size="2xl"
                      color={isDark ? "#fff" : "#000"}
                      textAlign="center"
                    >
                      Welcome to{"  "}
                    </Text>
                    <Text
                      size="2xl"
                      color={"blue"}
                      textAlign="center"
                    >
                      PhomoCam
                    </Text>
                  </Box>
                ) : (
                  <Heading
                    size="2xl"
                    fontWeight="$bold"
                    color={isDark ? "#fff" : "#000"}
                    textAlign="center"
                  >
                    {getTitle()}
                  </Heading>
                )}
                <Text
                  size="md"
                  color={isDark ? "#999" : "#666"}
                  textAlign="center"
                >
                  {getSubtitle()}
                </Text>
              </VStack>

              {error && (
                <Alert action="error" variant="solid">
                  <AlertIcon as={InfoIcon} mr="$3" />
                  <AlertText>{error}</AlertText>
                </Alert>
              )}

              <VStack space="md">
                {/* Username field for sign in and forgot password */}
                {(mode === 'signIn' || mode === 'forgotPassword') && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Username
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg="transparent"
                      borderWidth={1.5}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="person-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder="Username"
                        value={username}
                        onChangeText={(text) =>
                          setUsername(text.toLowerCase().replace(/\s/g, ''))
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                    </Input>
                  </VStack>
                )}

                {/* Username field for sign up */}
                {mode === 'signUp' && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Username
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="person-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder="Username"
                        value={username}
                        onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ''))}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username-new"
                        textContentType="username"
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                    </Input>
                  </VStack>
                )}

                {mode === 'signUp' && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Email
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="mail-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                    </Input>
                  </VStack>
                )}

                {(mode === 'signIn' || mode === 'signUp') && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Password
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder="Password"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                        }}
                        secureTextEntry={!showPassword}
                        autoComplete={mode === 'signUp' ? "new-password" : "current-password"}
                        textContentType="password"
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                      <InputSlot pr="$3" onPress={() => setShowPassword((prev) => !prev)}>
                        <InputIcon as={() => (
                          <Ionicons
                            name={showPassword ? "eye" : "eye-off"}
                            size={20}
                            color="#007AFF"
                          />
                        )} />
                      </InputSlot>
                    </Input>
                  </VStack>
                )}
                {mode === 'signIn' && (
                  <>
                    <Box style={{ width: '100%', alignItems: 'flex-end' }}>
                      <Pressable
                        onPress={() => {
                          setMode('forgotPassword');
                          setPassword('');
                          setError(null);
                        }}
                      >
                        <Text size="sm" color="#007AFF">
                          Forgot password?
                        </Text>
                      </Pressable>
                    </Box>

                  </>
                )}

                {mode === 'confirmReset' && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      New Password
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder="New Password"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (text.length === 0) {
                            setConfirmPassword('');
                            setShowConfirmPassword(false);
                          }
                        }}
                        secureTextEntry={!showPassword}
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                      <InputSlot pr="$3" onPress={() => setShowPassword((prev) => !prev)}>
                        <InputIcon as={() => (
                          <Ionicons
                            name={showPassword ? "eye" : "eye-off"}
                            size={20}
                            color="#007AFF"
                          />
                        )} />
                      </InputSlot>
                    </Input>
                  </VStack>
                )}

                {mode === 'confirmReset' && password.length > 0 && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Confirm New Password
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder={"Confirm New Password"}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                      <InputSlot pr="$3" onPress={() => setShowConfirmPassword((prev) => !prev)}>
                        <InputIcon as={() => (
                          <Ionicons
                            name={showConfirmPassword ? "eye" : "eye-off"}
                            size={20}
                            color="#007AFF"
                          />
                        )} />
                      </InputSlot>
                    </Input>
                  </VStack>
                )}

                {/* Email field for sign up */}


                {/* Birthday text input for sign up */}
                {mode === 'signUp' && (
                  <VStack space="sm">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Birthday
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputSlot pl="$3">
                        <InputIcon as={() => (
                          <Ionicons name="calendar-outline" size={20} color={isDark ? "#999" : "#666"} />
                        )} />
                      </InputSlot>
                      <InputField
                        placeholder="MM/DD/YYYY"
                        value={birthday}
                        onChangeText={(text) => setBirthday(formatBirthdayInput(text))}
                        keyboardType="number-pad"
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                        maxLength={10}
                      />
                    </Input>
                    <Text size="xs" color={isDark ? "#666" : "#999"}>
                      You must be at least {getMinAge()} years old to sign up
                    </Text>
                  </VStack>
                )}

                {(mode === 'confirmSignUp' || mode === 'confirmReset') && (
                  <VStack space="xs">
                    <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                      Verification Code
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      bg={isDark ? "#1a1a1a" : "transparent"}
                      borderColor={isDark ? "#333" : "#e5e5e5"}
                      borderWidth={1.5}
                      borderRadius={10} // 👈 numeric value works best here
                    >
                      <InputField
                        placeholder="6-digit verification code"
                        value={verificationCode}
                        onChangeText={(text) => {
                          // Only allow numbers and limit to 6 digits
                          const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                          setVerificationCode(numericText);
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        color={isDark ? "#fff" : "#000"}
                        placeholderTextColor={isDark ? "#666" : "#999"}
                      />
                    </Input>
                  </VStack>
                )}

                {(() => {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  const isValidEmail = (v: string) => emailRegex.test(v);
                  const isSignInValid = mode === 'signIn' ? (username.length > 0 && password.length > 0) : true;
                  const isSignUpValid = mode === 'signUp' ? (
                    username.length >= 4 && isValidEmail(email) && password.length >= 8 && isOfMinAge(birthday)
                  ) : true;
                  const isConfirmSignUpValid = mode === 'confirmSignUp' ? (username.length > 0 && verificationCode.length === 6) : true;
                  const isForgotPasswordValid = mode === 'forgotPassword' ? (username.length > 0) : true;
                  const isConfirmResetValid = mode === 'confirmReset' ? (
                    username.length > 0 && verificationCode.length === 6 && password.length >= 8 && password === confirmPassword
                  ) : true;
                  const disabled = isLoading || !(isSignInValid && isSignUpValid && isConfirmSignUpValid && isForgotPasswordValid && isConfirmResetValid);
                  return (
                    <Button
                      size="lg"
                      bg={isDark ? "#007AFF" : "#007AFF"}
                      borderRadius="$lg"
                      shadowColor="$black"
                      shadowOffset={{ width: 0, height: 4 }}
                      shadowOpacity={0.25}
                      shadowRadius={8}
                      onPress={() => {
                        switch (mode) {
                          case 'signIn':
                            handleSignIn();
                            break;
                          case 'signUp':
                            handleSignUp();
                            break;
                          case 'confirmSignUp':
                            handleConfirmSignUp();
                            break;
                          case 'forgotPassword':
                            handleForgotPassword();
                            break;
                          case 'confirmReset':
                            handleConfirmReset();
                            break;
                        }
                      }}
                      isDisabled={disabled}
                      opacity={disabled ? 0.6 : 1}
                    >
                      <HStack alignItems="center" space="sm">
                        <ButtonText color="$white" fontWeight="$semibold">
                          {isLoading ? 'Loading...' :
                            mode === 'signIn' ? 'Sign In' :
                              mode === 'signUp' ? 'Create Account' :
                                mode === 'confirmSignUp' ? 'Verify' :
                                  mode === 'forgotPassword' ? 'Send Reset Code' :
                                    mode === 'confirmReset' ? 'Reset Password' : 'Continue'}
                        </ButtonText>
                        <ExpoImage
                          source={require("../../assets/images/arrow-button.png")}
                          style={{ width: 18, height: 18 }}
                          contentFit="contain"
                        />
                      </HStack>
                    </Button>
                  );
                })()}

                {mode === 'confirmSignUp' && (
                  <Button
                    variant="link"
                    onPress={handleResendCode}
                    isDisabled={isLoading}
                    opacity={isLoading ? 0.6 : 1}
                  >
                    <ButtonText color={isDark ? "#007AFF" : "#007AFF"}>
                      Resend verification code
                    </ButtonText>
                  </Button>
                )}
              </VStack>

              <VStack space="sm" alignItems="center">
                {mode === 'signIn' && (
                  <>
                  <Box
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      flexDirection: "row",
                    }}
                  >
                    <Text
                      color={isDark ? "#007AFF" : "#6C7278"}
                      textAlign="center"
                    >
                      Don't have an account?{"  "}
                    </Text>
                    <Pressable onPress={() => {
                      setMode('signUp');
                      setUsername('');
                      setPassword('');
                      setError(null);
                    }}>
                      <Text size="sm" color={isDark ? "#007AFF" : "#007AFF"}>
                        Sign up
                      </Text>
                    </Pressable>
                  </Box>
                   

                  </>
                )}

                {mode === 'signUp' && (
                  <Box
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    flexDirection: "row",
                  }}
                >
                  <Text
                    color={isDark ? "#007AFF" : "#6C7278"}
                    textAlign="center"
                  >
                    Already have an account?{"  "}
                  </Text>
                  <Pressable onPress={() => {
                   setMode('signIn');
                   setUsername('');
                   setEmail('');
                   setPassword('');
                   setConfirmPassword('');
                   setError(null);
                  }}>
                    <Text size="sm" color={isDark ? "#007AFF" : "#007AFF"}>
                      Sign in
                    </Text>
                  </Pressable>
                </Box>
                )}

                {(mode === 'confirmSignUp' || mode === 'forgotPassword' || mode === 'confirmReset') && (
                  <Pressable onPress={() => {
                    setMode('signIn');
                    setVerificationCode('');
                    setPassword('');
                    setConfirmPassword('');
                    setError(null);
                  }}>
                    <Text size="sm" color={isDark ? "#007AFF" : "#007AFF"}>
                      Back to sign in
                    </Text>
                  </Pressable>
                )}
              </VStack>
            </VStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </Box>
    </Box>
  );
}