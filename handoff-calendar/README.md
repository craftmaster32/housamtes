# Calendar screen — v2 redesign

Phase 5c of the design-system rollout. One drop-in screen.

## Drop this in

| File in this bundle | Drop into |
|---|---|
| `app/(tabs)/calendar/index.tsx` | `homeapp/app/(tabs)/calendar/index.tsx` |

Same flow — unzip into `homeapp/`.

## What's preserved exactly

All v1 behavior:

- Month grid (6 rows × 7 days) with weekday header
- Week-start = Sunday
- Recurring event expansion (weekly / monthly / yearly)
- Multi-day event expansion
- Overlays from parking, recurring bills, chores, personal calendar
- Selected-day event list with sync buttons (Google / .ics on web,
  manual sync to connected calendar on native)
- Edit + delete on house events
- Event form modal (add + edit) with date/time pickers, notes, recurrence,
  repeat-until
- `useEventsStore` / `useParkingStore` / `useRecurringBillsStore` /
  `useChoresStore` / `useAuthStore` / `useSettingsStore` /
  `useCalendarSyncStore` / `usePersonalCalendar` — unchanged

## What's new

- **Blue hero card** — shows the current month/year as a title, with sync
  status as a subtitle. Same decoration circles + eyebrow + title aesthetic
  as the other v2 screens.
- **`Header` component** with right-slot "Add" button.
- **`type` ladder** — every text style flows through `type.*`.
- **Dark theme** via `useThemedColors()`.
- **Press scale** on every day cell, month nav arrow, action icon, recurrence
  chip in the modal.
- **`LinearTransition` on selected-day events** — events glide smoothly when
  the date changes or one is added/removed.
- **Haptics** — tap on month nav + day select + add, success on event save,
  warn on event delete.
- **Fade-up entrance** on mount.
- **`Button` + `EmptyState`** primitives in the event modal and the empty-day
  state.
- **Tap-to-jump UX on event rows** — instead of the prior expand/collapse
  mode, all event details now show at once (time, range, detail, notes) so
  the row is more glanceable. Action icons stay accessible.

## No new dependencies

All imports already in `package.json` from previous handoffs.
