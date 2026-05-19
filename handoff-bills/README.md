# Bills screens — v2 redesign

Phase 3 of the design-system rollout. Three drop-in screens for the Bills tab:
list, detail, and add. All three now follow the same visual system as the
spending v2 screen — dark-theme blue hero, `type` ladder, `Header` UI
primitive, animated press scale, fade-up entrance.

## Drop these in

| File in this bundle | Drop into |
|---|---|
| `app/(tabs)/bills/index.tsx` | `homeapp/app/(tabs)/bills/index.tsx` |
| `app/(tabs)/bills/[id].tsx` | `homeapp/app/(tabs)/bills/[id].tsx` |
| `app/(tabs)/bills/add.tsx` | `homeapp/app/(tabs)/bills/add.tsx` |

Unzip into `homeapp/` — same flow as the previous handoffs. Existing files
get replaced. `setup.tsx` is **not** touched.

## What's preserved exactly

Per the brief, these don't change behavior or layout:

- **Settle Up detailed section** — still expandable, still shows the minimum
  transfer list with avatars and names. Now the chevron rotates smoothly and
  each transfer amount counts up.
- **Sort by date** — newest first, grouped by date label ("Today",
  "Yesterday", "Mon, Jan 13"), just as in v1.
- **Recurring tab + `HouseholdTab`** — unchanged. The v2 list just renders it
  in the same place.
- **Stores, handlers, edge function contracts** — bit-for-bit identical. No
  schema changes, no new dependencies.

## What's new in each screen

### `bills/index.tsx`

- **Blue hero balance card** — replaces the three-column stat card. Shows
  Owed-to-you, You-owe, and a Net summary row in a single card with the same
  decoration-circles aesthetic as the spending hero.
- **Count-up amounts** — Owed / Owe / Net all animate from zero on mount and
  re-animate when data changes.
- **Animated Settle Up accordion** — rotates the chevron, springs the body.
- **`Header` component** — replaces the hand-rolled top bar.
- **Filter tabs** — same one-off / recurring tabs, now using press scale and
  the `type` ladder.
- **Bill row press scale + layout transition** — every bill row springs
  slightly on press, and re-orderings (e.g. when the sort changes) animate
  smoothly via `LinearTransition`.
- **Fade-up entrance** on the whole screen.

### `bills/[id].tsx`

- **Header** with back chevron and contextual right-side action (Edit / Cancel).
- **Hero card** — blue panel with the category icon, eyebrow, title, and
  count-up amount. Hidden during edit mode.
- **`MetaRow`** helper — date / paid-by / notes rendered consistently.
- **Split breakdown card** — same data, cleaner alignment using the `type`
  ladder (tabular amounts).
- **Category chip** with press scale during edit.
- **Settle / Delete buttons** use the `Button` primitive with `haptic="success"`
  and `haptic="warn"` respectively.
- **Pill** for the "Settled by X on Y" banner (already used the Pill — now via
  the v2 component).

### `bills/add.tsx`

- **Header** with back chevron.
- **`Field` helper** — every form field gets a consistent eyebrow label +
  right slot (used for the "Select all" link).
- **Person chips, split-type chips, category chips, date trigger** — all
  press-scaled and theme-aware.
- **Count-up "per person" preview** — when you adjust the amount with split
  set to equal, the per-person figure animates smoothly.
- **Success haptic** fires when the bill saves successfully.
- **Fade-up entrance** on mount.

## Animation hooks used (already in your repo from earlier handoffs)

- `useFadeInUp(delay)` — staggered entrance on mount
- `useCountUp(value, opts)` — animated number transitions
- `usePressScale(target)` — spring press on tappables
- `useExpandable(isOpen)` — accordion / chevron rotation
- `useHaptic()` — `.success()`, `.warn()`, `.tap()` etc.
- `LinearTransition` from `react-native-reanimated` for list reorders

## No new dependencies

Everything imported is already in your `package.json` from previous handoffs.

## After this

Per the plan:

1. ✓ Animation system
2. ✓ Spending screen + constants + UI components
3. **Bills list, Bills detail, Add bill** ← this bundle
4. Parking (next)
5. Grocery, Chores, Calendar
6. Settings, Profile, Auth screens
