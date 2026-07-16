// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAGS — the app's on/off switches
// ─────────────────────────────────────────────────────────────────────────────
//
// PREMIUM_ENABLED is the single master switch for the whole premium + ads system
// (the "Fable Season 5" monetization groundwork). All the real code is still
// here and fully tested — it is just hidden from users while this is `false`.
//
// Flip it to `true` and every premium surface comes back at once:
//   • the ad banner above the tab bar
//   • the "Premium ✨" row in Settings (opens the paywall screen)
//   • the photo free-tier limit (50) + the "upgrade" card in Photos
//
// There is nothing else to un-comment or un-hide. This one line is the back door.
// The full step-by-step plan lives in PREMIUM_BACKDOOR.md.
//
// Keep this `false` until we actually want to publish premium.
export const PREMIUM_ENABLED = false;
