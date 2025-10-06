import React, { useState, useEffect } from 'react';
import { useColorScheme, Platform, KeyboardAvoidingView, ScrollView, NativeModules } from 'react-native';
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
import { Picker } from '@react-native-picker/picker';

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
  
  // Birthday state for signUp
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  // Get current date for validation
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11
  const currentDay = today.getDate();
  
  // Generate year options (last 100 years)
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  
  // Generate month options - only show months up to current month for current year
  const getAllMonths = () => [
    { label: 'Jan', value: '1' },
    { label: 'Feb', value: '2' },
    { label: 'Mar', value: '3' },
    { label: 'Apr', value: '4' },
    { label: 'May', value: '5' },
    { label: 'Jun', value: '6' },
    { label: 'Jul', value: '7' },
    { label: 'Aug', value: '8' },
    { label: 'Sep', value: '9' },
    { label: 'Oct', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Dec', value: '12' },
  ];
  
  const months = getAllMonths().filter(month => {
    if (!birthYear) {
      return parseInt(month.value) <= currentMonth; // When no year selected, only show months up to current month
    }
    if (parseInt(birthYear) < currentYear) {
      return true; // Show all months for past years
    }
    if (parseInt(birthYear) === currentYear) {
      return parseInt(month.value) <= currentMonth; // Only show months up to current month for current year
    }
    return false; // Don't show any months for future years
  });
  
  // Generate day options based on selected month/year
  const getDaysInMonth = (month: string, year: string) => {
    if (!month || !year) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };
  
  const getAllDaysInMonth = () => Array.from(
    { length: getDaysInMonth(birthMonth, birthYear) },
    (_, i) => i + 1
  );
  
  const days = getAllDaysInMonth().filter(day => {
    if (!birthYear && !birthMonth) {
      return day <= currentDay; // When nothing selected, only show days up to today
    }
    if (!birthYear || !birthMonth) {
      // If only one is missing, be conservative and limit to current day
      return day <= currentDay;
    }
    
    const selectedYear = parseInt(birthYear);
    const selectedMonth = parseInt(birthMonth);
    
    if (selectedYear < currentYear) {
      return true; // Show all days for past years
    }
    if (selectedYear === currentYear && selectedMonth < currentMonth) {
      return true; // Show all days for past months in current year
    }
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      return day <= currentDay; // Only show days up to today for current month/year
    }
    return false; // Don't show any days for future dates
  });

  // Clear invalid selections when date constraints change
  useEffect(() => {
    if (!birthYear) return;
    
    const selectedYear = parseInt(birthYear);
    const selectedMonth = parseInt(birthMonth);
    const selectedDay = parseInt(birthDay);
    
    // Clear month if it's now invalid
    if (birthMonth && selectedYear === currentYear && selectedMonth > currentMonth) {
      setBirthMonth('');
      setBirthDay('');
    }
    
    // Clear day if it's now invalid
    if (birthDay && selectedYear === currentYear && selectedMonth === currentMonth && selectedDay > currentDay) {
      setBirthDay('');
    }
  }, [birthYear, birthMonth, birthDay, currentYear, currentMonth, currentDay]);

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

    if (!birthMonth || !birthDay || !birthYear) {
      setError('Please select your birthday');
      return;
    }

    // Age validation
    const birthDate = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const minAge = getMinAge();
    if (age < minAge) {
      setError(`You must be at least ${minAge} years old to create an account`);
      return;
    }

    if (username.length < 4) {
      setError('Username must be at least 4 characters long');
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
    <Box flex={1} bg={isDark ? "#000" : "#fff"}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VStack space="xl" flex={1} justifyContent="center" px="$6" py="$8">
        {/* Logo Section */}
        <VStack space="lg" alignItems="center">
          <Box
            width={100}
            height={100}
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
          
          <Heading 
            size="2xl" 
            fontWeight="$bold" 
            color={isDark ? "#fff" : "#000"}
            textAlign="center"
          >
            {getTitle()}
          </Heading>
          
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
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
              <InputField
                placeholder="Username"
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                color={isDark ? "#fff" : "#000"}
                placeholderTextColor={isDark ? "#666" : "#999"}
              />
            </Input>
          )}

          {/* Username field for sign up */}
          {mode === 'signUp' && (
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
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
          )}

          {(mode === 'signIn' || mode === 'signUp') && (
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
              <InputField
                placeholder="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (mode === 'signUp' && text.length === 0) {
                    setConfirmPassword('');
                    setShowConfirmPassword(false);
                  }
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
          )}

          {mode === 'confirmReset' && (
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
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
          )}

          {(mode === 'signUp' || mode === 'confirmReset') && password.length > 0 && (
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
              <InputField
                placeholder={mode === 'confirmReset' ? "Confirm New Password" : "Confirm Password"}
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
          )}

          {/* Email field for sign up */}
          {mode === 'signUp' && (
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
            >
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
          )}

          {/* Birthday pickers for sign up */}
          {mode === 'signUp' && (
            <VStack space="sm">
              <Text size="sm" color={isDark ? "#999" : "#666"} fontWeight="$medium">
                Birthday (MM/DD/YYYY)
              </Text>
              <HStack space="sm" alignItems="center">
                {/* Month Picker */}
                <Box flex={1} borderRadius="$lg" bg={isDark ? "#1a1a1a" : "#f8f8f8"} borderColor={isDark ? "#333" : "#e5e5e5"} borderWidth={1}>
                  <Picker
                    selectedValue={birthMonth}
                    onValueChange={setBirthMonth}
                    style={{ 
                      height: Platform.OS === 'ios' ? 100 : 50,
                      color: isDark ? "#fff" : "#000",
                    }}
                    itemStyle={{ 
                      height: Platform.OS === 'ios' ? 100 : undefined,
                      color: isDark ? "#fff" : "#000",
                      fontSize: 12
                    }}
                  >
                    <Picker.Item 
                      label="Month" 
                      value="" 
                      color={isDark ? "#666" : "#999"}
                    />
                    {months.map((month) => (
                      <Picker.Item 
                        key={month.value} 
                        label={month.label} 
                        value={month.value}
                        color={isDark ? "#fff" : "#000"}
                      />
                    ))}
                  </Picker>
                </Box>

                {/* Day Picker */}
                <Box flex={1} borderRadius="$lg" bg={isDark ? "#1a1a1a" : "#f8f8f8"} borderColor={isDark ? "#333" : "#e5e5e5"} borderWidth={1}>
                  <Picker
                    selectedValue={birthDay}
                    onValueChange={setBirthDay}
                    style={{ 
                      height: Platform.OS === 'ios' ? 100 : 50,
                      color: isDark ? "#fff" : "#000",
                    }}
                    itemStyle={{ 
                      height: Platform.OS === 'ios' ? 100 : undefined,
                      color: isDark ? "#fff" : "#000",
                      fontSize: 14
                    }}
                  >
                    <Picker.Item 
                      label="Day" 
                      value="" 
                      color={isDark ? "#666" : "#999"}
                    />
                    {days.map((day) => (
                      <Picker.Item 
                        key={day} 
                        label={day.toString()} 
                        value={day.toString()}
                        color={isDark ? "#fff" : "#000"}
                      />
                    ))}
                  </Picker>
                </Box>

                {/* Year Picker */}
                <Box flex={1.2} borderRadius="$lg" bg={isDark ? "#1a1a1a" : "#f8f8f8"} borderColor={isDark ? "#333" : "#e5e5e5"} borderWidth={1}>
                  <Picker
                    selectedValue={birthYear}
                    onValueChange={setBirthYear}
                    style={{ 
                      height: Platform.OS === 'ios' ? 100 : 50,
                      color: isDark ? "#fff" : "#000",
                    }}
                    itemStyle={{ 
                      height: Platform.OS === 'ios' ? 100 : undefined,
                      color: isDark ? "#fff" : "#000",
                      fontSize: 14
                    }}
                  >
                    <Picker.Item 
                      label="Year" 
                      value="" 
                      color={isDark ? "#666" : "#999"}
                    />
                    {years.map((year) => (
                      <Picker.Item 
                        key={year} 
                        label={year.toString()} 
                        value={year.toString()}
                        color={isDark ? "#fff" : "#000"}
                      />
                    ))}
                  </Picker>
                </Box>
              </HStack>
              <Text size="xs" color={isDark ? "#666" : "#999"}>
                You must be at least {getMinAge()} years old to sign up
              </Text>
            </VStack>
          )}

          {(mode === 'confirmSignUp' || mode === 'confirmReset') && (
            <Input
              variant="outline"
              size="lg"
              bg={isDark ? "#1a1a1a" : "#f8f8f8"}
              borderColor={isDark ? "#333" : "#e5e5e5"}
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
          )}

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
            isDisabled={isLoading}
            opacity={isLoading ? 0.6 : 1}
          >
            <ButtonText color="$white" fontWeight="$semibold">
              {isLoading ? 'Loading...' : 
               mode === 'signIn' ? 'Sign In' :
               mode === 'signUp' ? 'Create Account' :
               mode === 'confirmSignUp' ? 'Verify' :
               mode === 'forgotPassword' ? 'Send Reset Code' :
               mode === 'confirmReset' ? 'Reset Password' : 'Continue'}
            </ButtonText>
          </Button>

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
              <Pressable onPress={() => {
                setMode('signUp');
                setUsername('');
                setPassword('');
                setError(null);
              }}>
                <Text size="sm" color={isDark ? "#007AFF" : "#007AFF"}>
                  Don't have an account? Sign up
                </Text>
              </Pressable>
              <Pressable onPress={() => {
                setMode('forgotPassword');
                setPassword('');
                setError(null);
              }}>
                <Text size="sm" color={isDark ? "#007AFF" : "#007AFF"}>
                  Forgot password?
                </Text>
              </Pressable>
            </>
          )}

          {mode === 'signUp' && (
            <Pressable onPress={() => {
              setMode('signIn');
              setUsername('');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              setError(null);
            }}>
              <Text size="sm" color={isDark ? "#007AFF" : "#007AFF"}>
                Already have an account? Sign in
              </Text>
            </Pressable>
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
  );
}