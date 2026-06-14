# RoarPass — Design System & Whole-Product Coherence Review

**Phase 2, Stage 4 — System Reviewer**
**Scope:** 36 pages (P01–P36) + 10 shared components (C01–C10) + design tokens
**Result:** Conditional sign-off withheld — see blocking system issues below.

---

## 1. Information Architecture & Navigation

### 1.1 Primary Navigation (C01 App Shell)
The app shell defines the spine for all authenticated pages. Verified that the following top-level destinations resolve to real pages:

| Nav Destination | Target Page | Status |
|---|---|---|
| Home / Event Hub | P06 home-dashboard | OK |
| Communities | P07 → P08 → P09 | OK |
| Messages | P10 direct-messages (+ P11 live chat contextual) | OK |
| Discover (Matching) | P12 smart-match-discovery | OK |
| Trips | P14 trip-builder (hub for P15, P16) | OK |
| Helpers | P17 helper-directory | OK |
| Info | P20 official-info-guides | OK |
| Safety | P21 safety-modes | OK |
| Notifications | P26 notifications-center | OK |
| Settings | P25, P36, P13 (nested) | OK |

**FINDING (medium):** That is 9–10 primary destinations — exceeds the comfortable 5-tab mobile bottom-nav ceiling. C01 must define an explicit mobile pattern (5 primary tabs + "More" drawer) versus the desktop left-rail. Several refiners placed entry points differently; the shell must be the single source of truth.

### 1.2 Cross-Cutting Overlays
- **C09 sos-fab** must render on every authenticated screen at a fixed position. Verified intent in P21/P22/P23; must confirm C09 is mounted at the shell layer (C01), NOT per-page, to avoid duplication and z-index conflicts with C07 alert-banner and C28 premium gate.
- **C08 language-switcher** appears in onboarding (P01–P04) AND settings (P25). Confirm a single component instance with consistent placement (shell header on desktop, settings + onboarding header on mobile).

---

## 2. Orphan & Reachability Audit

Walked every page for at least one inbound entry point:

- **P05 verification-center** — reachable from C02 trust-badge tap, P06 dashboard prompt, P18 helper request. OK.
- **P13 match-visibility-settings** — reachable from P12 and P36. OK.
- **P16 intercity-routes** — reachable from P14/P15. OK.
- **P19 helper-management** — gated behind P03 role-selection (Helper role). Confirm dashboard (P06) surfaces a "Helper Mode" switch only when the role is active. OK with condition.
- **P24 phrase-cards** — reachable from P23 SOS overlay and P20 info. OK.
- **P28 ai-assistant-premium-gate** — component invoked from P27. OK.
- **P29–P31 business portal** — P29/P30 are partner-role contexts; P31 is fan-facing under Discover/Info. Confirm partner portal is a distinct authenticated context, not buried in fan nav.

**FINDING (high):** **P35 admin-phrase-library and the entire admin cluster (P32–P34) have no defined transition INTO them from the fan/partner shell — which is correct (separate console) — but no page defines the admin shell itself.** C01 is described for the consumer app only. Admin pages (P32–P35, desktop-only) reference no shared navigation component. Risk: 4 desktop admin screens with inconsistent, ad-hoc chrome. Needs a shared admin-shell decision.

---

## 3. Desktop / Mobile Parity

- P32–P35 are desktop-only by spec (admin) — acceptable, no mobile parity required.
- All other pages declare both viewports. Spot-checked parity concerns:
  - **P09 community-channel / P10 / P11** threaded messaging: desktop uses 3-pane (list/thread/detail); mobile must collapse to push-navigation stack. Confirm C03 message-bubble translation overlay (tap-to-reveal) works on both — desktop hover vs mobile tap divergence must be reconciled.
  - **P12 / C04 fan-match-card:** desktop grid vs mobile swipe-deck. Both are valid but must share C04; verify the card does not fork into two components.
  - **P29/P34 dashboards:** dense data tables/charts need a defined mobile reflow (P34 is desktop-only so OK; P29 is dual-viewport — confirm chart reflow).

**FINDING (medium):** C03 translation-overlay interaction (hover vs tap) is not unified. Mandate tap/click-to-toggle on BOTH viewports for accessibility (WCAG 2.1 AA — hover-only content fails 1.4.13).

