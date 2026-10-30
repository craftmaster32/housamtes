import type { IoniconName } from '@/types/icons';
import { AISLE_RULES, type Aisle } from '@utils/groceryKeywords';

export type CategoryTone =
  | 'green'
  | 'blue'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'slate'
  | 'teal'
  | 'pink'
  | 'orange'
  | 'indigo';

export interface GroceryCategory {
  labelKey: string;
  icon: IoniconName;
  order: number;
  tone: CategoryTone;
}

// Letters in the scripts we match (Latin incl. accents, Hebrew).
const LETTER = 'A-Za-z\\u00C0-\\u017F\\u0590-\\u05FF';
const SHORT_TERM = 3;

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One case-insensitive regex for a list of words/phrases in any language.
 * Terms match anywhere, except:
 *  - `^term` (and any term of 3 letters or fewer) must start a word, so "egg"
 *    still finds "eggs" but "tea" doesn't find "steak";
 *  - `=term` must be a whole word, so "water" skips "watermelon" and "דג"
 *    (fish) skips "דגני בוקר" (cereal).
 */
export function words(terms: string[]): RegExp {
  const start = `(?:^|[^${LETTER}])`;
  const end = `(?=$|[^${LETTER}])`;
  const parts = terms.map((raw) => {
    if (raw.startsWith('=')) return `${start}${escape(raw.slice(1))}${end}`;
    if (raw.startsWith('^')) return `${start}${escape(raw.slice(1))}`;
    return raw.length <= SHORT_TERM ? `${start}${escape(raw)}` : escape(raw);
  });
  return new RegExp(parts.join('|'), 'i');
}

const AISLES: Record<Aisle, GroceryCategory> = {
  produce: { labelKey: 'grocery.cat_produce', icon: 'leaf-outline', order: 0, tone: 'green' },
  dairy: { labelKey: 'grocery.cat_dairy_fridge', icon: 'snow-outline', order: 1, tone: 'blue' },
  bakery: { labelKey: 'grocery.cat_bakery', icon: 'basket-outline', order: 2, tone: 'orange' },
  meat_fish: {
    labelKey: 'grocery.cat_meat_fish',
    icon: 'restaurant-outline',
    order: 3,
    tone: 'rose',
  },
  pantry: {
    labelKey: 'grocery.cat_pantry',
    icon: 'file-tray-stacked-outline',
    order: 4,
    tone: 'amber',
  },
  frozen: { labelKey: 'grocery.cat_frozen', icon: 'thermometer-outline', order: 5, tone: 'indigo' },
  snacks: { labelKey: 'grocery.cat_snacks', icon: 'ice-cream-outline', order: 6, tone: 'pink' },
  drinks: { labelKey: 'grocery.cat_drinks', icon: 'water-outline', order: 7, tone: 'teal' },
  household: { labelKey: 'grocery.cat_household', icon: 'home-outline', order: 8, tone: 'violet' },
  personal_care: {
    labelKey: 'grocery.cat_personal_care',
    icon: 'body-outline',
    order: 9,
    tone: 'pink',
  },
  health: { labelKey: 'grocery.cat_health', icon: 'medkit-outline', order: 10, tone: 'rose' },
  baby: { labelKey: 'grocery.cat_baby', icon: 'happy-outline', order: 11, tone: 'pink' },
  pets: { labelKey: 'grocery.cat_pets', icon: 'paw-outline', order: 12, tone: 'amber' },
};

// Built once: the first rule that matches wins (see groceryKeywords.ts).
const RULES: Array<{ re: RegExp; cat: GroceryCategory }> = AISLE_RULES.map((rule) => ({
  re: words(rule.words),
  cat: AISLES[rule.aisle],
}));

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

// A few items are common enough to get their own picture instead of the
// aisle's icon. Checked in order; the first match wins.
const ITEM_ICONS: Array<{ re: RegExp; icon: IoniconName }> = [
  { re: words(['ice cream', 'גלידה', 'helado']), icon: 'ice-cream-outline' },
  { re: words(['egg', 'ביצה', 'ביצים', 'huevo']), icon: 'egg-outline' },
  {
    re: words(['fish', 'salmon', 'tuna', '=דג', '=דגים', 'סלמון', 'טונה', 'pescado', 'atún']),
    icon: 'fish-outline',
  },
  { re: words(['coffee', 'קפה', 'café', 'cafe', 'tea', '=תה', 'té']), icon: 'cafe-outline' },
  { re: words(['beer', 'בירה', 'cerveza']), icon: 'beer-outline' },
  { re: words(['wine', 'יין', 'vino']), icon: 'wine-outline' },
  { re: words(['pizza', 'פיצה']), icon: 'pizza-outline' },
  {
    re: words([
      'dog food',
      'cat food',
      'pet food',
      'cat litter',
      'אוכל לכלב',
      'אוכל לחתול',
      'חול לחתול',
      'אוכל לכלבים',
      'comida para perro',
      'comida para gato',
    ]),
    icon: 'paw-outline',
  },
  {
    re: words(['medicine', 'pill', 'vitamin', 'תרופה', 'תרופות', 'אקמול', 'ויטמין', 'medicina']),
    icon: 'medkit-outline',
  },
  { re: words(['flower', 'פרחים', 'flores']), icon: 'flower-outline' },
  { re: words(['battery', 'batteries', 'סוללות', 'pilas']), icon: 'battery-half-outline' },
  { re: words(['light bulb', 'נורה', 'נורות', 'bombilla']), icon: 'bulb-outline' },
  { re: words(['trash', 'bin bag', 'שקיות זבל', 'שקית זבל', 'basura']), icon: 'trash-outline' },
];

/** The icon to show for one item: its own picture if we know it, else its aisle's. */
export function detectItemIcon(name: string): IoniconName {
  return ITEM_ICONS.find((r) => r.re.test(name))?.icon ?? detectCategory(name).icon;
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
  teal: { bg: '#DFF2F1', fg: '#1F6B66' },
  pink: { bg: '#FBE7F0', fg: '#9B2F62' },
  orange: { bg: '#FCE9DC', fg: '#9A4A16' },
  indigo: { bg: '#E6E8FA', fg: '#3B44A0' },
};

const DARK_TONES: Record<CategoryTone, ToneColors> = {
  green: { bg: 'rgba(79,176,113,0.18)', fg: '#8FD3A6' },
  blue: { bg: 'rgba(78,130,212,0.20)', fg: '#9DBDEB' },
  violet: { bg: 'rgba(155,120,230,0.20)', fg: '#C4B2F0' },
  rose: { bg: 'rgba(229,100,95,0.18)', fg: '#F0A9A5' },
  amber: { bg: 'rgba(224,178,77,0.18)', fg: '#E8C77E' },
  slate: { bg: 'rgba(148,163,184,0.16)', fg: '#B8C2D3' },
  teal: { bg: 'rgba(56,178,172,0.18)', fg: '#8AD9D3' },
  pink: { bg: 'rgba(236,112,170,0.18)', fg: '#F2A9CB' },
  orange: { bg: 'rgba(235,140,70,0.18)', fg: '#F2B98C' },
  indigo: { bg: 'rgba(110,120,230,0.20)', fg: '#AEB5F2' },
};

export function toneColors(tone: CategoryTone, isDark: boolean): ToneColors {
  return (isDark ? DARK_TONES : LIGHT_TONES)[tone];
}
