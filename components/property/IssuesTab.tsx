import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import {
  useMaintenanceStore,
  type MaintenanceRequest,
  MAINTENANCE_CATEGORIES,
  STATUS_LABELS,
  STATUS_COLORS,
  NEXT_STATUS,
  type MaintenanceStatus,
} from '@stores/maintenanceStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

// Categories carry an emoji in the store; render a line icon here so the page
// speaks one visual language (no emoji beside icons).
const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  Plumbing: 'water-outline',
  Electrical: 'flash-outline',
  Appliance: 'construct-outline',
  Structure: 'business-outline',
  Pest: 'bug-outline',
  Other: 'document-text-outline',
};
function categoryIcon(label: string): React.ComponentProps<typeof Ionicons>['name'] {
  return CATEGORY_ICONS[label] ?? 'document-text-outline';
}

function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.days_ago', { count: days });
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: MaintenanceStatus }): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

type ListItem =
  | { kind: 'open'; request: MaintenanceRequest }
  | { kind: 'resolved-toggle' }
  | { kind: 'resolved'; request: MaintenanceRequest };

interface RequestCardProps {
  request: MaintenanceRequest;
  myId: string;
}

function RequestCard({ request, myId }: RequestCardProps): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const updateStatus = useMaintenanceStore((s) => s.updateStatus);
  const remove = useMaintenanceStore((s) => s.remove);

  const handleNextStatus = useCallback(() => {
    void updateStatus(request.id, NEXT_STATUS[request.status]);
  }, [request.id, request.status, updateStatus]);

  const handleRemove = useCallback(() => {
    void remove(request.id);
  }, [request.id, remove]);

  return (
    <View style={[styles.card, request.status === 'resolved' && styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIcon,
            {
              backgroundColor:
                request.status === 'resolved' ? c.surfaceSecondary : c.primary + '18',
            },
          ]}
        >
          <Ionicons
            name={categoryIcon(request.category)}
            size={19}
            color={request.status === 'resolved' ? c.textTertiary : c.primary}
          />
        </View>
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
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Ionicons name="close" size={18} color={c.textTertiary} />
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
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
      await add(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          status: 'open',
          reportedBy,
        },
        houseId
      );
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('maintenance.failed_save')));
      setIsSaving(false);
    }
  }, [title, description, category, reportedBy, houseId, add, onClose, isSaving, t]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('maintenance.new_request')}</Text>

      <Text style={styles.fieldLabel}>{t('maintenance.category')}</Text>
      <View style={styles.chipRow}>
        {MAINTENANCE_CATEGORIES.map((cat) => {
          const active = category === cat.label;
          return (
            <Pressable
              key={cat.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(cat.label)}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={cat.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={categoryIcon(cat.label)}
                size={14}
                color={active ? '#fff' : c.textSecondary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>{t('maintenance.issue_label')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('maintenance.issue_placeholder')}
        placeholderTextColor={c.textDisabled}
        accessibilityLabel={t('maintenance.issue_label')}
        accessibilityHint={t('maintenance.issue_placeholder')}
      />

      <Text style={styles.fieldLabel}>{t('maintenance.details_label')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('maintenance.details_placeholder')}
        placeholderTextColor={c.textDisabled}
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
          <Text style={styles.saveBtnText}>
            {isSaving ? t('common.loading') : t('maintenance.log_issue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function IssuesTab(): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'resolved-toggle') {
        return (
          <Pressable
            style={styles.resolvedToggle}
            onPress={() => setShowResolved((v) => !v)}
            accessible
            accessibilityRole="button"
            accessibilityState={{ expanded: showResolved }}
          >
            <Ionicons
              name={showResolved ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={c.textSecondary}
            />
            <Text style={styles.resolvedToggleText}>
              {t('maintenance.resolved_section')} ({resolved.length})
            </Text>
          </Pressable>
        );
      }
      return <RequestCard request={item.request} myId={myId} />;
    },
    [showResolved, resolved.length, t, myId, styles, c]
  );

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

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },
    listHeader: { gap: sizes.sm },

    addBtn: {
      borderWidth: 2,
      borderColor: C.primary + '40',
      borderStyle: 'dashed',
      borderRadius: 14,
      paddingVertical: sizes.md,
      alignItems: 'center',
    },
    addBtnText: { color: C.primary, ...font.semibold, fontSize: sizes.fontMd },

    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.md,
      gap: sizes.sm,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    } as never,
    cardResolved: { opacity: 0.65 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    cardIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardInfo: { flex: 1, gap: 2 },
    cardTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    cardTitleResolved: { textDecorationLine: 'line-through', color: C.textSecondary },
    cardMeta: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },
    removeBtn: {
      padding: 4,
      minWidth: 30,
      minHeight: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
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

    form: {
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.md,
      gap: sizes.sm,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    } as never,
    formTitle: { fontSize: 17, ...font.bold, color: C.textPrimary, marginBottom: sizes.xs },
    fieldLabel: {
      fontSize: 12,
      ...font.semibold,
      color: C.textSecondary,
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
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: sizes.fontSm, ...font.medium, color: C.textPrimary },
    chipTextActive: { color: '#fff' },
    input: {
      backgroundColor: C.background,
      borderRadius: sizes.borderRadiusSm,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: sizes.sm,
      paddingVertical: sizes.sm,
      fontSize: sizes.fontMd,
      color: C.textPrimary,
      ...font.regular,
    },
    inputMultiline: { height: 80, textAlignVertical: 'top' },
    formActions: {
      flexDirection: 'row',
      gap: sizes.sm,
      justifyContent: 'flex-end',
      marginTop: sizes.xs,
    },
    cancelBtn: {
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    cancelBtnText: { color: C.textSecondary, ...font.medium },
    saveBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
    },
    saveBtnDisabled: { backgroundColor: C.textDisabled },
    saveBtnText: { color: '#fff', ...font.semibold },
    saveError: { color: C.danger, fontSize: 13, ...font.regular },

    resolvedToggle: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: sizes.sm,
      alignItems: 'center',
      justifyContent: 'center',
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorBanner: {
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: sizes.sm,
      borderWidth: 1,
      borderColor: C.danger + '40',
    },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.danger },
  });
