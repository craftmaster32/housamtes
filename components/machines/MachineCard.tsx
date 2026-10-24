import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';
import { remainingMs, type ApplianceKind, type ApplianceSession } from '@stores/appliancesStore';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { MACHINE_META, formatRemaining } from '@components/machines/meta';
import { MachineArt } from '@components/machines/MachineArt';

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

/**
 * One machine as a glance tile: its name, one big answer (Free / time left /
 * Just finished), who's using it in handwriting, and the drawn appliance whose
 * door ring fills as the cycle runs. Start is a paper tag; freeing is red text.
 */
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
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
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
  const who = session ? resolveMemberName(session.startedBy) : '';

  const answer = !inUse
    ? t('machines.free')
    : finished
      ? t('machines.finished')
      : t('machines.time_left', { time: formatRemaining(left) });
  const answerColor = !inUse || finished ? c.success : meta.color;

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface }]}
      accessible={false}
      accessibilityLabel={`${name}. ${answer}`}
    >
      <View style={styles.top}>
        <View style={styles.copy}>
          <View style={styles.labelRow}>
            <Ionicons name={meta.icon} size={15} color={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Text
            style={[styles.big, heading, { color: answerColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {answer}
          </Text>
          {inUse && (
            <Text style={[styles.who, hand, { color: c.textSecondary }]} numberOfLines={2}>
              {finished
                ? t('machines.ready_to_unload')
                : t('machines.in_use_by', { name: mine ? t('common.you') : who })}
              {session?.label ? ` · “${session.label}”` : ''}
            </Text>
          )}
        </View>
        <View pointerEvents="none">
          <MachineArt
            kind={kind}
            progress={finished ? 1 : progress}
            running={inUse}
            color={finished ? c.success : meta.color}
          />
        </View>
      </View>

      {inUse ? (
        <Pressable
          style={({ pressed }) => [styles.link, (pressed || busy) && styles.dim]}
          onPress={() => onStop(kind)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('machines.mark_free')}
        >
          <Text style={[styles.linkText, { color: c.negative }]}>
            {mine && !finished ? t('machines.stop') : t('machines.mark_free')}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.tagRow, busy && styles.dim]} pointerEvents={busy ? 'none' : 'auto'}>
          <PaperTag label={t('machines.start')} onPress={() => onStart(kind)} />
        </View>
      )}
    </View>
  );
}

export const MachineCard = React.memo(MachineCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: ms(22),
    paddingTop: ms(14),
    paddingHorizontal: ms(16),
    paddingBottom: ms(10),
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10) },
  copy: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  label: { fontSize: mf(13.5), ...font.bold, flexShrink: 1 },
  big: { fontSize: mf(32), lineHeight: mf(40), marginTop: ms(4), letterSpacing: -0.5 },
  who: { fontSize: mf(19), lineHeight: mf(22), marginTop: ms(2) },
  tagRow: { flexDirection: 'row', paddingVertical: ms(4), marginTop: ms(2) },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: mf(15), ...font.semibold },
  dim: { opacity: 0.5 },
});
