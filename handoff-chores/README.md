# Chores screen — v2 redesign

Phase 5b of the design-system rollout. One drop-in screen.

## Drop this in

| File in this bundle | Drop into |
|---|---|
| `app/(tabs)/chores/index.tsx` | `homeapp/app/(tabs)/chores/index.tsx` |

Same flow — unzip into `homeapp/`.

## What's preserved exactly

All v1 behavior:

- One-off / weekly / monthly recurrence with day picker (week + month)
- Localized weekday labels via `useLanguageStore`
- Take / drop / delete actions
- Owner/admin "Reset all" action
- `useChoresStore` / `useAuthStore` / `useHousematesStore` / `useLanguageStore` — unchanged

## What's new

- **Blue hero with progress** — count-up done count + spring-animated progress
  bar. Same decoration circles + eyebrow + title aesthetic as the other v2
  screens.
- **Separate "form" card** — the add form moves into its own surface card
  below the hero, so the hero stays focused on status.
- **`Header` component** — page title at the top.
- **`type` ladder** — every text style flows through `type.*`.
- **Dark theme** via `useThemedColors()`.
- **Press scale** on every chip: recurrence (Once/Weekly/Monthly), weekday
  picker, month-day picker, claim/drop links.
- **`LinearTransition` on chore rows** — completed chores glide to the bottom
  smoothly.
- **Haptics** — success on check, warn on delete + reset-all, tap on
  recurrence change + claim/drop.
- **Fade-up entrance** on mount.
- **`Button` + `EmptyState`** primitives — replaces the hand-rolled add
  button and empty state.

## No new dependencies

All imports already in `package.json` from previous handoffs.
