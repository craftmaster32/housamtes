# FEATURES.md — Nestiq Feature Specifications

All features written in BDD (Behavior-Driven Development) format.
Each feature uses MUST / SHOULD / MAY keywords:
- **MUST** = required, non-negotiable
- **SHOULD** = important, build in this phase
- **MAY** = nice-to-have, can move to next phase

No feature gets coded unless it is listed here.
New ideas go in IDEAS.md, not here.

---

## PHASE 1 — Auth & House System

### Feature 1.1 — User Sign Up

**User Story:** As a new housemate, I want to create an account so I can access my household.

**Acceptance Criteria:**
- MUST support email + password sign-up
- MUST validate email format before submitting
- MUST require password of minimum 8 characters
- MUST send email verification before account is active
- MUST show clear error if email is already registered
- MUST show loading state while request is in progress
- SHOULD display inline validation errors immediately (not on submit)
- MAY support Sign in with Apple (Phase 7+)

**Scenarios:**
```
GIVEN I am on the Sign Up screen
WHEN I enter a valid email and password (8+ chars) and tap "Create Account"
THEN the system sends me a verification email
AND shows a confirmation message: "Check your email to verify your account"

GIVEN I enter an email that is already registered
WHEN I tap "Create Account"
THEN the system shows: "This email is already in use"
AND does not create a new account

GIVEN I enter a password shorter than 8 characters
WHEN I move to the next field
THEN the system immediately shows: "Password must be at least 8 characters"
AND disables the "Create Account" button until fixed
```

---

### Feature 1.2 — User Login

**Acceptance Criteria:**
- MUST support login with email + password
- MUST persist session for 30 days (user stays logged in)
- MUST handle incorrect password with a clear message
- MUST handle unverified email with instruction to check inbox
- MUST provide "Forgot Password" link that sends reset email
- MUST show loading state during login
- MUST redirect to Dashboard after successful login

**Scenarios:**
```
GIVEN I have a verified account
WHEN I enter correct email and password and tap "Log In"
THEN the app navigates to the Dashboard
AND my session is saved (app stays logged in when reopened)

GIVEN I enter the wrong password
WHEN I tap "Log In"
THEN the system shows: "Incorrect email or password"
AND does not log me in
AND does not say which field is wrong (security)

GIVEN I close and reopen the app within 30 days
THEN I am automatically logged in without entering credentials
```

---

### Feature 1.3 — Create a House

**User Story:** As the first housemate, I want to create a house profile so others can join.

**Acceptance Criteria:**
- MUST allow user to set house name (2–50 characters)
- MUST generate a unique 8-character invite code (e.g. "NEST-4821")
- MUST make the invite code easy to copy and share
- MUST make the creator the house admin
- MUST allow the creator to set house address (optional)
- SHOULD immediately show the invite code after creation
- SHOULD allow the house name to be changed later in settings

**Scenarios:**
```
GIVEN I have just signed up and have no house
WHEN I enter "Our Flat" and tap "Create House"
THEN the system creates the house
AND shows me the invite code: "NEST-4821"
AND displays a "Share Code" button that copies it to clipboard
AND takes me to the Dashboard

GIVEN I try to create a house with a name shorter than 2 characters
THEN the system shows: "House name must be at least 2 characters"
AND prevents creation
```

---

### Feature 1.4 — Join a House

**Acceptance Criteria:**
- MUST allow user to enter an invite code to join
- MUST validate the code exists before showing confirmation
- MUST show the house name and existing member count before joining
- MUST add the user as a member immediately on confirmation
- MUST redirect to Dashboard after joining
- MUST show error if code is invalid or expired
- SHOULD be case-insensitive for the invite code
- MAY support joining via a shared link (Phase 7+)

**Scenarios:**
```
GIVEN I have a valid invite code "NEST-4821"
WHEN I enter it and tap "Join"
THEN the system shows: "Join 'Our Flat'? 2 members already inside"
AND when I confirm, I am added as a member
AND taken to the Dashboard

GIVEN I enter an invalid code "XXXX-0000"
THEN the system shows: "Invalid invite code. Check with your housemate."
AND does not add me to any house
```

---

### Feature 1.5 — House Settings

**Acceptance Criteria:**
- MUST show all house members with their names
- MUST allow admin to change house name
- MUST allow admin to remove a member (with confirmation)
- MUST allow admin to regenerate the invite code
- MUST allow all members to leave the house (with confirmation)
- MUST show configurable parking advance booking window (default: 2 days, range: 1–14 days)
- MUST show configurable parking approval setting (all members / any one member)
- SHOULD show when each member joined

---

## PHASE 2 — Bills & Expenses

### Feature 2.1 — Add a Bill

**User Story:** As a housemate, I want to log a bill so everyone knows what we owe.

