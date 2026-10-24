import { Pressable } from 'react-native';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';

interface CardShellProps {
  styles: CardStyles;
  onPress: () => void;
  accessibilityLabel: string;
  pinned?: boolean;
  children: React.ReactNode;
}

// The tappable card body shared by the simple cards (chores, votes, machines).
export function CardShell({
  styles,
  onPress,
  accessibilityLabel,
  pinned = false,
  children,
}: CardShellProps): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.shell,
        pinned && styles.pinnedShell,
        pressed && { opacity: 0.9 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}
