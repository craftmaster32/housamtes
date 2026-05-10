import { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function Section({ title, children }: { title: string; children: string }): React.JSX.Element {
  const C = useThemedColors();
  return (
    <View style={sectionStyles(C).wrap}>
      <Text style={sectionStyles(C).title}>{title}</Text>
      <Text style={sectionStyles(C).body} selectable>{children}</Text>
    </View>
  );
}

function sectionStyles(C: ColorTokens) {
  return StyleSheet.create({
    wrap: { gap: sizes.xs },
    title: { fontSize: 15, ...font.bold, color: C.textPrimary },
    body: { fontSize: 14, ...font.regular, color: C.textSecondary, lineHeight: 22 },
  });
}

export default function PrivacyPolicyScreen(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.heading}>Privacy Policy</Text>
          <Text style={styles.updated}>Last updated: 25 April 2026</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Section title="1. Who We Are">
            {`HouseMates ("we", "us", "our") is the data controller for all personal information you provide through this app. For privacy enquiries, contact: privacy@housemates.app`}
          </Section>
          <Section title="2. Information We Collect">
            {`Account information: name, email address, and avatar colour when you sign up.\n\nHousehold content: bills, chores, parking sessions, grocery lists, maintenance notes, announcements, group messages, and photos you create or upload.\n\nProfile data: profile photo and cover image you optionally upload.\n\nDevice and usage data: push notification tokens (to deliver alerts to your device) and device identifiers used by Sentry for crash reporting only. We collect anonymised crash diagnostics — never the content of your messages or files.\n\nWe do NOT collect: your location, contacts, browsing history, biometric identifiers, or payment card numbers.`}
          </Section>
          <Section title="3. Lawful Basis for Processing (GDPR)">
            {`For users in the European Economic Area (EEA) or United Kingdom:\n\n• Contract performance: to provide the HouseMates service you signed up for (bill tracking, chores, chat, etc.).\n• Legitimate interests: to detect and prevent fraud, abuse, and security incidents; to improve stability via anonymised crash reports. You have the right to object (see Section 9).\n• Consent: to send push notifications. You may withdraw consent anytime in your device notification settings.`}
          </Section>
          <Section title="4. How We Use Your Information">
            {`• To operate and personalise HouseMates for you and your housemates.\n• To deliver push notifications you have enabled (bill reminders, chore alerts, chat messages).\n• To detect and fix bugs via anonymised Sentry crash reports.\n• To respond to support and legal requests.\n• To comply with legal obligations.\n\nWe do NOT use your data for automated decision-making that produces legal effects, behavioural advertising, or profiling.`}
          </Section>
          <Section title="5. We Do Not Sell Your Data">
            {`We do not sell, rent, trade, or share your personal information with advertisers or data brokers — and we never will.\n\nCalifornia residents: You have the right to opt out of the sale or sharing of your personal information. Because we do not sell or share personal data for cross-context behavioural advertising, no opt-out mechanism is required. If this changes, we will notify you and provide a clear opt-out before any such sharing begins.\n\nTo confirm our data practices or make a formal "Do Not Sell" request, email: privacy@housemates.app`}
          </Section>
          <Section title="6. Third-Party Service Providers">
            {`We share data only with the following sub-processors, each bound by data processing agreements:\n\n• Supabase Inc. (database and file storage, hosted on AWS, United States): stores your account data, household content, and uploaded photos.\n• Sentry — Functional Software Inc. (United States): receives anonymised crash reports containing only a randomised user identifier — never your name, email, or household content.\n• Apple Inc. / Google LLC: delivers push notifications via APNs / FCM. Your push token is transmitted to these platforms solely to route notifications to your device.\n• Expo — 650 Industries Inc. (United States): push notification delivery infrastructure.\n\nNo data is provided to any other third party without your explicit consent.`}
          </Section>
          <Section title="7. International Data Transfers">
            {`Your data is stored on servers in the United States. If you are in the EEA or United Kingdom, this is an international transfer. We rely on Standard Contractual Clauses (SCCs) approved by the European Commission to protect such transfers. You may request a copy of the relevant safeguards at: privacy@housemates.app`}
          </Section>
          <Section title="8. Data Retention">
            {`Account and profile data: retained while your account is active. Deleted within 30 days of account deletion.\n\nHousehold content (bills, chores, etc.): deleted within 90 days of account deletion.\n\nGroup chat messages: retained while your account is active. You may delete individual messages you sent within 15 minutes. You may request deletion of all your messages by emailing privacy@housemates.app.\n\nPhotos: retained while uploaded by any active household member. Deleted within 30 days after you remove a photo or delete your account.\n\nCrash reports (Sentry): 90-day retention, then automatically purged.\n\nPush notification tokens: deleted upon sign-out or account deletion.`}
          </Section>
          <Section title="9. Your Rights">
            {`All users:\n• Access: request a copy of the data we hold about you.\n• Correction: ask us to fix inaccurate data.\n• Deletion: request permanent erasure. To delete your account, go to Profile → Delete Account. To request deletion of specific data, email privacy@housemates.app. We will complete deletion within 30 days.\n• Data portability: request your data in a portable, machine-readable format.\n\nEEA / UK users (GDPR):\n• Restriction: ask us to pause processing while a complaint is investigated.\n• Object: object to processing based on legitimate interests.\n• Lodge a complaint with your national data protection authority (e.g., ICO in the UK, CNIL in France).\n\nCalifornia residents (CCPA / CPRA):\n• Right to Know: request the categories and specific pieces of personal information we collect about you.\n• Right to Delete: request deletion of personal information.\n• Right to Correct: request correction of inaccurate personal information.\n• Right to Opt Out of Sale/Sharing: we do not sell or share your data. No further action required.\n• Right to Non-Discrimination: we will not treat you differently for exercising privacy rights.\n\nTo exercise any right, email privacy@housemates.app. We respond within 30 days (45 days for complex CCPA requests).`}
          </Section>
          <Section title="10. Children's Privacy (COPPA)">
            {`HouseMates is strictly for users aged 18 and older. We do not direct the app at children and do not knowingly collect personal information from anyone under 18.\n\nIf we learn that a user is under 18, we will immediately delete their account and all associated data. If you believe a minor has registered, contact: privacy@housemates.app\n\nFor users between 13 and 17 who reside in the United States: HouseMates is not available to you. Registration is blocked for users who indicate they are under 18 during sign-up. If you used this app and are under 18, please contact us so we can remove your data.`}
          </Section>
          <Section title="11. Biometric Data (BIPA — Illinois)">
            {`HouseMates does not collect, store, analyse, or use biometric identifiers or biometric information as defined under the Illinois Biometric Information Privacy Act (BIPA) or any other biometric privacy law.\n\nProfile photos and household photos you upload are stored as standard image files only. We do not perform facial recognition, facial geometry analysis, or any biometric identification on any image. We do not share image data with any facial recognition service.\n\nIf we ever introduce features involving biometric data in the future, we will obtain your explicit written consent before collecting any such data.`}
          </Section>
          <Section title="12. Cookies and Tracking">
            {`The HouseMates mobile app does not use cookies or advertising trackers.\n\nIf you access HouseMates via a web browser, we use only essential session cookies required for authentication. We do not use third-party analytics cookies, advertising pixels, or fingerprinting technologies.`}
          </Section>
          <Section title="13. User-Generated Content and CSAM">
            {`You are solely responsible for any content you upload or share through HouseMates. We prohibit illegal content of any kind.\n\nChild Sexual Abuse Material (CSAM): It is a federal crime to distribute, receive, or possess CSAM. We have zero tolerance for such material. We are legally required to report any known CSAM to the National Center for Missing and Exploited Children (NCMEC) and will cooperate fully with law enforcement. If you encounter CSAM within the app, report it immediately to: safety@housemates.app\n\nWe reserve the right to remove any content that violates our Terms of Service and to report violations to the appropriate authorities.`}
          </Section>
          <Section title="14. Copyright and DMCA">
            {`We respect intellectual property rights. If you believe that content in HouseMates infringes your copyright, send a DMCA takedown notice to our designated agent:\n\nDMCA Agent: legal@housemates.app\n\nYour notice must include: (1) your contact information; (2) identification of the copyrighted work; (3) identification of the infringing content; (4) a statement that the use is not authorised; (5) a statement under penalty of perjury that the information is accurate and you are authorised to act.\n\nWe will process valid notices within 10 business days.`}
          </Section>
          <Section title="15. Financial Data">
            {`HouseMates tracks shared household expenses as an informal record-keeping tool. It does not constitute a financial service, and we are not a bank, payment processor, money transmitter, or financial adviser.\n\nExpense calculations and balance figures are for informal reference only and are not legally binding. We do not hold, transmit, or facilitate the transfer of funds between users. Users settle debts directly with each other using their preferred payment method.\n\nWe do not share expense data or financial patterns with any third party.`}
          </Section>
          <Section title="16. Security">
            {`We protect your data using industry-standard measures: TLS 1.2+ encryption in transit, AES-256 encryption at rest, row-level database security restricting access to your household only, and access controls enforced by Supabase's Row-Level Security (RLS).\n\nData Breach Notification: If we become aware of a security breach affecting your personal data, we will notify the relevant supervisory authority within 72 hours as required by GDPR Article 33, and notify affected users within the legally required timeframe under applicable state laws (typically 30 days).\n\nDespite these measures, no system is 100% secure. If you believe your account has been compromised, change your password immediately and contact support@housemates.app.`}
          </Section>
          <Section title="17. Changes to This Policy">
            {`We may update this policy. When we make material changes, we will notify you through the app at least 14 days before the changes take effect. For significant changes affecting your rights (such as new data sharing), we will request your re-acceptance.\n\nThe "Last updated" date at the top of this page reflects the current version. Archived versions are available on request.`}
          </Section>
          <Section title="18. Contact Us">
            {`Data controller: HouseMates\n\nPrivacy enquiries: privacy@housemates.app\nSafety / content reporting: safety@housemates.app\nCopyright / DMCA: legal@housemates.app\nGeneral support: support@housemates.app\n\nWe aim to respond to all privacy enquiries within 5 business days.`}
          </Section>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    header: { padding: sizes.lg, gap: 4 },
    backBtn: { marginBottom: sizes.sm },
    backText: { color: C.primary, fontSize: 15, ...font.medium },
    heading: { fontSize: 24, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.3 },
    updated: { color: C.textSecondary, fontSize: 13, ...font.regular },
    content: { paddingHorizontal: sizes.lg, paddingBottom: sizes.xxl, gap: sizes.lg },
  });
}
