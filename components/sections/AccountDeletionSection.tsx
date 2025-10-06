import React, { useState } from 'react';
import {
  Alert,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Heading,
  Input,
  InputField,
  Spinner,
} from '@gluestack-ui/themed';
import { generateClient } from 'aws-amplify/api';
import { deleteUserFace } from '@/src/graphql/mutations';
import { useAuth } from '@/context/AuthContext';
import { fetchAuthSession } from 'aws-amplify/auth';
import { showMessage } from 'react-native-flash-message';
import { useUploadQueue } from '@/src/stores/uploadQueueStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = generateClient();

interface AccountDeletionSectionProps {
  isFaceUploading?: boolean;
}

export default function AccountDeletionSection({ isFaceUploading = false }: AccountDeletionSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, signOut } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { stats } = useUploadQueue();
  const hasActiveUploads = stats.pending > 0 || stats.processing > 0;
  const isDeleteDisabled = hasActiveUploads || isFaceUploading;

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      showMessage({
        message: 'Please type DELETE to confirm',
        type: 'warning',
      });
      return;
    }

    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data, photos, and connections will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);

            try {
              if (!user?.userId) {
                throw new Error('User ID not found');
              }

              const session = await fetchAuthSession();
              const identityId = session.identityId;

              console.log('Starting account deletion for user:', user.username);

              // Call Lambda to handle all deletion operations
              const faceResult = await client.graphql({
                query: deleteUserFace,
                variables: {
                  userId: user.username,
                  identityId: identityId || '',
                },
              });

              if (!faceResult.data.deleteUserFace.success) {
                throw new Error(faceResult.data.deleteUserFace.error || 'Account deletion failed');
              }

              console.log('Account deletion successful, signing out');

              await AsyncStorage.setItem('cameFromAccountDeletion', 'true');
              setShowDeleteModal(false);
              setConfirmText('');

              showMessage({
                message: 'Account deleted',
                description: 'You have been signed out.',
                type: 'success',
                duration: 2000,
              });

              signOut();

            } catch (error) {
              console.error('Error initiating account deletion:', error);
              showMessage({
                message: 'Failed to delete account. Please try again.',
                type: 'danger',
              });
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Box
        mt={-10}
        mb="$4"
        borderWidth={1}
        borderColor={isDark ? "#444" : "#ccc"}
        borderRadius={8}
        p="$3"
      >
        <TouchableOpacity
          onPress={() => setShowDeleteModal(true)}
          disabled={isDeleteDisabled}
          style={{ opacity: isDeleteDisabled ? 0.5 : 1 }}
        >
          <Text
            color={isDeleteDisabled ? (isDark ? "#666" : "#999") : "#ff3b30"}
            fontSize="$sm"
            textAlign="center"
            fontWeight="$medium"
          >
            {isDeleteDisabled
              ? (isFaceUploading
                ? "Cannot delete while uploading face..."
                : "Cannot delete while uploading photos...")
              : "Delete Account"}
          </Text>
        </TouchableOpacity>
      </Box>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setConfirmText('');
          }
        }}
        closeOnOverlayClick={!isDeleting}
        size="md"
      >
        <ModalBackdrop />
        <ModalContent bg={isDark ? '#1a1a1a' : '#fff'}>
          <ModalHeader justifyContent="center">
            <Heading size="md" color={isDark ? '#fff' : '#000'}>
              Delete Account
            </Heading>
          </ModalHeader>
          <ModalBody>
            <VStack space="lg" alignItems="center">
              <Text
                color={isDark ? '#fff' : '#000'}
                fontSize="$sm"
                textAlign="center"
              >
                This action is permanent and cannot be undone. You will lose:
              </Text>
              <VStack space="sm" alignItems="center">
                <Text color={isDark ? '#ccc' : '#333'} fontSize="$sm" textAlign="center">
                  • All your photos and events
                </Text>
                <Text color={isDark ? '#ccc' : '#333'} fontSize="$sm" textAlign="center">
                  • Your friend connections
                </Text>
                <Text color={isDark ? '#ccc' : '#333'} fontSize="$sm" textAlign="center">
                  • Your profile, account and face data
                </Text>
              </VStack>
              <Text
                color={isDark ? '#fff' : '#000'}
                fontSize="$sm"
                fontWeight="$semibold"
                textAlign="center"
              >
                Type DELETE to confirm:
              </Text>
              <Input
                variant="outline"
                size="md"
                borderColor={isDark ? '#444' : '#ddd'}
                w="80%"
              >
                <InputField
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="Type DELETE"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  color={isDark ? '#fff' : '#000'}
                  autoCapitalize="characters"
                  textAlign="center"
                />
              </Input>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack space="md">
              <Button
                variant="outline"
                borderColor={isDark ? '#444' : '#ddd'}
                onPress={() => {
                  setShowDeleteModal(false);
                  setConfirmText('');
                }}
                disabled={isDeleting}
              >
                <ButtonText color={isDark ? '#fff' : '#000'}>Cancel</ButtonText>
              </Button>
              <Button
                bg="#ff3b30"
                opacity={confirmText === 'DELETE' ? 1 : 0.5}
                onPress={handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <HStack space="sm" alignItems="center">
                    <Spinner size="small" color="$white" />
                    <ButtonText color="$white">Deleting...</ButtonText>
                  </HStack>
                ) : (
                  <ButtonText color="$white">Delete Account</ButtonText>
                )}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}