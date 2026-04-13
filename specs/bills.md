# Spec: Bills & Expenses

**Phase:** 2
**Status:** Ready to build
**Depends on:** Phase 1 (Auth + House System) complete

---

## Context

Housemates currently use Splitwise to track shared bills. The goal is to replace it
with something built into HouseMates. Key difference from Splitwise: calculations must be
permanently visible (not hidden behind "simplify debts"). Each person takes responsibility
for specific recurring bills and updates them monthly.

---

## Data Model

```
bills
  id: uuid PK
  house_id: uuid FK → houses
  name: text (e.g. "Electricity April")
  category: enum (electricity, water, internet, rent, subscriptions, groceries, other)
  total_amount: numeric(10,2)
  due_date: date
  paid_by_user_id: uuid FK → users
  split_type: enum (equal, custom)
  is_recurring: boolean
  recurrence_interval: enum (monthly, bimonthly, quarterly, yearly) nullable
  notes: text nullable
  receipt_photo_url: text nullable
  status: enum (pending, settled)
  created_by_user_id: uuid FK → users
  created_at: timestamptz
  updated_at: timestamptz

bill_splits
  id: uuid PK
  house_id: uuid FK → houses
  bill_id: uuid FK → bills
  user_id: uuid FK → users
  percentage: numeric(5,2)  -- e.g. 33.33
  amount_owed: numeric(10,2) -- calculated: total * percentage / 100
  created_at: timestamptz

settlements
  id: uuid PK
  house_id: uuid FK → houses
  bill_id: uuid FK → bills
  settled_by_user_id: uuid FK → users
  settled_at: timestamptz
  notes: text nullable
```

---

## Screens

### Screen 1: Bills List (`app/(tabs)/bills/index.tsx`)
- Header: "Bills" + "Add Bill" button (top right)
- Balance summary card (always at top):
  - Each housemate shown with their balance
  - Positive = owed money (green)
  - Negative = owes money (red)
  - Tap any balance → shows breakdown screen
- Bills grouped by category with section headers
- Each bill shows: name, amount, due date, who paid, overdue label if applicable
- Filter bar: All / This Month / [Category]
- Empty state: "No bills yet. Tap + to add your first bill."
- Loading state: skeleton cards
- Error state: "Couldn't load bills. Tap to retry."

### Screen 2: Add Bill (`app/(tabs)/bills/add.tsx`)
- Form fields:
  - Bill name (text input)
  - Category (selector: Electricity / Water / Internet / Rent / Subscriptions / Groceries / Other)
  - Total amount (numeric input, € prefix)
  - Due date (date picker)
  - Who paid? (member selector — defaults to current user)
  - Split type (toggle: Equal / Custom)
  - If Custom: slider or percentage input per person (must total 100%)
  - Recurring? (toggle)
  - If recurring: interval selector (Monthly / Bimonthly / Quarterly / Yearly)
  - Notes (optional text)
  - Receipt photo (optional, camera or library)
- Preview section (live): "Each person owes €X" or custom breakdown
- Save button (disabled until form is valid)
- Validation: name required, amount > 0, date required, splits must total 100%

### Screen 3: Bill Detail (`app/(tabs)/bills/[id].tsx`)
- Full bill info: name, category, amount, due date, paid by
- Breakdown section — always visible, all calculations shown:
  - For equal: "€120 ÷ 3 = €40 each"
  - For custom: "Alex 50% = €60 | Sam 30% = €36 | Jordan 20% = €24"
- Status: Pending / Settled (with who settled and when)
- "Mark as Settled" button (visible if status is Pending)
- "Edit Bill" button (visible to bill creator only)
- History: timestamp of creation, any edits, settlement
- Back to bills list

### Screen 4: Edit Bill (modal or `app/(tabs)/bills/[id]/edit.tsx`)
- Only bill creator can access
- Editable fields: name, amount, due date, notes
- Non-editable: who paid, split type (changing split would invalidate history)
- Save changes button

### Screen 5: Balance Breakdown (modal)
- Triggered by tapping a balance on the Bills List
- Shows every bill contributing to the balance
- Shows the calculation for each: "Water: you owe €20 (33% of €60)"
- Total at bottom: "Net: you owe Alex €45"

---

## Acceptance Scenarios

### Scenario A — Add an equal-split bill
```
GIVEN I am on the Add Bill screen
WHEN I enter: name "Electricity", amount €120, due April 30, paid by me, split equally
THEN the preview shows: "Each person owes €40.00"
AND when I tap Save:
  - Bill appears in the Electricity category on the bills list
  - My balance dashboard updates to show I am owed €80 (€40 × 2 others)
  - Both other housemates receive push notification: "New bill: Electricity €120.00 due Apr 30"
  - Other housemates see the bill on their phones within 2 seconds
```

### Scenario B — Add a custom-split bill
```
GIVEN I enter total €100 and select Custom split
AND I set: Alex 50%, Sam 30%, Jordan 20%
THEN the preview shows: "Alex €50 | Sam €30 | Jordan €20"
AND tapping Save creates the bill with those exact amounts

GIVEN I set 40% + 40% + 10% = 90%
THEN the Save button is disabled
AND a red message shows: "Percentages must add up to 100%. Currently: 90%"
```

### Scenario C — Mark a bill as settled
```
GIVEN a bill shows status "Pending"
WHEN I tap "Mark as Settled"
THEN the system shows a confirmation dialog: "Mark Water bill as settled?"
AND when I confirm:
  - Bill status changes to "Settled"
  - Balance dashboard updates for all members in real-time
  - All members receive notification: "Water bill marked as settled by Jordan"
  - Bill moves to "Settled" section in the list (still visible)
```

### Scenario D — Overdue bill
```
GIVEN a bill has a due date of yesterday
THEN the bill shows a red "Overdue" label on the list
AND the bill creator received a push notification 2 days before it was due
```

### Scenario E — Recurring bill
```
GIVEN I add "Internet" as a monthly recurring bill
THEN the bill appears for this month
AND on the same due date next month, a new bill automatically appears
AND the house receives a notification: "Monthly bill created: Internet"
```

### Scenario F — Bill breakdown always visible
```
GIVEN there is an equal-split bill for €90 between 3 people
WHEN I tap on the bill
THEN I see: "€90.00 ÷ 3 people = €30.00 each"
AND I can see: "Alex owes €30 | Sam owes €30 | Jordan paid €90"
```

---

## Edge Cases to Handle

- User tries to add a bill with €0 → error: "Amount must be greater than 0"
- User tries to add a bill with a past due date → allow it (overdue bills are valid)
- Only 2 members in house — equal split → 50% each (not 33%)
- Bill creator leaves the house → bill remains, shown as "Former member"
- Two people try to settle the same bill at the exact same time → first one wins, second sees "already settled"

---

## Performance Requirements

- Bills list loads within 1.5 seconds on average iPhone
- Balance updates appear within 2 seconds of a change on another device (real-time)
- Adding a bill and seeing it on another device within 2 seconds

---

## Notifications Summary

| Event | Recipients | Message |
|---|---|---|
| New bill added | All members | "New bill: [name] €[amount] due [date]" |
| Bill due in 2 days | Bill creator / payer | "[name] is due in 2 days" |
| Bill settled | All members | "[name] settled by [person]" |
| Recurring bill auto-created | All members | "Monthly bill created: [name]" |
