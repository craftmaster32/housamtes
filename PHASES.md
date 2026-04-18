# PHASES.md — Housemates Build Phases, Quality Gates & Workflow

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

## PHASE 0 — Environment Setup ✅ COMPLETE

**Goal:** Your computer can run the app and you can see it on your iPhone.

### What was built:
- Full project scaffold (all folders, config files, linting, TypeScript setup)
- Supabase project structure with initial schema
- Environment variable setup
- Expo configuration

### Quality Gate:
- [x] App opens on iPhone showing a welcome/auth screen
- [x] No red error screens when opening
- [x] TypeScript compiles with zero errors
- [x] ESLint passes with zero errors

---

## PHASE 1 — Auth & House System ✅ COMPLETE

**Goal:** You can sign up, create your house, and invite your 2 housemates.

### What was built:
- Sign Up screen (email + password + validation)
- Login screen (with "Forgot Password" link)
- Email verification flow
- "Create a House" screen with invite code generation
- "Join a House" screen (enter invite code → confirm → join)
- Basic profile: name, avatar color selection
- House Settings screen (members, house name, parking config)
- Session persistence

### Database tables created:
- `users` (extends Supabase auth)
- `houses`
- `house_members`

### Quality Gate:
- [x] Sign up works with email + password
- [x] Email verification flow works
- [x] Login works and session persists after closing/reopening app
- [x] "Forgot password" sends reset email
- [x] House can be created with invite code generated
- [x] All 3 housemates can join the same house via invite code
- [x] All 3 housemates can see each other's names
- [x] House settings: name editable, parking advance window configurable
- [x] RLS verified: users cannot see other houses' data
- [x] TypeScript + ESLint pass

---

## PHASE 2 — Bills & Expenses ✅ COMPLETE

**Goal:** All bills tracked, balances always visible — Splitwise replaced.

### What was built:
- Add Bill screen (name, category, amount, due date, who paid, split type)
- Equal split and custom amount split
- Recurring bill support (monthly, bimonthly, quarterly, yearly)
- Bills list screen (grouped by category, filterable)
- Overdue bill highlighting
- Bill detail screen (full breakdown, all calculations visible)
- Edit bill screen
- Delete bill
- Mark as settled (records who settled and when)
- Balance summary on Dashboard (who owes whom)
- Monthly summary view
- Real-time sync across all phones

### Database tables created:
- `bills`
- `bill_splits`
- `settlements`

### Quality Gate:
- [x] Add a bill → appears instantly on all 3 phones
- [x] Equal split: €120 between 3 people correctly shows €40 each
- [x] Custom split calculates correctly per person
- [x] Percentages/amounts validated before saving
- [x] Overdue bill shows red/warning label
- [x] Balance dashboard shows correct totals
- [x] Mark as settled → balance updates for all 3 in real-time
- [x] Recurring bill support built
- [x] RLS: confirm User A cannot see bills from a different house
- [x] TypeScript + ESLint pass

**Note:** Push notifications for bills not yet live (Phase 6 — Edge Functions pending).

---

## PHASE 3 — Parking Manager ✅ COMPLETE

**Goal:** No more parking confusion. Every housemate knows who has the spot in real-time.

### What was built:
- Parking status card on Dashboard: "Free" or "Taken by [Name]"
- "I'm using it" / "I'm done" buttons
- Reservation request screen (date, time range, note)
- Reservation approval screen (approve or deny)
- Parking calendar: all upcoming reservations
- Conflict detection: cannot book an already-reserved slot
- Configurable settings: advance booking window, approval requirements
- Real-time sync

### Database tables created:
- `parking_status`
- `parking_reservations`
- `parking_approvals`

### Quality Gate:
- [x] Claim parking spot → status changes on all 3 phones in real-time
- [x] Release parking spot → status updates immediately
- [x] Reservation request submitted → visible to all members
- [x] Cannot book an already-reserved time slot
- [x] Parking calendar shows all future reservations correctly
- [x] Settings: advance window + approval mode configurable
- [x] RLS: reservations from other houses not visible
- [x] TypeScript + ESLint pass

**Note:** Push notifications for parking not yet live (Phase 6 — Edge Functions pending).

---

## PHASE 4 — Grocery, Chores & Tasks ✅ COMPLETE

**Goal:** One place for all shared house responsibilities and shopping.

### What was built:
- Shared grocery list (add, check off, clear checked, real-time sync)
- Personal private grocery lists
- Chore creation (name, frequency, assigned or rotating)
- Chore completion tracking (who did it, when)
- Chore overdue highlighting
- Monthly chore completion stats per person
- House task list (title, description, priority, assignee, due date)
- Task completion and history
- House notice board / pinned notes

### Database tables created:
- `grocery_items`
- `chores`
- `chore_completions`
- `tasks`
- `house_notes`

### Quality Gate:
- [x] Add item to shared list → appears on all 3 phones instantly
- [x] Check off item → shows who checked it
- [x] Clear checked items → removes for everyone
- [x] Personal list is not visible to other members
- [x] Create rotating chore → shows whose turn it is
- [x] Mark chore done → rotation advances to next person
- [x] Overdue chore shows red indicator
- [x] Tasks with priority work
- [x] Mark task complete → moves to completed section
- [x] Pinned notes visible to all members
- [x] TypeScript + ESLint pass

---

## PHASE 5 — Chat, Photos & Extra Features ✅ COMPLETE

**Goal:** In-app communication, shared photo album, and household extras.

