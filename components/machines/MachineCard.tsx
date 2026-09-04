import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { mf, ms } from '@utils/responsive';
import { remainingMs, type ApplianceKind, type ApplianceSession } from '@stores/appliancesStore';
import { MACHINE_META, formatRemaining } from './meta';

interface MachineCardProps {
  kind: ApplianceKind;
  session: ApplianceSession | null;
  now: Date;
  myId: string;
  resolveMemberName: (id: string) => string;
  onStart: (kind: ApplianceKind) => void;
  onStop: (kind: ApplianceKind) => void;
  busy: boolean;
}

function MachineCardComponent({
  kind,
  session,
  now,
  myId,
  resolveMemberName,
  onStart,
  onStop,
  busy,
}: MachineCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const meta = MACHINE_META[kind];
  const name = t(meta.labelKey);
  const inUse = session !== null;
  const mine = session?.startedBy === myId;

  const total = session
    ? new Date(session.endsAt).getTime() - new Date(session.startedAt).getTime()
    : 0;
  const left = remainingMs(session, now);
  // Clamp to [0,1] — a cycle can overrun its estimate before the cron closes it.
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 0;
  const finished = inUse && left === 0;

  const statusColor = inUse ? (finished ? c.success : meta.color) : c.success;
  const who = session ? resolveMemberName(session.startedBy) : '';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: meta.color + '1F' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.status, { color: statusColor }]} numberOfLines={1}>
            {!inUse
              ? t('machines.free')
              : finished
                ? t('machines.finished')
                : t('machines.in_use_by', { name: mine ? t('common.you') : who })}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: inUse ? meta.color + '18' : c.successTint }]}>
          <Text style={[styles.pillText, { color: inUse ? meta.color : c.success }]}>
            {inUse ? t('machines.running_pill') : t('machines.free_pill')}
          </Text>
        </View>
      </View>

      {inUse ? (
        <View style={styles.body}>
          <View style={styles.countdownRow}>
            <Ionicons
              name={finished ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={finished ? c.success : c.textSecondary}
            />
            <Text style={[styles.countdown, { color: finished ? c.success : c.textPrimary }]}>
              {finished
                ? t('machines.ready_to_unload')
                : t('machines.time_left', { time: formatRemaining(left) })}
            </Text>
          </View>
          {!!session?.label && (
            <Text style={styles.label} numberOfLines={1}>
              {session.label}
            </Text>
          )}
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(progress * 100)}%`, backgroundColor: meta.color },
              ]}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.stopBtn,
              { borderColor: c.border },
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={() => onStop(kind)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('machines.mark_free')}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={c.textPrimary} />
            <Text style={styles.stopText}>
              {mine ? t('machines.stop') : t('machines.mark_free')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.startBtn,
            { backgroundColor: meta.color },
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
          onPress={() => onStart(kind)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('machines.start_machine', { name })}
        >
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={styles.startText}>{t('machines.start')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export const MachineCard = React.memo(MachineCardComponent);

const makeStyles = (c: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    card: {
      borderRadius: ms(18),
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: ms(16),
      gap: ms(14),
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: ms(11) },
    iconChip: {
      width: ms(40),
      height: ms(40),
      borderRadius: ms(12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headText: { flex: 1, minWidth: 0 },
    name: { fontSize: mf(15.5), ...font.bold, color: c.textPrimary },
    status: { fontSize: mf(12.5), ...font.medium, marginTop: ms(1) },
    pill: {
      paddingHorizontal: ms(9),
      paddingVertical: ms(4),
      borderRadius: sizes.borderRadiusFull,
    },
    pillText: { fontSize: mf(10.5), ...font.bold, letterSpacing: 0.4 },

    body: { gap: ms(9) },
    countdownRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
    countdown: { fontSize: mf(15), ...font.bold },
    label: { fontSize: mf(12.5), ...font.regular, color: c.textSecondary },
    track: {
      height: ms(7),
      borderRadius: ms(4),
      backgroundColor: c.surfaceSecondary,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: ms(4) },

    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(7),
      paddingVertical: ms(12),
      borderRadius: ms(13),
    },
    startText: { fontSize: mf(14.5), ...font.bold, color: '#fff' },
    stopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(7),
      paddingVertical: ms(11),
      borderRadius: ms(13),
      borderWidth: 1,
    },
    stopText: { fontSize: mf(14), ...font.semibold, color: c.textPrimary },
    pressed: { opacity: 0.9 },
    disabled: { opacity: 0.5 },
  });
