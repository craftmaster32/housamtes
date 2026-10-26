import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { type MatePropKind } from '@components/shared/MateProp';
import { MateCameoPose, type CameoPose } from '@components/shared/MateCameoPose';
import { mf, ms } from '@utils/responsive';

export type CameoPage = 'photos' | 'bills' | 'tasks' | 'parking' | 'voting' | 'notes' | 'grocery';

const PROP_FOR: Record<CameoPage, MatePropKind> = {
  photos: 'camera',
  bills: 'receipt',
  tasks: 'broom',
  parking: 'car',
  voting: 'ballot',
  notes: 'pin',
  grocery: 'bag',
};
const LINES_PER_PAGE = 8;
// Lines 1–4 are said holding the page's thing; each later line has its own scene.
const POSE_FOR_LINE: Record<number, CameoPose> = {
  5: 'fallen',
  6: 'sleeping',
  7: 'peek',
  8: 'upside',
};
// Mate turns up on roughly half the visits, so he stays a small surprise.
const SHOW_CHANCE = 0.55;

interface MateCameoProps {
  page: CameoPage;
}

/**
 * Mate at the very end of a list in a little scene — holding something from
 * the page (a camera on Photos, a broom on Tasks…), fallen over, asleep,
 * peeking in from the edge or hanging upside down — with a one-line joke. He only shows
 * sometimes, sits below everything, and can't be tapped — never in the way.
 * Use it only where the page doesn't already show Mate (e.g. not with an empty
 * state), so there's still at most one Mate per screen.
 */
export function MateCameo({ page }: MateCameoProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const [line] = useState<number | null>(() =>
    Math.random() < SHOW_CHANCE ? 1 + Math.floor(Math.random() * LINES_PER_PAGE) : null
  );
  if (line === null) return null;
  const pose = POSE_FOR_LINE[line] ?? 'hold';
  const say = (
    <Text style={[styles.say, hand, { color: c.textSecondary }]} numberOfLines={2}>
      {t(`mate.${page}_${line}`)}
    </Text>
  );
  const figure = <MateCameoPose pose={pose} prop={PROP_FOR[page]} size={ms(48)} />;
  return (
    <View
      style={[styles.wrap, pose === 'peek' && styles.peekWrap]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pose === 'peek' ? (
        <>
          {say}
          {figure}
        </>
      ) : (
        <>
          {figure}
          {say}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    paddingTop: ms(28),
    paddingBottom: ms(12),
    paddingHorizontal: ms(16),
  },
  // Peeking: he sits right at the screen's edge, half out of view.
  peekWrap: { justifyContent: 'flex-end', paddingEnd: 0 },
  say: {
    flexShrink: 1,
    maxWidth: ms(230),
    fontSize: mf(19),
    lineHeight: mf(23),
    transform: [{ rotate: '-1.5deg' }],
  },
});