**Acceptance Criteria:**
- MUST allow entering: bill name, category, total amount, due date, who paid it
- MUST support split types: equal (default), or custom percentage per person
- MUST support categories: Electricity, Water, Internet, Rent, Subscriptions, Groceries, Other
- MUST support one-time bills and recurring bills (monthly, bimonthly, quarterly, yearly)
- MUST show a preview of each person's share before saving
- MUST notify all housemates when a new bill is added (push notification)
- MUST validate that custom split percentages add up to 100%
- SHOULD auto-fill last amount for recurring bills
- SHOULD allow attaching a photo of the receipt

**Scenarios:**
```
GIVEN I am on the Add Bill screen
WHEN I enter: "Electricity", amount €120, due in 5 days, paid by me, split equally (3 people)
THEN the preview shows: "Each person owes €40"
AND when I save, the bill appears in the bills list
AND the other 2 housemates receive a push notification: "New bill added: Electricity €120"

GIVEN I set a custom split of 50% / 30% / 20%
AND the percentages don't add up to 100%
THEN the system shows: "Percentages must add up to 100%"
AND disables the Save button until fixed

GIVEN I set a bill as monthly recurring
THEN the bill automatically re-appears each month on the same due day
```

---

### Feature 2.2 — Bills Overview

**Acceptance Criteria:**
- MUST show all bills grouped by category
- MUST show each bill: name, amount, due date, who paid, status (pending/settled)
- MUST highlight overdue bills visibly (red or warning label)
- MUST allow filtering by: All / This Month / Category
- MUST show a balance summary at the top: who owes whom and how much
- MUST make the balance summary always visible on the Dashboard
- SHOULD show the bills in chronological order by due date
- SHOULD show a monthly total spending for the house

**Scenarios:**
```
GIVEN there are 3 bills this month
WHEN I open the Bills screen
THEN I see all 3 bills grouped by category
AND at the top I see: "You owe €45 to Alex" and "Jordan owes you €30"

GIVEN a bill is past its due date
THEN it shows a red "Overdue" label next to it
```

---

### Feature 2.3 — Bill Detail & Edit

**Acceptance Criteria:**
- MUST show full bill details: all fields, who owes what, history of changes
- MUST allow the bill owner to edit: amount, due date, notes
- MUST show a breakdown of every person's share with calculations visible
- MUST allow any member to mark the bill as settled
- MUST show who settled it and when
- SHOULD show a timeline of changes to the bill

**Scenarios:**
```
GIVEN I tap on the "Water" bill
THEN I see: total €60, due March 31, paid by Jordan
AND the breakdown: "You owe €20 | Alex owes €20 | Jordan paid €60"
AND I can see how the calculation was made

GIVEN I tap "Mark as Settled"
THEN the bill moves to a "Settled" section
AND a notification is sent to all members: "Water bill marked as settled"
```

---

### Feature 2.4 — Balance Dashboard

**Acceptance Criteria:**
- MUST show each housemate's balance at all times on the Dashboard
- MUST show: positive = they are owed money, negative = they owe money
- MUST show the exact bills contributing to each balance (tap to expand)
- MUST update in real-time when any bill is added or settled
- MUST show a monthly summary: total spent, top category
- SHOULD show a "Settle Up" button next to each debt that records a manual settlement
- MAY allow exporting the monthly summary as text (to paste into WhatsApp)

---

## PHASE 3 — Parking Manager

### Feature 3.1 — Parking Status

**User Story:** As a housemate, I want to see if the parking spot is free right now.

**Acceptance Criteria:**
- MUST show current parking status on the Dashboard: "Free" or "Taken by [Name]"
- MUST allow any member to claim the spot with one tap
- MUST allow the current occupant to release the spot with one tap
- MUST update in real-time for all members simultaneously
- MUST show how long the current occupant has had the spot
- MUST notify all members when the spot is claimed or released

**Scenarios:**
```
GIVEN the parking spot is free
WHEN I tap "I'm using it"
THEN the status immediately changes to "Taken by You" on all phones
AND the other housemates receive a notification: "Alex claimed the parking spot"

GIVEN I am currently using the spot
WHEN I tap "I'm done"
THEN the status changes to "Free" on all phones
AND the other housemates receive a notification: "Parking spot is now free"
```

---

### Feature 3.2 — Parking Reservations

**Acceptance Criteria:**
- MUST allow any member to request the spot for a future date and time range
- MUST enforce advance booking limit (default 2 days, configurable in house settings)
- MUST send the request to all other members for approval
- MUST require all other members to approve before the reservation is confirmed
- MUST notify the requester when approved or denied (with who approved/denied)
- MUST show a calendar view of all upcoming reservations
- MUST prevent booking a slot that is already reserved
- SHOULD allow a note with the request (e.g., "Moving furniture")
- SHOULD allow the requester to cancel a pending or approved reservation
- MAY allow one member to deny with a reason

