# DESIGN.md — the HouseMates redesign

The design language, the decisions behind it, and how we work on it.
Read this before touching any screen's look. It is the memory of the redesign:
if a chat gets summarised, this file is what carries the process forward.

**Owner:** non-technical, plain English. **Goal:** the app should feel warm and
hand-made — like a real shared house fridge, notebook and receipts — and never
like a generic AI-generated app.

---

## 0. Start here — the loop for every page (new chat? follow this)

The owner will just say "work on the design" or "next page". Do this, in order:

1. **Get the branch:** `git fetch origin feature/app-redesign` and check it out.
   Never start from `main`, never make a new design branch or PR. Read §7 to see
   which page is next.
2. **Mockup:** make an HTML mockup of the next page (light + dark), show it, and
   wait for a yes. Change it until the owner is happy.
3. **Build** it on `feature/app-redesign`. Commit as you go. Before each commit:
   `npx tsc --noEmit`, `npm run lint`, `npx jest`. Look at the page in light and
   dark on the test house before showing it.
4. **Push only when the owner says "push"/"yes"** (even if a hook nags). Pushing
   updates the preview link on PR #252 so the owner can try it on their phone.
5. **When the owner says the page is done**, do the review step — once per page,
   never per push: post the comment `@coderabbitai review` on PR #252.
   CodeRabbit then checks only what changed since its last review. Fix what it
   finds (push with permission), then tell the owner in plain English.
   **Don't push anything while CodeRabbit is reviewing** — a new commit cancels
   the review ("Head commit changed") and it has to be asked again.
6. **Write it down:** tick the page in §1, add what was decided to §7, commit.
7. **Last page done?** Mark PR #252 "Ready for review" (not draft), let
   CodeRabbit do its final pass, fix, then the owner merges once
   ("Create a merge commit"). The whole app changes look in one update.

Cost rule: drafts are not reviewed automatically, so many pushes are free. The
only reviews are the one-per-page `@coderabbitai review` and the final one. If
the repo's automation starts posting `@coderabbitai full review` after each page
review (a full re-check of everything), tell the owner — that wastes tokens.

---

## 1. Ground rules (owner's words, keep them)

- **Design only.** Never change features, flows or wording ("word gaming") while
  restyling. Every tap must still do what it did. Texts stay the same keys.
  Exception: when the owner explicitly asks for a layout/flow change (e.g. the
  Splitwise-style split, moving Contributions to insights).
- **Mockup first, then code.** For every page: make an HTML mockup, show it,
  get a yes, then build. Mockups live in the scratchpad (not the repo).
