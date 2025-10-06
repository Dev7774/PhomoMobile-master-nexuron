/* components/PasswordSection.tsx */
import React, { useState, useEffect } from "react";
import { Alert, useColorScheme } from "react-native";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  InputField,
  InputSlot,
  Button,
  ButtonText,
  Pressable,
  Spinner,
  InputIcon
} from '@gluestack-ui/themed';
import { updatePassword } from "aws-amplify/auth";
import { Ionicons } from "@expo/vector-icons";

interface PasswordSectionProps {
  thirdPartyProvider: string | null;
}

export default function PasswordSection({ thirdPartyProvider }: PasswordSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordDropdownOpen, setPasswordDropdownOpen] = useState(false);

  useEffect(() => {
    if (newPassword === "") {
      setConfirmNewPassword("");
    }
  }, [newPassword]);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Please fill out all password fields");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      await updatePassword({
        oldPassword: oldPassword,
        newPassword: newPassword
      });
      Alert.alert("Password changed successfully");

      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowOld(false);
      setShowNew(false);
      setShowConfirm(false);
      setPasswordDropdownOpen(false);
    } catch (err: any) {
      console.error("Password change error:", err);

      let message = "Unknown error";
      if (err?.name === "NotAuthorizedException") {
        message = "Current password is incorrect.";
      } else if (err?.name === "InvalidPasswordException") {
        message = "New password does not meet security requirements.";
      } else if (err?.name === "LimitExceededException") {
        message = "You have made too many password change attempts. Please try again later.";
      }
      Alert.alert("Password change failed", message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Box>
      <Pressable
        onPress={() => setPasswordDropdownOpen((prev) => !prev)}
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
            Change Password
          </Text>
          <Ionicons
            name={passwordDropdownOpen ? "chevron-up" : "chevron-down"}
            size={24}
            color="#007AFF"
          />
        </HStack>
      </Pressable>

      {passwordDropdownOpen && (
        <Box mt="$3" p="$4" borderRadius="$lg" bg={isDark ? "#0a0a0a" : "#f9f9f9"}>
          <VStack space="md">
            {thirdPartyProvider ? (
              <Box 
                bg="#ffebee"
                borderColor="#f44336"
                borderWidth="$1"
                borderRadius="$lg"
                p="$4"
              >
                <Text 
                  color="#d32f2f"
                  fontWeight="$semibold"
                  textAlign="center"
                  fontSize="$sm"
                >
                  Can't change password because you are signed in using {thirdPartyProvider}
                </Text>
              </Box>
            ) : (
              <VStack space="md" alignItems="center">
                {/* Old Password */}
                <HStack alignItems="center" w="100%" justifyContent="center">
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
                      placeholder="Current Password"
                      placeholderTextColor={isDark ? "#666" : "#999"}
                      color={isDark ? "#fff" : "#000"}
                      value={oldPassword}
                      onChangeText={setOldPassword}
                      secureTextEntry={!showOld}
                    />
                    <InputSlot pr="$3" onPress={() => setShowOld((prev) => !prev)}>
                      <InputIcon as={() => (
                        <Ionicons
                          name={showOld ? "eye" : "eye-off"}
                          size={20}
                          color="#007AFF"
                        />
                      )} />
                    </InputSlot>
                  </Input>
                </HStack>

                {/* New Password */}
                <HStack alignItems="center" w="100%" justifyContent="center">
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
                      placeholder="New Password"
                      placeholderTextColor={isDark ? "#666" : "#999"}
                      color={isDark ? "#fff" : "#000"}
                      value={newPassword}
                      onChangeText={(text) => {
                        setNewPassword(text);
                        if (text.length === 0) {
                          setConfirmNewPassword("");
                          setShowConfirm(false);
                        }
                      }}
                      secureTextEntry={!showNew}
                    />
                    <InputSlot pr="$3" onPress={() => setShowNew((prev) => !prev)}>
                      <InputIcon as={() => (
                        <Ionicons
                          name={showNew ? "eye" : "eye-off"}
                          size={20}
                          color="#007AFF"
                        />
                      )} />
                    </InputSlot>
                  </Input>
                </HStack>

                {/* Confirm Password */}
                {newPassword.length > 0 && (
                  <HStack alignItems="center" w="100%" justifyContent="center">
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
                        placeholder="Confirm New Password"
                        placeholderTextColor={isDark ? "#666" : "#999"}
                        color={isDark ? "#fff" : "#000"}
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                        secureTextEntry={!showConfirm}
                      />
                      <InputSlot pr="$3" onPress={() => setShowConfirm((prev) => !prev)}>
                        <InputIcon as={() => (
                          <Ionicons
                            name={showConfirm ? "eye" : "eye-off"}
                            size={20}
                            color="#007AFF"
                          />
                        )} />
                      </InputSlot>
                    </Input>
                  </HStack>
                )}

                {changingPassword ? (
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
                    onPress={handleChangePassword}
                    $pressed={{
                      bg: "#0056CC",
                    }}
                  >
                    <ButtonText color="$white" fontWeight="$semibold">
                      Change Password
                    </ButtonText>
                  </Button>
                )}
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </Box>
  );
}