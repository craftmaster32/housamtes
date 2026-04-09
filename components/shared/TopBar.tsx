import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useDrawerStore } from '@stores/drawerStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export function TopBar(): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toggle = useDrawerStore((s) => s.toggle);

  const handleMenuPress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggle();
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + sizes.sm }]}>
      <Pressable
        style={styles.menuBtn}
        onPress={handleMenuPress}
        accessibilityRole="button"
        accessibilityLabel={t('settings.open_menu')}
        accessible={true}
      >
        <View style={styles.hamburger}>
          <View style={[styles.line, styles.lineTop]} />
          <View style={[styles.line, styles.lineMid]} />
          <View style={[styles.line, styles.lineBot]} />
        </View>
      </Pressable>
      <Text style={styles.appName}>Nestiq</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.md,
    paddingBottom: 14,
    boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
  } as never,
  appName: {
    fontSize: 22,
    ...font.extrabold,
    color: colors.primary,
    letterSpacing: -0.8,
  },
  menuBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburger: { gap: 5, alignItems: 'flex-start' },
  line: { height: 2, backgroundColor: colors.primary, borderRadius: 2 },
  lineTop: { width: 22 },
  lineMid: { width: 14 },
  lineBot: { width: 22 },
});
