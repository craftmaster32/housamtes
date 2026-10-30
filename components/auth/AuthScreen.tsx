import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Entrance } from '@components/shared/Entrance';
import { mf, ms } from '@utils/responsive';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  /** Shown as a blue "‹ Back" link above everything. */
  onBack?: () => void;
  backLabel?: string;
  /** Something above the title, e.g. the step trail. */
  top?: React.ReactNode;
  /** A small drawing beside the title. */
  art?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The page every sign-in screen sits on: the page colour (no blue header),
 * a back link, a Fraunces title with a small drawing at its end, and the
 * form underneath on lines. Scrolls and lifts above the keyboard.
 */
export function AuthScreen({
  title,
  subtitle,
  onBack,
  backLabel,
  top,
  art,
  children,
}: AuthScreenProps): React.JSX.Element {
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const rtl = isRTL(useLanguageStore((s) => s.language));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!!onBack && !!backLabel && (
            <Pressable
              onPress={onBack}
              style={styles.back}
              hitSlop={12}
              accessible
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Ionicons
                name={rtl ? 'chevron-forward' : 'chevron-back'}
                size={20}
                color={c.primary}
              />
              <Text style={[styles.backText, { color: c.primary }]}>{backLabel}</Text>
            </Pressable>
          )}
          {top}
          <Entrance style={styles.head}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, heading, { color: c.textPrimary }]}>{title}</Text>
              {!!subtitle && (
                <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>
              )}
            </View>
            {!!art && (
              <View
                style={styles.art}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {art}
              </View>
            )}
          </Entrance>
          <Entrance style={styles.body} delay={70}>
            {children}
          </Entrance>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: sizes.lg,
    paddingTop: sizes.sm,
    paddingBottom: ms(40),
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingEnd: ms(8),
  },
  backText: { fontSize: mf(15), ...font.semibold },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: ms(12),
    marginTop: ms(14),
    marginBottom: ms(26),
  },
  titleWrap: { flex: 1, gap: ms(6) },
  // Taller line height so descenders ("g", "y") aren't clipped.
  title: { fontSize: mf(36), lineHeight: mf(44), letterSpacing: -0.6 },
  subtitle: { fontSize: mf(15.5), ...font.regular, lineHeight: mf(22) },
  art: { paddingBottom: ms(4) },
  body: { gap: ms(20) },
});
