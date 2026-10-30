import type { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICONS: Record<string, IoniconName> = {
  food: 'fast-food-outline',
  groceries: 'cart-outline',
  transport: 'car-outline',
  utilities: 'flash-outline',
  rent: 'home-outline',
  entertainment: 'musical-notes-outline',
  health: 'medkit-outline',
  travel: 'airplane-outline',
  shopping: 'bag-outline',
  internet: 'wifi-outline',
  phone: 'phone-portrait-outline',
  default: 'receipt-outline',
};

/** Ionicon name for a category, falling back to a generic receipt icon. */
export function getCategoryIcon(category: string): IoniconName {
  return CATEGORY_ICONS[(category ?? '').toLowerCase()] ?? CATEGORY_ICONS.default;
}
