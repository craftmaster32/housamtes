import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface SectionHeadProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

/** A Fraunces section heading with an optional blue link on the right. */
export function SectionHead({ title, action, onAction }: SectionHeadProps): React.JSX.Element {
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  return (
    <View style={styles.head}>
      <Text
        style={[styles.headTitle, heading, { color: c.textPrimary }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {!!action && !!onAction && (
        <Pressable onPress={onAction} style={styles.headLink} accessibilityRole="button">
          <Text style={[styles.headLinkText, { color: c.primary }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ms(26),
    marginBottom: ms(8),
  },
  headTitle: { fontSize: mf(21), lineHeight: mf(27) },
  headLink: { minHeight: 44, justifyContent: 'center', paddingStart: ms(10) },
  headLinkText: { fontSize: mf(14), ...font.semibold },
});
