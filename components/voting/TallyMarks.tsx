import Svg, { Path } from 'react-native-svg';

interface TallyMarksProps {
  count: number;
  color: string;
  height?: number;
}

const STROKE = 6; // gap between strokes in a group
const GROUP = 4 * STROKE + 10; // four strokes plus the space before the next group

/** Votes counted the old way: |||| with a fifth stroke across, in pen. */
export function TallyMarks({
  count,
  color,
  height = 22,
}: TallyMarksProps): React.JSX.Element | null {
  if (count <= 0) return null;
  const groups = Math.ceil(count / 5);
  const width = groups * GROUP;
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    const inGroup = Math.min(5, count - g * 5);
    const x0 = g * GROUP + 3;
    for (let i = 0; i < Math.min(4, inGroup); i++) {
      // A little wobble so it reads as handwriting, not a barcode.
      const x = x0 + i * STROKE;
      const lean = i % 2 === 0 ? 0.8 : -0.5;
      parts.push(`M${x} 3 L${x + lean} 19`);
    }
    if (inGroup === 5) parts.push(`M${x0 - 3} 15 L${x0 + 3 * STROKE + 3} 6`);
  }
  return (
    <Svg width={(width * height) / 22} height={height} viewBox={`0 0 ${width} 22`}>
      <Path
        d={parts.join(' ')}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
