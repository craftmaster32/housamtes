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

| Screen                                            | Mockup(s)                                                                | Status | Notes                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Currency picker                                   | `settings-modals-v2` (row → sheet)                                       | ✅     | `more/settings.tsx` now a row that opens a bottom-sheet list                                                                                                             |
| Spending screen                                   | (dashboard stat icon → screen)                                           | ✅     | removed old Animated opacity wrapper that blanked on web                                                                                                                 |
| Back button / nav                                 | —                                                                        | ✅     | retired legacy TopBar on screens with own headers                                                                                                                        |
| Profile menu side                                 | —                                                                        | ✅     | opens on the avatar's side                                                                                                                                               |
| Web icons                                         | —                                                                        | ✅     | deploy embeds all @expo/vector-icons fonts                                                                                                                               |
| **Bills** (merged balance + tap-to-reveal settle) | `bills-flow-v2`, `bills-v2`, `addbill-v2`                                | ✅     | list/add/detail already match mockups; fixed setup.tsx (Housemates) web-blank (old opacity-0 Animated wrapper, same bug class as spending)                               |
| Dashboard                                         | `nestiq-v2-dashboard`, `nestiq-v2-final`                                 | ✅     | matches `nestiq-v2-final` (the implemented target). `nestiq-v2-dashboard` is a SUPERSEDED early exploration — do not chase its quick-actions/spending-card/3-tile layout |
| Grocery                                           | `grocery-final`, `grocery-modals-v2`, `grocery-options`, `grocery-count` | ⬜     |                                                                                                                                                                          |
| Parking                                           | `parking-grocery-v2`                                                     | ⬜     |                                                                                                                                                                          |
| Calendar (event editor)                           | `calendar-event-v2`, `chores-calendar`                                   | ⬜     |                                                                                                                                                                          |
| Photos (flow + viewer)                            | `photo-flow-v2`, `photo-modal-v2`                                        | ⬜     |                                                                                                                                                                          |
| Tasks                                             | `tasks-v2`, `tasks-alt`, `tasks-style`                                   | ⬜     |                                                                                                                                                                          |
| Voting                                            | `voting-v2`, `voting-alt`, `voting-fonts`                                | ⬜     |                                                                                                                                                                          |
| Notes                                             | `notes-v2`                                                               | ⬜     |                                                                                                                                                                          |
| Property / Condition / Maintenance                | `property-v2`, `fair`                                                    | ⬜     |                                                                                                                                                                          |
| Games                                             | `games-v2`                                                               | ⬜     |                                                                                                                                                                          |
| Auth / onboarding                                 | `auth-v2`                                                                | ⬜     |                                                                                                                                                                          |
| Profile / Settings (rest)                         | `profile-settings`, `settings-modals-v2`                                 | 🔨     | currency done; audit remaining rows                                                                                                                                      |

---

## Known follow-ups (deferred, not lost)

- **Web-blank pattern (watch on every remaining screen):** many screens wrap all
  content in an old-API `Animated.View` whose `opacity` starts at 0 with
  `useNativeDriver: true` — the exact thing that blanked the spending screen and
  Housemates on web. When reconciling each ⬜ screen, if it uses this pattern
  (`grocery`, `calendar`, `voting`, `property`, `maintenance`, `chat`, `profile`,
  `more/settings`, several `settings/*`, `condition`, onboarding, auth), swap the
  wrapper for a plain `View` as we did for spending/Housemates.
- `textSecondary` cream-contrast tweak — a locked palette token; needs owner sign-off.
- Auth-layout AppState token refresh on the reset-password flow — needs device testing.
- Any remaining CodeRabbit nits — handle in the single polish-phase review before merge.
