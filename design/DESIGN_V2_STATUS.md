# Design v2 — reconciliation status (source of truth)

**Why this file exists:** the v2 redesign is being reconciled screen-by-screen
against approved mockups. Chat history gets compressed and the scratchpad is
temporary, so the plan + approved mockups live here in git instead. **Any
session picking this up: read this file first, then continue from the table
below.** The approved mockups are in `design/mockups/*.html` — open them in a
browser to see the intended design for each screen.

Branch: `claude/design-v2-app-implementation-wc1fr3` · PR #194

---

## Workflow (agreed with owner)

1. **Design phase (current):** PR #194 stays a **Draft** so CodeRabbit does not
   review superseded commits. Every push still auto-deploys a **Vercel preview**
   (`.github/workflows/preview-deploy.yml`) and comments the link on PR #194 —
   that is the owner's verification loop.
2. Reconcile **one screen at a time**: open its mockup → make the live code
   match → push → owner checks the new preview link → mark it ✅ below.
3. **Polish phase (only once the owner is happy with the look):** flip PR #194
   to **Ready for review** → let CodeRabbit review once → clear its nits → merge.
4. Merge to `main` runs the production deploy (`npm run deploy`, unchanged).

Verify before every push: `npx tsc --noEmit`, `npm run lint`, `npx jest`.

---

## Screen reconciliation checklist

Status: ✅ matches mockup & verified · 🔨 in progress · ⬜ not started yet

| Screen                                            | Mockup(s)                                                                | Status | Notes                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency picker                                   | `settings-modals-v2` (row → sheet)                                       | ✅     | `more/settings.tsx` now a row that opens a bottom-sheet list                                                                                                                                                                                                                                                                                                        |
| Spending screen                                   | (dashboard stat icon → screen)                                           | ✅     | removed old Animated opacity wrapper that blanked on web                                                                                                                                                                                                                                                                                                            |
| Back button / nav                                 | —                                                                        | ✅     | retired legacy TopBar on screens with own headers                                                                                                                                                                                                                                                                                                                   |
| Profile menu side                                 | —                                                                        | ✅     | opens on the avatar's side                                                                                                                                                                                                                                                                                                                                          |
| Web icons                                         | —                                                                        | ✅     | deploy embeds all @expo/vector-icons fonts                                                                                                                                                                                                                                                                                                                          |
| **Bills** (merged balance + tap-to-reveal settle) | `bills-flow-v2`, `bills-v2`, `addbill-v2`                                | ✅     | list/add/detail already match mockups; fixed setup.tsx (Housemates) web-blank (old opacity-0 Animated wrapper, same bug class as spending)                                                                                                                                                                                                                          |
| Dashboard                                         | `nestiq-v2-dashboard`, `nestiq-v2-final`                                 | ✅     | matches `nestiq-v2-final` (the implemented target). `nestiq-v2-dashboard` is a SUPERSEDED early exploration — do not chase its quick-actions/spending-card/3-tile layout                                                                                                                                                                                            |
| Grocery                                           | `grocery-final`, `grocery-modals-v2`, `grocery-options`, `grocery-count` | ✅     | v2 add-to chooser + list already implemented; web-blank fade removed — owner spot-checked OK                                                                                                                                                                                                                                                                        |
| Parking                                           | `parking-grocery-v2`                                                     | ✅     | hero card + circular FREE/TAKEN gradient badge + reservations match the mockup                                                                                                                                                                                                                                                                                      |
| Calendar (event editor)                           | `calendar-event-v2`, `chores-calendar`                                   | ✅     | bottom-sheet editor matches: Fraunces title, blue-pill repeat segment, add-end-date, repeat-until; web-blank removed                                                                                                                                                                                                                                                |
| Photos (flow + viewer)                            | `photo-flow-v2`, `photo-modal-v2`                                        | ✅     | straight-to-upload flow (no caption/category step — supersedes `photo-modal-v2`'s upload sheet), Fraunces title, category chips, 3-col grid, upload overlay match; viewer date localized                                                                                                                                                                            |
| Tasks                                             | `tasks-v2`, `tasks-alt`, `tasks-style`                                   | ✅     | matches mockup (accent + priority dot + assignee face + filters/count); formatted due dates                                                                                                                                                                                                                                                                         |
| Voting                                            | `voting-v2`, `voting-alt`, `voting-fonts`                                | ✅     | matches mockup (proposal cards, tally, voters, vote buttons); localized timestamps                                                                                                                                                                                                                                                                                  |
| Notes                                             | `notes-v2`                                                               | ✅     | matches mockup (Fraunces title, compose card, accent + author face, localized "18 Apr · edited")                                                                                                                                                                                                                                                                    |
| Property / Condition / Maintenance                | `property-v2`, `fair`                                                    | ✅     | live screen is `property/index` (Issues + Condition tabs): Fraunces title, tinted-square line icons, ✕ close, status badges + advance/reopen match; `fair` circle-family fix in place (`CONDITION_CONFIG.fair` = `remove-circle`); localized issue dates. NB `condition/index` & `maintenance/index` are `href:null` dead routes superseded by this combined screen |
| Games                                             | `games-v2`                                                               | ✅     | Word Scramble + Dad Jokes match: Fraunces title, bordered-circle back button, Score/Round/Streak flame, emoji-free category pills, letter tiles, bulb hint, checkmark submit, shuffle, result card, joke card. Reanimated `entering=` proven web-safe (same as bills/tasks/notes/dashboard)                                                                         |
| Auth / onboarding                                 | `auth-v2`                                                                | ⬜     |                                                                                                                                                                                                                                                                                                                                                                     |
| Profile / Settings (rest)                         | `profile-settings`, `settings-modals-v2`                                 | 🔨     | currency done; audit remaining rows                                                                                                                                                                                                                                                                                                                                 |

---

## Global fixes applied this pass (affect every screen)

- **Money glyph clipping** — `components/shared/Money.tsx` now sets an explicit
  lineHeight so big amounts aren't top-clipped by `numberOfLines={1}` overflow
  on web (was visible on Bills/Dashboard/detail heroes).
- **Browser auto-translate blocked** — `app/+html.tsx` marks the web page
  `notranslate`. Chrome was mistranslating labels ("Personal"→"Staff") and
  breaking the icon font (empty boxes). The app keeps its own i18n.
- **Segmented-control selected state** — the Add-Bill "How to split" pill used
  `C.surface` (darker than the container in dark mode → looked recessed); now a
  primary blue pill, matching calendar/grocery/bills-filter. NB: Property's
  segment intentionally keeps the surface pill per `property-v2`.

## Known follow-ups (deferred, not lost)

- **Web-blank pattern — mostly swept.** The full-screen opacity-from-0
  `Animated.View` wrapper (which blanked spending on web) has now been removed
  from: spending, Housemates, grocery, calendar, voting, profile, more/settings,
  more/chat, maintenance, property, condition, settings/{index,premium,categories,
  members,notifications,terms,privacy-policy}, onboarding/{intro,house-setup},
  +not-found and accept-terms. **Still to do:** the auth screens
  (`login`, `signup`, `welcome`, `forgot-password`, `verify-email`) use a
  _partial_ fade on the header/card sub-sections (not the whole screen) — lower
  risk; convert them when reconciling `auth-v2`.
- `textSecondary` cream-contrast tweak — a locked palette token; needs owner sign-off.
- Auth-layout AppState token refresh on the reset-password flow — needs device testing.
- Any remaining CodeRabbit nits — handle in the single polish-phase review before merge.
