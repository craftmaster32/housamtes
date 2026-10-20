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
- **One page at a time:** Home ✅ → Bills ✅ (review asked on #252) → Parking → Chores → Chat →
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

**Next:** Parking (mockup first).

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
