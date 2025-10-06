import React from 'react';
import { VStack, Text, Box } from '@gluestack-ui/themed';
import { ExternalLink } from '@/components/ExternalLink';

export function TermsContent() {
  return (
    <VStack space="md">
      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        Welcome to PhomoCam
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        By using PhomoCam, you agree to these Terms of Service. Please read them carefully.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        1. Acceptance of Terms
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        By accessing or using PhomoCam, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this app. These terms constitute a legally binding agreement between you and PhomoCam.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        2. Use of Service
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        PhomoCam is a photo-sharing application that uses facial recognition technology. By using our service, you consent to the collection and processing of your facial data for the purpose of identifying you in photos shared within the app.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        3. Privacy & Data
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We take your privacy seriously. Your facial recognition data is securely stored and encrypted. We do not sell or share your personal data with third parties without your explicit consent. Photos you take are stored securely in the cloud and are only accessible to you and those you explicitly share them with.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        4. User Conduct
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        You agree to use PhomoCam responsibly and not to:
        {'\n'}• Upload inappropriate, offensive, or illegal content
        {'\n'}• Harass, abuse, or harm other users
        {'\n'}• Attempt to access other users' accounts without permission
        {'\n'}• Use the service for any unlawful purpose
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        5. Content Ownership
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        You retain ownership of all photos and content you upload to PhomoCam. By uploading content, you grant us a non-exclusive, worldwide, royalty-free license to store, process, display, and transmit your content solely for the purpose of providing our services. This license terminates when you delete your content or close your account.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        6. Facial Recognition
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        Our facial recognition technology is used solely to identify you and your friends in photos for the purpose of sharing and organizing photos. You can update your facial recognition data at any time in the app settings.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        7. Limitations of Liability
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        PHOMOCAM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR SECURITY. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES AND SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        8. Changes to Terms
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We reserve the right to modify these terms at any time. We will notify you of any changes by posting the new Terms of Service within the app. Your continued use of PhomoCam after changes constitutes acceptance of the new terms.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        9. Content Moderation & User Safety
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        PhomoCam has ZERO TOLERANCE for objectionable content or abusive users. We are committed to maintaining a safe, respectful environment for all users.
        {'\n\n'}Our content moderation includes:
        {'\n'}• User reporting system for flagging inappropriate photos and behavior
        {'\n'}• User blocking functionality to prevent unwanted interactions
        {'\n'}• 24-hour response commitment - All reports are reviewed and acted upon within 24 hours
        {'\n'}• Immediate content removal and user ejection for violations
        {'\n'}• Permanent bans for serious violations or repeat offenders
        {'\n\n'}If you encounter objectionable content or abusive behavior:
        {'\n'}• Report photos using the flag icon in the photo viewer
        {'\n'}• Report or block users from their profile page
        {'\n'}• Contact support directly for urgent safety concerns
        {'\n\n'}Violations will result in content removal and account termination without warning.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        10. Termination
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including violation of these terms. Upon termination, your right to use the service ceases immediately. You may also terminate your account at any time by contacting us. Sections relating to intellectual property, disclaimers, limitations of liability, and governing law shall survive termination.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        11. Compliance with Laws
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        You agree to use PhomoCam in compliance with all applicable local, state, national, and international laws and regulations. We may disclose information to law enforcement or regulatory agencies if required by law or if we believe it is necessary to protect the rights, safety, and security of our users or the public.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        12. Prohibited Uses & Third-Party Policies
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        You may not use PhomoCam to store, share, or transmit any content that is illegal, harmful, threatening, abusive, harassing, defamatory, obscene, hateful, or otherwise objectionable. This includes content that violates the AWS Acceptable Use Policy, Apple App Store, or Google Play Store policies. Violations may result in immediate termination of your account and reporting to appropriate authorities.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        13. Age Restrictions
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        PhomoCam is not intended for use by children under the age of 13. By using the app, you confirm that you are at least 13 years old (or the minimum age required in your jurisdiction) or have the consent of a parent or guardian. In jurisdictions where local law requires parental consent for users under 16, you represent and warrant that such consent has been obtained before using PhomoCam. If you do not meet these requirements, you may not use our services.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        14. Data Retention
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        We retain your data only for as long as necessary to provide our services or as required by law. Certain features, including deletion of content or biometric data, may not be fully available in this version of the app. We aim to provide full control over your data in future updates.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        15. Third-Party Services
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        PhomoCam relies on third-party services, including but not limited to Amazon Web Services and Expo Application Services. We are not responsible for interruptions, outages, or data loss caused by these third-party providers.
        PhomoCam may allow you to (a) import photos from Apple iCloud Photos into the app,
        and (b) sync or export photos from the app back to your iCloud Photos. By enabling
        these features, you authorize PhomoCam to access your iCloud Photo library through
        Apple's APIs solely for the purpose of carrying out your requested import or sync.
        {"\n\n"}
        We do not control and are not responsible for the availability, security, or
        performance of Apple's iCloud services. Syncing or transfer of photos may be
        subject to delays, errors, or interruptions outside of our control.
        {"\n\n"}
        You remain responsible for maintaining backups of your photos in your iCloud
        account or elsewhere. PhomoCam does not guarantee that all photos will successfully
        import to or sync with iCloud Photos.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        16. Indemnification
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        You agree to indemnify, defend, and hold harmless PhomoCam, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from: (a) your use of the service; (b) your violation of these terms; (c) your violation of any rights of others; or (d) your content uploaded to the service.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        17. No Guarantee of Data Security
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        While we take reasonable measures to protect your data, no method of transmission or storage is 100% secure. You acknowledge and accept that we cannot guarantee the absolute security of your information.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        18. Dispute Resolution
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        Any disputes arising from these terms or your use of PhomoCam shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. You waive any right to participate in class action lawsuits or class-wide arbitration. This arbitration clause does not apply to claims related to intellectual property rights.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        19. Governing Law
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        These terms are governed by and construed in accordance with the laws of the State of California, without regard to conflict of law principles. Any legal action must be brought in the federal or state courts located in San Francisco County, California.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        20. Severability
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        If any provision of these terms is found to be unenforceable, the remainder shall continue in full force and effect. The unenforceable provision shall be replaced with an enforceable provision that most closely reflects the original intent.
      </Text>

      <Text color="$black" fontSize="$lg" fontWeight="$bold" textAlign="center">
        21. Contact Us
      </Text>

      <Text color="$black" fontSize="$md" lineHeight="$lg" textAlign="center">
        For questions about these Terms of Service, please visit our{' '}
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