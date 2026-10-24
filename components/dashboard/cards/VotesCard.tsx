import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useVotingStore } from '@stores/votingStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { type ColorTokens } from '@constants/colors';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';
import { CardShell } from '@components/dashboard/cards/CardShell';
import { CardLabel } from '@components/dashboard/cards/CardLabel';
import { BallotArt } from '@components/dashboard/art/BallotArt';
import { ms } from '@utils/responsive';

interface VotesCardProps {
  styles: CardStyles;
  c: ColorTokens;
  compact: boolean;
  pinned?: boolean;
}

export function VotesCard({
  styles,
  c,
  compact,
  pinned = false,
}: VotesCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const headingFont = useHeadingFont('semibold');
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const proposals = useVotingStore((s) => s.proposals);
  const open = proposals.filter((p) => p.isOpen);
  const next = open[0];
  return (
    <CardShell
      styles={styles}
      pinned={pinned}
      onPress={() => navigateToBase('/(tabs)/voting')}
      accessibilityLabel={t('dashboard.votes_label')}
    >
      <CardLabel
        styles={styles}
        icon="people-outline"
        label={t('dashboard.votes_label')}
        meta={compact ? undefined : t('dashboard.votes_open', { count: open.length })}
        pinned={pinned}
      />
      <Text style={[styles.big, headingFont]}>{open.length}</Text>
      <Text style={styles.sub} numberOfLines={1}>
        {next ? next.title : t('dashboard.votes_none')}
      </Text>
      <View style={rtl ? styles.artRTL : styles.art} pointerEvents="none">
        <BallotArt color={c.primary} width={ms(40)} />
      </View>
    </CardShell>
  );
}
