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

export default function TermsScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: 1 April 2026</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="1. Acceptance of Terms">
          {`By creating an account and using Nestiq, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.`}
        </Section>
        <Section title="2. Use of the Service">
          {`Nestiq is provided for personal household management use only. You must not use the app for any unlawful purpose, to harm other users, or to misrepresent yourself or your household.`}
        </Section>
        <Section title="3. Your Account">
          {`You are responsible for maintaining the security of your account credentials. You must not share your login with people outside your household. You must be at least 18 years old to create an account.`}
        </Section>
        <Section title="4. User Content">
          {`You retain ownership of content you create in Nestiq (bills, messages, photos, etc.). By uploading content, you grant Nestiq a limited licence to store and display it to your housemates. You must not upload illegal, harmful, or infringing content.`}
        </Section>
        <Section title="5. Free and Premium Tiers">
          {`The free tier includes all core features with a 50-photo limit per household. Premium features, if purchased, are non-refundable except where required by law. Subscription billing is managed through the App Store and is subject to Apple's terms.`}
        </Section>
        <Section title="6. Limitation of Liability">
          {`Nestiq is provided "as is". We are not liable for any loss of data, financial disagreements between housemates, or indirect damages arising from use of the app. Financial calculations are for reference only — always verify amounts independently.`}
        </Section>
        <Section title="7. Termination">
          {`We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time.`}
        </Section>
        <Section title="8. Changes to Terms">
          {`We may update these terms from time to time. Continued use of the app after changes are posted constitutes acceptance.`}
        </Section>
        <Section title="9. Contact">
          {`Questions? Email us at support@nestiq.app.`}
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
