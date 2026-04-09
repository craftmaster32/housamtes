import { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const features = useSettingsStore((s) => s.features);
  const toggleFeature = useSettingsStore((s) => s.toggleFeature);

  const handleToggle = useCallback(
    (key: string) => {
      toggleFeature(key);
    },
    [toggleFeature]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('settings.features_intro')}</Text>

        <Text style={styles.sectionLabel}>{t('settings.features_section')}</Text>

        <View style={styles.card}>
          {features.map((feature, index) => (
            <View
              key={feature.key}
              style={[
                styles.row,
                index < features.length - 1 && styles.rowBorder,
              ]}
            >
              <Text style={styles.icon}>{feature.icon}</Text>
              <View style={styles.info}>
                <Text style={styles.label}>{feature.label}</Text>
                <Text style={styles.description}>{feature.description}</Text>
              </View>
              <Switch
                value={feature.enabled}
                onValueChange={() => handleToggle(feature.key)}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={feature.enabled ? colors.primary : colors.textSecondary}
                accessible
                accessibilityLabel={`Toggle ${feature.label}`}
                accessibilityState={{ checked: feature.enabled }}
              />
            </View>
          ))}
        </View>

        <Text style={styles.note}>{t('settings.features_note')}</Text>

        <Text style={styles.sectionLabel}>LEGAL</Text>
        <View style={styles.card}>
          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => router.push('/(tabs)/settings/privacy-policy')}>
            <Text style={styles.icon}>🔒</Text>
            <Text style={[styles.label, { flex: 1 }]}>{t('settings.privacy')}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/(tabs)/settings/terms')}>
            <Text style={styles.icon}>📄</Text>
            <Text style={[styles.label, { flex: 1 }]}>{t('settings.terms')}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: sizes.lg, gap: sizes.sm },
  intro: { color: colors.textSecondary, ...font.regular, fontSize: 15, lineHeight: 22 },
  sectionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    ...font.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: sizes.sm,
    marginBottom: sizes.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.md,
    gap: sizes.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: { fontSize: 24, width: 32, textAlign: 'center' },
  info: { flex: 1 },
  label: {
    fontSize: 16,
    color: colors.textPrimary,
    ...font.semibold,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    ...font.regular,
    marginTop: 2,
  },
  note: {
    fontSize: 15,
    color: colors.textSecondary,
    ...font.regular,
    textAlign: 'center',
    marginTop: sizes.md,
    fontStyle: 'italic',
  },
  chevron: { color: colors.textSecondary, fontSize: 20 },
});
