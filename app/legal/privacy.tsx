/* app/legal/privacy.tsx */
import React from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@gluestack-ui/themed';
import { PrivacyContent } from '@/src/utils/legalContent/PrivacyContent';

export default function PrivacyPolicy() {
  return (
    <Box flex={1} bg="$white">
      {/* Scrollable Privacy Policy Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <PrivacyContent />
      </ScrollView>
    </Box>
  );
}
