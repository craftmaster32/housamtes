# Parking screen — v2 redesign

Phase 4 of the design-system rollout. One drop-in screen.

## Drop this in

| File in this bundle | Drop into |
|---|---|
| `app/(tabs)/parking/index.tsx` | `homeapp/app/(tabs)/parking/index.tsx` |

Same flow — unzip into `homeapp/`.

## What's preserved exactly

Same data flow, same stores, same handlers:

- `useParkingStore` — claim, release, addReservation, voteOnReservation,
  cancelReservation, clearHistoryItem, checkReservationAutoApply
- `useCalendarSyncStore` — syncParkingApproved/Pending, removeCalendarEvent
- The same AppState + 60s interval for auto-apply
- The same approval flow (housemates vote; admin can cancel/free anywhere)
- The reserve modal flow + the date-conflict check

No store changes, no schema changes, no new dependencies.

## What's new

- **Blue hero card** — replaces the surface/positive/negative status circle.
  Same dark-theme aesthetic as the spending and bills heroes, with decoration
  circles, eyebrow + title, occupant info, and an integrated count-up timer
  (`Xh Ym` since the spot was claimed).
- **`Header` UI primitive** — replaces the hand-rolled title row.
- **`Button` UI primitive** — Claim / Release / Admin-free all use the
  themed Button. Modal Cancel / Request also use Button.
- **`Pill` UI primitive** — reservation status (approved/pending/rejected)
  uses Pill with the right tone.
- **`type` ladder** — every text style flows through `type.*` for typography
  consistency.
- **Animations**:
  - `useFadeInUp(0)` entry on the screen
  - `usePressScale` on the Add-reserve button, icon buttons, and vote chips
  - `useCountUp` on the elapsed hours / minutes
  - `LinearTransition` on reservation cards so they reorder smoothly when
    statuses change
- **Haptics**:
  - `success` on claim + reservation save
  - `warn` on release + cancel
  - `toggle` on approve/reject vote
  - `tap` on opening the reserve modal

## Implementation notes

- The hero's elapsed timer updates whenever `current` changes — when you
  refresh or when the parking session is reloaded. It does **not** tick every
  minute on its own (that's a future polish — happy to add it as a 60s
  interval if you want a live clock).
- The reserve modal got a re-skin (Button primitives, type ladder) but
  the same form fields and validation as before.
- The `VoteRow` (small avatars with approval dots) is intentionally kept
  visually similar — it's a recognizable pattern from v1 and works well in
  dark mode without changes.

## After this

Per the plan:

1. ✓ Animation system
2. ✓ Spending screen + constants + UI components
3. ✓ Bills list, Bills detail, Add bill
4. **Parking** ← this bundle
5. Grocery, Chores, Calendar (next)
6. Settings, Profile, Auth screens
