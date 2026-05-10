import { useMemo, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    header: { padding: sizes.lg, gap: 4 },
    backBtn: { marginBottom: sizes.sm },
    backText: { color: C.primary, fontSize: 15, ...font.medium },
    heading: { fontSize: 24, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.3 },
    updated: { color: C.textSecondary, fontSize: 13, ...font.regular },
    content: { paddingHorizontal: sizes.lg, paddingBottom: sizes.xxl, gap: sizes.lg },
    section: { gap: sizes.xs },
    sectionTitle: { fontSize: 15, ...font.bold, color: C.textPrimary },
    body: { fontSize: 14, ...font.regular, color: C.textSecondary, lineHeight: 22 },
});

function Section({ title, children }: { title: string; children: string }): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body} selectable>{children}</Text>
    </View>
  );
}

export default function TermsScreen(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleBackPress = useCallback(() => router.back(), []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.heading}>Terms of Service</Text>
          <Text style={styles.updated}>Last updated: 25 April 2026</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>

          <Section title="1. Acceptance of Terms">
            {`By creating an account and using HouseMates, you confirm that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you must not use the app.\n\nThese Terms form a legally binding agreement between you ("you" or "user") and HouseMates ("we", "us", "our"). By ticking the acceptance checkbox at sign-up, you provide affirmative, documented consent to these Terms. This constitutes a valid clickwrap agreement enforceable under applicable law.`}
          </Section>

          <Section title="2. Eligibility — You Must Be 18 or Older">
            {`You must be at least 18 years old to create a HouseMates account. By ticking the acceptance checkbox, you confirm under penalty of account termination that you are aged 18 or older.\n\nIf we discover that a user is under 18, we will immediately terminate their account, delete all associated personal data, and report the violation to a parent or guardian if required by applicable law.\n\nHouseMates is not directed at children under 13. We do not knowingly collect personal data from children under 13. If you become aware of a child using this app, notify us at safety@housemates.app.`}
          </Section>

          <Section title="3. Your Account">
            {`You are responsible for:\n• Maintaining the strict confidentiality of your login credentials.\n• All activity that occurs under your account.\n• Keeping your account information (name, email) accurate and current.\n\nYou must not share your account login with anyone — including other housemates. Each person must have their own account.\n\nNotify us immediately at support@housemates.app if you suspect unauthorised access to your account. We may require you to change your password at any time if we believe your account security has been compromised.`}
          </Section>

          <Section title="4. Permitted Use">
            {`HouseMates is provided exclusively for personal, non-commercial, shared household management among a group of adult housemates. Permitted uses include coordinating shared bills, chores, parking, grocery lists, maintenance tracking, and household communication.`}
          </Section>

          <Section title="5. Prohibited Conduct">
            {`You must not use HouseMates to:\n\n• Violate any applicable local, national, or international law or regulation.\n• Upload, post, or share content that is illegal, harmful, defamatory, obscene, threatening, harassing, discriminatory, or that infringes any third party's intellectual property rights.\n• Upload, access, or distribute child sexual abuse material (CSAM). This is a federal crime. We will immediately report any CSAM to NCMEC and law enforcement.\n• Impersonate any person, misrepresent your identity, or create a false sense of affiliation.\n• Attempt to gain unauthorised access to any account, server, or network connected to HouseMates.\n• Reverse-engineer, decompile, disassemble, or extract source code from the app or its infrastructure.\n• Use automated tools (bots, scrapers, crawlers) to access or interact with the service.\n• Disrupt, damage, or interfere with other users' access to or enjoyment of the service.\n• Upload malware, viruses, ransomware, or any harmful or disruptive code.\n• Use the app to facilitate unlawful debt collection, financial coercion, or harassment of other housemates over money.\n• Circumvent any security, privacy, or access control feature.\n\nViolation of any prohibited conduct may result in immediate account suspension or permanent termination without notice.`}
          </Section>

          <Section title="6. User Content">
            {`You retain full ownership of all content you create in HouseMates (messages, photos, notes, lists, etc.) ("User Content").\n\nBy uploading or submitting User Content, you grant HouseMates a limited, non-exclusive, royalty-free, worldwide licence to store, reproduce, and display your content solely to operate the service for you and your housemates. This licence ends when you delete the content or your account.\n\nYou represent and warrant that:\n(a) You own or have all necessary rights to upload your User Content.\n(b) Your User Content does not violate these Terms, any applicable law, or any third-party rights (including copyright, privacy, and publicity rights).\n(c) You have the consent of all individuals identifiable in photos you upload.\n\nWe do not review User Content in advance but reserve the right to remove content that violates these Terms. You are solely responsible for your User Content.`}
          </Section>

          <Section title="7. Content Moderation and Reporting">
            {`We take safety seriously. You may report content or behaviour that violates these Terms:\n\n• Chat messages: long-press any message you did not send to report it.\n• Photos: tap the report icon on any photo you did not upload.\n• Other concerns: email safety@housemates.app.\n\nWe will review all reports within 48 hours and take appropriate action, which may include content removal, account suspension, or reporting to law enforcement.\n\nWe maintain logs of all reported content and moderation actions for legal defensibility. You may request the outcome of your report by emailing safety@housemates.app.`}
          </Section>

          <Section title="8. Intellectual Property">
            {`All HouseMates software, design, trademarks, logos, trade names, and original content are our exclusive intellectual property, protected by copyright, trademark, and other applicable laws.\n\nThese Terms grant you no rights to our intellectual property beyond the limited right to use the app in accordance with these Terms.\n\nFeedback: If you submit ideas, suggestions, or feedback about the app, you grant us a perpetual, irrevocable, royalty-free licence to use that feedback without compensation or obligation to you.`}
          </Section>

          <Section title="9. Financial Services Disclaimer — Important">
            {`HouseMates is an expense-tracking and household management tool. It is NOT a financial service.\n\nSpecifically:\n• We do not hold, receive, transmit, or facilitate the transfer of funds between users.\n• We are not a bank, money transmitter, payment processor, or licensed financial institution.\n• We are not regulated by FinCEN, the CFPB, or any state financial regulator in connection with this app.\n• Expense calculations and balance figures displayed in the app are informal records only. They are NOT legally binding debt instruments, contracts, or payment demands.\n• Users settle debts directly with each other using their own chosen payment methods (e.g., bank transfer, cash, Venmo). This app plays no role in those transactions.\n\nWe are not liable for any financial disputes between housemates arising from use of the app. For legal or financial advice, consult a qualified professional.`}
          </Section>

          <Section title="10. Landlord-Tenant Disclaimer">
            {`HouseMates is not a landlord-tenant documentation service, legal tool, or property management platform.\n\nCondition reports, maintenance requests, and photos stored in the app are informal household records. They are not intended for use in legal proceedings, rent disputes, tenancy tribunal claims, or formal complaints to housing authorities.\n\nWe are not liable for any outcome in landlord-tenant disputes, even if the app was used to record related information. For legal matters involving your tenancy, consult a solicitor or tenant advisory service.`}
          </Section>

          <Section title="11. Copyright — DMCA">
            {`We respond to valid notices of copyright infringement. To submit a DMCA takedown notice:\n\nDMCA Agent: legal@housemates.app\n\nYour notice must include: (1) your contact information; (2) identification of the copyrighted work claimed to be infringed; (3) identification of the infringing material within the app; (4) a statement that use of the material is not authorised by the copyright owner; (5) a statement under penalty of perjury that the information is accurate and you are the rights owner or authorised to act on their behalf.\n\nWe will process valid notices within 10 business days and notify the uploader. Repeat infringers will have their accounts terminated.`}
          </Section>

          <Section title="12. Premium Features and Payments">
            {`Core features of HouseMates are free. Premium features are clearly labelled with pricing before purchase.\n\nAll payments are processed exclusively through the Apple App Store or Google Play Store, subject to their respective terms. We do not process payments directly and never access your payment card information.\n\nSubscription fees are non-refundable except where required by applicable law. EU and UK consumers have the right to a 14-day cooling-off period for digital services purchased online, subject to conditions. To exercise this right, contact support@housemates.app within 14 days of purchase.`}
          </Section>

          <Section title="13. Disclaimer of Warranties">
            {`THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND — EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE — INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT.\n\nWe do not warrant that:\n• The app will be uninterrupted, error-free, secure, or free of viruses or harmful components.\n• Data will be stored without loss, corruption, or unauthorised access.\n• Expense calculations are accurate for tax, accounting, or legal purposes.\n• The app will be available in your jurisdiction or compatible with your device.\n\nFinancial figures in the app are for informal reference only. Always verify amounts independently before making payments.`}
          </Section>

          <Section title="14. Limitation of Liability">
            {`TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HOUSEMATES AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR:\n\n• Any indirect, incidental, special, consequential, exemplary, OR punitive damages.\n• Loss of profits, revenue, data, goodwill, or business opportunities.\n• Financial disputes, debt conflicts, or payment disagreements between housemates.\n• Damage resulting from unauthorised access to your account or household data.\n• Interruption or unavailability of the service.\n\nOur total aggregate liability to you for all claims arising from your use of the app shall not exceed the greater of: (a) the amount you paid to us in the 12 months preceding the claim, or (b) £50 (fifty pounds sterling).\n\nJurisdictions that do not allow limitation of consequential damages: in those jurisdictions, liability is limited to the maximum extent permitted by law. Nothing in these Terms limits liability for death, personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.`}
          </Section>

          <Section title="15. Indemnification">
            {`You agree to indemnify, defend, and hold harmless HouseMates and its officers, directors, employees, agents, and licensors from and against any and all claims, liabilities, losses, damages, and costs (including reasonable legal fees) arising out of or connected with:\n\n• Your breach of these Terms.\n• Your User Content.\n• Your misuse of the app.\n• Your violation of any applicable law or third-party rights.\n• Any dispute between you and another housemate.`}
          </Section>

          <Section title="16. Dispute Resolution and Governing Law">
            {`Informal resolution: Before filing a formal dispute, contact us at support@housemates.app and give us 30 days to attempt good-faith resolution.\n\nGoverning law: These Terms are governed by and construed in accordance with the laws of England and Wales, without regard to conflict of law principles.\n\nJurisdiction: Any dispute not resolved informally shall be subject to the exclusive jurisdiction of the courts of England and Wales, EXCEPT that:\n• Consumers resident in EU member states retain the right to bring proceedings in the courts of their country of residence.\n• Consumers resident in the United Kingdom retain all rights under the Consumer Rights Act 2015.\n• Nothing in these Terms limits your right to use alternative dispute resolution (ADR) or mediation services available in your jurisdiction.\n\nClass action: To the extent permitted by applicable law, you agree to resolve disputes individually and not as part of any class, consolidated, or representative action.`}
          </Section>

          <Section title="17. Termination">
            {`By you: You may close your account at any time via Profile → Delete Account. Deletion is immediate. Your personal data will be permanently removed within 30 days, as set out in our Privacy Policy.\n\nBy us: We may suspend or terminate your account immediately and without notice if you violate these Terms, engage in fraudulent or harmful conduct, or if we are required to do so by law. Where reasonably practicable, we will notify you by email.\n\nEffect of termination: Sections 6, 8, 9, 10, 13, 14, 15, 16, and 18 survive termination.`}
          </Section>

          <Section title="18. Force Majeure">
            {`We are not liable for any failure or delay in performance caused by circumstances beyond our reasonable control, including: natural disasters, acts of government or regulatory authority, war or civil unrest, power or internet outages, third-party service failures (including Supabase, Apple, or Google infrastructure), or pandemic.`}
          </Section>

          <Section title="19. Severability">
            {`If any provision of these Terms is found to be invalid, illegal, or unenforceable under applicable law, that provision will be modified to the minimum extent necessary to make it enforceable, or severed if modification is not possible. The remaining provisions will continue in full force and effect.`}
          </Section>

          <Section title="20. Entire Agreement">
            {`These Terms, together with our Privacy Policy, constitute the entire agreement between you and HouseMates regarding use of the app. They supersede all prior agreements, representations, and understandings relating to the subject matter.`}
          </Section>

          <Section title="21. Changes to Terms">
            {`We may update these Terms from time to time. When we make material changes, we will notify you through the app at least 14 days before the changes take effect. Where required by applicable law, we will obtain your re-acceptance before the new Terms apply.\n\nIf you do not agree to revised Terms, you must stop using the app and delete your account before the effective date. Continued use after the effective date constitutes acceptance.`}
          </Section>

          <Section title="22. Contact Us">
            {`HouseMates\n\nGeneral support: support@housemates.app\nPrivacy: privacy@housemates.app\nSafety & abuse: safety@housemates.app\nLegal / DMCA: legal@housemates.app\n\nWe aim to respond to all enquiries within 5 business days.`}
          </Section>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
