import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useMaintenanceStore, type MaintenanceRequest } from '@stores/maintenanceStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { IssueTicket } from '@components/property/IssueTicket';
import { IssueSheet } from '@components/property/IssueSheet';
import { mf, ms } from '@utils/responsive';

type ListItem =
  | { kind: 'open'; request: MaintenanceRequest }
  | { kind: 'resolved-toggle' }
  | { kind: 'resolved'; request: MaintenanceRequest };

/** Maintenance issues as job tickets; resolved ones fold away under a toggle. */
export function IssuesTab(): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const hand = useHandFont();
  const { t } = useTranslation();
  const requests = useMaintenanceStore((s) => s.requests);
  const isLoading = useMaintenanceStore((s) => s.isLoading);
  const error = useMaintenanceStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const [showForm, setShowForm] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const myId = profile?.id ?? '';

  const open = useMemo(() => requests.filter((r) => r.status !== 'resolved'), [requests]);
  const resolved = useMemo(() => requests.filter((r) => r.status === 'resolved'), [requests]);

  const data = useMemo((): ListItem[] => {
    const items: ListItem[] = open.map((request) => ({ kind: 'open', request }));
    if (resolved.length > 0) {
      items.push({ kind: 'resolved-toggle' });
      if (showResolved) resolved.forEach((request) => items.push({ kind: 'resolved', request }));
    }
    return items;
  }, [open, resolved, showResolved]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }): React.JSX.Element => {
      if (item.kind === 'resolved-toggle') {
        return (
          <Pressable
            style={styles.toggle}
            onPress={() => setShowResolved((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showResolved }}
          >
            <Text style={styles.toggleText}>
              {t('maintenance.resolved_section')} ({resolved.length})
            </Text>
            <Ionicons
              name={showResolved ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={c.textSecondary}
            />
          </Pressable>
        );
      }
      return (
        <View style={styles.item}>
          <IssueTicket request={item.request} myId={myId} />
        </View>
      );
    },
    [showResolved, resolved.length, t, myId, styles, c]
  );

  const keyExtractor = useCallback(
    (item: ListItem): string => (item.kind === 'resolved-toggle' ? 'toggle' : item.request.id),
    []
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner accessibilityLabel={t('common.loading')} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t('maintenance.subtitle')}</Text>
            <PaperTag
              label={t('maintenance.log_new').replace(/^\+\s*/, '')}
              onPress={() => setShowForm(true)}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Mate size={ms(80)} />
            <Text style={[styles.emptyTitle, hand]}>{t('maintenance.no_open')}</Text>
            <Text style={styles.emptyText}>{t('maintenance.no_open_hint')}</Text>
          </View>
        }
      />
      <IssueSheet
        visible={showForm}
        reportedBy={myId}
        houseId={houseId ?? ''}
        onClose={() => setShowForm(false)}
      />
    </>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    centered: { paddingVertical: ms(60), alignItems: 'center' },
    list: { paddingHorizontal: ms(20), paddingBottom: ms(60) },
    header: { gap: ms(12), marginBottom: ms(20), alignItems: 'flex-start' },
    subtitle: { fontSize: mf(14), lineHeight: mf(20), ...font.regular, color: C.textSecondary },
    error: { fontSize: mf(13), ...font.regular, color: C.danger },
    item: { marginBottom: ms(20) },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      minHeight: 44,
      marginBottom: ms(12),
    },
    toggleText: { fontSize: mf(14), ...font.semibold, color: C.textSecondary },
    empty: { alignItems: 'center', paddingVertical: ms(24), gap: ms(8) },
    emptyTitle: { fontSize: mf(22), lineHeight: mf(26), color: C.textPrimary, textAlign: 'center' },
    emptyText: {
      fontSize: mf(13.5),
      lineHeight: mf(19),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingHorizontal: ms(16),
    },
  });