---

## 4. Shared Component Reuse Verification

| Component | Must appear in | Reuse confirmed |
|---|---|---|
| C02 trust-badge | P05, P12, P17, P18, P19, C04, C05 | Verify no page renders an inline badge variant |
| C03 message-bubble | P09, P10, P11, P15 | OK — single source |
| C04 fan-match-card | P12, P06 (suggestions) | OK |
| C05 helper-card | P17, P06, P16 | OK |
| C06 trip-object-card | P14, P15, P16, P27 (AI output) | OK |
| C07 alert-banner | P06, P16, P20, P21, P26 | OK |
| C10 ai-suggestion-card | P27, P14 (inline AI) | OK |

**FINDING (medium):** C02 trust-badge tier taxonomy (verification-trust-tiers:7.10.1) must be byte-identical everywhere — same tier names, colors, icons. Refiners for P05, P17, P18 each described tiers; reconcile to one canonical tier list and token-driven colors (no per-page hex).

**FINDING (low):** C06 trip-object-card is reused inside AI assistant output (P27/C10). Confirm C10 ai-suggestion-card composes C06 rather than re-rendering trip items, to keep "add to trip" affordance consistent.

---

## 5. End-to-End Flow Sanity

Traced critical journeys:

1. **First-run:** P01 → P02 → P03 → P04 → P06. Coherent. Confirm a user can activate an event (P04) before/after profile (P02) — order must be locked by the shell, not assumed per-page.
2. **Meet a fan safely:** P12 → match → P10 DM → P22 meetup check-in → (C09 SOS available). Coherent. Verify P22 check-in surfaces C07 alert-banner state on P06.
3. **Plan & coordinate a trip:** P14 → P15 (group) → P16 (intercity) → P27 (AI assist) → P28 (premium gate). Coherent. P27 outputs must write back to P14 via C06.
4. **Get local help:** P17 → P18 (request flow) → P10 DM → P22. Coherent.
5. **Language/safety in-field:** any screen → C09 → P23 → P24. Coherent.

**FINDING (medium):** Premium gate (P28) is reachable from P27 but the upgrade/entitlement state has no defined global home. After upgrade, what reflects the new entitlement across P27, P12 (advanced matching?), and helper features? Needs a single entitlement indicator (likely in C01 header / P36). Flagging as system-level coherence gap, not a page bug.

---

## 6. Consistency of RoarPass Core Concepts

Verified the five core concepts render with consistent vocabulary across pages:
- **Event** (P04, P06, P32) — consistent "Activated Event" framing. OK.
- **Country/City Community** (P07, P08, P09) — consistent. OK.
- **Fan Profile** (P02, P12, P36) — consistent. OK.
- **Local Helper** (P17–P19, C05) — consistent. OK.
- **Community Trip** (P14–P16, C06) — **terminology drift risk:** "Trip" vs "Itinerary" vs "Community Trip" used across P14/P15/P16. Standardize: personal = "Itinerary", shared = "Community Trip".

**FINDING (medium):** Lock trip terminology in the glossary; update P14/P15/P16/C06 labels.

---

## 7. Tokens, i18n/RTL, Accessibility (cross-page)

- **RTL:** C08 toggles RTL. Confirm all flow pages (P01–P04, P14, P18, P22, P30) mirror correctly; directional icons (back/next, route arrows in P16) must use logical properties. Spot risk in P16 intercity route visualization.
- **Color/contrast:** trust-badge and alert-banner colors must pass AA from tokens; no per-page overrides (ties to §4 finding).
- **SOS (C09/P23):** must remain reachable and AA-contrast in both LTR/RTL and dark mode; emergency text (REQ-TRANS-14) must be pre-translated, not live-MT-dependent.

---

## 8. Summary of Blocking vs Non-Blocking

- **Blocking (high):** Admin shell undefined for P32–P35 (§2).
- **Should-fix before sign-off (medium):** mobile nav ceiling/More-drawer (§1.1); C03 hover-vs-tap (§3); trust-badge canonical taxonomy (§4); entitlement global indicator (§5); trip terminology (§6).
- **Non-blocking (low):** C10 composing C06 (§4).

**Sign-off withheld** pending the one high-severity structural gap (admin shell) and confirmation of the shared-component canonicalization items.