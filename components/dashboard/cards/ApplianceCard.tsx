import { useEffect, useState } from 'react';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAppliancesStore, type ApplianceKind } from '@stores/appliancesStore';
import { useHousematesStore } from '@stores/housematesStore';
import { MACHINE_META, formatRemaining } from '@components/machines/meta';
import { resolveName } from '@utils/housemates';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';
import { CardShell } from '@components/dashboard/cards/CardShell';
import { CardLabel } from '@components/dashboard/cards/CardLabel';

interface ApplianceCardProps {
  styles: CardStyles;
  kind: ApplianceKind;
  pinned?: boolean;
}

export function ApplianceCard({
  styles,
  kind,
  pinned = false,
}: ApplianceCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const headingFont = useHeadingFont('semibold');
  const session = useAppliancesStore((s) => s.sessions[kind]);
  const housemates = useHousematesStore((s) => s.housemates);
  const meta = MACHINE_META[kind];
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Tick the countdown only while this machine is actually running.
  useEffect(() => {
    if (!session) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return (): void => clearInterval(id);
  }, [session]);

  const left = session ? Math.max(0, new Date(session.endsAt).getTime() - nowMs) : 0;
  const running = session !== null && left > 0;
  const who = session ? resolveName(session.startedBy, housemates, t('common.unknown')) : '';

  return (
    <CardShell
      styles={styles}
      pinned={pinned}
      onPress={() => navigateToBase('/(tabs)/machines')}
      accessibilityLabel={t(meta.labelKey)}
    >
      <CardLabel styles={styles} icon={meta.icon} label={t(meta.labelKey)} pinned={pinned} />
      <Text
        style={[styles.big, headingFont, session ? { color: meta.color } : undefined]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {!session ? t('machines.free') : running ? formatRemaining(left) : t('machines.finished')}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {!session
          ? t('machines.tap_to_start')
          : running
            ? t('machines.in_use_by', { name: who })
            : t('machines.ready_to_unload')}
      </Text>
    </CardShell>
  );
}
