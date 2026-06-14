# RoarPass — Design System & Whole-Product Coherence Review

**Phase 2, Stage 4 — Design System Reviewer**
**Scope:** 36 pages/flows (P01–P36) + 10 shared components (C01–C10) + tokens
**Verdict:** Conditional — sign-off withheld pending resolution of high-severity system issues (see JSON).

---

## 1. Information Architecture & Navigation

### 1.1 Primary navigation (C01 App Shell)
The product spans seven functional clusters: Onboarding, Communities/Messaging, Discovery/Matching,
Trips, Helpers, Safety, and Business/Admin. C01 must expose a coherent primary nav that does not
exceed 5 top-level destinations on mobile (per platform-foundation-nfr:8.7). The current page set
implies **7+ logical top-level areas**, which cannot all live in a mobile tab bar.

**Recommended canonical IA:**
- **Tab bar (mobile, 5 slots):** Home (P06) · Communities (P07→P08→P09) · Discover (P12 + P17 + P31) · Trips (P14) · Messages (P10).
- **Persistent overlays:** SOS FAB (C09), Language Switcher (C08) in header.
- **Drawer / "More":** Verification (P05), Safety (P21), Official Info (P20), Notifications (P26), Settings (P36), AI Assistant entry (P27), Helper Mode (P19).
- **Desktop:** left rail mirrors the same hierarchy with the drawer items promoted to a secondary nav group.

Without an explicit nav home for **Discover**, three discrete discovery surfaces (fan matching P12,
helper directory P17, business discovery P31) are effectively orphaned — each reachable only by deep
link. This is the single biggest IA risk and is flagged high.

### 1.2 Entry points that lack a parent
- **P16 Intercity Routes** — should be reachable from Trips (P14/P15), not a standalone destination.
- **P22 Meetup Check-In/Out** — should launch from a meetup/trip context or a match thread, not nav.
- **P24 Phrase Cards** & **P25 Translation Preferences** — belong under Safety (P21) and Settings (P36) respectively; confirm both have a nav parent.
- **P13 Match Visibility Settings** — must be reachable from both P12 and P36 (Settings) for discoverability.
- **P28 AI Premium Gate** & **P23 SOS Overlay** are correctly modeled as components/overlays (no nav slot needed).

### 1.3 Role-gated areas
P19 (Helper Mode), P29/P30 (Business Portal), P32–P35 (Admin) are role-conditional per
identity-onboarding:6 multi-role model. Nav must render these conditionally based on active role
and provide a clear **role switcher**. No page in the set owns the role-switch affordance — it must
live in C01. Flagged medium.

---

## 2. Shared Component Reuse Audit

| Component | Expected consumers | Coverage notes |
|-----------|-------------------|----------------|
| C02 Trust Badge | P05, P12, P17, P18, P19, C04, C05 | Must be the **single** source of tier rendering; verify P05 doesn't fork its own badge styling. |
| C03 Message Bubble + translation overlay | P09, P10, P11, P15(coord), P27 | AI assistant (P27) and group itinerary chat (P15) must reuse C03, not bespoke bubbles. |
| C04 Fan Match Card | P12, P06(hub teaser) | OK |
| C05 Helper Card | P17, P06, P31(adjacent) | Verify P31 uses a distinct business card, not C05. |
| C06 Trip Object Card | P14, P15, P16, P27(AI suggestions render into) | C10 AI Suggestion Card must convert into C06 on accept — confirm shared schema. |
| C07 Alert Banner | P06, P08, P20, P21, P26, host-city-wide | OK; ensure single severity scale. |
| C08 Language Switcher / RTL | global header | Must appear on **every** authenticated page incl. admin (P32–P35). |
| C09 SOS FAB | every authenticated fan-facing page | **Must NOT appear** on admin/business desktop-only consoles; confirm exclusion rule. |
| C10 AI Suggestion Card | P27, P14, P16 | Depends on premium gate (P28) state. |

**Finding:** C03's translation overlay (REQ-TRANS-03/09) and C08's RTL toggle (translation-layer:7.4)
must share one i18n/direction context. If P09/P10/P11 each manage direction independently, RTL parity
breaks. Flagged high — RTL must be a single app-level concern propagated through C01.

---

## 3. End-to-End Flow Sanity

1. **Onboarding → Activation:** P01→P02→P03→P04→P06. Coherent. Confirm P03 role selection feeds the
   conditional nav in §1.3 and P04 host-city selection seeds language defaults consumed by C08/P25.
2. **Discover a fan → meet safely:** P12→C04→P10(DM)→P22(meetup check-in)→C09/P23 fallback. Coherent,
   but the hop from a match card to a *safe meetup* relies on P22 being launchable from a DM thread —
   currently P22 is typed `flow` with no documented entry from P10. Flagged medium.
3. **Plan a trip:** P14→P15(share)→P16(intercity)→C10/P27(AI augment)→P20(visa/official). The AI
   assistant (P27) and trip builder (P14) must write to the same Trip Object model (C06). Confirm.
4. **Get help locally:** P17→P05(trust filter)→P18(request)→P10(coordinate). C05↔C02 dependency holds.
5. **Business:** P29→P30→(publishes to)→P31. One-directional publish flow is sound.
6. **Admin moderation:** P08/P09 reports → P33 queue → audit log. Community-moderation:7.3.2 reporting
   affordance must exist inside C03/P09; verify the report action is present on the message bubble.

---

## 4. Desktop / Mobile Parity

- P32–P35 are **desktop-only** by spec — acceptable for admin, but ensure graceful "open on desktop"
  messaging if reached on mobile rather than a broken layout.
- All fan-facing pages declare both viewports. Highest-risk responsive screens: P09/P11 (live chat
  density), P16 (route/map), P34 (data viz). Confirm refiners specified mobile reflow for each.
- SOS FAB (C09) placement must not collide with mobile tab bar (C01) or RTL mirrored layouts.

---

## 5. Consistency of Core Concepts

Event, Country Community, Fan Profile, Local Helper, Community Trip are represented across P04/P06,
P07–P09, P02, P17–P19, and P14–P16 respectively. Terminology is consistent in titles. One risk:
"Trip" appears as both *Personal Itinerary* (P14) and *Community Trip* (P15/P16) — ensure copy and
C06 visually distinguish personal vs. shared/community trip objects to avoid user confusion. Medium.

---

## 6. Token & Visual Consistency
- Single trust-tier color scale must be token-driven and consumed only via C02.
- Alert severity (C07) and trust tiers (C02) must use **distinct** palettes to avoid semantic
  collision (e.g., green "verified" vs green "all-clear").
- RTL: directional tokens (start/end vs left/right) required across all components; confirm tokens
  expose logical properties.

---

## 7. Summary
The page inventory is comprehensive and requirement-traceable. Coherence blockers are concentrated
in (a) the missing **Discover** nav home leaving three surfaces orphaned, (b) **RTL/i18n** needing a
single app-level context, and (c) under-specified cross-flow entry points (P22, P16, role switcher).
Resolve the high-severity items and re-submit for sign-off.