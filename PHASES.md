# PHASES.md — Nestiq Build Phases, Quality Gates & Workflow

This document defines the exact build sequence, what must be true before moving forward,
and how the owner and Claude communicate at each step.

---

## Core Principle

**We never skip a quality gate. We never rush a phase.**
A phase is not complete until every item on its gate checklist is verified on a real iPhone.
If something is broken, we fix it before moving forward — no exceptions.

---

## Communication Cadence

**Before every phase starts:**
```
BEFORE I BUILD — [Feature Name]
What I'm about to create: [plain English]
You will see: [what appears on screen]
This will let you: [what action it enables]
New database tables needed: [yes/no — if yes, described simply]

Ready to proceed? (yes / change this / explain more)
```

**When a phase is complete:**
```
PHASE [N] COMPLETE

Now working:
• [feature in plain English]
• [feature in plain English]

To test it — do this on your iPhone:
1. [exact step]
2. [exact step]
→ You should see: [expected result]

Test with all 3 housemates:
• [step for second person]
• [what to verify together]

Known gaps (coming in next phase):
• [thing not yet built]
```

**If something breaks:**
```
ISSUE FOUND: [plain English description]
What happened: [simple explanation]
What I'm doing to fix it: [simple explanation]
What you need to do: [none / or specific step]
```

---

## PHASE 0 — Environment Setup

**Goal:** Your computer can run the app and you can see it on your iPhone.

### What I build:
- Full project scaffold (all folders, config files, linting, TypeScript setup)
- Supabase project structure with initial empty schema
- Environment variable setup
- Expo configuration
- Setup guide specific to your machine

