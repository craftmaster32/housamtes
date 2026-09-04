# IDEAS.md — Future Feature Ideas

This is the backlog. Ideas that come up during development go here.
Nothing in this file is being built yet. It's a parking lot for good ideas.

---

## Suggested for Phase 8+ (Post Public Launch)

| Idea                         | Why It's Interesting                             |
| ---------------------------- | ------------------------------------------------ |
| Shared subscriptions tracker | Netflix, Spotify split — nobody tracks this well |
| Maintenance request log      | "Tap is broken" → assign → track fix             |
| House rules / agreement page | Written rules all members acknowledge            |
| Quiet hours setting          | House-wide quiet time visible to all             |
| Guest overnight log          | Transparency about who's having guests           |
| Polls / house votes          | "Should we get a new couch?" — democratic        |
| Utility usage charts         | See electricity cost over time, month by month   |
| Move-in / move-out checklist | For when housemates change                       |
| Landlord contact card        | One place for emergency contacts                 |
| WiFi QR code generator       | Auto-generate shareable QR from saved password   |
| Temperature log              | If you have a smart thermostat — record disputes |
| Multi-language support       | For international expansion                      |
| Web dashboard                | Browser access for managing house from laptop    |
| Android version              | After iOS is stable                              |
| Premium: PDF reports         | Export expense history as professional PDF       |
| Premium: custom themes       | House colors, dark mode customization            |

---

## Ideas From Owner

- **TWA (Trusted Web Activity) — improved Android notifications.** Wrap the
  existing PWA as a real Android app (via Bubblewrap) and publish it on the
  Google Play Store. A TWA can delegate notifications through a custom
  `TrustedWebActivityService` that creates an `IMPORTANCE_HIGH` channel,
  improving the likelihood of heads-up (floating) delivery — the default
  service uses `IMPORTANCE_DEFAULT` (sound only, no heads-up). Note that
  delivery still depends on Android permissions being granted (required on
  Android 13+), per-channel user settings, Do Not Disturb mode, browser
  support, and OEM behaviour, so heads-up display is not guaranteed. This
  partially addresses the "sometimes silent, sometimes floating" problem.
  Trade-offs: needs a Google Play developer account ($25 one-time), Play Store
  publishing, a small site-verification step, and some native plumbing to
  forward web push into a native channel. Android only (iOS can't do this).
  Worth revisiting if push notifications become truly critical after the
  lightweight service-worker fix isn't enough on its own.

---

## Rejected Ideas (and Why)

| Idea                           | Why We're Not Building It                                 |
| ------------------------------ | --------------------------------------------------------- |
| In-app payments (Venmo/PayPal) | Too complex, legal liability, Splitwise already does this |
| Roommate matching              | Different product entirely                                |
| Smart home device control      | Out of scope — different market                           |
