# Grocery screen — v2 redesign

Phase 5a of the design-system rollout. One drop-in screen.

## Drop this in

| File in this bundle | Drop into |
|---|---|
| `app/(tabs)/grocery/index.tsx` | `homeapp/app/(tabs)/grocery/index.tsx` |

Same flow — unzip into `homeapp/`.

## What's preserved exactly

All v1 behavior:

- 3 add modes (Shared / Private / Draft) with persisted preference
- Draft → publish flow
- Duplicate-detection (draft items flagged when same name exists on shared list)
- Inline edit mode (name + quantity)
- Per-item quantity counters (bought/total)
- Shopping run start/end + cross-housemate live view
- Auto-categorization (Produce / Dairy / Household / Meat & Fish / Pantry / Other)
- Swipe-to-delete via the existing handlers
- All v1 haptics (success on add, medium on delete, selection on inc/dec, etc.)
- `useGroceryStore` / `useAuthStore` / `useHousematesStore` / `useSettingsStore` — unchanged

## What's new

- **Blue hero card** — the bulk add area is now an integrated blue hero with
  decoration circles, eyebrow, title, mode toggle, add input, qty selector,
  and quick-add chips. Replaces the cream/Banani surface.
- **`Header` component** — page title at the top.
- **`type` ladder** — every text style flows through `type.*`.
- **Dark theme** — every style built from `useThemedColors()`.
- **Press scale on every chip** — mode toggle, qty preset, quick-add, add
  button, counter buttons, the inline edit row.
- **`LinearTransition` on item rows** — sorting, deleting, and category
  changes animate smoothly.
- **Fade-up entrance** on mount.
- **EmptyState** primitive for the empty list.
- **Banani cream tokens removed** — the screen no longer hard-codes the
  `SURFACE_BG`, `SHOP_CARD_BG`, `PERSONAL_BG` etc. tokens, so it follows the
  active theme correctly in both light and dark.

## No new dependencies

All imports already in `package.json` from previous handoffs.