- **One page at a time:** Home ✅ → Bills ✅ → Parking ✅ (review asked on #252) → Tasks (Chores merged in) ✅ → Chat ✅ → More/Settings ✅ →
  Grocery → Spending ✅ (review asked on #252) → the rest (autonomous pass) → sign-in, intro,
  house setup, 404 (built, owner to review on the preview).
- **One branch, one draft PR:** all redesign work goes on `feature/app-redesign`
  (PR #252, kept as a **draft**). CodeRabbit skips drafts, so pushes during the
  work cost no reviews; each push still gets a Vercel preview and the free CI
  checks. When every page is done: mark #252 "Ready for review" → one
  CodeRabbit review → fix → the owner merges once, so the whole app changes
  look together. Unrelated bug fixes go in their own small PRs.
- **Previews never touch the live app.** Vercel previews use the separate
  staging Supabase with fake data. Never copy real data there.
- **Never push without the owner saying "push" / "yes".**
- Mate (the house mascot) appears **at most once per screen**.

## 2. What "not AI-looking" means here (lessons from feedback)

Things the owner rejected, so don't do them:

- Generic rounded cards with icon + title + subtitle rows, pill badges, gradient
  hero blocks, uppercase grey section labels ("ALL EXPENSES"), segmented
  controls with a filled blue pill, outlined Material text inputs.
- A "+" icon _and_ a "+" in the text on the same button (pick one).
- Drawings that disappear on dark backgrounds.
- Too much information stacked before the main content.
- Stickers behind the **home** card drawings (owner: "no need") — stickers are
  only used on the Bills recurring tiles.
- Animations that feel cheap: things that jump, pop in, or slide away and then
  re-appear abruptly. Motion must be continuous and physical.

What works instead — real-world objects with one job each:

- **Notebook page** for money (ruled lines, red margin, scalloped torn bottom).
- **Blue sticky note** for house notes and for small results ("₪95 per person").
- **Receipt roll / slip** for expenses (zig-zag torn edges, dashed day headers,
  dotted leaders between name and price, rubber stamps).
- **Paper tag** with a punched hole for the main action on a tile.
- **Hand-circled words** for selection (categories, chosen day).
- **Marker underline** for tabs.
- **Underlined form fields** (writing on a line), not boxes.
- **Avatar circles** for picking people (blue ring = chosen, tick badge = in).
- **Glanceable widget tiles:** small label row → one big Fraunces answer →
  one meta line → small hand-drawn picture in the corner.
- **Rubber stamps** instead of pill badges ("✓ Settled", "Recurring", big
  green "Settled by X on date" across a settled bill).

## 3. Tokens

All colours come from `constants/colors.ts` (`useThemedColors()`); never
hard-code except identity colours (avatars) and the paper-tag pink.

| Role                                              | Light                                                  | Dark                  | Notes                                                |
| ------------------------------------------------- | ------------------------------------------------------ | --------------------- | ---------------------------------------------------- |
| background                                        | `#F2F1EE` stone                                        | `#1E2024` graphite    | page                                                 |
| surface                                           | `#FFFFFF`                                              | `#2A2D32`             | cards, chips                                         |
| primary (the **only** accent)                     | `#3B6FBF`                                              | `#4E82D4`             | links, rings, buttons                                |
| success / danger                                  | `#2F8550` / `#B84540`                                  | `#4FB071` / `#E5645F` | money owed to / by me, overdue                       |
| paper / paperInk / paperMuted                     | `#FBF3D3` / `#22201D` / `#6B6250`                      | `#F3EBCB` …           | notebook page, period strip                          |
| paperRule / paperMargin                           | blue 10% / red 32%                                     | same                  | ruled lines, margin                                  |
| note / noteInk                                    | `#D6E4F7` / `#14243D`                                  | `#CADBF2`             | sticky note                                          |
| receipt / receiptInk / receiptMuted / receiptRule | `#FFFDF8` / `#22201D` / `#7A746B` / ink 20%            | `#F4F1EA` …           | receipt paper                                        |
| sticker                                           | transparent                                            | `#F3EEE3`             | backing for drawings in dark mode (Bills tiles only) |
| paper tag                                         | cream `c.paper`, urgent pink `#F6D8D2` + ink `#8E2F28` | same                  | Log button                                           |

Paper surfaces (notebook, note, receipt) **stay light in dark mode** — like
real paper on a dark table. That's what keeps dark mode from feeling generic.

**Type**

- **Fraunces** (serif) for titles and big answers/amounts — `useHeadingFont('semibold')`
  (falls back to Heebo for Hebrew). Screen title 36, section 22, big answer 30–56.
- **Inter** for body (`font.*` from `constants/typography.ts`). Labels: 13.5 bold,
  muted. Values: 17 semibold.
- **Caveat** handwriting — `useHandFont()` (Heebo for Hebrew). Use sparingly for
  human notes: "Settle up", status lines ("Next due 1 Nov"), +/− balances,
  "Next unpaid period", "+ Add recurring bill", "Fill remaining equally".
- Money: always `writingDirection: 'ltr'` so ₪ and digits don't reorder in Hebrew.
  Big amounts use `<Money wholeFamily={heading.semibold.fontFamily}>` (small cents).

**Sizes:** sizes via `ms()`/`mf()` from `utils/responsive`. Touch targets ≥ 44.
Card radius 20–24, sheet radius 26, buttons 16–18.

## 4. Shared building blocks (use these, don't re-invent)

| Component                               | File                                                                | Use                                                                       |
| --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| NotebookPaper                           | `components/shared/NotebookPaper.tsx`                               | money card, amount entry                                                  |
| Stamp                                   | `components/shared/Stamp.tsx`                                       | rubber stamp; `big` for settled                                           |
| DotLeader                               | `components/shared/DotLeader.tsx`                                   | dotted line name → price                                                  |
| ArtSticker                              | `components/shared/ArtSticker.tsx`                                  | light backing for drawings in dark mode (Bills only)                      |
| Mate                                    | `components/shared/Mate.tsx`                                        | mascot (once per screen, empty states, loader)                            |
| ReceiptRoll / ReceiptEdge               | `components/bills/ReceiptRoll.tsx`                                  | receipt paper with zig-zag edges                                          |
| BillTabs                                | `components/bills/BillTabs.tsx`                                     | marker-underline tabs; `role="radio"` for in-form choices                 |
| CategoryWords                           | `components/bills/CategoryWords.tsx`                                | hand-circled filter words                                                 |
| ExpenseLines                            | `components/bills/ExpenseLines.tsx`                                 | receipt lines, day headers, swipe-to-delete                               |
| BalancePaper                            | `components/bills/BalancePaper.tsx`                                 | "You're owed" + handwritten settle-up                                     |
| BillSlip                                | `components/bills/BillSlip.tsx`                                     | bill detail as a receipt slip                                             |
| UnderlineInput                          | `components/bills/form/UnderlineInput.tsx`                          | form field on a line                                                      |
| PersonPicker                            | `components/bills/form/PersonPicker.tsx`                            | avatar circles (single ring / multi tick)                                 |
| SplitNote                               | `components/bills/form/SplitNote.tsx`                               | sticky-note result                                                        |
| PaperTag                                | `components/bills/recurring/PaperTag.tsx`                           | tile action button (no "+")                                               |
| MonthTrack                              | `components/bills/recurring/MonthTrack.tsx`                         | 6 month boxes: tick / red ring / dashed next                              |
| SheetHeader, PeriodStepper, ChoiceChips | `components/bills/recurring/`                                       | bottom-sheet header with grab handle, period on paper strip, people chips |
| PenCircle                               | `components/shared/PenCircle.tsx`                                   | the pen ring around any chosen word/day; draws itself in one stroke       |
| PageSheet, SheetButton                  | `components/shared/PageSheet.tsx`, `SheetButton.tsx`                | standard bottom sheet (page colour, header, scroll) and its blue button   |
| InkTickBox                              | `components/shared/InkTickBox.tsx`                                  | on/off as an ink box ticked in blue pen (instead of a switch)             |
| Dashboard art                           | `components/dashboard/art/*` and `components/bills/art/BillArt.tsx` | hand-drawn SVG pictures                                                   |

Pop-ups: bottom sheets sit on the **page colour** (`background`) with a grab
handle, Fraunces title, round close button; chips/cards inside are `surface`.
Centered dialogs (date picker, new category) the same. Cancel = blue text link,
primary = big blue rounded button. **Every `Alert.alert`** (from `@lib/alert`) is
the app's own **blue sticky note** with tape (`AlertHost`), on web and phones —
owner's choice; the phone's grey box and the browser's alert/confirm (which
wrote "Cerrar" in the phone's language) are gone. Main button big blue (red to
delete), Cancel a blue word, extra choices outlined. Pass `{ code }` to show a
short value big in handwriting (the invite code).

## 5. Motion

- Use **RN Animated** or requestAnimationFrame — reanimated doesn't animate on
  the web build. Always respect `useReduceMotion()` (show the end state).
- Motion should feel physical and continuous: ease-out on enter, things move
  _together_ (the next item rises while the current one leaves), no blank gap,
  no pop-in. ~250–400 ms. Small spring for "settling" paper.
- Mate hops/waves once; loaders rotate funny lines.
- Every pen circle around a choice (`PenCircle`) is **drawn** when picked
  (owner): one quick stroke (~360 ms, ease-out) that overshoots where it
  started, like a real pen. Use it for any new circled choice.
- **Every pen mark draws itself** (owner: "anywhere we can add"): ticks
  (`PenTick` — tick boxes, grocery ticks, the Home grocery tile, saved lists,
  checkout, photo select, the "Terms updated" list, which inks one line after
  another), crosses (`PenCross` — ballots and the Home Votes tile: one stroke,
  then the other, ~300 ms) and new tally marks. They share `usePenStroke`.
  Marks already there when a page opens just show. The signup password line
  slides to its new length.
- **Moving between pages** (`RouteTransition`): going forward, the new page
  rises ~18 px into place as it fades in; going back, it settles down from just
  above (~300 ms, ease-out). Vertical only, so it never fights the browser's
  sideways back-swipe. RN Animated, so it runs on the web (the earlier
  reanimated version never did). Direction comes from `utils/routeDirection`.
- Pinned notes: the next note (with its real text) waits under the top one and
  rises into place while the top one is flicked away (`NextNote`), so the swap
  is one continuous move — never "slide off, then a new note pops in".

## 6. Platform gotchas

- iOS can't dash/dot a **single** border side → draw dashes/dots as Views
  (DotLeader, DayHeader, cut line) or use SVG (receipt zig-zag). Full dashed
  borders (all sides) are fine.
- Fraunces/Caveat are Latin-only → always go through the font hooks.
- RTL: margins/arrows flip (`isRTL`), money stays LTR.
- Keep files under ~300 lines; split into components.
- Tests find things by translation key text/labels (e.g. `HouseholdTab.test.tsx`);
  keep those texts and accessibility labels when restyling.

## 7. Page log (what was decided)

**Home (done, PR #249 → included in #252)**
Two-line greeting · latest note as blue sticky note with tape (swipe/tap to see
other pinned notes) · events as tickets · money on notebook page · glanceable
widget cards two-up with drawings (Parking: Free/You/name + since; car drives
in) · daily joke told by Mate. Drawings plain (no stickers).

**Bills (done, on #252)**

- Main: Fraunces title, marker-underline tabs, BalancePaper with handwritten
  "Settle up", underlined search, circled category words, expenses on a receipt
  roll (stamps, struck-through settled lines, swipe-to-delete), Mate empty state.
- Recurring tab: wide tiles (label row with icon + ⋯, big answer "15d overdue"
  red / "in 13d", meta line, drawing on sticker top-right, 6 month boxes,
  handwritten status, paper-tag Log + History), dashed handwritten
  "+ Add recurring bill".
- **Contributions** moved off Bills to the spending insights page
  (`app/(tabs)/profile/spending.tsx`) — person cards, total in Fraunces, +/−
  vs equal share in handwriting.
- Detail: receipt slip, scissor cut line, split breakdown, big green settled
  stamp, red text "Delete Bill".
- New expense / Edit: amount on notebook paper, underlined fields, circled
  categories (default **Other**, listed first — owner; the category follows the
  title like the grocery list — `utils/expenseCategory.ts` — until picked by
  hand: a title naming one of the house's own categories gets it, e.g. "Gym
  membership" → Gym, then the built-in words), big blue Save.
  **Split follows Splitwise:** one sentence
  "Paid by [you] and split [equally]" — equal split is the default and needs no
  extra taps; tapping a chip opens a sheet with Who paid / Split between /
  Equal·Custom·By % and the sticky-note result.
- Receipt lines (later, owner: "more colours", then "like drawings"): each
  expense has a small hand-drawn picture of its category (`CategoryDoodle`,
  chosen by `doodleKind` from the category's icon, then its name) in the same
  ink style as the recurring tiles, coloured in with the category's own colour.
- Pop-ups: Log payment (period on paper strip with ‹ ›, handwritten "Next unpaid
  period", underlined amount/date, people chips with avatars), ⋯ menu as a
  grouped sheet, recurring form as a dashed card, date picker with pen-circled
  day, new-category dialog.

**Parking (built on #252, waiting for the owner to say it's done)**

- Spot card: a painted bay (dashed outline) with one big Fraunces answer —
  Free (green) / You / the parked housemate's name (red, like Home) — the status
  line, and the Home drawings (P sign / parked car, pink for a housemate).
  Claim = big blue button, Release = red outline, "Free the spot" = text link.
  **The whole card is tappable** (owner): it claims / releases / frees, like
  the Home card, with a light haptic. Quick taps are queued so the spot ends
  where the last tap left it; the car turns back smoothly if tapped mid-drive.
- "Please move your car" warning is a pink **parking ticket** taped on the card.
- The next 7 days: owner asked for **each day separate** — every day is its own
  little tear-off calendar page (weekday band with binding holes, Fraunces date,
  status dots). Today's page is blue. Tapping a day opens its schedule.
- Reservations: "Reserve" is a paper tag; reservations are lines on one notebook
  page (`PaperSlice` rows in the FlatList): date in the margin, time, who · note,
  vote avatars with tick/cross badges, handwritten "not voting?" note, rubber
  stamp for the status, round ✓ / ✕ vote buttons, red "Cancel" text. History
  sits on the same page, faded and struck through, with a red "Clear All".
- Pop-ups: Reserve and day schedule are bottom sheets (`SheetHeader`); clash
  warnings on a blue sticky note; the day schedule is a receipt slip with stamps.
  Date, start and end time are all fields on a line (`LineField`); an empty
  time shows grey "--:--". The date opens the Bills pop-up calendar; a time
  opens `TimePickerModal` — two quiet wheels (5-minute steps) between thin
  lines, big serif numbers, Clear / Cancel / Confirm. The old shared
  TimePicker ("+ Add time" pill) is no longer used on Parking.
- Motion must feel calm and grown-up, **not childish** (owner): no bounces or
  overshoot. Someone parks → the car glides in and eases to a stop; spot freed →
  the car drives off and the P sign eases up. A stamp gives a short small press
  when a status changes. The ticket slides gently into place. Day pages only
  darken when pressed.
- No emoji in the Parking texts (owner removed the 🏎️).
- Owner tried a squarer Parking (small corners) and **preferred the round
  corners** — keep them (spot card 24, buttons 17–18, day tiles 10, pop-up
  cards 26).
- Old reservations are **swiped left to delete** (red Delete, like the Bills
  expenses); the bin stays for screen readers. The vote note is hidden once a
  request is settled. Page titles use a taller line height so descenders ("g")
  aren't clipped.
- Empty: Mate on a notebook page. The screen's logic lives in
  `hooks/useParkingActions.ts`; pieces in `components/parking/`.

**Tasks (Chores + Tasks merged into one list — built on #252, waiting for the owner to say it's done)**

- Owner found that the app only opens **Tasks** (the old Chores page had no
  links left) and asked for one page under one name, in the Chores look. One
  real list in `house_tasks`: tasks gained Repeat (once/weekly/monthly); old
  chores were copied in by migration; `/chores` now redirects to Tasks; the
  daily chore reminder, Calendar and menu badges read repeating tasks.
- Glance tile like Home: big Fraunces "2 of 6 done", subtitle, thin progress
  line, bucket drawing; admins get a red "Reset repeating" link (un-ticks only
  weekly/monthly tasks — owner's choice).
- Form on lines: title, details, Priority as circled words with colour dots
  (`PriorityWords`), Repeat as circled words with weekday letters / days 1–31
  circled in pen (`CircledDays`), Assign to as avatar circles with a dashed
  "Nobody" (`AssignPicker`), due date as a line that opens the pop-up calendar,
  big blue "Add task" (no "+").
- All / Active / Completed are marker-underline tabs with a handwritten
  "4 active". Tasks sit on a to-do pad (`PadSlice`, blue glued edge, stays light
  in dark): ink checkbox ticked in blue pen, priority dot, details in grey,
  "Every Thursday" and due date in handwriting (red "Overdue · 14 Oct"), who
  it's for with a clear "Give back" button (anyone a task is assigned to can
  hand it back, even if they didn't create it), or a paper-tag "Take it". Done tasks under a
  handwritten "2 done". Empty: Mate on the pad.
- No emoji in these texts (owner removed them on Parking and Chores).

**Chat (done, review asked on #252)**

- Opens from the floating chat button (`ChatFab`) → `app/(tabs)/more/chat.tsx`.
  Back link + Fraunces "House Chat" title (taller line height, no clipped
  descenders). Same behaviour: lazy load, mark read, send, long-press to
  delete your own message for 15 min or report someone else's.
- Messages are paper: someone else's is a light slip with the author's name in
  handwriting (`MessageSlip`, avatar-side corner nearly square), yours is a blue
  sticky note on the other side. Both stay light in dark mode. Time and the
  small "Hold to…" hints stay.
- Day headings are handwritten between dashed lines (`DayHeading`); messages
  are grouped by the housemates' **local** day (was UTC, which could put a
  late-evening message under the wrong day).
- The message is written on a line (`UnderlineInput`, now without the browser's
  focus box on web) with a round blue send button (`MessageBar`).
- Empty chat: Mate. No emoji in the empty message (owner removed them everywhere).

**Settings + More menu (done, review asked on #252)**

- Owner felt the app had **too many pages**. Appearance (Light · Dark · System)
  and Language (English · עברית · Español) are now picked right on Settings as
  pen-circled words (`ChoiceWords`); their two pages were deleted. Profile is
  only about you — its House card (housemates) went, Settings has it.
- Owner **rejected merging Notes, Votes and Photos** into one Notice Board:
  people wouldn't find Photos and Votes under Notes. Every page keeps its own
  name in the menu.
- Settings: Fraunces title and section words ("General", not "GENERAL", via
  `utils/asWord`), rows written on lines (`SettingsLine`) with the current
  choice handwritten in blue, no row icons (owner found icons + everything
  "crowded"). House = cream key tag with a metal ring, faces and handwritten
  "3 people ›" (opens Housemates); the invite code is a blue ticket stub with
  punched holes on its end (tap to share). Leave House is red text; Version,
  Terms and Privacy are small print under a dotted line, footer handwritten.
- Pop-ups: Leave / Settle first are centred dialogs on the page colour
  (`SettingsDialog`); Timezone (search on a line) and Currency are bottom sheets
  with `SheetHeader`. Leave logic lives in `hooks/useLeaveHouse.ts`.
- More menu (⋯ tab): sheet on the page colour with a round close button; the
  items sit two per row on a `NotebookPaper` page titled "House". New counts are
  a red number circled in pen; a yellow highlighter swipes the name while
  pressed.

**Grocery (built on #252, waiting for the owner to say it's done)**

- Owner said the first mockups were **too monotonous** (all notebook + sticky
  notes) and then **too crowded**. Grocery got its own object: a **brown paper
  grocery bag** (`BagSlice`, `kraft*` colour tokens, stays light in dark mode)
  with coloured **aisle signs** hanging on strings (`AisleSign`). Each page
  should have one signature object of its own while keeping the shared pieces.
- Page order (owner): title → **add strip** → Shared · Just me · Draft (pen
  circles) → two tiles (**Heading to the shop?** with a drawn cart + pink
  "I'm going" tag and Quick buy; **Saved Lists** with index cards) → the bag.
  The summary line, faces and aisle shortcut tiles were removed.
- **Add strip** (`AddStrip`): cream paper, dashed line, round blue +; second
  line has − n + and units × · ml · L · g · kg circled in pen (owner: "how can
  I put 2 L milk"). Long-press + opens the details sheet (note). Resets to ×1.
- Rows (`GroceryItemRow`): ink box + blue pen tick, amount handwritten in blue,
  **who and when stay** (owner: important), swipe to delete, long-press for
  details. "Still need it?" is a yellow strip under that item. Reminders are a
  pink tag on a bulldog clip at the bag's corner (`ReminderClip`), opening the
  reminders sheet (list + set reminder, date/time on lines).
- Saved lists open in a sheet as index cards with a Load tag; the list editor
  writes items on an index card; Keep private is an ink tick box.
- Shopping trip: same steps; progress in Fraunces + thin bar; rows on the bag;
  "In the basket" sign; Finish & add expense (blue) + red "Leave without an
  expense". Add expense uses the Bills pieces (NotebookPaper total,
  UnderlineInput, SplitSummary + SplitSheet). Quick buy uses the same form.
- Owner idea for later (in IDEAS.md): photos on grocery items; rows keep room.
- Empty grocery texts lost their emoji.
- **Ticking must not shake the page** (owner: items "jump and affect the whole
  page"). On the shopping trip a ticked item stays where it is for a beat (you
  see the tick and can undo it, and can tick several in a row), then folds away
  while the rows below glide up, and unfolds in "In the basket"
  (`useCalmMove` + the shared `Fold`). The "Still need it?" strip stays with
  its item: ticking that item folds it away instead of hopping to another row
  (`useStaleNudge`). The 3/12 counters have a fixed width so 9→10 never re-wraps
  the name.
- **Every change moves, nothing snaps** (owner): the tick is drawn in one quick
  pen stroke and lifts off when un-ticked (`PenTick`); − / + roll the count like
  a little odometer (`RollingCount`); the item's bar and the trip's progress
  bar slide to their new length (`useEasedValue`). Owner also wants smooth
  moves between pages — to be added later.
- Speed (owner: "a bit faster"): ticked items wait ½ s before moving; folds
  open in 220 ms / close in 180 ms; the tick draws in 200 ms; counts roll in
  150 ms; bars slide in 200 ms.
- "Clear ticked" folds the ticked rows (and any aisle sign left empty) away
  before they're removed (`useFoldAway`). Tasks use the same calm move: a
  ticked task waits a beat, then folds down under "done" (`useTaskPadRows`).

**Autonomous pass (built on #252 without mockups, owner to review on the preview)**

The owner asked for every remaining page and pop-up in one go, so these skipped
the mockup step and follow the approved style. Each has its own object:

- **Machines** — drawn washer / dryer / dishwasher (`MachineArt`); the door
  ring (or the dishwasher's strip) fills as the cycle runs. One big Fraunces
  answer (Free / time left / Just finished), who's using it in handwriting,
  Start is a paper tag, freeing is red text. Start sheet: presets as paper
  tags with a ×, hours : minutes as big numbers on lines.
- **Notice Board** — a cork board with a wooden frame (`CorkBoard`, drawn in
  slices so notes stay in a FlatList); notes are paper slips in each
  housemate's paper colour with a push pin, signed "— Dana, 12 Oct".
- **Votes** — ballot slips: tick a box with a pen cross, votes counted as tally
  marks, a rubber stamp with the result when closed. New proposal is a sheet.
  _Redone after the owner's review (below)._
- **Photos** — white-bordered prints that lean a little, months on masking
  tape, album filters circled in pen; select mode ticks a box on each print.
- **Calendar** — a hanging wall calendar with spiral binding; today circled in
  red pen, the chosen day highlighted yellow. Day list: time in handwriting, a
  coloured stroke per kind. Event form on lines (shared date/time pickers);
  the screen was split into `components/calendar/*` and two hooks.
- **Property** — issues are yellow job tickets torn off a pad (Open · In
  progress · Resolved with the current step circled; resolved gets a stamp).
  Condition log is an inspection sheet on a clipboard, verdicts circled in
  their colour. Both forms are sheets. Status / category / room words are now
  translated (`utils/propertyLabels.ts`).
- **Profile** — a house member card on a lanyard (cover across the top,
  passport photo, "Member of …" in handwriting). Spending summary on notebook
  paper. Rows reuse `SettingsLine`; details and password open sheets.
- **Spending** — redone after the owner felt lost ("so much inside"). One
  month at a time, read top to bottom: title → House · Personal as pen-circled
  words → the 6-month chart on squared paper (tap a bar to pick the month; its
  total and your share are written above the bars) → Mate's AI note → "Where
  it went" (one colour strip + receipt lines, biggest first, top 5 then
  "N more") → "Who paid" (one line per person, +/− in pen). Tapping a category
  opens a pop-up (`CategorySheet`) with the house amount, your share, the change
  since last month and the bills behind it on a receipt. Owner removed the month
  arrows and the totals card; the title now scrolls with the page.
- Owner then asked for the regular bills **first and apart**: "Where it went"
  has House Bills (all shown, each with "Covers Sep – Oct 2026" — the months
  its payments cover, from the months picked when logging it) and then
  Lifestyle (top 5, "N more"). Each payment in the pop-up says what it covers.
- Pop-ups (`PageSheet`): the dim background fades in place and only the sheet
  slides up — the owner saw the whole dark layer sliding up the page.
- **Housemates** — a steel door buzzer panel, one name slip per person; the
  invite code is a ticket with a perforated "Copy code" stub.
- **Settings sub-pages** — Notifications, Calendar, Members, Categories, Terms
  and Privacy match the Settings page: Fraunces sections, ruled lines, on/off
  as an ink tick box (`InkTickBox`) instead of a phone switch.

New shared pieces: `PageSheet` + `SheetButton` (standard bottom sheet and its
blue button), `InkTickBox`, `Fold` (opens/closes a row by its height so the
list below glides instead of jumping). Emoji were removed from empty-state texts.

**Sign-in, intro, house setup, 404 (built on #252 without mockups, owner to review)**

The owner asked to "build the rest", so these follow the approved style without
a mockup step. Their object is **the front door** (`components/auth/`):

- No more blue header with a white card. Every sign-in page (`AuthScreen`) sits
  on the page colour: blue "‹ Back" link, Fraunces title with a small drawing at
  its end (a brass **key on a cream tag** for log in / forgot / reset password,
  an **envelope** for check your inbox), fields written on a line (`AuthField`:
  label above, blue line while writing, red line on the field to fix, an eye for
  passwords, big spaced digits for codes), the big blue button (`SheetButton`,
  which now takes `loading` and `testID`), and plain text links (`TextLink`).
- Welcome: a drawn **blue front door** ("42", brass letterbox, doormat, a plant)
  with Mate beside it, "HouseMates" in Fraunces, the tagline handwritten, the
  pitch on a notebook page. The language is picked right there as pen-circled
  words (English · עברית · Español), like Settings — the flag chip is gone.
- Signup steps are words, not numbered circles (`StepTrail`): the current step
  circled in pen, finished ones ticked. The 18+ / terms box is an `InkTickBox`;
  the password strength is a thin line with Weak/Fair/Strong in handwriting;
  "Use it" for an email typo is handwritten. "Email sent" is a blue sticky note.
- Password updated: a notebook page with the key on it (`PasswordDone`).
- Accept updated terms: the changes are lines on a notebook page, each with a
  blue pen tick.
- Intro slides: each picture is drawn on cream paper held by masking tape
  (`TapedPicture`: door / receipt / car), Fraunces title, handwritten subtitle;
  the dots are ink dots with the current one a short blue stroke.
- House setup: Create / Join are a cream **key tag** and a blue **ticket stub**
  (the same objects Settings uses for the house and its invite code); the chosen
  one has its name circled in pen, the other's writing fades (the paper stays
  bright in dark mode). "Is this your house?" is a `PageSheet` with the house as
  a key tag. The logic lives in `hooks/useHouseSetup.ts`.
- 404: Mate with "404" scribbled on a blue sticky note.
- Removed (no longer used): `StepProgress`, `LanguageSwitcher`,
  `AuthIllustration` (+ its photos), `HouseSkyline`.
- Owner asked to **delete** the pages nothing opened: Games, Maintenance,
  Condition (Property replaced the last two), the old `settings/index` page and
  NFC Parking. Premium stays (switched off by `PREMIUM_ENABLED`; it now bounces
  to the new Settings page).
- Smooth moves between pages: done (see §5).

**Home events + pop-ups (after the owner's preview check)**

- Upcoming events on Home are **paper tickets** (owner picked A of three): a
  **white** ticket whose stub is printed in colour — blue for plans, amber for a
  parking request, green "Now" for a live shop — with the day handwritten and
  the time in the serif in white; a dashed tear with punched notches; what it
  is beside it; neighbours lean opposite ways. They were cream at first, but the
  owner found them too like the cream money page, so white + coloured stub won.
- Pop-up messages: the sticky note above (owner picked it over the plain card).
  It **sticks on** when it appears (drops from a little above, turning from
  -6° to its tilt, pressed flat with a tiny settle, 380 ms) and **peels off**
  upwards when closed (220 ms); the button's action runs once it's gone.
  Reduce Motion: it just appears.

**Votes (redone after the owner's review)**

- Owner: the headings didn't match the house style, and the ballots should look
  better. "New proposal" is a cream paper tag beside the title (no blue bar);
  the lists sit under serif headings "Open" (handwritten "2 to decide") and
  "Decided" (handwritten count, folds away when tapped) — no grey "Past votes".
- Each proposal is a white **ballot paper** (`BallotCard`): a dashed tear-off top
  with BALLOT and "Proposed by … · today" in handwriting, the question in the
  serif (smaller than the page title), then **Yes and No side by side** as boxes
  (`BallotChoice`): the word, a square crossed in blue pen, tally marks and the
  faces of who chose it; your side outlined blue. Under them, the faded faces of
  who still has to vote ("Waiting for"). Decided ballots: greyed sides, stamp.
- **Quick vote on Home** (owner): the Votes tile keeps its layout (label, big
  number, one line) but, while an open vote is waiting for you, the line is that
  question and a row of ☐ Yes ☐ No ink boxes (like the grocery tile) replaces the
  ballot drawing; one tap votes in place and shows your cross. Owner: "don't
  change the layout of the tabs, just the voting".
- Fixed: tapping Yes then No quickly flickered — saves now run one after
  another and a reload mid-save keeps your tap (`votingStore`).

**Photos (redone after the owner's phone check — gallery-app habits)**

- The chat button covered "Save" while picking photos, so it's hidden on
  Photos (it also sat over the grid's corner). Picking works like a phone
  gallery: a "Select" button beside the camera, then "Select all" · "Cancel"
  in the header; picked prints get a light blue wash plus the pen tick. The
  bottom bar is Save · "3 selected" · Delete (red), sitting in the page (not
  floating), so nothing covers it.
- **Delete several at once** (owner) with one confirm (`usePhotoSelection`,
  `photoStore.removeMany`). Owner then asked for **Delete on every photo**:
  any housemate can delete any photo in their house (migration
  `20261026130000_house_members_delete_photos`), and **Report is gone** — it
  only wrote to Sentry, which nobody reads.
- The open photo felt "weak and cheap": now a darkroom stage (#0B0B0C) where
  the photo grows in from the grid and shrinks back when closed; the day in
  the serif on top ("Today", "Maya · 14:48"), the caption handwritten on
  masking tape, a strip of thumbnails to jump between photos (`Filmstrip`),
  and Save · 2 / 6 · Delete as big icon + word buttons.

**Mate cameos, loading lines, background uploads (owner: "make the app a bit more funny")**

- Uploading photos no longer covers the page: a small note at the bottom
  (`UploadNote`) shows "Uploading 4 of 5…", a hopping Mate and a rotating
  funny line; you can keep scrolling and tapping meanwhile.
- 24 more loading lines (`constants/loadingQuips.ts`, shared by the big
  loader and the upload note), in all three languages.
- **Mate cameos** (`MateCameo` + `MateProp`): on about half the visits, Mate
  sits at the very end of a list holding something from that page — camera
  (Photos), receipt (Bills), broom (Tasks), toy car (Parking), ballot (Votes),
  push pin (Notes) — with a one-line joke in handwriting (`mate.*` keys, four
  per page). Never tappable, never above content, and only when the list has
  items, so the empty-state Mate is still the only Mate on that screen.
- Owner: "make more, change Mate's position — maybe he fell from something".
  Now eight lines per page and five scenes (`MateCameoPose`): holding the
  thing (lines 1–4), **fallen** on his side seeing stars with the thing
  dropped beside him (5), **asleep** with "z z Z" (6), **peeking** in from
  the screen's edge, half out of view (7), **hanging upside down** on a
  string (8). Grocery joined (paper bag with carrots). Every joke matches
  its scene.
- Owner then wanted Mate to **pop up in the page itself**, not only at the end,
  "so it won't interfere with the app flow", at spots the owner drew on
  screenshots. `useMateScene` picks one spot each time the page comes into view (or none — owner: he shows on 3 visits in 6, on every page; pages stay open in the background, so picking only once at first open left him missing for good; fixed):
  **Parking** — hanging upside down on a rope off the spot card over the week,
  or sitting under the day pages; **Bills** — peeking over the top of the
  balance paper above the chart button (drawn behind the paper), or clinging
  to its torn bottom edge; or the end-of-list cameo. `MateSpot` eases him in
  once (the rope lowers with a small sway that settles), never tappable, never
  read out. Zero-height anchor Views place him without moving the layout.
- Owner: "put him in other places as you see fit". Same picking, one spot or
  the end-of-list cameo per visit: **Tasks** — peeking over the "2 of 6 done"
  tile; **Grocery** — peeking over the Saved Lists tile; **Votes** — peeking
  over the first open ballot; **Notes** — peeking over the cork board's frame;
  **Photos** — sitting at the end of the first date's tape. Every page passes
  `enabled = false` to `useMateScene` while its empty-state Mate shows, so
  there's never a second Mate (this also fixed Parking and Bills).

**Bottom menu (owner)**

- Owner wants **icons only, no words**; rejected three looks (words + marker,
  pen circle, binder tabs) and three more (hand-drawn icons, floating bar,
  highlighter). Chosen: today's bar with option A's feel — the page you're on is
  blue with a soft blue **marker stroke** under its icon, swiped in left to
  right when you arrive (`TabButton`, RN Animated so it runs on the web) — and
  a **P parking sign** instead of the car (`ParkingSignIcon`, outlined, filled in
  when on Parking; matches the Home parking tile). The + is the blue round
  button. New-things counts are red numbers circled in pen (`PenCount`).
- Owner: tapping a page in the menu **takes you to its top** — also when it's
  the page you're on, like a phone's own apps. `navigateToBase` sends a signal
  (`utils/scrollToTop`) and each main page's list glides up
  (`useScrollToTopOnNav`).

## 8. Working setup (for the next session)

- Staging Supabase (test data only): `https://tcwhpelylmbafagliors.supabase.co`.
  Test house "Dizengoff 42" with fake housemates (Maya, Noam) and the owner's
  test account as admin. Demo activity (six months of bills and payments by
  the existing members) is `supabase/demo/staging-demo.sql`, run by the
  "Staging demo data" GitHub Action with the staging secrets GitHub already has
  — no keys are needed in a session. It runs once; it never touches the live app.
- Local visual check: run Expo web on port 8099 with the staging URL/key as
  `EXPO_PUBLIC_SUPABASE_*`, inject a test session into localStorage, and take
  Playwright screenshots (Chromium at `/opt/pw-browsers/chromium`) in light +
  dark at 402×874. Always look at both themes before showing the owner.
- Before every commit: `npx tsc --noEmit`, `npm run lint`, `npx jest` (all).
- Commit style: `style: …` for design-only commits.
