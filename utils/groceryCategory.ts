import type { IoniconName } from '@/types/icons';

export type CategoryTone = 'green' | 'blue' | 'violet' | 'rose' | 'amber' | 'slate';

export interface GroceryCategory {
  labelKey: string;
  icon: IoniconName;
  order: number;
  tone: CategoryTone;
}

const RULES: Array<{ re: RegExp; cat: GroceryCategory }> = [
  {
    re: /banana|apple|avocado|tomato|carrot|onion|lettuce|orange|strawberry|grape|cucumber|pepper|lime|lemon|herb|spinach|broccoli|salad/i,
    cat: { labelKey: 'grocery.cat_produce', icon: 'leaf-outline', order: 0, tone: 'green' },
  },
  {
    re: /milk|oat milk|almond milk|egg|cheese|butter|yogurt|cream|dairy/i,
    cat: { labelKey: 'grocery.cat_dairy_fridge', icon: 'snow-outline', order: 1, tone: 'blue' },
  },
  {
    re: /toilet|soap|trash|bin bag|sponge|paper towel|dish|laundry|detergent|bleach|towel|cleaning/i,
    cat: { labelKey: 'grocery.cat_household', icon: 'home-outline', order: 2, tone: 'violet' },
  },
  {
    re: /chicken|beef|fish|salmon|tuna|pork|lamb|shrimp|sausage|meat|mince/i,
    cat: { labelKey: 'grocery.cat_meat_fish', icon: 'restaurant-outline', order: 3, tone: 'rose' },
  },
  {
    re: /pasta|rice|bread|flour|sugar|salt|olive oil|oil|cereal|oats|coffee|\btea\b|sauce|\bcans?\b|\btins?\b/i,
    cat: {
      labelKey: 'grocery.cat_pantry',
      icon: 'file-tray-stacked-outline',
      order: 4,
      tone: 'amber',
    },
  },
];

export const OTHER_CATEGORY: GroceryCategory = {
  labelKey: 'grocery.cat_other',
  icon: 'cube-outline',
  order: 99,
  tone: 'slate',
};

/** Best-guess aisle for an item name; anything unrecognised lands in "Other". */
export function detectCategory(name: string): GroceryCategory {
  return RULES.find((r) => r.re.test(name))?.cat ?? OTHER_CATEGORY;
}

export interface ToneColors {
  /** Soft tile behind the icon. */
  bg: string;
  /** Icon / pill text — dark enough for 4.5:1 on `bg`. */
  fg: string;
}

const LIGHT_TONES: Record<CategoryTone, ToneColors> = {
  green: { bg: '#E3F1E6', fg: '#2F6B45' },
  blue: { bg: '#E5EEFB', fg: '#2952A0' },
  violet: { bg: '#EEE8F8', fg: '#5B3F96' },
  rose: { bg: '#F9E6E4', fg: '#A23F39' },
  amber: { bg: '#F7EDD6', fg: '#7D5A12' },
  slate: { bg: '#ECEEF2', fg: '#475569' },
};

const DARK_TONES: Record<CategoryTone, ToneColors> = {
  green: { bg: 'rgba(79,176,113,0.18)', fg: '#8FD3A6' },
  blue: { bg: 'rgba(78,130,212,0.20)', fg: '#9DBDEB' },
  violet: { bg: 'rgba(155,120,230,0.20)', fg: '#C4B2F0' },
  rose: { bg: 'rgba(229,100,95,0.18)', fg: '#F0A9A5' },
  amber: { bg: 'rgba(224,178,77,0.18)', fg: '#E8C77E' },
  slate: { bg: 'rgba(148,163,184,0.16)', fg: '#B8C2D3' },
};

export function toneColors(tone: CategoryTone, isDark: boolean): ToneColors {
  return (isDark ? DARK_TONES : LIGHT_TONES)[tone];
}
