import { useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useGroceryStore } from '@stores/groceryStore';
import { type ColorTokens } from '@constants/colors';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';
import { CardLabel } from '@components/dashboard/cards/CardLabel';

interface GroceriesCardProps {
  styles: CardStyles;
  c: ColorTokens;
  compact: boolean;
  pinned?: boolean;
}

export function GroceriesCard({
  styles,
  c,
  compact,
  pinned = false,
}: GroceriesCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const items = useGroceryStore((s) => s.items);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const shared = items.filter((i) => !i.isPersonal && !i.isDraft);
  const toBuy = shared.filter((i) => !i.isChecked).length;
  const preview = shared.slice(0, 3);
  const onToggle = useCallback(
    (id: string): void => {
      toggleItem(id).catch(() => {});
    },
    [toggleItem]
  );
  // The label navigates; the item rows are tappable to tick off in place, so this
  // card is a working mini-list rather than a static Pressable.
  return (
    <View style={[styles.shell, pinned && styles.pinnedShell]}>
      <Pressable
        onPress={() => navigateToBase('/(tabs)/grocery')}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.grocery_list')}
      >
        <CardLabel
          styles={styles}
          icon="cart-outline"
          // On a narrow card the cart icon says "groceries"; the count matters more.
          label={compact ? t('dashboard.n_to_buy', { count: toBuy }) : t('dashboard.grocery_list')}
          meta={compact ? undefined : t('dashboard.n_to_buy', { count: toBuy })}
          pinned={pinned}
        />
      </Pressable>
      <View style={styles.groceryList}>
        {preview.length === 0 ? (
          <Text style={styles.sub}>{t('dashboard.grocery_empty')}</Text>
        ) : (
          preview.map((item) => (
            <Pressable
              key={item.id}
              style={styles.groceryRow}
              onPress={() => onToggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isChecked }}
              accessibilityLabel={item.name}
            >
              <View
                style={[
                  styles.groceryBox,
                  item.isChecked
                    ? { backgroundColor: c.success, borderColor: c.success }
                    : { borderColor: c.textTertiary },
                ]}
              >
                {item.isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text
                style={[
                  styles.groceryName,
                  { color: item.isChecked ? c.textTertiary : c.textPrimary },
                  item.isChecked && styles.groceryDone,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}
