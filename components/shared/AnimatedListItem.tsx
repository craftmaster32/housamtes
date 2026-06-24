import Animated, { FadeInDown } from 'react-native-reanimated';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
}

export function AnimatedListItem({
  children,
  index = 0,
}: AnimatedListItemProps): React.JSX.Element {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 250)).duration(300)}>
      {children}
    </Animated.View>
  );
}
