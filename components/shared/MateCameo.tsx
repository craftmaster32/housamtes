import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, lightColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { Mate } from '@components/shared/Mate';
import { MateProp, type MatePropKind } from '@components/shared/MateProp';
import { mf, ms } from '@utils/responsive';

export type CameoPage = 'photos' | 'bills' | 'tasks' | 'parking' | 'voting' | 'notes';

const PROP_FOR: Record<CameoPage, MatePropKind> = {
  photos: 'camera',
  bills: 'receipt',
  tasks: 'broom',
  parking: 'car',
  voting: 'ballot',
  notes: 'pin',
};
const LINES_PER_PAGE = 4;
// Mate turns up on roughly half the visits, so he stays a small surprise.
const SHOW_CHANCE = 0.55;

interface MateCameoProps {
  page: CameoPage;
}

/**
 * Mate at the very end of a list, holding something from the page (a camera on
 * Photos, a broom on Tasks…) with a one-line joke in handwriting. He only shows
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
  const size = ms(48);
  return (
    <View
      style={styles.wrap}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.mate, { width: size + ms(16), height: size }]}>
        <Mate size={size} />
        <View style={styles.prop}>
          <MateProp
            kind={PROP_FOR[page]}
            size={ms(26)}
            ink={lightColors.paperInk}
            stroke={c.textPrimary}
            paper="#FBF3D3"
            accent={c.primary}
          />
        </View>
      </View>
      <Text style={[styles.say, hand, { color: c.textSecondary }]} numberOfLines={2}>
        {t(`mate.${page}_${line}`)}
      </Text>
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
  mate: { position: 'relative' },
  prop: { position: 'absolute', end: -ms(2), top: -ms(10), transform: [{ rotate: '12deg' }] },
  say: {
    flexShrink: 1,
    maxWidth: ms(230),
    fontSize: mf(19),
    lineHeight: mf(23),
    transform: [{ rotate: '-1.5deg' }],
  },
});
