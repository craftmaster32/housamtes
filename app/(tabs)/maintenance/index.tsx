import { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { RequestCard } from '@components/maintenance/RequestCard';
import { AddRequestForm } from '@components/maintenance/AddRequestForm';
import { BackLink } from '@components/shared/BackLink';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';
const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, paddingBottom: ms(60), gap: sizes.sm },

    pageHeader: { marginBottom: sizes.xs },
    heading: { fontSize: mf(26), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    headingSub: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      marginTop: ms(2),
    },

    addBtn: {
      borderWidth: 2,
      borderColor: C.primary + '40',
      borderStyle: 'dashed',
      borderRadius: ms(14),
      paddingVertical: sizes.md,
      alignItems: 'center',
    },
    addBtnText: { color: C.primary, ...font.semibold, fontSize: sizes.fontMd },

    resolvedToggle: {
      minHeight: ms(44),
      paddingVertical: sizes.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(4),
    },
    resolvedToggleText: { color: C.textSecondary, fontSize: sizes.fontSm, ...font.medium },

    emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
    emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    emptyText: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(20) },
    errorBanner: {
      backgroundColor: C.danger + '15',
      borderRadius: ms(10),
      padding: sizes.sm,
      borderWidth: 1,
      borderColor: C.danger + '40',
    },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.danger },
  });

export default function MaintenanceScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const requests = useMaintenanceStore((s) => s.requests);
  const isLoading = useMaintenanceStore((s) => s.isLoading);
  const error = useMaintenanceStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const [showForm, setShowForm] = useState(false);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const open = requests.filter((r) => r.status !== 'resolved');
  const resolved = requests.filter((r) => r.status === 'resolved');
  const [showResolved, setShowResolved] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View style={styles.pageHeader}>
            <BackLink label={t('common.home')} />
            <Text style={[styles.heading, headingFont]}>{t('maintenance.title')}</Text>
            <Text style={styles.headingSub}>{t('maintenance.subtitle')}</Text>
          </View>

          {showForm ? (
            <AddRequestForm
              onClose={() => setShowForm(false)}
              reportedBy={profile?.id ?? ''}
              houseId={houseId ?? ''}
            />
          ) : (
            <Pressable
              style={styles.addBtn}
              onPress={() => setShowForm(true)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('maintenance.log_new')}
            >
              <Text style={styles.addBtnText}>{t('maintenance.log_new')}</Text>
            </Pressable>
          )}

          {open.length === 0 && !showForm && (
            <View style={styles.emptySection}>
              <Text style={styles.emptyTitle}>{t('maintenance.no_open')}</Text>
              <Text style={styles.emptyText}>{t('maintenance.no_open_hint')}</Text>
            </View>
          )}

          {open.map((r) => (
            <RequestCard key={r.id} request={r} myId={profile?.id ?? ''} />
          ))}

          {resolved.length > 0 && (
            <>
              <Pressable
                style={styles.resolvedToggle}
                onPress={() => setShowResolved((v) => !v)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${t('maintenance.resolved_section')} (${resolved.length})`}
                accessibilityState={{ expanded: showResolved }}
              >
                <Ionicons
                  name={showResolved ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={C.textSecondary}
                />
                <Text style={styles.resolvedToggleText}>
                  {t('maintenance.resolved_section')} ({resolved.length})
                </Text>
              </Pressable>
              {showResolved &&
                resolved.map((r) => (
                  <RequestCard key={r.id} request={r} myId={profile?.id ?? ''} />
                ))}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
