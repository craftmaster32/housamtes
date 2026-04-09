# Spec: Parking Manager

**Phase:** 3
**Status:** Ready to build
**Depends on:** Phase 1 (Auth + House System) complete

---

## Context

The house has one shared parking spot. Currently housemates coordinate via WhatsApp,
which leads to missed messages, double-bookings, and confusion. The parking feature
replaces all WhatsApp coordination with a dedicated system that is real-time, transparent,
and requires explicit approval for future reservations.

---

## House Settings (Configurable)

| Setting | Default | Range |
|---|---|---|
| Advance booking window | 2 days | 1–14 days |
| Approval required from | All members | All members / Any one member |

---

## Data Model

```
parking_status
  id: uuid PK
  house_id: uuid FK → houses (UNIQUE — one row per house)
  is_occupied: boolean DEFAULT false
  occupied_by_user_id: uuid FK → users nullable
  occupied_since: timestamptz nullable
  updated_at: timestamptz

parking_reservations
  id: uuid PK
  house_id: uuid FK → houses
  requested_by_user_id: uuid FK → users
  date: date
  start_time: time
  end_time: time
  note: text nullable
  status: enum (pending, approved, denied, cancelled)
  created_at: timestamptz
  updated_at: timestamptz

parking_approvals
  id: uuid PK
  house_id: uuid FK → houses
  reservation_id: uuid FK → parking_reservations
  approver_user_id: uuid FK → users
  decision: enum (approved, denied)
  decided_at: timestamptz
  note: text nullable
```

---

## Screens

### Screen 1: Parking Dashboard Card (component on main Dashboard)
- Status indicator (large, unmissable):
  - Green: "Parking Free"
  - Red: "Taken by [Name] · 2h 15m ago"
- If free: "I'm using it" button
- If I'm using it: "I'm done" button (large, easy to tap while in car)
- If someone else is using it: "They've been using it since [time]" (no action for others)
- "Reserve for later" link → opens Parking screen

### Screen 2: Parking Screen (`app/(tabs)/parking/index.tsx`)
- Full parking status card (same as dashboard card, larger)
- Upcoming reservations section:
  - Chronological list of all future approved reservations
  - Each shows: name, date, time range, optional note
  - "Mine" label on own reservations
- "Request a Reservation" button → opens reservation form modal
- My pending requests section (requests awaiting approval)
- Parking calendar view (monthly view, dots on dates with reservations)

### Screen 3: Reservation Request (modal)
- Date picker (blocked: past dates, dates beyond advance window)
- Start time picker
- End time picker
- Optional note (e.g. "Moving furniture")
- Shows who will be asked to approve
- Submit button → sends request to other members
- Validation: end time must be after start time

### Screen 4: Approve/Deny Request (notification deep link)
- Shows: who is requesting, date, time range, note
- Large "Approve" button (green) and "Deny" button (red)
- Optional note when denying (e.g. "I need it that day")
- Tapping from notification deep-links directly here

---

## Acceptance Scenarios

### Scenario A — Claim the parking spot
```
GIVEN the spot is free (green status)
WHEN I tap "I'm using it"
THEN the status immediately changes to "Taken by Me · just now" on my phone
AND within 2 seconds, all other housemates' phones show "Taken by [My Name] · just now"
AND both other housemates receive a push notification: "[My Name] claimed the parking spot"
```

### Scenario B — Release the parking spot
```
GIVEN the spot shows "Taken by Me"
WHEN I tap "I'm done"
THEN the status changes to "Parking Free" on all phones within 2 seconds
AND both other housemates receive: "Parking spot is now free"
```

### Scenario C — Request a future reservation (approved)
```
GIVEN the advance window is 2 days (default)
AND I want the spot this Saturday 10:00–14:00

WHEN I open the reservation form
THEN Saturday is selectable (it's within 2 days)
AND next week is grayed out (beyond 2-day limit)

WHEN I submit the request for Saturday 10:00–14:00 with note "Supermarket run"
THEN Alex and Jordan both receive: "[My Name] wants the parking spot Sat 10:00–14:00 · Supermarket run"
AND I see "Pending" on my reservation

WHEN Alex approves
  → Jordan then receives a reminder to approve too (if "all members" setting)
WHEN Jordan also approves
  → I receive: "Your reservation is confirmed: Sat 10:00–14:00"
  → Reservation appears on the calendar for all members
```

### Scenario D — Request denied
```
GIVEN I submit a reservation request

WHEN Alex denies it (with or without a note)
THEN I receive: "Your reservation for Sat 10:00–14:00 was denied"
AND the reservation is marked as Denied
AND I can see who denied it
```

### Scenario E — Conflict prevention
```
GIVEN Alex has an approved reservation for Sat 10:00–14:00

WHEN I try to book Sat 12:00–16:00 (overlapping)
THEN the system shows: "This time overlaps with Alex's reservation (Sat 10:00–14:00)"
AND prevents me from submitting

WHEN I try to book Sat 14:00–17:00 (back-to-back, not overlapping)
THEN my request is submitted normally
```

### Scenario F — Advance window enforcement
```
GIVEN the advance booking window is set to 2 days in house settings

WHEN I open the date picker for a reservation
THEN only today, tomorrow, and the day after are selectable
AND all other future dates are grayed out with "Too far ahead" label

WHEN admin changes setting to 7 days
THEN immediately the next 7 days become selectable
```

### Scenario G — Cancel a reservation
```
GIVEN I have an upcoming approved reservation for Saturday

WHEN I tap "Cancel Reservation" on it
THEN a confirmation dialog shows: "Cancel your Saturday reservation?"
WHEN I confirm:
  → My reservation is marked Cancelled
  → Other members receive: "[My Name] cancelled their Saturday parking reservation"
  → The slot becomes available for others to request
```

### Scenario H — "Any one member" approval setting
```
GIVEN house settings shows "Approval: Any one member"

WHEN I submit a reservation request
AND Alex approves (before Jordan)
THEN I immediately receive: "Your reservation is confirmed. Alex approved."
AND Jordan is notified it was already approved (no action needed)
```

---

## Real-Time Requirements

- Status changes (claim/release) must propagate to all phones within 2 seconds
- Reservation approvals must update the requester's view in real-time
- Calendar must reflect new reservations without requiring a manual refresh

---

## Edge Cases to Handle

- Two people try to claim the spot at the exact same moment → first wins, second sees "Just taken by [Name]"
- Person with approved reservation did not actually show up → no automatic action (spot stays free until someone claims it)
- Housemate leaves the house with a pending request → request is cancelled automatically
- Advance window is 2 days, but admin changes it to 1 day → existing reservations beyond 1 day are kept (not retroactively cancelled)
- House has only 2 members (not 3) → "all members" approval means only 1 other person needs to approve

---

## Notifications Summary

| Event | Recipients | Message |
|---|---|---|
| Spot claimed | All others | "[Name] claimed the parking spot" |
| Spot released | All others | "Parking spot is now free" |
| Reservation requested | All others | "[Name] wants the spot [date] [time]" |
| Reservation approved (partial) | Requester + unapproved members | "[Name] approved · waiting for [Name]" |
| Reservation fully approved | Requester | "Confirmed: [date] [time]" |
| Reservation denied | Requester | "Denied: [date] [time]" |
| Reservation cancelled | All members | "[Name] cancelled their [date] reservation" |

---

## Performance Requirements

- Status update (claim/release) visible to all within 2 seconds
- Calendar loads within 1 second
- Reservation form submission gives immediate feedback
