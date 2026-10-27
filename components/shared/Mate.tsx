import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { MateDrawing } from '@components/shared/MateDrawing';
import { ms } from '@utils/responsive';

const BLINK_EVERY_MS = 4200;
const BLINK_FOR_MS = 140;
const WAVE_DELAY_MS = 500;
const WAVE_MS = 1000;
const REACT_MS = 650;

type Reaction = 'wave' | 'hop' | 'wiggle' | 'happy';
const REACTIONS: readonly Reaction[] = ['wave', 'hop', 'wiggle', 'happy'];

interface MateProps {
  size?: number;
  /** Wave hello once when he appears. Skipped when Reduce Motion is on. */
  wave?: boolean;
  /** Tapping him makes him do a little something. On by default. */
  tappable?: boolean;
  /** Called after he reacts to a tap (e.g. to say a new line). */
  onTap?: () => void;
}

// Wave: a few decaying swings of the arm, like a quick "hi!".
function waveAngle(t: number): number {
  return -16 * Math.sin(t * Math.PI * 3) * (1 - t);
}

interface Pose {
  armAngle: number;
  hop: number;
  tilt: number;
  happy: boolean;
}

const REST: Pose = { armAngle: 0, hop: 0, tilt: 0, happy: false };

// One frame of a tap reaction, t from 0 to 1.
function reactionPose(kind: Reaction, t: number, size: number): Pose {
  if (kind === 'wave') return { ...REST, armAngle: waveAngle(t) };
  if (kind === 'hop') return { ...REST, hop: -size * 0.22 * Math.sin(t * Math.PI) };
  if (kind === 'wiggle') return { ...REST, tilt: 12 * Math.sin(t * Math.PI * 4) * (1 - t) };
  return { ...REST, happy: t < 0.9, hop: -size * 0.06 * Math.sin(t * Math.PI * 2) };
}

/**
 * Mate on the home screen: waves once when he appears and blinks now and then.
 * Tap him and he waves, hops, wiggles or smiles with his eyes shut.
 * Driven by requestAnimationFrame + state, not reanimated — reanimated's
 * animations don't run on this app's web build (see Entrance.tsx).
 */
export function Mate({
  size = 68,
  wave = true,
  tappable = true,
  onTap,
}: MateProps): React.JSX.Element {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const [pose, setPose] = useState<Pose>(REST);
  const [eyesClosed, setEyesClosed] = useState(false);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastReaction = useRef<Reaction | null>(null);

  const play = useCallback((frame: (t: number) => Pose, duration: number, delay = 0): void => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    const begin = Date.now() + delay;
    const loop = (): void => {
      const now = Date.now();
      if (now >= begin) {
        const t = Math.min(1, (now - begin) / duration);
        setPose(t >= 1 ? REST : frame(t));
        if (t >= 1) return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (wave && !reduceMotion) {
      play((t) => ({ ...REST, armAngle: waveAngle(t) }), WAVE_MS, WAVE_DELAY_MS);
    }
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [wave, reduceMotion, play]);

  // A blink every few seconds keeps him alive without drawing the eye.
  useEffect(() => {
    if (reduceMotion) return;
    let reopen: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setEyesClosed(true);
      reopen = setTimeout(() => setEyesClosed(false), BLINK_FOR_MS);
    }, BLINK_EVERY_MS);
    return (): void => {
      clearInterval(id);
      if (reopen) clearTimeout(reopen);
    };
  }, [reduceMotion]);

  const handlePress = useCallback((): void => {
    // Never the same trick twice in a row.
    const choices = REACTIONS.filter((r) => r !== lastReaction.current);
    const kind = choices[Math.floor(Math.random() * choices.length)];
    lastReaction.current = kind;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!reduceMotion) play((p) => reactionPose(kind, p, size), REACT_MS);
    onTap?.();
  }, [play, reduceMotion, size, onTap]);

  const drawing = (
    <View style={{ transform: [{ translateY: pose.hop }, { rotate: `${pose.tilt}deg` }] }}>
      <MateDrawing size={size} armAngle={pose.armAngle} eyesClosed={eyesClosed || pose.happy} />
    </View>
  );

  if (!tappable) {
    return (
      <View testID="mate" accessible accessibilityRole="image" accessibilityLabel="Mate">
        {drawing}
      </View>
    );
  }

  return (
    <Pressable
      testID="mate"
      onPress={handlePress}
      hitSlop={Math.max(0, (ms(44) - size) / 2)}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Mate"
      accessibilityHint={t('mate.tap_hint')}
    >
      {drawing}
    </Pressable>
  );
}
