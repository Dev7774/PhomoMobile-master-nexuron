/* components/EmailSection.tsx */
import React, { useState, useEffect } from "react";
import { Alert, useColorScheme } from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  InputField,
  Button,
  ButtonText,
  Pressable,
  Spinner,
} from '@gluestack-ui/themed';
import {
  updateUserAttributes,
  confirmUserAttribute,
  fetchUserAttributes
} from "aws-amplify/auth";
import { Ionicons } from "@expo/vector-icons";

export default function EmailSection() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [emailDropdownOpen, setEmailDropdownOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEmail() {
      try {
        const attributes = await fetchUserAttributes();
        if (attributes && typeof attributes === "object") {
          if (Array.isArray(attributes)) {
            const emailAttr = attributes.find(attr => attr.Name === "email");
            if (emailAttr) setCurrentEmail(emailAttr.Value);
          } else {
            if ("email" in attributes) setCurrentEmail(attributes.email ?? "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch current email:", err);
      }
    }
    fetchEmail();
  }, []);

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert("Email is required.");
      return;
    }

    if (newEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
      Alert.alert("You're already using this email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      Alert.alert("Please enter a valid email address.");
      return;
    }

    try {
      setUpdatingEmail(true);

      await updateUserAttributes({
        userAttributes: {
          email: newEmail.trim()
        }
      });

      setPendingEmail(newEmail.trim());

      Alert.alert(
        "Email Updated",
        "A verification code has been sent to your new email. Please enter it below."
      );
      setShowVerificationInput(true);
      setNewEmail("");
    } catch (err: any) {
      console.error("Email update error:", err);
      Alert.alert("Failed to update email", err?.message || "Unknown error");
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert("Please enter the verification code.");
      return;
    }

    try {
      setVerifyingCode(true);

      await confirmUserAttribute({
        userAttributeKey: 'email',
        confirmationCode: verificationCode.trim()
      });

      Alert.alert("Email verified successfully!");
      setShowVerificationInput(false);
      setVerificationCode("");
      setEmailDropdownOpen(false);

      // Refresh current email from server to ensure consistency
      try {
        const refreshedAttributes = await fetchUserAttributes();
        if (refreshedAttributes && typeof refreshedAttributes === "object") {
          if (Array.isArray(refreshedAttributes)) {
            const emailAttr = refreshedAttributes.find(attr => attr.Name === "email");
            if (emailAttr) setCurrentEmail(emailAttr.Value);
          } else {
            if ("email" in refreshedAttributes) setCurrentEmail(refreshedAttributes.email ?? "");
          }
        }
      } catch (refreshError) {
        console.warn("Failed to refresh email after verification:", refreshError);
        // Fallback to pending email if refresh fails
        if (pendingEmail) {
          setCurrentEmail(pendingEmail);
        }
      }

      setPendingEmail(null);
    } catch (err: any) {
      console.error("Verification error:", err);
      Alert.alert("Verification failed", err?.message || "Unknown error");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (!pendingEmail) {
      Alert.alert("No pending email to resend verification for.");
      return;
    }

    try {
      setResendingCode(true);

      if (pendingEmail) {
        await updateUserAttributes({
          userAttributes: {
            email: pendingEmail
          }
        });
      }

      Alert.alert("Verification code resent!", "Check your new email.");
    } catch (err: any) {
      console.error("Resend code error:", err);
      Alert.alert("Failed to resend code", err?.message || "Unknown error");
    } finally {
      setResendingCode(false);
    }
  };

  const handleCancelVerification = () => {
    setShowVerificationInput(false);
    setVerificationCode("");
    setPendingEmail(null);
    setNewEmail("");
  };

  return (
    <Box>
      <Pressable
        onPress={() => setEmailDropdownOpen((prev) => !prev)}
        bg={isDark ? "#1a1a1a" : "#f0f0f0"}
        borderRadius="$lg"
        p="$4"
        $pressed={{
          bg: isDark ? "#2a2a2a" : "#e5e5e5",
        }}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <Text 
            fontWeight="$bold" 
            fontSize="$lg"
            color={isDark ? "#fff" : "#000"}
          >
            Change Email
          </Text>
          <Ionicons
            name={emailDropdownOpen ? "chevron-up" : "chevron-down"}
            size={24}
            color="#007AFF"
          />
        </HStack>
      </Pressable>

      {emailDropdownOpen && (
        <Box mt="$3" p="$4" borderRadius="$lg" bg={isDark ? "#0a0a0a" : "#f9f9f9"}>
          <VStack space="md">
            <Text 
              fontSize="$sm"
              color={isDark ? "#999" : "#666"}
              fontStyle="italic"
              textAlign="center"
            >
              Current email: {currentEmail || "Not set"}
            </Text>

            {!showVerificationInput && (
              <VStack space="md" alignItems="center">
                <Input
                  w="80%"
                  borderWidth="$1"
                  borderColor={isDark ? "#333" : "#ccc"}
                  borderRadius="$lg"
                  bg={isDark ? "#1a1a1a" : "#fff"}
                  $focus={{
                    borderColor: "#007AFF",
                  }}
                >
                  <InputField
                    placeholder="New Email"
                    placeholderTextColor={isDark ? "#666" : "#999"}
                    color={isDark ? "#fff" : "#000"}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </Input>

                {updatingEmail ? (
                <Spinner 
                  size="small" 
                  color={isDark ? "#60a5fa" : "#007AFF"} 
                />
                ) : (
                  <Button
                    bg="#007AFF"
                    borderRadius="$lg"
                    w="80%"
                    h={44}
                    onPress={handleChangeEmail}
                    $pressed={{
                      bg: "#0056CC",
                    }}
                  >
                    <ButtonText color="$white" fontWeight="$semibold">
                      Change Email
                    </ButtonText>
                  </Button>
                )}
              </VStack>
            )}

            {showVerificationInput && (
              <VStack space="lg" alignItems="center">
                <Input
                  w="80%"
                  borderWidth="$1"
                  borderColor={isDark ? "#333" : "#ccc"}
                  borderRadius="$lg"
                  bg={isDark ? "#1a1a1a" : "#fff"}
                  $focus={{
                    borderColor: "#007AFF",
                  }}
                >
                  <InputField
                    placeholder="Enter verification code"
                    placeholderTextColor={isDark ? "#666" : "#999"}
                    color={isDark ? "#fff" : "#000"}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    textAlign="center"
                  />
                </Input>

                <Box>
                  {resendingCode ? (
                    <Spinner 
                      size="small" 
                      color={isDark ? "#60a5fa" : "#007AFF"} 
                    />
                  ) : (
                    <Pressable
                      onPress={handleResendCode}
                      $pressed={{
                        opacity: 0.7,
                      }}
                    >
                      <Text 
                        color="#007AFF" 
                        fontWeight="$bold"
                        textAlign="center"
                      >
                        Resend Verification Code
                      </Text>
                    </Pressable>
                  )}
                </Box>

                {verifyingCode ? (
                <Spinner 
                  size="small" 
                  color={isDark ? "#60a5fa" : "#007AFF"} 
                />
                ) : (
                  <VStack space="sm" w="80%">
                    <Button
                      bg="#007AFF"
                      borderRadius="$lg"
                      h={44}
                      onPress={handleVerifyCode}
                      $pressed={{
                        bg: "#0056CC",
                      }}
                    >
                      <ButtonText color="$white" fontWeight="$semibold">
                        Verify Email
                      </ButtonText>
                    </Button>
                    
                    <Button
                      variant="outline"
                      borderColor="#ff3b30"
                      borderRadius="$lg"
                      h={44}
                      onPress={handleCancelVerification}
                      $pressed={{
                        bg: isDark ? "#1a0a0a" : "#fff0f0",
                      }}
                    >
                      <ButtonText color="#ff3b30" fontWeight="$medium">
                        Cancel
                      </ButtonText>
                    </Button>
                  </VStack>
                )}
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </Box>
  );
}