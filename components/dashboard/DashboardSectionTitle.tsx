import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface DashboardSectionTitleProps {
  title: string;
  /** Optional trailing control, e.g. an "Edit" link. */
  right?: React.ReactNode;
}

/** A friendly serif heading that opens each part of the home screen. */
export function DashboardSectionTitle({
  title,
  right,
}: DashboardSectionTitleProps): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont();
  return (
    <View style={styles.row}>
      <Text
        style={[styles.title, headingFont, { color: c.textPrimary }]}
        accessibilityRole="header"
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    paddingHorizontal: ms(4),
    paddingTop: ms(26),
    paddingBottom: ms(10),
  },
  title: { flex: 1, fontSize: mf(22), letterSpacing: -0.3 },
});
