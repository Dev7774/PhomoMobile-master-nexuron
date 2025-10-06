/* app/legal/terms.tsx */
import React from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@gluestack-ui/themed';
import { TermsContent } from '@/src/utils/legalContent/TermsContent';

export default function TermsOfService() {
  return (
    <Box flex={1} bg="$white">
      {/* Scrollable Terms Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <TermsContent />
      </ScrollView>
    </Box>
  );
}
