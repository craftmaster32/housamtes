import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

interface PushPinProps {
  color: string;
  size?: number;
}

/** A round push pin seen from above, with its shadow falling down-right. */
export function PushPin({ color, size = 22 }: PushPinProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={14.5} cy={15} rx={7} ry={5.5} fill="rgba(40,25,10,0.28)" />
      <Path
        d="M12 12 L16 19"
        stroke="rgba(40,25,10,0.45)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Circle cx={11} cy={10} r={7.5} fill={color} />
      <Circle cx={11} cy={10} r={7.5} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={1} />
      <Circle cx={8.6} cy={7.4} r={2.4} fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
}
