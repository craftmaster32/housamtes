import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
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
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return `${days} days ago`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function StatusBadge({ status }: { status: MaintenanceStatus }): React.JSX.Element {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

type MaintenanceRequest = ReturnType<typeof useMaintenanceStore.getState>['requests'][0];

type ListItem =
  | { kind: 'open'; request: MaintenanceRequest }
  | { kind: 'resolved-toggle' }
  | { kind: 'resolved'; request: MaintenanceRequest };

function RequestCard({ request, myId }: { request: MaintenanceRequest; myId: string }): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const updateStatus = useMaintenanceStore((s) => s.updateStatus);
  const remove = useMaintenanceStore((s) => s.remove);
  const category = MAINTENANCE_CATEGORIES.find((c) => c.label === request.category);

  const handleNextStatus = useCallback(() => {
    void updateStatus(request.id, NEXT_STATUS[request.status]);
  }, [request.id, request.status, updateStatus]);

  const handleRemove = useCallback(() => {
    void remove(request.id);
  }, [request.id, remove]);

  return (
    <View style={[styles.card, request.status === 'resolved' && styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{category?.icon ?? '📝'}</Text>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, request.status === 'resolved' && styles.cardTitleResolved]}>
            {request.title}
          </Text>
          <Text style={styles.cardMeta}>
            {request.category} · {t('maintenance.reported_by', { name: resolveName(request.reportedBy, housemates) })} · {timeAgo(request.createdAt, t)}
          </Text>
        </View>
        {request.reportedBy === myId && (
          <Pressable
            onPress={handleRemove}
            style={styles.removeBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {request.description ? (
        <Text style={styles.cardDescription}>{request.description}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <StatusBadge status={request.status} />
        {request.status !== 'resolved' && (
          <Pressable
            style={styles.advanceBtn}
            onPress={handleNextStatus}
            accessible
            accessibilityRole="button"
          >
            <Text style={styles.advanceBtnText}>
              {request.status === 'open' ? t('maintenance.mark_in_progress') : t('maintenance.mark_resolved')}
            </Text>
          </Pressable>
        )}
        {request.status === 'resolved' && (
          <Pressable
            style={styles.reopenBtn}
            onPress={handleNextStatus}
            accessible
            accessibilityRole="button"
          >
            <Text style={styles.reopenBtnText}>{t('maintenance.reopen')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function AddRequestForm({
  onClose,
  reportedBy,
  houseId,
}: {
  onClose: () => void;
  reportedBy: string;
  houseId: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const add = useMaintenanceStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(MAINTENANCE_CATEGORIES[0].label);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = useCallback(async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await add({ title: title.trim(), description: description.trim(), category, status: 'open', reportedBy }, houseId);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('maintenance.failed_save'));
      setIsSaving(false);
    }
  }, [title, description, category, reportedBy, houseId, add, onClose, isSaving, t]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('maintenance.new_request')}</Text>

      <Text style={styles.fieldLabel}>{t('maintenance.category')}</Text>
      <View style={styles.chipRow}>
        {MAINTENANCE_CATEGORIES.map((c) => (
          <Pressable
            key={c.label}
            style={[styles.chip, category === c.label && styles.chipActive]}
            onPress={() => setCategory(c.label)}
          >
            <Text style={styles.chipIcon}>{c.icon}</Text>
            <Text style={[styles.chipText, category === c.label && styles.chipTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>{t('maintenance.issue_label')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('maintenance.issue_placeholder')}
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel={t('maintenance.issue_label')}
        accessibilityHint={t('maintenance.issue_placeholder')}
      />

      <Text style={styles.fieldLabel}>{t('maintenance.details_label')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('maintenance.details_placeholder')}
        placeholderTextColor={colors.textDisabled}
        multiline
        numberOfLines={3}
        accessibilityLabel={t('maintenance.details_label')}
        accessibilityHint={t('maintenance.details_placeholder')}
      />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityState={{ disabled: isSaving }}
        >
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!title.trim() || isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('maintenance.log_issue')}
          accessibilityState={{ disabled: !title.trim() || isSaving }}
        >
          <Text style={styles.saveBtnText}>{isSaving ? t('common.loading') : t('maintenance.log_issue')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function IssuesTab(): React.JSX.Element {
  const { t } = useTranslation();
  const requests = useMaintenanceStore((s) => s.requests);
  const isLoading = useMaintenanceStore((s) => s.isLoading);
  const error = useMaintenanceStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const [showForm, setShowForm] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const open = useMemo(() => requests.filter((r) => r.status !== 'resolved'), [requests]);
  const resolved = useMemo(() => requests.filter((r) => r.status === 'resolved'), [requests]);

  const data = useMemo((): ListItem[] => {
    const items: ListItem[] = open.map((request) => ({ kind: 'open', request }));
    if (resolved.length > 0) {
      items.push({ kind: 'resolved-toggle' });
      if (showResolved) {
        resolved.forEach((request) => items.push({ kind: 'resolved', request }));
      }
    }
    return items;
  }, [open, resolved, showResolved]);

  const myId = profile?.id ?? '';

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'resolved-toggle') {
      return (
        <Pressable style={styles.resolvedToggle} onPress={() => setShowResolved((v) => !v)}>
          <Text style={styles.resolvedToggleText}>
            {showResolved ? '▲' : '▼'} {t('maintenance.resolved_section')} ({resolved.length})
          </Text>
        </Pressable>
      );
    }
    return <RequestCard request={item.request} myId={myId} />;
  }, [showResolved, resolved.length, t, myId]);

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'resolved-toggle') return 'resolved-toggle';
    return item.request.id;
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.scroll}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}
          {showForm ? (
            <AddRequestForm
              onClose={() => setShowForm(false)}
              reportedBy={profile?.id ?? ''}
              houseId={houseId ?? ''}
            />
          ) : (
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.addBtnText}>{t('maintenance.log_new')}</Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        !showForm ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyTitle}>{t('maintenance.no_open')}</Text>
            <Text style={styles.emptyText}>{t('maintenance.no_open_hint')}</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },
  listHeader: { gap: sizes.sm },

  addBtn: {
    borderWidth: 2,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: sizes.md,
    alignItems: 'center',
  },
  addBtnText: { color: colors.primary, ...font.semibold, fontSize: sizes.fontMd },

  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    gap: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  cardResolved: { opacity: 0.65 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
  cardIcon: { fontSize: 24, lineHeight: 30 },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  cardTitleResolved: { textDecorationLine: 'line-through', color: colors.textSecondary },
  cardMeta: { fontSize: sizes.fontXs, ...font.regular, color: colors.textSecondary },
  removeBtn: { padding: 4 },
  removeBtnText: { color: colors.textDisabled, fontSize: sizes.fontSm },
  cardDescription: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, flexWrap: 'wrap' },
  statusBadge: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 4 },
  statusText: { fontSize: sizes.fontXs, ...font.bold },
  advanceBtn: {
    backgroundColor: colors.primary + '15',
    borderRadius: sizes.borderRadiusFull,
    paddingHorizontal: sizes.md,
    paddingVertical: 5,
  },
  advanceBtnText: { color: colors.primary, fontSize: sizes.fontSm, ...font.semibold },
  reopenBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: sizes.borderRadiusFull,
    paddingHorizontal: sizes.md,
    paddingVertical: 4,
  },
  reopenBtnText: { color: colors.textSecondary, fontSize: sizes.fontSm, ...font.regular },

  form: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    gap: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  formTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary, marginBottom: sizes.xs },
  fieldLabel: {
    fontSize: 12,
    ...font.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: sizes.sm,
    paddingVertical: 6,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: sizes.fontSm, ...font.medium, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  input: {
    backgroundColor: colors.background,
    borderRadius: sizes.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: sizes.sm,
    paddingVertical: sizes.sm,
    fontSize: sizes.fontMd,
    color: colors.textPrimary,
    ...font.regular,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: sizes.sm, justifyContent: 'flex-end', marginTop: sizes.xs },
  cancelBtn: {
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textSecondary, ...font.medium },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12 },
  saveBtnDisabled: { backgroundColor: colors.textDisabled },
  saveBtnText: { color: colors.white, ...font.semibold },
  saveError: { color: colors.danger, fontSize: 13, ...font.regular },

  resolvedToggle: { paddingVertical: sizes.sm, alignItems: 'center' },
  resolvedToggleText: { color: colors.textSecondary, fontSize: sizes.fontSm, ...font.medium },

  emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
  emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorBanner: {
    backgroundColor: colors.danger + '15',
    borderRadius: 10,
    padding: sizes.sm,
    borderWidth: 1,
    borderColor: colors.danger + '40',
  },
  errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: colors.danger },
});
