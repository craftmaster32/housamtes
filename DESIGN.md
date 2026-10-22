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
- **One page at a time:** Home ✅ → Bills ✅ → Parking ✅ (review asked on #252) → Tasks (Chores merged in) ✅ → Chat →
  More/Settings → the rest.
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
| Dashboard art                           | `components/dashboard/art/*` and `components/bills/art/BillArt.tsx` | hand-drawn SVG pictures                                                   |

Pop-ups: bottom sheets sit on the **page colour** (`background`) with a grab
handle, Fraunces title, round close button; chips/cards inside are `surface`.
Centered dialogs (date picker, new category) the same. Cancel = blue text link,
primary = big blue rounded button. System Alerts stay native.

## 5. Motion

- Use **RN Animated** or requestAnimationFrame — reanimated doesn't animate on
  the web build. Always respect `useReduceMotion()` (show the end state).
- Motion should feel physical and continuous: ease-out on enter, things move
  _together_ (the next item rises while the current one leaves), no blank gap,
  no pop-in. ~250–400 ms. Small spring for "settling" paper.
- Mate hops/waves once; loaders rotate funny lines.
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
  categories (default **Other**; the category follows the title like the grocery
  list — `utils/expenseCategory.ts` — until picked by hand), big blue Save.
  **Split follows Splitwise:** one sentence
  "Paid by [you] and split [equally]" — equal split is the default and needs no
  extra taps; tapping a chip opens a sheet with Who paid / Split between /
  Equal·Custom·By % and the sticky-note result.
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

**Chat (built on #252, waiting for the owner to say it's done)**

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

**Next:** More / Settings (mockup first) — once the owner says Chat is done.

## 8. Working setup (for the next session)

- Staging Supabase (test data only): `https://tcwhpelylmbafagliors.supabase.co`.
  Test house "Dizengoff 42" with fake housemates (Maya, Noam) and the owner's
  test account as admin. Seed scripts are kept outside the repo.
- Local visual check: run Expo web on port 8099 with the staging URL/key as
  `EXPO_PUBLIC_SUPABASE_*`, inject a test session into localStorage, and take
  Playwright screenshots (Chromium at `/opt/pw-browsers/chromium`) in light +
  dark at 402×874. Always look at both themes before showing the owner.
- Before every commit: `npx tsc --noEmit`, `npm run lint`, `npx jest` (all).
- Commit style: `style: …` for design-only commits.
