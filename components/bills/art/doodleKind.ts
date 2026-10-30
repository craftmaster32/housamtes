export type DoodleKind =
  | 'cart'
  | 'pizza'
  | 'car'
  | 'ticket'
  | 'firstaid'
  | 'bag'
  | 'plane'
  | 'phone'
  | 'bulb'
  | 'drop'
  | 'flame'
  | 'router'
  | 'house'
  | 'receipt';

// Which drawing each category icon gets (the icon the house picked, or the
// recurring bill's icon).
const BY_ICON: Record<string, DoodleKind> = {
  cart: 'cart',
  basket: 'cart',
  nutrition: 'cart',
  pizza: 'pizza',
  'fast-food': 'pizza',
  cafe: 'pizza',
  beer: 'pizza',
  restaurant: 'pizza',
  wine: 'pizza',
  'ice-cream': 'pizza',
  car: 'car',
  bus: 'car',
  train: 'car',
  bicycle: 'car',
  speedometer: 'car',
  sparkles: 'ticket',
  film: 'ticket',
  'game-controller': 'ticket',
  'musical-notes': 'ticket',
  tv: 'ticket',
  medkit: 'firstaid',
  medical: 'firstaid',
  body: 'firstaid',
  barbell: 'firstaid',
  'bag-handle': 'bag',
  bag: 'bag',
  gift: 'bag',
  airplane: 'plane',
  globe: 'plane',
  'phone-portrait': 'phone',
  call: 'phone',
  flash: 'bulb',
  bulb: 'bulb',
  water: 'drop',
  flame: 'flame',
  thermometer: 'flame',
  wifi: 'router',
  home: 'house',
  bed: 'house',
  key: 'house',
  business: 'house',
};

// When the icon says nothing, the category's name does (English and Hebrew).
const BY_NAME: [RegExp, DoodleKind][] = [
  [/grocer|supermarket|קניות|סופר/i, 'cart'],
  [/food|pizza|restaurant|cafe|coffee|אוכל|מסעד/i, 'pizza'],
  [/transport|taxi|fuel|petrol|car|bus|תחבורה|מונית|דלק/i, 'car'],
  [/entertain|cinema|movie|netflix|fun|בילוי|סרט/i, 'ticket'],
  [/health|pharm|doctor|medic|בריאות|תרופ/i, 'firstaid'],
  [/shop|cloth|gift|קני|בגד|מתנה/i, 'bag'],
  [/travel|flight|trip|holiday|טיסה|חופש/i, 'plane'],
  [/phone|mobile|טלפון|סלולר/i, 'phone'],
  [/electric|חשמל/i, 'bulb'],
  [/water|מים/i, 'drop'],
  [/gas|heating|גז|חימום/i, 'flame'],
  [/internet|wifi|אינטרנט/i, 'router'],
  [/rent|arnona|house|home|שכירות|ארנונה|בית/i, 'house'],
];

/** The drawing for a category, from its icon first and then its name. */
export function doodleKind(icon: string | null | undefined, name?: string | null): DoodleKind {
  const key = (icon ?? '').replace(/-outline$|-sharp$/, '');
  if (BY_ICON[key]) return BY_ICON[key];
  const text = name ?? '';
  for (const [pattern, kind] of BY_NAME) {
    if (pattern.test(text)) return kind;
  }
  return 'receipt';
}