**Scenarios:**
```
GIVEN I want the spot on Saturday 10am–2pm
WHEN I submit a reservation request
THEN Alex and Jordan both receive a notification: "Sam wants the parking spot Sat 10am–2pm"
AND both must approve before it is confirmed
AND I see "Pending approval" in my reservations

GIVEN both housemates approve
THEN I receive: "Your reservation is confirmed: Sat 10am–2pm"
AND the slot appears on the parking calendar

GIVEN I try to book a slot that Alex already has reserved
THEN the system shows: "This time is already reserved by Alex"
AND prevents my booking
```

---

## PHASE 4A — Grocery Lists

### Feature 4.1 — Shared Grocery List

**Acceptance Criteria:**
- MUST show one shared list for common household items
- MUST allow any member to add items with: name and optional quantity
- MUST allow any member to check off items when bought (shows who bought it)
- MUST allow any member to uncheck an item if it was checked by mistake
- MUST have a "Clear checked items" button
- MUST sync in real-time across all phones
- SHOULD suggest recently used items when typing
- SHOULD allow categorizing items (Cleaning, Food, Bathroom, etc.)

---

### Feature 4.2 — Personal Lists

**Acceptance Criteria:**
- MUST allow each user to maintain private shopping lists
- MUST keep personal lists invisible to other members
- MUST allow switching between shared and personal lists with a toggle

---

## PHASE 4B — Chores

### Feature 4.3 — Chore Management

**Acceptance Criteria:**
- MUST allow creating chores with: name, frequency (daily/weekly/monthly), assigned person or rotation
- MUST show whose turn it is this cycle for rotating chores
- MUST auto-advance rotation after a chore is marked complete
- MUST show overdue chores prominently (red indicator)
- MUST allow any member to mark a chore as done (logs who did it and when)
- MUST send a reminder notification when a chore is due
- SHOULD show a simple stat: chores completed per person this month

---

## PHASE 4C — Tasks & Notes

### Feature 4.4 — House Task List

**Acceptance Criteria:**
- MUST allow adding tasks with: title, description, priority (low/medium/high), optional assignee
- MUST allow marking tasks complete (stays in history, doesn't disappear)
- MUST filter tasks: All / Active / Completed
- SHOULD allow assigning a due date to tasks

---

### Feature 4.5 — House Notice Board

**Acceptance Criteria:**
- MUST allow any member to pin notes visible to all (WiFi password, bin day, etc.)
- MUST allow editing and deleting any note
- MUST show who posted each note and when
- SHOULD support at most 20 pinned notes (oldest auto-archives if exceeded)

---

## PHASE 5 — Chat & Photos

### Feature 5.1 — House Group Chat

**Acceptance Criteria:**
- MUST show a single group chat for all house members
- MUST support text messages with sender name, color avatar, and timestamp
- MUST show unread message count on the tab icon
- MUST mark messages as read when the chat screen is opened
- MUST notify members of new messages when the app is in background
- SHOULD show "seen" indicators per message

---

### Feature 5.2 — Photo Board

**Acceptance Criteria:**
- MUST allow uploading photos from camera or photo library
- MUST show photos in a grid with uploader name and date
- MUST support categories: Receipts, Damage/Maintenance, Memories
- MUST allow filtering by category
- MUST show photo in full-screen when tapped
- MUST allow deleting own photos
- SHOULD support captions on photos
- Free tier: max 50 photos per house

---

## PHASE 6 — Notifications

All push notifications are configurable per user in Settings.

| Event | Who gets notified | Message |
|---|---|---|
| New bill added | All members | "New bill: [Name] €[Amount] due [Date]" |
| Bill due in 2 days | Bill owner | "[Name] bill is due in 2 days" |
| Bill settled | All members | "[Name] bill marked as settled by [Person]" |
| Parking claimed | All members | "[Person] claimed the parking spot" |
| Parking released | All members | "Parking spot is now free" |
| Parking request received | All other members | "[Person] wants the spot [Date] [Time]" |
| Parking request approved/denied | Requester | "Your parking request was [approved/denied]" |
| Chore due today | Assigned person | "[Chore name] is due today" |
| Chore overdue | Assigned person | "[Chore name] is overdue" |
| New task assigned | Assignee | "New task assigned to you: [Title]" |
| New chat message | All members (if app backgrounded) | "[Person]: [First 50 chars of message]" |

---

## PHASE 7 — Polish & Public Prep

- Onboarding flow (3-screen intro for first-time users)
- App Store assets (icon, screenshots, description)
- Privacy policy screen (in-app)
- Terms of service screen (in-app)
- "Rate this app" prompt after 7 days of active use
- Anonymous analytics (opt-in only)
- Google AdMob banner ads (free tier users)
- Premium in-app purchase: ad-free + unlimited photos + PDF export

---

## OUT OF SCOPE — NOT BUILDING

- In-app money transfers (Venmo, PayPal, bank integrations)
- Roommate matching or finding new housemates
- Smart home device control
- Android (Phase 7+)
- Web browser version
- Multi-language support (Phase 7+)
- Custom themes (premium, Phase 7+)
