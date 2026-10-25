import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { Entrance } from '@components/shared/Entrance';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { SheetButton } from '@components/shared/SheetButton';
import { KeyArt } from '@components/auth/art/KeyArt';
import { mf, ms } from '@utils/responsive';

/**
 * "Password updated" — a notebook page with the new key drawn on it, then a
 * big blue button back to signing in.
 */
export function PasswordDone(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: c.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.center}>
        <Entrance>
          <NotebookPaper contentStyle={styles.page}>
            <View
              style={styles.art}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <KeyArt width={ms(78)} ink={c.paperInk} />
            </View>
            <Text style={[styles.title, heading, { color: c.paperInk }]}>
              {t('auth.password_updated_title')}
            </Text>
            <Text style={[styles.body, { color: c.paperMuted }]}>
              {t('auth.password_updated_body')}
            </Text>
          </NotebookPaper>
        </Entrance>
        <Entrance delay={90}>
          <SheetButton
            label={t('auth.go_to_sign_in')}
            onPress={() => router.replace('/(auth)/login')}
          />
        </Entrance>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: sizes.lg, gap: ms(28) },
  page: { alignItems: 'center', paddingTop: ms(22), paddingBottom: ms(26) },
  art: { marginBottom: ms(8) },
  title: { fontSize: mf(26), lineHeight: ms(32), textAlign: 'center' },
  body: { fontSize: mf(15.5), ...font.regular, lineHeight: ms(32), textAlign: 'center' },
});
