// Lines Mate says while you wait, one at a time (big loaders, upload note).
export const LOADING_QUIP_KEYS: readonly string[] = [
  'loading.quip_cushions',
  'loading.quip_remote',
  'loading.quip_turn',
  'loading.quip_pizza',
  'loading.quip_dishes',
  'loading.quip_lights',
  ...Array.from({ length: 24 }, (_, i) => `loading.quip_${i + 1}`),
];
