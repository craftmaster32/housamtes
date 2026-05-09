# Spec: Spending Analysis v2

**Phase:** 3 (post-MVP polish)
**Status:** Ready to build
**Depends on:** Existing `app/(tabs)/profile/spending.tsx` and its stores (no schema changes)

---

## Goal

Visual + interaction polish pass on the existing Spending Analysis screen, plus
the underlying token system to support **dark mode** and **locale-aware
multi-currency**. No data-model changes. No new packages — Reanimated 3,
Gesture Handler 2, and Haptics are already in `package.json`.

The existing screen stays compiling and running until the rename in §6.

---

## Files

### 1. `constants/colors.ts` — extended

Adds:
- `darkColors: typeof colors` — same shape as `colors`, lifted for OLED.
- `ThemeMode = 'light' | 'dark' | 'system'`.
- `resolvePalette(mode, systemScheme)` — pure helper.
- `useThemedColors()` hook — reads `themeMode` from `useSettingsStore` and the
  OS color scheme via `useColorScheme()`.

The existing `colors` export stays unchanged so every screen that imports it
keeps working on light theme. Screens opt into dark mode one at a time by
swapping `import { colors }` → `const C = useThemedColors()` and threading `C`
through their `StyleSheet.create` factory.

### 2. `constants/currencies.ts` — new

Locale-aware catalog. Replaces the symbol-only contract.

```ts
export type CurrencyCode = 'ILS' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'CHF' | 'JPY';
export interface Currency { code; symbol; label; locale; decimals; }
export const CURRENCIES: Record<CurrencyCode, Currency>;
export function formatFull(amount, code): string;   // "₪1,234.56"
export function formatShort(amount, code): string;  // "₪1.2k"
export function getCurrency(code): Currency;
export function currencyFromSymbol(symbol): CurrencyCode;
```

Uses `Intl.NumberFormat` for thousands separators with a manual fallback for
older Hermes builds. Symbol is rendered manually (prefix) to keep visual
consistency with the legacy "₪123.45" style across the app.

### 3. `settingsStore.ts` — additive migration

Add `currencyCode: CurrencyCode` and `themeMode: ThemeMode`. Keep the existing
`currency: string` (symbol) field readable for one release so other screens
don't break, but mark it `@deprecated`.

```ts
type SettingsState = {
  // ...existing fields...
  currency: string;            // @deprecated — symbol; read currencyCode instead
  currencyCode: CurrencyCode;  // new canonical
  themeMode: ThemeMode;        // 'system' default
  setCurrencyCode: (code: CurrencyCode) => void;
  setThemeMode: (mode: ThemeMode) => void;
};
```

On first read after upgrade, persist middleware will hydrate without
`currencyCode`. Add a tiny `onRehydrateStorage` migration: if `currencyCode` is
missing, call `currencyFromSymbol(state.currency)` and write it back. Keep
`setCurrency` writing both fields.

### 4. `app/(tabs)/profile/spending.v2.tsx` — new screen

Drop-in replacement for `spending.tsx`. Same data flow:
- Reads `useSpendingStore`, `useAuthStore`, `useSettingsStore`
- Calls `load(houseId, userName)` on focus
- Calls `fetchInsight(houseId, userName, symbol)` — passes the **symbol**
  (not code) so the existing edge function contract is unchanged. The edge
  function is out of scope for this PR.

What's new:
- **Dark theme** — every style is built from `useThemedColors()`. Uses border
  + hairline in dark mode where light mode used a soft shadow.
- **Animated bars** — `useSharedValue` heights with `withSpring`; bar fills
  re-spring whenever the selected month changes. Selected bar transitions
  background, dot opacity, and label weight via `withTiming`.
- **Count-up amounts** — `useCountUp` hook (cubic-out, 900ms) on the overview
  House total + Your share. Re-runs on month change.
- **LayoutAnimation drill-down** — category accordion uses
  `LayoutAnimation.configureNext(Presets.easeInEaseOut)` on toggle. Chevron
  rotates via Reanimated.
- **Swipe-to-jump-month gesture** — `Gesture.Pan().activeOffsetX([-20, 20])`
  wraps the SectionList. Right swipe → older month, left swipe → newer.
  Triggers light haptic, no-ops at list edges.
- **Haptics** — `Haptics.selectionAsync()` on bar tap + accordion toggle;
  `ImpactFeedbackStyle.Light` on swipe + jump-to-current.
- **Sparkles glyph** — Insight card uses `Ionicons name="sparkles"` instead of
  the `✨` emoji to render consistently across platforms.
- **Real spinner** — Refresh button rotates a Reanimated `withTiming` loop
  while `insightLoading`, instead of swapping to `<ActivityIndicator>`.

### 5. Tests

- `currencies.test.ts` — `formatFull(1234.5, 'USD')` → `"$1,234.50"`;
  JPY → `"¥1,235"` (zero decimals); fallback when Intl throws.
- `colors.test.ts` — `resolvePalette('system', 'dark')` returns `darkColors`;
  `resolvePalette('light', 'dark')` returns `colors`.

---

## Rollout

1. Land #1, #2, #3 first — additive, no behavior change.
2. Land #4 alongside the rename: `mv spending.tsx spending.v1.tsx.bak` and
   `mv spending.v2.tsx spending.tsx`. The `.bak` file gets deleted in the
   next PR once smoke-tested.
3. Wire `themeMode` and `currencyCode` pickers into Settings — out of scope
   for this PR; tracked as a follow-up.
4. Migrate other screens to `useThemedColors()` opportunistically. The visual
   mockup in the design project shows the target end state.

## Out of scope

- Edge-function contract changes (still receives a symbol)
- Settings UI for theme + currency (tracked separately)
- Migrating other screens to dark mode