### What you do — step by step:
1. Download and install **Node.js** (I'll give you the exact link and installer)
2. Download **Expo Go** from the App Store on all 3 iPhones (free)
3. Create a free account at **supabase.com** (just email + password)
4. Open Terminal on your Mac (I'll show you how to find it)
5. Run one command I give you — this downloads the project
6. Run a second command — this starts the app
7. Scan the QR code with your iPhone camera → app opens

### Quality Gate — Phase 0 must pass ALL of these:

- [ ] App opens on your iPhone showing a welcome screen
- [ ] No red error screens when opening
- [ ] All 3 housemates can open the app via Expo Go on their phones
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit` passes)
- [ ] ESLint passes with zero errors

**Done signal:** All 3 housemates see the same "Welcome to Nestiq" screen.

---

## PHASE 1 — Auth & House System

**Goal:** You can sign up, create your house, and invite your 2 housemates.

### What I build:
- Sign Up screen (email + password + validation)
- Login screen (with "Forgot Password" link)
- Email verification flow
- "Create a House" screen with invite code generation
- "Join a House" screen (enter invite code → confirm → join)
- Basic profile: name, avatar color selection
- House Settings screen (members, house name, parking config)
- Session persistence (stay logged in for 30 days)

### Database tables created:
- `users` (extends Supabase auth)
- `houses`
- `house_members`

### Quality Gate — Phase 1:

- [ ] Sign up works with email + password
- [ ] Email verification email arrives and clicking it activates account
- [ ] Login works and session persists after closing/reopening the app
- [ ] "Forgot password" sends reset email
- [ ] House can be created with invite code generated
- [ ] All 3 housemates can join the same house via invite code
- [ ] All 3 housemates can see each other's names in the house
- [ ] House settings: name editable, parking advance window configurable
- [ ] RLS verified: test that logging in as User A cannot see data belonging to a different house
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes
- [ ] All Phase 1 screen tests pass

**Done signal:** All 3 housemates are logged in, inside the same house, see each other's names.

---

## PHASE 2 — Bills & Expenses

**Goal:** All bills tracked, balances always visible — Splitwise replaced.

### What I build:
- Add Bill screen (name, category, amount, due date, who paid, split type)
- Equal split and custom percentage split
- Recurring bill support (monthly, bimonthly, quarterly, yearly)
- Bills list screen (grouped by category, filterable)
- Overdue bill highlighting
- Bill detail screen (full breakdown, all calculations visible)
- Edit bill screen (owner can update amount and due date)
- Mark as settled (records who settled and when)
- Balance summary (always visible on Dashboard — who owes whom)
- Tap balance to see exact breakdown with calculations
- Monthly summary view
- Push notifications: new bill added, bill due soon, bill settled

### Database tables created:
- `bills`
- `bill_splits`
- `settlements`

### Quality Gate — Phase 2:

- [ ] Add a bill → appears instantly on all 3 phones
- [ ] Equal split: €120 between 3 people correctly shows €40 each
- [ ] Custom split: 50/30/20 correctly calculates per person
- [ ] Percentages must add to 100% — error shown if not
- [ ] Overdue bill shows red/warning label
- [ ] Balance dashboard shows correct totals (spot-checked against manual math)
- [ ] Tapping a balance shows the breakdown with visible calculations
- [ ] Mark as settled → balance updates for all 3 in real-time
- [ ] Recurring bill: set as monthly → re-appears next month
- [ ] Push notification received on all phones when new bill added
- [ ] Push notification received when bill is due in 2 days
- [ ] All 3 housemates add at least 2 real bills each and verify math
- [ ] RLS: confirm User A cannot see bills from a different house
- [ ] TypeScript + ESLint pass
- [ ] Test coverage ≥ 80% on bill calculation logic

**Done signal:** All current real bills are in the app. Math checks out. Confident to stop using Splitwise.

---

## PHASE 3 — Parking Manager

**Goal:** No more parking confusion. Every housemate knows who has the spot in real-time.

### What I build:
- Parking status card on Dashboard: "Free" or "Taken by [Name] — 2h 15m ago"
- "I'm using it" button (claims spot)
- "I'm done" button (releases spot)
- Reservation request screen: pick date, time range, add optional note
- Reservation approval screen: approve or deny with one tap
- Parking calendar: view all upcoming reservations
- Conflict detection: cannot book an already-reserved slot
- Configurable settings: advance booking window, approval requirements
- Push notifications: spot claimed/released, request received, request approved/denied

### Database tables created:
- `parking_status`
- `parking_reservations`
- `parking_approvals`

### Quality Gate — Phase 3:

- [ ] Claim parking spot → status changes on all 3 phones within 2 seconds (real-time)
- [ ] Release parking spot → status updates on all 3 phones immediately
- [ ] Push notification sent to others when spot is claimed or released
- [ ] Reservation request submitted → both other housemates receive notification
- [ ] Both housemates approve → requester gets "confirmed" notification
- [ ] One housemate denies → requester gets "denied" notification
- [ ] Cannot book an already-reserved time slot (error message shown)
- [ ] Cannot book further ahead than the advance window (configurable, default 2 days)
- [ ] Parking calendar shows all future reservations correctly
- [ ] Change advance window to 7 days in settings → enforced immediately
- [ ] Change approval to "any one member" in settings → only one approval needed
- [ ] RLS: reservations from other houses not visible
- [ ] All 3 housemates test the full flow: request → approve → confirm
- [ ] TypeScript + ESLint pass

**Done signal:** All 3 housemates use parking manager for 1 full week with no confusion.

---

## PHASE 4 — Grocery, Chores & Tasks

**Goal:** One place for all shared house responsibilities and shopping.

### What I build:
- Shared grocery list (add, check off, clear checked, real-time sync)
- Item suggestions based on recent additions
- Personal private grocery lists
- Chore creation (name, frequency, assigned or rotating)
- Chore completion tracking (who did it, when)
- Chore overdue highlighting + push notification
- Monthly chore completion stats per person
- House task list (title, description, priority, assignee, due date)
- Task completion and history
- House notice board (pinned notes)

### Database tables created:
- `grocery_items`
- `chores`
- `chore_completions`
- `tasks`
- `house_notes`

### Quality Gate — Phase 4:

- [ ] Add item to shared list → appears on all 3 phones instantly
- [ ] Check off item → shows who checked it and when
- [ ] Clear checked items → removes all checked items for everyone
- [ ] Personal list is not visible to other members (verified)
- [ ] Create rotating chore → correctly shows whose turn it is
- [ ] Mark chore done → rotation advances to next person
- [ ] Overdue chore shows red indicator + sends push notification
- [ ] Add task with priority → appears in task list
- [ ] Mark task complete → moves to completed section, stays in history
- [ ] Add pinned note → visible to all members
- [ ] TypeScript + ESLint pass

**Done signal:** All 3 housemates use grocery list and chores for 1 week.

---

## PHASE 5 — Chat & Photos

**Goal:** In-app communication — house chat and shared photo album.

### What I build:
- House group chat (text messages only)
- Sender name, avatar color, timestamp on each message
- Unread message count on tab icon
- Mark as read when chat is opened
- Push notification for new messages
- Photo board with camera + library upload
- Photo grid view
- Categories: Receipts, Damage, Memories
- Full-screen photo viewer
- Delete own photos

### Database tables created:
- `messages`
- `photos`

### Quality Gate — Phase 5:

- [ ] Send message → appears on all 3 phones in real-time
- [ ] Unread count shows on tab when messages arrive while on another screen
- [ ] Push notification received when app is backgrounded and message arrives
- [ ] Upload photo from camera and library → appears in grid for all members
- [ ] Tap photo → opens full-screen view
- [ ] Delete own photo → removes it for everyone
- [ ] Cannot delete another person's photo (RLS verified)
- [ ] TypeScript + ESLint pass

**Done signal:** Chat and photo board used for at least 3 days by all 3 housemates.

---

## PHASE 6 — Notifications & Settings Polish

**Goal:** App proactively reminds you of things before they become problems.

### What I build:
- Per-user notification settings (toggle each event type on/off)
- Bill due reminder (X days before — configurable, default 2)
- Scheduled chore reminders
- Supabase Edge Functions for server-side scheduled notifications
- Full settings screen (profile, notifications, house settings, privacy policy, sign out)

### Quality Gate — Phase 6:

- [ ] All notification types deliver correctly on physical iPhone
- [ ] Turning off a notification type in settings stops those notifications
- [ ] Bill reminder arrives at the right time (test with a short deadline)
- [ ] Edge functions deployed and running on Supabase
- [ ] Settings screen: all options save and persist after app restart
- [ ] Sign out clears session and returns to login screen

**Done signal:** No missed bills or chores for 2 weeks of real use.

---

## PHASE 7 — Polish & Public Preparation

**Goal:** App feels like a finished product. Ready for the App Store.

### What I build:
- Onboarding flow for new users (3 screens, shown only on first launch)
- Empty states on every screen (helpful, friendly messages — not blank screens)
- Error boundary (catches crashes, shows friendly message + retry button)
- App icon and splash screen (final design)
- Performance audit (FlatList virtualization, lazy loading, image caching)
- Accessibility pass (VoiceOver test, touch targets, contrast)
- Privacy policy screen
- Terms of service screen
- "Rate this app" prompt (after 7 days of use)
- Google AdMob integration (banner ads for free tier)
- Sentry error tracking (live crash reports)
- Firebase Analytics (opt-in, anonymous usage data)

### Quality Gate — Phase 7:

- [ ] App used by all 3 housemates for 2 full weeks without major issues
- [ ] No crashes reported in Sentry for 1 week
- [ ] All screens have: loading state, error state, empty state
- [ ] Onboarding flow shown on first launch, never shown again
- [ ] VoiceOver tested on iPhone — all interactive elements reachable
- [ ] All touch targets ≥ 44x44pt
- [ ] App icon and splash screen are final (not Expo default)
- [ ] Privacy policy and terms accessible in-app
- [ ] Ads display without crashing
- [ ] App launch time under 3 seconds on iPhone SE (oldest target device)
- [ ] TypeScript + ESLint pass with zero warnings
- [ ] Full test suite passes
- [ ] Test coverage ≥ 80% overall

**Done signal:** All 3 housemates would recommend this app to friends. Zero embarrassing rough edges.

---

## PHASE 8 — App Store Submission

**Goal:** App is live on the App Store for other households to download.

### Prerequisites:
- All Phase 7 quality gates pass
- Apple Developer account created ($99/year — I'll guide you through this)

### What I do:
- Prepare app.json with correct bundle ID, version, permissions
- Generate App Store screenshots (all required sizes)
- Write App Store description and keywords
- Configure EAS Build (Expo's cloud build service)
- Create production build and submit via EAS Submit
- Set up TestFlight for beta testing with outside users first
- Monitor launch — watch Sentry and crash reports closely

### What you do:
- Create Apple Developer account
- Review and approve App Store listing text
- Test the TestFlight build yourself first
- Submit for App Store review (Apple reviews in 1–3 days)

---

## SCOPE CHANGE PROTOCOL

If during any phase you want to add, change, or remove a feature:

1. **Stop** — don't implement it mid-phase
2. **Log it** — describe it in IDEAS.md or as a change request
3. **Assess** — does it fit the current phase, or is it a new phase?
4. **Decide together** — confirm before any code changes
5. **Update FEATURES.md** — the spec is always updated first
6. **Then build** — code follows the spec, never the other way around

---

## CURRENT STATUS

| Phase | Name | Status |
|---|---|---|
| 0 | Environment Setup | In progress — awaiting user .env key + first run |
| 1 | Auth & House System | Not started |
| 2 | Bills & Expenses | Not started |
| 3 | Parking Manager | Not started |
| 4 | Grocery + Chores + Tasks | Not started |
| 5 | Chat + Photos | Not started |
| 6 | Notifications & Settings | Not started |
| 7 | Polish & Public Prep | Not started |
| 8 | App Store Submission | Not started |

**Next action:** Begin Phase 0 — Environment Setup.
