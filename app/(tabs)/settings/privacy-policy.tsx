import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function Section({ title, children }: { title: string; children: string }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body} selectable>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: 1 April 2026</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="1. Information We Collect">
          {`We collect the information you provide when creating an account (name, email address, avatar colour) and information generated through using the app (bills, chores, parking sessions, messages and photos you upload).`}
        </Section>
        <Section title="2. How We Use Your Information">
          {`Your information is used solely to provide the Nestiq service to you and your housemates. We do not sell your personal data to third parties. Aggregated, anonymised analytics may be used to improve the app.`}
        </Section>
        <Section title="3. Data Storage">
          {`Your data is stored securely on Supabase infrastructure (hosted on AWS). All data is encrypted in transit (TLS) and at rest. You can delete your account at any time, which permanently removes your personal data.`}
        </Section>
        <Section title="4. Data Sharing">
          {`Your information is shared only with the other members of your household on Nestiq. We do not share your data with advertisers. Error reports sent to Sentry contain only a user ID — never your name, email, or household content.`}
        </Section>
        <Section title="5. Your Rights">
          {`You have the right to access, correct, or delete your personal data at any time. To delete your account and all associated data, go to Profile → Delete Account. To request a data export, contact us at privacy@nestiq.app.`}
        </Section>
        <Section title="6. Changes to This Policy">
          {`We may update this policy from time to time. We will notify you through the app when significant changes are made.`}
        </Section>
        <Section title="7. Contact">
          {`Questions about this policy? Email us at privacy@nestiq.app.`}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: sizes.lg, gap: 4 },
  backBtn: { marginBottom: sizes.sm },
  backText: { color: colors.primary, fontSize: 15, ...font.medium },
  heading: { fontSize: 24, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.3 },
  updated: { color: colors.textSecondary, fontSize: 13, ...font.regular },
  content: { paddingHorizontal: sizes.lg, paddingBottom: sizes.xxl, gap: sizes.lg },
  section: { gap: sizes.xs },
  sectionTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  body: { fontSize: 14, ...font.regular, color: colors.textSecondary, lineHeight: 22 },
});
