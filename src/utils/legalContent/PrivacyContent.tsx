import React from 'react';
import { VStack, Text, Box } from '@gluestack-ui/themed';
import { ExternalLink } from '@/components/ExternalLink';

export function PrivacyContent() {
  return (
    <VStack space="md">
      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        Your Privacy Matters
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        This Privacy Policy explains how PhomoCam collects, uses, stores, and protects your personal information, including biometric data from facial recognition technology. By using PhomoCam, you consent to the collection and processing of your data as described in this policy.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        1. Information We Collect
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        <Text fontWeight="$semibold">Account Information:</Text>
        {'\n'}• Email address and username
        {'\n'}• Profile information you provide
        {'\n'}• Authentication credentials (encrypted)
        {'\n\n'}
        <Text fontWeight="$semibold">Biometric Data (Special Category):</Text>
        {'\n'}• Facial recognition data from your selfie enrollment
        {'\n'}• Face vectors and mathematical representations (not actual images)
        {'\n'}• Facial geometry measurements and unique facial templates
        {'\n'}• This data is used solely for identifying you in photos
        {'\n'}• You may request deletion at any time
        {'\n\n'}
        <Text fontWeight="$semibold">Content:</Text>
        {'\n'}• Photos you upload or capture
        {'\n'}• Photos you choose to import from Apple iCloud Photos into the app
        {'\n'}• Photos you choose to sync or export from the app back to Apple iCloud Photos
        {'\n'}• Metadata from photos (date, time, camera settings, device type, OS version)
        {'\n\n'}
        <Text fontWeight="$semibold">Usage Data:</Text>
        {'\n'}• App interactions and features used
        {'\n'}• Device information (model, OS version)
        {'\n'}• Push notification tokens
        {'\n'}• Analytics data to help improve the service
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        2. Legal Basis for Processing
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        For users in jurisdictions requiring it (such as the EU under GDPR), we process your personal data based on:
        {'\n'}• Your explicit consent (required for biometric data processing)
        {'\n'}• Performance of a contract (providing the app's features)
        {'\n'}• Compliance with legal obligations (data retention, law enforcement)
        {'\n'}• Our legitimate interests (security, preventing abuse, service improvement)
        {'\n'}• Vital interests (safety and security of users)
        {'\n'}• Some data management features, such as account deletion or export, may be limited while we enhance the app. We aim to provide full control over your data in future updates.
        {'\n\n'}You may withdraw consent at any time, though this may limit service functionality.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        3. How We Use Your Information
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We use your information to:
        {'\n'}• Identify you in photos using facial recognition
        {'\n'}• Share photos with friends you've authorized
        {'\n'}• Send notifications about shared photos and event invites
        {'\n'}• Improve app performance and user experience
        {'\n'}• Ensure security and prevent unauthorized access
        {'\n'}• Comply with legal obligations
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        4. Facial Recognition Technology
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        <Text fontWeight="$semibold">How It Works:</Text>
        {'\n'}• We use AWS Rekognition to process facial data
        {'\n'}• Your selfie is converted to mathematical vectors
        {'\n'}• These vectors are compared to identify you in photos
        {'\n'}• Original selfies are deleted after processing
        {'\n\n'}
        <Text fontWeight="$semibold">Your Control & Biometric Rights:</Text>
        {'\n'}• You can update your facial data anytime in settings
        {'\n'}• You maintain full control over this biometric data
        {'\n'}• Right to request deletion of biometric identifiers
        {'\n'}• Written notice provided before collection of biometric data
        {'\n'}• No sale of biometric data to third parties (prohibited)
        {'\n'}• Biometric data not disclosed without consent or court order
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        5. Data Storage & Security
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        <Text fontWeight="$semibold">Where We Store Data:</Text>
        {'\n'}• Photos: Amazon S3 with encryption at rest
        {'\n'}• User data: Amazon DynamoDB with encryption
        {'\n'}• Face vectors: AWS Rekognition collections
        {'\n'}• All data is stored in secure AWS data centers
        {'\n\n'}
        <Text fontWeight="$semibold">Security Measures:</Text>
        {'\n'}• End-to-end encryption for sensitive data
        {'\n'}• Secure HTTPS connections for all transfers
        {'\n'}• Access controls and authentication
        {'\n'}• Regular security audits and updates
        {'\n'}• Automatic backups with encryption
        {'\n\n'}
        <Text fontWeight="$semibold">Security Disclaimer:</Text>
        {'\n'}While we implement industry-standard security measures including encryption, access controls, and regular audits, no method of transmission or storage is completely secure. We cannot guarantee absolute security but commit to:
        {'\n'}• Immediate notification of security breaches affecting your data
        {'\n'}• Annual security assessments and penetration testing
        {'\n'}• SOC 2 Type II compliance for our infrastructure
        {'\n'}• Zero-knowledge architecture where technically feasible
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        6. Data Sharing & Third Parties
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We DO NOT:
        {'\n'}• Sell your personal data to third parties
        {'\n'}• Share your facial recognition data with advertisers
        {'\n'}• Use your photos for marketing without permission
        {'\n'}• Allow unauthorized access to your content
        {'\n\n'}
        We MAY share data:
        {'\n'}• With friends you explicitly authorize
        {'\n'}• When required by law, legal process, or court order
        {'\n'}• To protect safety and prevent harm
        {'\n'}• With trusted service providers under strict data processing agreements:
        {'\n'}  - Amazon Web Services (cloud infrastructure)
        {'\n'}  - Expo Application Services (app distribution)
        {'\n'}  - Push notification providers
        {'\n'}  - Apple Inc. (iCloud Photos access for importing/syncing and only photos you explicitly select for import/export, subject to Apple's privacy and security practices)
        {'\n'}• In case of merger, acquisition, or sale of assets (with notice)
        {'\n'}• With law enforcement when legally required
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        7. Your Rights & Choices
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        You have the right to:
        {'\n'}• Access all data we have about you (within 30 days)
        {'\n'}• Request correction of inaccurate data
        {'\n'}• Export your data in a portable format
        {'\n'}• Request deletion of your account and all associated data
        {'\n'}• Opt-out of notifications and marketing communications
        {'\n'}• Control who can see your photos and biometric matches
        {'\n'}• File complaints with relevant data protection authorities
        {'\n'}• Receive compensation for unauthorized use of biometric data (where applicable)
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        8. Data Retention
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        • Active accounts: Data retained while account is active
        {'\n'}• Facial/biometric data: Only as long as necessary to provide our services
        {'\n'}• Biometric data: Immediate deletion upon request or account closure
        {'\n'}• Legal holds: Data may be retained if required by law (with notice)
        {'\n'}• Photos: Deleted immediately upon user request
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        9. Children's Privacy
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        PhomoCam is not intended for children under 13. We do not knowingly collect data from children under 13. In jurisdictions where a higher minimum age applies, we comply with that standard. If we become aware that we have inadvertently collected personal information from a child under 13 without verified parental consent, we will delete such information promptly. If you believe a child has provided us with personal information, please contact us immediately for removal.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        10. International Data Transfers
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy and applicable laws.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        11. California Privacy Rights (CCPA)
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        California residents have additional rights including:
        {'\n'}• Right to know what personal information is collected and how it's used
        {'\n'}• Right to know if information is sold or disclosed (we do not sell)
        {'\n'}• Right to opt-out of sale of personal information
        {'\n'}• Right to non-discrimination for exercising privacy rights
        {'\n'}• Right to request deletion of personal information
        {'\n'}• Right to correct inaccurate personal information
        {'\n'}• Special protections for biometric data under CCPA
        {'\n\n'}Note: We do not sell personal information to third parties.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        12. European Privacy Rights (GDPR)
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        If you are in the European Economic Area, you have rights under GDPR including:
        {'\n'}• Right to be informed about data processing
        {'\n'}• Right to rectification of inaccurate data
        {'\n'}• Right to erasure ("right to be forgotten")
        {'\n'}• Right to restrict processing
        {'\n'}• Right to data portability
        {'\n'}• Right to object to processing
        {'\n'}• Rights related to automated decision making
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        13. Changes to Service and This Policy
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We may update this Privacy Policy or make changes to our data practices as we add new features or integrate with additional third-party services. We will notify you of any material changes through the app or via email. Your continued use after changes indicates acceptance of the updated policy.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        14. Data Breach Notification
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        In the event of a data breach that affects your personal information:
        {'\n'}• We will notify affected users within 72 hours of discovery
        {'\n'}• Notification will include nature of breach and data involved
        {'\n'}• We will report to relevant authorities as required by law
        {'\n'}• We maintain cyber liability insurance to protect against breaches
        {'\n'}• Incident response plan includes forensic investigation and remediation
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        15. State-Specific Biometric Privacy Laws
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        For residents of Illinois, Texas, and Washington:
        {'\n'}• Written consent obtained before biometric data collection
        {'\n'}• Disclosure of retention schedule and destruction procedures
        {'\n'}• No sale of biometric data (prohibited)
        {'\n'}• Right to request destruction of biometric identifiers
        {'\n'}• Statutory damages available for violations
        {'\n'}• Biometric data stored separately from other personal information
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        16. Contact Us
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        For questions about your privacy or data handling, please visit our{' '}
        <ExternalLink
          href="https://phomo.camera/support?from=app&subject=Privacy/Terms%20Concerns&lock_subject=true"
          style={{ color: '#3b82f6', fontSize: 16, lineHeight: 24, textDecorationLine: 'none' }}
        >
          Support Page
        </ExternalLink>
        {' '}or contact us directly at: prasiddha@gmail.com.
      </Text>

      <Box height={24}/>

      <Text color="$black" fontSize="$sm" textAlign="center" fontStyle="italic">
        Last updated: September 4th, 2025
      </Text>

      <Box height={20}/>
    </VStack>
  );
}