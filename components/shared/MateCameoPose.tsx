import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { useThemedColors, lightColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { Mate } from '@components/shared/Mate';
import { MateProp, type MatePropKind } from '@components/shared/MateProp';
import { mf } from '@utils/responsive';

export type CameoPose = 'hold' | 'fallen' | 'sleeping' | 'peek' | 'upside';

interface MateCameoPoseProps {
  pose: CameoPose;
  prop: MatePropKind;
  /** Mate's drawn size. */
  size: number;
  /** Tapping Mate (he reacts) also calls this, e.g. to say a new line. */
  onTap?: () => void;
}

/** Little stars circling a dizzy head. */
function Dizzy({ size, color }: { size: number; color: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 40 20" fill="none">
      {[6, 20, 34].map((x, i) => (
        <Path
          key={x}
          d={`M${x} ${i === 1 ? 4 : 9} l1.6 3.4 3.6 .4 -2.7 2.4 .8 3.6 -3.3 -1.9 -3.3 1.9 .8 -3.6 -2.7 -2.4 3.6 -.4 Z`}
          fill={color}
        />
      ))}
    </Svg>
  );
}

/**
 * Mate in one of his little situations at the end of a list: holding the
 * page's thing, fallen over (seeing stars), asleep (z z Z), peeking in from
 * the edge, or hanging upside down on a string. Tap him and he reacts.
 */
export function MateCameoPose({ pose, prop, size, onTap }: MateCameoPoseProps): React.JSX.Element {
  const c = useThemedColors();
  const hand = useHandFont();
  const propSize = size * 0.54;
  const thing = (
    <MateProp
      kind={prop}
      size={propSize}
      ink={lightColors.paperInk}
      stroke={c.textPrimary}
      paper="#FBF3D3"
      accent={c.primary}
    />
  );

  if (pose === 'fallen') {
    // On his side, roof to the end, seeing stars; the thing he held landed nearby.
    return (
      <View style={{ width: size * 1.7, height: size * 1.05 }}>
        <View style={[styles.abs, { start: 0, bottom: 0, transform: [{ rotate: '-28deg' }] }]}>
          {thing}
        </View>
        <View style={[styles.abs, { start: size * 0.55, bottom: -size * 0.08 }, styles.onSide]}>
          <Mate size={size} wave={false} onTap={onTap} />
        </View>
        <View style={[styles.abs, { start: size * 0.7, top: 0 }]}>
          <Dizzy size={size * 0.75} color="#E8B23A" />
        </View>
      </View>
    );
  }

  if (pose === 'sleeping') {
    return (
      <View style={{ width: size * 1.55, height: size * 1.15 }}>
        <View style={[styles.abs, { start: 0, bottom: 0, transform: [{ rotate: '-7deg' }] }]}>
          <Mate size={size} wave={false} asleep onTap={onTap} />
        </View>
        <Text style={[styles.abs, styles.zzz, hand, { color: c.textSecondary, end: 0, top: 0 }]}>
          z z Z
        </Text>
        <View
          style={[
            styles.abs,
            { end: size * 0.05, bottom: 0, transform: [{ rotate: '80deg' }, { scale: 0.8 }] },
          ]}
        >
          {thing}
        </View>
      </View>
    );
  }

  if (pose === 'peek') {
    // Only his front half shows, leaning in from the screen's edge.
    return (
      <View style={[styles.clip, { width: size * 0.72, height: size * 1.1 }]}>
        <View style={[styles.abs, { start: 0, top: size * 0.12 }, styles.lean]}>
          <Mate size={size} onTap={onTap} />
        </View>
      </View>
    );
  }

  if (pose === 'upside') {
    // Hanging from a string, upside down, the thing dangling from his arm.
    return (
      <View style={{ width: size * 1.35, height: size * 1.45 }}>
        <View
          style={[
            styles.abs,
            styles.string,
            { start: size * 0.5, top: 0, height: size * 0.5, backgroundColor: c.textSecondary },
          ]}
        />
        <View style={[styles.abs, { start: 0, top: size * 0.4 }, styles.flip]}>
          <Mate size={size} wave={false} onTap={onTap} />
        </View>
        <View style={[styles.abs, { end: 0, bottom: 0, transform: [{ rotate: '160deg' }] }]}>
          {thing}
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: size * 1.33, height: size }}>
      <Mate size={size} onTap={onTap} />
      <View style={[styles.abs, styles.held, { end: -size * 0.04, top: -size * 0.2 }]}>
        {thing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  onSide: { transform: [{ rotate: '90deg' }] },
  lean: { transform: [{ rotate: '-14deg' }] },
  flip: { transform: [{ rotate: '180deg' }] },
  held: { transform: [{ rotate: '12deg' }] },
  clip: { overflow: 'hidden' },
  string: { width: 1.5 },
  zzz: { fontSize: mf(18), lineHeight: mf(22) },
});