### What was built:
- House group chat (text messages, sender name, avatar color, timestamp)
- Unread message count on tab icon
- Mark as read when chat is opened
- Photo board (camera + library upload, grid view, full-screen viewer)
- Categories: Receipts, Damage, Memories
- Delete own photos
- **Beyond original scope — also built:**
  - Events (create, track, RSVP)
  - Announcements (house-wide notices)
  - Maintenance requests (log and track home issues)
  - Voting (create polls, housemates vote)
  - Condition tracking

### Database tables created:
- `messages`
- `photos`
- `events`, `announcements`, `maintenance_requests`, `votes`, `conditions` (extra features)

### Quality Gate:
- [x] Send message → appears on all 3 phones in real-time
- [x] Unread count shows on tab when messages arrive
- [x] Upload photo from camera and library → appears in grid for all
- [x] Tap photo → opens full-screen view
- [x] Delete own photo → removes it for everyone
- [x] Cannot delete another person's photo (RLS)
- [x] TypeScript + ESLint pass

**Note:** Push notification for new chat messages not yet live (Phase 6 pending).

---

## PHASE 6 — Push Notifications 🔴 IN PROGRESS

**Goal:** App proactively reminds housemates of things before they become problems.

### What's done:
- [x] Per-user notification settings UI (toggle each event type on/off)
- [x] Settings screen: all options save and persist
- [x] Sign out clears session and returns to login

### What still needs building:
- [ ] Supabase Edge Functions for server-side push delivery
- [ ] Bill due reminder (X days before — default 2 days)
- [ ] New bill added notification
- [ ] Bill settled notification
- [ ] Parking claimed/released notification
- [ ] Parking request received/approved/denied notification
- [ ] Chore due/overdue reminder
- [ ] New task assigned notification
- [ ] New chat message notification (app backgrounded)
- [ ] Expo push token registration on login

### Quality Gate — Phase 6:
- [ ] All notification types deliver correctly on physical iPhone
- [ ] Turning off a notification type in settings stops those notifications
- [ ] Bill reminder arrives at the right time
- [ ] Edge Functions deployed and running on Supabase
- [ ] Notifications work when app is fully closed (not just backgrounded)

**Done signal:** All 3 housemates receive the right notifications for 1 week with no misses.

---

## PHASE 7 — Design & Polish 🟡 PARTIAL

**Goal:** App looks great and feels like a finished, professional product.

### What's done:
- [x] Onboarding flow (3-screen swipe, shown only on first launch)
- [x] Empty states on screens
- [x] Error boundary (friendly crash screen with retry)
- [x] Privacy policy screen (in-app)
- [x] Terms of service screen (in-app)
- [x] Sentry error tracking live
- [x] Security hardening (RLS, SecureStore, Zod validation)
- [x] Real-time on all 16 tables

### What still needs building:
- [ ] UI/UX redesign pass — Banani is working on this now
- [ ] App icon (final design — waiting on Banani)
- [ ] Splash screen (final design — waiting on Banani)
- [ ] Performance audit (FlatList virtualization, lazy loading, image caching)
- [ ] Accessibility pass (VoiceOver test, touch targets ≥ 44pt, contrast)
- [ ] "Rate this app" prompt (after 7 days of use)
- [ ] Google AdMob integration (banner ads for free tier)
- [ ] Premium in-app purchase (ad-free + unlimited photos)
- [ ] Firebase Analytics (opt-in, anonymous)

### Quality Gate — Phase 7:
- [ ] App used by all 3 housemates for 2 weeks without major issues
- [ ] No crashes in Sentry for 1 week
- [ ] All screens have loading, error, and empty states
- [ ] VoiceOver tested — all interactive elements reachable
- [ ] All touch targets ≥ 44×44pt
- [ ] App icon and splash screen are final (not Expo default)
- [ ] Ads display without crashing
- [ ] App launch time under 3 seconds on iPhone SE
- [ ] TypeScript + ESLint pass with zero warnings
- [ ] Test coverage ≥ 80%

**Done signal:** All 3 housemates would recommend this app to a friend. Zero embarrassing rough edges.

---

## PHASE 8 — App Store Submission ⬜ NOT STARTED

**Goal:** App is live on the App Store for other households to download.

### Prerequisites:
- All Phase 7 quality gates pass
- Apple Developer account ($99/year)
- Push notifications working (Phase 6 complete)
- Final design applied (Phase 7 complete)

### What I do:
- Prepare app.json: correct bundle ID, version, permissions
- Generate App Store screenshots (all required sizes)
- Write App Store description and keywords
- Configure EAS Build (Expo's cloud build service)
- Create production build and submit via EAS Submit
- Set up TestFlight for beta testing first
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
| 0 | Environment Setup | ✅ Complete |
| 1 | Auth & House System | ✅ Complete |
| 2 | Bills & Expenses | ✅ Complete |
| 3 | Parking Manager | ✅ Complete |
| 4 | Grocery + Chores + Tasks | ✅ Complete |
| 5 | Chat + Photos + Extras | ✅ Complete |
| 6 | Push Notifications | 🔴 In progress — Edge Functions not built yet |
| 7 | Design & Polish | 🟡 Partial — design in progress (Banani), icon/ads/accessibility pending |
| 8 | App Store Submission | ⬜ Not started |

**Next action:** Build Phase 6 — Supabase Edge Functions for push notifications.
After that: Apply Banani's design, finish Phase 7 polish, then App Store.
