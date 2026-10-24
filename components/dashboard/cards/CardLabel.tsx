import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { type CardStyles, sentenceCase } from '@components/dashboard/cards/cardStyles';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface CardLabelProps {
  styles: CardStyles;
  icon: IoniconName;
  label: string;
  /** Short note on the trailing side, e.g. "6 to buy". */
  meta?: string;
  pinned?: boolean;
}

// The small "what is this card" line: icon + label, plus a pin when pinned.
export function CardLabel({
  styles,
  icon,
  label,
  meta,
  pinned = false,
}: CardLabelProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={styles.labelRow}>
      <Ionicons name={icon} size={15} color={c.textSecondary} />
      <Text style={styles.label} numberOfLines={1}>
        {sentenceCase(label)}
      </Text>
      {pinned ? (
        <Ionicons name="pin" size={14} color={c.primary} style={styles.pinIcon} />
      ) : meta ? (
        <Text style={styles.labelMeta}>{meta}</Text>
      ) : null}
    </View>
  );
}
