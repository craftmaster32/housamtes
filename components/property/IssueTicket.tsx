import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import {
  useMaintenanceStore,
  MAINTENANCE_CATEGORIES,
  NEXT_STATUS,
  type MaintenanceRequest,
  type MaintenanceStatus,
} from '@stores/maintenanceStore';
import { resolveName } from '@utils/housemates';
import { categoryLabel, statusLabel } from '@utils/propertyLabels';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { PenCircle } from '@components/shared/PenCircle';
import { Stamp } from '@components/shared/Stamp';
import { mf, ms } from '@utils/responsive';

// A repair job ticket: yellow carbon paper, light inks in both themes.
const P = lightColors;
const TICKET = '#FFF3C9';
const STEPS: MaintenanceStatus[] = ['open', 'in_progress', 'resolved'];
const HOLES = 16;

export function statusColor(status: MaintenanceStatus): string {
  return status === 'open' ? P.negative : status === 'in_progress' ? P.warning : P.positive;
}

function timeAgo(
  iso: string,
  t: (key: string, o?: Record<string, unknown>) => string,
  lang: string
): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.days_ago', { count: days, n: days });
  const locale = lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

interface IssueTicketProps {
  request: MaintenanceRequest;
  myId: string;
}

/**
 * One maintenance issue as a job ticket torn off a pad: the category, the
 * problem in Fraunces, who reported it in handwriting, and the job's progress
 * Open · In progress · Resolved with the current step circled in pen.
 */
function IssueTicketComponent({ request, myId }: IssueTicketProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const housemates = useHousematesStore((s) => s.housemates);
  const updateStatus = useMaintenanceStore((s) => s.updateStatus);
  const remove = useMaintenanceStore((s) => s.remove);
  const resolved = request.status === 'resolved';
  const icon =
    MAINTENANCE_CATEGORIES.find((m) => m.label === request.category)?.icon ??
    'document-text-outline';

  const handleNext = useCallback((): void => {
    void updateStatus(request.id, NEXT_STATUS[request.status]);
  }, [request.id, request.status, updateStatus]);

  const handleRemove = useCallback((): void => {
    void remove(request.id);
  }, [request.id, remove]);

  return (
    <View style={styles.ticket}>
      {/* Torn perforation along the top: holes in the page colour. */}
      <View style={styles.perf} pointerEvents="none">
        {Array.from({ length: HOLES }, (_, i) => (
          <View key={i} style={[styles.hole, { backgroundColor: c.background }]} />
        ))}
      </View>

      <View style={styles.head}>
        <View style={styles.cat}>
          <Ionicons name={icon} size={14} color={P.paperMuted} />
          <Text style={styles.catText}>{categoryLabel(t, request.category)}</Text>
        </View>
        {request.reportedBy === myId && (
          <Pressable
            onPress={handleRemove}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Ionicons name="close" size={18} color={P.paperMuted} />
          </Pressable>
        )}
      </View>

      <Text style={[styles.title, heading]}>{request.title}</Text>
      <Text style={[styles.meta, hand]}>
        {t('maintenance.reported_by', { name: resolveName(request.reportedBy, housemates) })} ·{' '}
        {timeAgo(request.createdAt, t, i18n.language)}
      </Text>
      {request.description ? <Text style={styles.description}>{request.description}</Text> : null}

      <View style={styles.rule} />
      <View style={styles.foot}>
        <View style={styles.steps} accessibilityLabel={statusLabel(t, request.status)}>
          {STEPS.map((s, i) => {
            const on = s === request.status;
            return (
              <View key={s} style={styles.stepWrap}>
                {i > 0 && <Text style={styles.dot}>·</Text>}
                <View style={styles.step}>
                  {on && !resolved && (
                    <PenCircle color={statusColor(s)} style={styles.ring} strokeWidth={2} />
                  )}
                  <Text
                    style={[styles.stepText, on && { color: statusColor(s) }, on && styles.stepOn]}
                  >
                    {statusLabel(t, s)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <Pressable
        style={styles.link}
        onPress={handleNext}
        accessibilityRole="button"
        accessibilityLabel={
          resolved
            ? t('maintenance.reopen')
            : request.status === 'open'
              ? t('maintenance.mark_in_progress')
              : t('maintenance.mark_resolved')
        }
      >
        <Text style={[styles.linkText, { color: P.primary }]}>
          {resolved
            ? t('maintenance.reopen')
            : request.status === 'open'
              ? t('maintenance.mark_in_progress')
              : t('maintenance.mark_resolved')}
        </Text>
      </Pressable>

      {resolved && (
        <View style={styles.stamp} pointerEvents="none">
          <Stamp color={P.positive} big>
            {statusLabel(t, 'resolved')}
          </Stamp>
        </View>
      )}
    </View>
  );
}

export const IssueTicket = React.memo(IssueTicketComponent);

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: TICKET,
    borderRadius: ms(3),
    paddingHorizontal: ms(18),
    paddingTop: ms(14),
    paddingBottom: ms(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  perf: {
    position: 'absolute',
    top: -ms(4),
    left: ms(8),
    right: ms(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hole: { width: ms(8), height: ms(8), borderRadius: ms(4) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cat: { flexDirection: 'row', alignItems: 'center', gap: ms(5), minHeight: 28 },
  catText: { fontSize: mf(12.5), ...font.bold, color: P.paperMuted },
  remove: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: -ms(10),
  },
  title: { fontSize: mf(20), lineHeight: mf(26), color: P.paperInk, letterSpacing: -0.3 },
  meta: { fontSize: mf(18), lineHeight: mf(21), color: P.paperMuted, marginTop: ms(2) },
  description: {
    fontSize: mf(14.5),
    lineHeight: mf(21),
    ...font.regular,
    color: P.paperInk,
    marginTop: ms(8),
  },
  rule: { height: 1.5, backgroundColor: 'rgba(107,98,80,0.22)', marginTop: ms(12) },
  foot: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  steps: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  step: { paddingHorizontal: ms(7), paddingVertical: ms(6) },
  ring: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    transform: [{ rotate: '-4deg' }],
  },
  stepText: { fontSize: mf(13.5), ...font.medium, color: P.paperMuted },
  stepOn: { ...font.bold },
  dot: { fontSize: mf(14), color: P.paperMuted },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: mf(14.5), ...font.semibold },
  stamp: { position: 'absolute', end: ms(16), bottom: ms(14) },
});
