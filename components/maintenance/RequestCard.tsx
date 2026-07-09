import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import {
  useMaintenanceStore,
  MAINTENANCE_CATEGORIES,
  STATUS_LABELS,
  STATUS_COLORS,
  NEXT_STATUS,
  type MaintenanceStatus,
} from '@stores/maintenanceStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type MaintenanceRequest = ReturnType<typeof useMaintenanceStore.getState>['requests'][0];

interface RequestCardProps {
  request: MaintenanceRequest;
  myId: string;
}

function timeAgo(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.days_ago', { count: days });
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: sizes.md,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    cardResolved: { opacity: 0.65 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
    cardIcon: { fontSize: 24, lineHeight: 30 },
    cardInfo: { flex: 1, gap: 2 },
    cardTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    cardTitleResolved: { textDecorationLine: 'line-through', color: C.textSecondary },
    cardMeta: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },
    removeBtn: { padding: 4 },
    removeBtnText: { color: C.textDisabled, fontSize: sizes.fontSm },
    cardDescription: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
    },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, flexWrap: 'wrap' },
    statusBadge: {
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.sm,
      paddingVertical: 4,
    },
    statusText: { fontSize: sizes.fontXs, ...font.bold },
    advanceBtn: {
      backgroundColor: C.primary + '15',
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.md,
      paddingVertical: 5,
    },
    advanceBtnText: { color: C.primary, fontSize: sizes.fontSm, ...font.semibold },
    reopenBtn: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.md,
      paddingVertical: 4,
    },
    reopenBtnText: { color: C.textSecondary, fontSize: sizes.fontSm, ...font.regular },
    cardError: { color: C.danger, fontSize: sizes.fontSm, ...font.regular },
  });

function StatusBadge({ status }: { status: MaintenanceStatus }): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, myId }) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const housemates = useHousematesStore((s) => s.housemates);
  const updateStatus = useMaintenanceStore((s) => s.updateStatus);
  const remove = useMaintenanceStore((s) => s.remove);
  const category = MAINTENANCE_CATEGORIES.find((c) => c.label === request.category);
  const [actionError, setActionError] = useState('');

  const handleNextStatus = useCallback(async () => {
    setActionError('');
    try {
      await updateStatus(request.id, NEXT_STATUS[request.status]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('maintenance.failed_save'));
    }
  }, [request.id, request.status, updateStatus, t]);

  const handleRemove = useCallback(async () => {
    setActionError('');
    try {
      await remove(request.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('maintenance.failed_save'));
    }
  }, [request.id, remove, t]);

  return (
    <View style={[styles.card, request.status === 'resolved' && styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{category?.icon ?? '📝'}</Text>
        <View style={styles.cardInfo}>
          <Text
            style={[styles.cardTitle, request.status === 'resolved' && styles.cardTitleResolved]}
          >
            {request.title}
          </Text>
          <Text style={styles.cardMeta}>
            {request.category} ·{' '}
            {t('maintenance.reported_by', { name: resolveName(request.reportedBy, housemates) })} ·{' '}
            {timeAgo(request.createdAt, t)}
          </Text>
        </View>
        {request.reportedBy === myId && (
          <Pressable
            onPress={handleRemove}
            style={styles.removeBtn}
            hitSlop={12}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${t('common.delete')}: ${request.title}`}
          >
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {request.description ? (
        <Text style={styles.cardDescription}>{request.description}</Text>
      ) : null}

      {!!actionError && <Text style={styles.cardError}>{actionError}</Text>}

      <View style={styles.cardFooter}>
        <StatusBadge status={request.status} />
        {request.status !== 'resolved' && (
          <Pressable
            style={styles.advanceBtn}
            onPress={handleNextStatus}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              request.status === 'open'
                ? t('maintenance.mark_in_progress')
                : t('maintenance.mark_resolved')
            }
          >
            <Text style={styles.advanceBtnText}>
              {request.status === 'open'
                ? t('maintenance.mark_in_progress')
                : t('maintenance.mark_resolved')}
            </Text>
          </Pressable>
        )}
        {request.status === 'resolved' && (
          <Pressable
            style={styles.reopenBtn}
            onPress={handleNextStatus}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('maintenance.reopen')}
          >
            <Text style={styles.reopenBtnText}>{t('maintenance.reopen')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};
