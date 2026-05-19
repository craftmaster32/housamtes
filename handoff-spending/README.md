# Spending screen + design tokens — handoff bundle

This bundle is the first deliverable in the design-system v2 rollout. The
animation system + dashboard patches went out in previous handoffs; this one
covers the **spending screen redesign** and the **design tokens** it depends on.

## Drop these in

| File in this bundle | Drop into | Status |
|---|---|---|
| `constants/colors.ts` | `homeapp/constants/colors.ts` | Replace (no-op if already current) |
| `constants/typography.ts` | `homeapp/constants/typography.ts` | Replace (no-op if already current) |
| `constants/currencies.ts` | `homeapp/constants/currencies.ts` | Replace (no-op if already current) |
| `components/ui/Pill.tsx` | `homeapp/components/ui/Pill.tsx` | Replace (no-op if already current) |
| `components/ui/Header.tsx` | `homeapp/components/ui/Header.tsx` | Replace (no-op if already current) |
| `components/ui/EmptyState.tsx` | `homeapp/components/ui/EmptyState.tsx` | Replace (no-op if already current) |
| `app/(tabs)/profile/spending.tsx` | `homeapp/app/(tabs)/profile/spending.tsx` | **Replace** — the redesign |

## Heads-up: most of these are already in your codebase

When I audited `homeapp/` against the Design System (2) drafts, the **constants
and the three UI components are already there** — `useThemedColors`, the new
`type` ladder, `Pill`/`Header`/`EmptyState` etc. all match the design-system
drafts already.

I've included them anyway so this bundle is **self-contained** — drop the whole
folder over `homeapp/` and the spending screen has every dependency it needs
in the same revision. If any of those six files are byte-identical to what's
already in your repo, your diff tool will show no changes — that's fine.

The **only file that actually changes the running app is `spending.tsx`** — the
v2 redesign drops in over the old version.

## What `spending.tsx` does new

Same data flow (`useSpendingStore`, `useAuthStore`, `useSettingsStore`). Same
edge-function contract (still passes the **symbol**, not the code).

New on top:

- **Dark theme** — every style built from `useThemedColors()`. Hairline border
  + tinted backgrounds in dark mode where light used soft shadows.
- **Spring-animated bars** — `useSharedValue` heights with `withSpring`; bar
  fills re-spring whenever the selected month changes. Selected bar transitions
  background, dot opacity, and label weight via `withTiming`.
- **Count-up overview** — `useCountUp` (cubic-out, 900ms) on House total + Your
  share. Re-runs on month change.
- **LayoutAnimation accordion** — category drill-down uses
  `LayoutAnimation.configureNext(Presets.easeInEaseOut)` on toggle. Chevron
  rotates via Reanimated.
- **Swipe to jump month** — `Gesture.Pan().activeOffsetX([-20, 20])` wraps the
  SectionList. Right swipe → older month, left swipe → newer. Light haptic,
  no-ops at list edges.
- **Haptics** — selection on bar tap + accordion toggle; light impact on
  swipe + jump-to-current.
- **Sparkles glyph** — Insight card uses `Ionicons name="sparkles"` (no emoji).
- **Real spinner** — Refresh button rotates a Reanimated `withTiming` loop
  while `insightLoading`, instead of swapping to `<ActivityIndicator>`.

## Legacy compatibility

`spending.tsx` reads `currencyCode` from settings if present, falls back to
deriving it from the legacy `currency` symbol. So you can ship this **before**
the settings UI for theme/currency goes in — it just defaults to ILS if neither
field is set.

## Out of scope (next handoffs)

Per the plan:

- **Bills list, Bills detail, Add bill** — next
- Parking — after that
- Grocery, Chores, Calendar — then
- Settings, Profile, Auth screens — last

Each will land as its own `handoff-*` bundle following this exact pattern.

## No new dependencies

`react-native-reanimated@3`, `react-native-gesture-handler@2`, `expo-haptics`,
and `expo-router` are all already in your `package.json`. No installs.
