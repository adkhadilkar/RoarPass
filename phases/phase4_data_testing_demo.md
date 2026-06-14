# Phase 4 — Data Seeding, Testing, and Demo

**Goal:** Fill the app with realistic **FIFA World Cup 2026** data, run functional + integration
tests via parallel sub-agents, then produce a 3–4 page demo presentation with animations/screens.
**Human gate after:** No — the workflow ENDS by producing the demo (it does not pause).
**Push to GitHub after:** Yes (seed data, test reports, demo assets).

## Test target
- Primary fixture: **FIFA World Cup 2026** (US · Canada · Mexico), the active event in the PRD's
  go-to-market. Secondary dataset: **FIFA Club World Cup** as an additional event to exercise the
  multi-event/multi-tenant model.

## Agent topology

```
 deployed app
     │
     ▼
 data_seeder (1..k) ──► realistic FIFA WC 2026 dataset (events, teams, host cities, matches,
     │                   fans across countries, helpers, communities, trips, messages)
     ▼
 ┌──────── parallel test agents (per chunk/area) ────────┐
 │ test_agent: functional tests  +  integration tests    │  (run in parallel, capped)
 └────────────────────────┬──────────────────────────────┘
                          ▼
                    consolidated test report
                          ▼
                    demo_agent ──► demo animations/screens + 3–4 page presentation
```

## Stage 1 — Data seeding (`data_seeder`)
- Generates `data/seed/` fixtures: the FIFA WC 2026 event (48 teams, 16 host cities), a realistic
  match schedule, thousands of synthetic fan profiles spread across participating nations,
  language distributions, a set of verified local helpers per host city, country communities with
  channels and seeded messages, sample trips and intercity routes (e.g., Dallas→Houston), and
  business-partner listings.
- **Privacy:** all data is **synthetic** — no real PII. Faker-style generation. Seed data is
  committed (public repo) only because it is fabricated; the seeder asserts no real emails/phones.

## Stage 2 — Test design + execution (`test_agent` ×N, parallel)
- Each area's test agent writes and runs:
  - **Functional tests:** acceptance criteria from the chunk's refined spec (e.g., a Korean fan
    activates WC 2026 → auto-joined to "South Korea · FIFA World Cup 2026" + host-city sub-comms).
  - **Integration tests:** cross-service flows (matching surfaces "14 Korean fans arriving at LAX
    Jun 14–16"; helper request → message thread; trip group → shared itinerary → group poll;
    SOS triggers alert path; multi-event profile persists across WC and Club WC).
- Results stream into `tests/reports/<area>.json`; orchestrator consolidates
  `docs/TEST_REPORT.md` with pass/fail, coverage of acceptance criteria, and defects (routed back
  to a Phase-3 coder for hotfix if a regression blocks the demo, bounded retries).

## Stage 3 — Demo production (`demo_agent`)
- Walks the seeded, tested app through a scripted user journey (e.g., a South Korea fan's WC 2026
  trip: onboard → activate event → join community → find a helper in LA → plan Dallas→Houston
  intercity → meetup with SOS demo).
- Captures screenshots and short screen-capture animations (GIF/MP4 via headless browser; see
  `scripts/demo_capture.py`) into `demo/`.
- Produces a **3–4 page demo presentation** (`demo/DEMO_PRESENTATION.md` + rendered PDF/HTML):
  1. What RoarPass is + the WC 2026 scenario.
  2. Core fan journey with embedded animations/screens.
  3. Differentiators (helpers, intercity, safety) shown live.
  4. Architecture + test summary + what's next.

## Exit criteria
- Synthetic seed committed, `TEST_REPORT.md` written, demo presentation + animations produced and
  pushed. `run_state.json` phase 4 complete → **workflow done.**
