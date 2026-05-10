import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

    pageHeader: { marginBottom: sizes.xs },
    heading: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    headingSub: { fontSize: sizes.fontSm, ...font.regular, color: C.textSecondary, marginTop: 2 },

    addBtn: { borderWidth: 2, borderColor: C.primary + '40', borderStyle: 'dashed', borderRadius: 14, paddingVertical: sizes.md, alignItems: 'center' },
    addBtnText: { color: C.primary, ...font.semibold, fontSize: sizes.fontMd },

    card: { backgroundColor: C.surface, borderRadius: 16, padding: sizes.md, gap: sizes.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    cardResolved: { opacity: 0.65 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
    cardIcon: { fontSize: 24, lineHeight: 30 },
    cardInfo: { flex: 1, gap: 2 },
    cardTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    cardTitleResolved: { textDecorationLine: 'line-through', color: C.textSecondary },
    cardMeta: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },
    removeBtn: { padding: 4 },
    removeBtnText: { color: C.textDisabled, fontSize: sizes.fontSm },
    cardDescription: { fontSize: sizes.fontSm, ...font.regular, color: C.textSecondary, lineHeight: 20 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, flexWrap: 'wrap' },
    statusBadge: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 4 },
    statusText: { fontSize: sizes.fontXs, ...font.bold },
    advanceBtn: { backgroundColor: C.primary + '15', borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.md, paddingVertical: 5 },
    advanceBtnText: { color: C.primary, fontSize: sizes.fontSm, ...font.semibold },
    reopenBtn: { borderWidth: 1, borderColor: C.border, borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.md, paddingVertical: 4 },
    reopenBtnText: { color: C.textSecondary, fontSize: sizes.fontSm, ...font.regular },

    form: { backgroundColor: C.surface, borderRadius: 16, padding: sizes.md, gap: sizes.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    formTitle: { fontSize: 17, ...font.bold, color: C.textPrimary, marginBottom: sizes.xs },
    fieldLabel: { fontSize: 12, ...font.semibold, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: sizes.sm, paddingVertical: 6, borderRadius: sizes.borderRadiusFull, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipIcon: { fontSize: 14 },
    chipText: { fontSize: sizes.fontSm, ...font.medium, color: C.textPrimary },
    chipTextActive: { color: '#fff' },
    input: { backgroundColor: C.background, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: C.border, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd, color: C.textPrimary, ...font.regular },
    inputMultiline: { height: 80, textAlignVertical: 'top' },
    formActions: { flexDirection: 'row', gap: sizes.sm, justifyContent: 'flex-end', marginTop: sizes.xs },
    cancelBtn: { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12, borderWidth: 1, borderColor: C.border },
    cancelBtnText: { color: C.textSecondary, ...font.medium },
    saveBtn: { backgroundColor: C.primary, paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12 },
    saveBtnDisabled: { backgroundColor: C.textDisabled },
    saveBtnText: { color: '#fff', ...font.semibold },
    saveError: { color: C.danger, fontSize: 13, ...font.regular },

    resolvedToggle: { paddingVertical: sizes.sm, alignItems: 'center' },
    resolvedToggleText: { color: C.textSecondary, fontSize: sizes.fontSm, ...font.medium },

    emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
    emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    emptyText: { fontSize: sizes.fontSm, ...font.regular, color: C.textSecondary, textAlign: 'center' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorBanner: { backgroundColor: C.danger + '15', borderRadius: 10, padding: sizes.sm, borderWidth: 1, borderColor: C.danger + '40' },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.danger },
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

function RequestCard({ request, myId }: { request: ReturnType<typeof useMaintenanceStore.getState>['requests'][0]; myId: string }): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const housemates = useHousematesStore((s) => s.housemates);
  const updateStatus = useMaintenanceStore((s) => s.updateStatus);
  const remove = useMaintenanceStore((s) => s.remove);
  const category = MAINTENANCE_CATEGORIES.find((c) => c.label === request.category);

  const handleNextStatus = useCallback(() => {
    updateStatus(request.id, NEXT_STATUS[request.status]);
  }, [request.id, request.status, updateStatus]);

  const handleRemove = useCallback(() => remove(request.id), [request.id, remove]);

  return (
    <View style={[styles.card, request.status === 'resolved' && styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{category?.icon ?? '📝'}</Text>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, request.status === 'resolved' && styles.cardTitleResolved]}>
            {request.title}
          </Text>
          <Text style={styles.cardMeta}>
            {request.category} · {t('maintenance.reported_by', { name: resolveName(request.reportedBy, housemates) })} · {timeAgo(request.createdAt)}
          </Text>
        </View>
        {request.reportedBy === myId && (
          <Pressable onPress={handleRemove} style={styles.removeBtn}>
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
          <Pressable style={styles.advanceBtn} onPress={handleNextStatus}>
            <Text style={styles.advanceBtnText}>
              {request.status === 'open' ? t('maintenance.mark_in_progress') : t('maintenance.mark_resolved')}
            </Text>
          </Pressable>
        )}
        {request.status === 'resolved' && (
          <Pressable style={styles.reopenBtn} onPress={handleNextStatus}>
            <Text style={styles.reopenBtnText}>{t('maintenance.reopen')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function AddRequestForm({ onClose, reportedBy, houseId }: { onClose: () => void; reportedBy: string; houseId: string }): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
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
        placeholderTextColor={C.textDisabled}
      />

      <Text style={styles.fieldLabel}>{t('maintenance.details_label')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('maintenance.details_placeholder')}
        placeholderTextColor={C.textDisabled}
        multiline
        numberOfLines={3}
      />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? t('common.loading') : t('maintenance.log_issue')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

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
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.scroll}>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View style={styles.pageHeader}>
            <Text style={styles.heading}>{t('maintenance.title')}</Text>
            <Text style={styles.headingSub}>{t('maintenance.subtitle')}</Text>
          </View>

          {showForm ? (
            <AddRequestForm onClose={() => setShowForm(false)} reportedBy={profile?.id ?? ''} houseId={houseId ?? ''} />
          ) : (
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.addBtnText}>{t('maintenance.log_new')}</Text>
            </Pressable>
          )}

          {open.length === 0 && !showForm && (
            <View style={styles.emptySection}>
              <Text style={styles.emptyTitle}>{t('maintenance.no_open')}</Text>
              <Text style={styles.emptyText}>{t('maintenance.no_open_hint')}</Text>
            </View>
          )}

          {open.map((r) => <RequestCard key={r.id} request={r} myId={profile?.id ?? ''} />)}

          {resolved.length > 0 && (
            <>
              <Pressable style={styles.resolvedToggle} onPress={() => setShowResolved((v) => !v)}>
                <Text style={styles.resolvedToggleText}>
                  {showResolved ? '▲' : '▼'} {t('maintenance.resolved_section')} ({resolved.length})
                </Text>
              </Pressable>
              {showResolved && resolved.map((r) => <RequestCard key={r.id} request={r} myId={profile?.id ?? ''} />)}
            </>
          )}

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
