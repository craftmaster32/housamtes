import { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { PenCross } from '@components/shared/PenCross';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAuthStore } from '@stores/authStore';
import { useVotingStore, type Proposal } from '@stores/votingStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';
import { CardShell } from '@components/dashboard/cards/CardShell';
import { CardLabel } from '@components/dashboard/cards/CardLabel';
import { BallotArt } from '@components/dashboard/art/BallotArt';
import { mf, ms } from '@utils/responsive';

interface VotesCardProps {
  styles: CardStyles;
  c: ColorTokens;
  compact: boolean;
  pinned?: boolean;
}

function myChoice(p: Proposal, myId: string): 'yes' | 'no' | null {
  let choice: 'yes' | 'no' | null = null;
  for (const v of p.votes) if (v.person === myId) choice = v.choice;
  return choice;
}

/**
 * The Votes tile. While there's an open vote you haven't answered, it shows
 * that question with Yes / No ink boxes you can tick right on the tile (like
 * the grocery tile's list); the vote you just cast stays up with your cross.
 * Otherwise it's the usual glance: how many are open, the next question.
 */
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
  const castVote = useVotingStore((s) => s.castVote);
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  // The vote cast from this tile, kept on screen so you see your cross.
  const [justVotedId, setJustVotedId] = useState<string | null>(null);

  const open = proposals.filter((p) => p.isOpen);
  const next = open[0];
  const quick =
    (justVotedId ? open.find((p) => p.id === justVotedId) : undefined) ??
    (myId ? open.find((p) => myChoice(p, myId) === null) : undefined);
  const mine = quick ? myChoice(quick, myId) : null;

  const handleVote = useCallback(
    (choice: 'yes' | 'no'): void => {
      if (!quick || !myId) return;
      setJustVotedId(quick.id);
      castVote(quick.id, myId, choice).catch(() =>
        Alert.alert(t('common.error'), t('voting.vote_error'))
      );
    },
    [quick, myId, castVote, t]
  );

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
      <Text style={[styles.big, headingFont, quick && local.bigTight]}>{open.length}</Text>
      <Text style={styles.sub} numberOfLines={1}>
        {quick ? quick.title : next ? next.title : t('dashboard.votes_none')}
      </Text>
      {quick ? (
        <View style={local.row} accessibilityRole="radiogroup" accessibilityLabel={quick.title}>
          {(['yes', 'no'] as const).map((choice) => {
            const on = mine === choice;
            const label = choice === 'yes' ? t('voting.yes_label') : t('voting.no_label');
            return (
              <Pressable
                key={choice}
                onPress={() => handleVote(choice)}
                hitSlop={ms(4)}
                style={({ pressed }) => [local.choice, pressed && local.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${label}: ${quick.title}`}
              >
                <View
                  style={[styles.groceryBox, { borderColor: on ? c.primary : c.textSecondary }]}
                >
                  <PenCross checked={on} size={ms(24)} color={c.primary} style={local.cross} />
                </View>
                <Text style={[local.word, { color: c.textPrimary }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={rtl ? styles.artRTL : styles.art} pointerEvents="none">
          <BallotArt color={c.primary} width={ms(40)} />
        </View>
      )}
    </CardShell>
  );
}

const local = StyleSheet.create({
  // Room for the boxes: the number sits a little higher while you can vote.
  bigTight: { marginTop: ms(8) },
  row: { flexDirection: 'row', gap: ms(14), marginTop: ms(6) },
  choice: { flexDirection: 'row', alignItems: 'center', gap: ms(7), minHeight: 36 },
  pressed: { opacity: 0.6 },
  cross: { position: 'absolute', left: -ms(4), top: -ms(5) },
  word: { fontSize: mf(14.5), ...font.semibold },
});
