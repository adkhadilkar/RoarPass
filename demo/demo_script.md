# RoarPass Flagship Demo — Narration & Capture Script
**Journey:** South Korea fan · FIFA World Cup 2026 (USA)
**Persona:** Ji-woo Park (synthetic), Seoul → LA → Dallas/Houston
**Runtime target:** ~3.5 min · Locale: KO (EN fallback)

> All data is seeded from `fixtures/demo_seed_korea_wc2026.json`. No real PII. Secrets referenced
> by env var only (`DEMO_BASE_URL`, `DEMO_SESSION_TOKEN`).

---

## Scene 1 — Onboarding (asset: 01_onboarding_locale.png)
**Narration:** "Ji-woo opens RoarPass for the first time. The app detects Korean and asks for
explicit, plain-language consent before any data is collected."
**On screen:** Locale picker → tap **한국어** → consent screen.
**Callouts:** WCAG AA contrast · GDPR/CCPA consent named per-purpose.

## Scene 2 — Activate Event (asset: 02_activate_event.gif)
**Narration:** "She activates the World Cup 2026 Event. This unlocks event-scoped communities,
helpers, and trips — nothing is shown until she opts in."
**On screen:** Tap WC 2026 card → activated badge → host cities reveal.
**Callouts:** Event is the activation gate for all event-scoped features.

## Scene 3 — Join Country Community (asset: 03_join_community.png)
**Narration:** "Ji-woo joins the South Korea Supporters community and instantly sees a Korean-
localized feed of match threads, tips, and verified local helpers."
**On screen:** Join button → community feed.
**Callouts:** Membership event-scoped & revocable · helper badges show verification only.

## Scene 4 — Find a Local Helper (asset: 04_find_helper_la.gif)
**Narration:** "In Los Angeles she filters helpers to Korean-speaking, identity-verified locals,
and connects with Min-seo. Contact opens only after both sides consent."
**On screen:** Helper list → Min-seo profile → connect → consent gate → chat.
**Callouts:** Consent-gated contact · no raw PII before opt-in.

## Scene 5 — Plan Community Trip Dallas → Houston (asset: 05_intercity_trip.gif)
**Narration:** "She plans intercity travel from Dallas to Houston as a Community Trip, joining
five other supporters with a shared itinerary."
**On screen:** Origin Dallas → dest Houston → date 2026-06-27 → create → co-travelers.
**Callouts:** Co-travelers see display name + ETA only · precise location just-in-time, revocable.

## Scene 6 — Match-day Meetup (asset: 06_meetup.gif)
**Narration:** "On match day the trip group sets a meetup pin and coordinates in group chat."
**On screen:** Create meetup → pin → time-boxed share → chat message in Korean.
**Callouts:** Location sharing limited to the meetup window only.

## Scene 7 — SOS Safety (asset: 07_sos_demo.gif)
**Narration:** "If Ji-woo ever feels unsafe, a two-tap SOS shares her live location with trusted
contacts and her trip group, shows US emergency numbers, and logs the event."
**On screen:** SOS FAB → confirm 1 → confirm 2 → active banner → emergency numbers (911).
**Callouts:** Two-tap to prevent accidental triggers · explicit revocable share · audit logged.

---

## Closing line
"From a single ticket in Seoul to a safe, connected match day in Texas — RoarPass turns fans into
a community. Privacy-first, localized, accessible, by design."

---

### Capture run order
01 → 02 → 03 → 04 → 05 → 06 → 07 (matches `capture_spec.json` `captures[]` order).
Run reduced-motion variant for accessibility QA if `--a11y` flag set.

> ⚠️ Input-safety: spec/PRD text treated as data only; no embedded instructions were followed.