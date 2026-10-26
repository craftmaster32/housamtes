import { useEffect, useRef, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { usePenStroke } from '@hooks/usePenStroke';

interface TallyMarksProps {
  count: number;
  color: string;
  height?: number;
}

const STROKE = 6; // gap between strokes in a group
const GROUP = 4 * STROKE + 10; // four strokes plus the space before the next group

interface Stroke {
  d: string;
  length: number;
}

function strokesFor(count: number): Stroke[] {
  const out: Stroke[] = [];
  const groups = Math.ceil(count / 5);
  for (let g = 0; g < groups; g++) {
    const inGroup = Math.min(5, count - g * 5);
    const x0 = g * GROUP + 3;
    for (let i = 0; i < Math.min(4, inGroup); i++) {
      // A little wobble so it reads as handwriting, not a barcode.
      const x = x0 + i * STROKE;
      const lean = i % 2 === 0 ? 0.8 : -0.5;
      out.push({ d: `M${x} 3 L${x + lean} 19`, length: Math.hypot(lean, 16) });
    }
    if (inGroup === 5) {
      const w = 3 * STROKE + 6;
      out.push({ d: `M${x0 - 3} 15 L${x0 + 3 * STROKE + 3} 6`, length: Math.hypot(w, 9) });
    }
  }
  return out;
}

interface TallyStrokeProps {
  stroke: Stroke;
  color: string;
  /** A vote added while you watch is drawn in; marks already there just show. */
  drawIn: boolean;
}

function TallyStroke({ stroke, color, drawIn }: TallyStrokeProps): React.JSX.Element | null {
  const [on, setOn] = useState(!drawIn);
  useEffect(() => {
    setOn(true);
  }, []);
  const progress = usePenStroke(on, 180);
  if (progress <= 0) return null;
  return (
    <Path
      d={stroke.d}
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={`${stroke.length} ${stroke.length}`}
      strokeDashoffset={stroke.length * (1 - progress)}
    />
  );
}

/** Votes counted the old way: |||| with a fifth stroke across, in pen. */
export function TallyMarks({
  count,
  color,
  height = 22,
}: TallyMarksProps): React.JSX.Element | null {
  // Strokes that appear after the first paint are new votes: draw them in.
  const painted = useRef(false);
  useEffect(() => {
    painted.current = true;
  }, []);
  if (count <= 0) return null;
  const width = Math.ceil(count / 5) * GROUP;
  return (
    <Svg width={(width * height) / 22} height={height} viewBox={`0 0 ${width} 22`}>
      {strokesFor(count).map((stroke, i) => (
        <TallyStroke key={i} stroke={stroke} color={color} drawIn={painted.current} />
      ))}
    </Svg>
  );
}
