import { Defs, Pattern, Path } from 'react-native-svg';

/**
 * Pencil hatching. Each Svg defines its own copy: on iOS a pattern can only be
 * used inside the Svg that defines it.
 */
export function Hatch({ id }: { id: string }): React.JSX.Element {
  return (
    <Defs>
      <Pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse">
        <Path d="M0 6 L6 0" stroke="rgba(34,32,29,0.55)" strokeWidth={1.2} />
      </Pattern>
    </Defs>
  );
}
