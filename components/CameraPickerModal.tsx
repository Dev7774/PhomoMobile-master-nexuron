import React, { useState } from 'react';
import { ScrollView, useColorScheme } from 'react-native';
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalBody,
  VStack,
  HStack,
  Text,
  Pressable,
  Input,
  InputField,
  Box,
  Icon,
} from '@gluestack-ui/themed';
import { Search, X } from 'lucide-react-native';

interface Camera {
  cameraId: string;
  name: string;
}

interface CameraPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: Camera[];
  onSelect: (cameraId: string | null) => void;
  selectedCameraId?: string | null;
}

export function CameraPickerModal({ 
  isOpen, 
  onClose, 
  cameras, 
  onSelect, 
  selectedCameraId 
}: CameraPickerModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchText, setSearchText] = useState('');

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelect = (cameraId: string | null) => {
    onSelect(cameraId);
    onClose();
    setSearchText('');
  };

  const renderCamera = (item: Camera, index: number) => (
    <Pressable
      key={item.cameraId}
      onPress={() => handleSelect(item.cameraId)}
      p="$4"
      borderBottomWidth={index < filteredCameras.length - 1 ? 1 : 0}
      borderBottomColor={isDark ? '$borderDark700' : '$borderLight200'}
      $pressed={{
        bg: isDark ? '$backgroundDark700' : '$backgroundLight100',
      }}
    >
      <Text
        fontSize="$md"
        color={isDark ? '$textDark50' : '$textLight900'}
        fontWeight={selectedCameraId === item.cameraId ? '$bold' : '$normal'}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {item.name}
      </Text>
    </Pressable>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop />
      <ModalContent
        bg={isDark ? '#000' : '#fff'}
        borderRadius="$lg"
        minWidth={280}
        maxWidth={340}
        maxHeight="70%"
      >
        <ModalBody p="$0">
          <VStack>
            {/* Header */}
            <HStack
              p="$4"
              borderBottomWidth="$1"
              borderBottomColor={isDark ? '$borderDark700' : '$borderLight200'}
              alignItems="center"
              justifyContent="space-between"
            >
              <VStack flex={1} alignItems="center">
                <Text
                  fontSize="$lg"
                  fontWeight="$bold"
                  color={isDark ? '$textDark50' : '$textLight900'}
                >
                  Select Event
                </Text>
                {cameras.length > 0 && (
                  <Text
                    fontSize="$sm"
                    color={isDark ? '$textDark300' : '$textLight600'}
                    textAlign="center"
                    mt="$1"
                  >
                    Choose where to share photos
                  </Text>
                )}
              </VStack>
              <Pressable
                onPress={onClose}
                p="$2"
                borderRadius="$md"
                $pressed={{ bg: isDark ? '$backgroundDark700' : '$backgroundLight100' }}
              >
                <Icon as={X} size="md" color={isDark ? '$textDark300' : '$textLight600'} />
              </Pressable>
            </HStack>
            
            {/* Search */}
            {cameras.length > 5 && (
              <Box p="$4" borderBottomWidth="$1" borderBottomColor={isDark ? '$borderDark700' : '$borderLight200'}>
                <Box position="relative">
                  <Input
                    borderColor={isDark ? '$borderDark700' : '$borderLight300'}
                    bg={isDark ? '$backgroundDark900' : '$backgroundLight50'}
                  >
                    <InputField
                      placeholder="Search events..."
                      placeholderTextColor={isDark ? '$textDark400' : '$textLight600'}
                      color={isDark ? '$textDark50' : '$textLight900'}
                      value={searchText}
                      onChangeText={setSearchText}
                    />
                  </Input>
                  <Box position="absolute" right="$3" top="50%" transform={[{ translateY: -10 }]}>
                    <Icon as={Search} size="sm" color={isDark ? '$textDark400' : '$textLight600'} />
                  </Box>
                </Box>
              </Box>
            )}

            {/* Face-match option */}
            <Pressable
              onPress={() => handleSelect(null)}
              p="$4"
              borderBottomWidth={filteredCameras.length > 0 ? 1 : 0}
              borderBottomColor={isDark ? '$borderDark700' : '$borderLight200'}
              $pressed={{
                bg: isDark ? '$backgroundDark700' : '$backgroundLight100',
              }}
            >
              <Text
                fontSize="$md"
                color={isDark ? '$textDark50' : '$textLight900'}
                fontWeight={selectedCameraId === null ? '$bold' : '$normal'}
              >
                Face-match
              </Text>
            </Pressable>

            {/* Camera list */}
            <ScrollView 
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            >
              {filteredCameras.map((camera, index) => renderCamera(camera, index))}
              {searchText && filteredCameras.length === 0 && (
                <Box p="$4" alignItems="center">
                  <Text color={isDark ? '$textDark400' : '$textLight600'}>
                    No events found for "{searchText}"
                  </Text>
                </Box>
              )}
            </ScrollView>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}