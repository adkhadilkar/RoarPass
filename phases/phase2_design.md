# Phase 2 — UX/UI Design (Web + Mobile-Web)

**Goal:** Produce a reviewable design for every refined feature, as responsive web + mobile-web
screens, plus a design README with screenshots, ready for the **single human approval gate**.
**Human gate after:** **YES — the only mandatory gate in the workflow.**
**Push to GitHub after:** Yes (`design/phase2`).

## Agent topology

```
 refined reqs ──► design_chunker (1) ──► design units (per page/flow)
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
  page_designer      page_designer  ...  page_designer     (parallel, capped)
       │                  │                  │
  asset_designer (icons, illustration, tokens) feeds all pages
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
              design_refiner (windows of N) ──► per-page feedback (loop, design_max_rounds)
                          ▼
              design_system_reviewer (1) ──► whole-system coherence
                          ▼
                  DESIGN_README.md + screens  ──► HUMAN GATE
```

## Stage 1 — Design chunking (`design_chunker`)
- Input: `REFINED_REQUIREMENTS.md` + `chunks.json`.
- Output: `docs/design/pages.json` — list of pages/flows to design, each `{id, slug, title,
  req_refs[], type: page|flow|component, viewport: [desktop, mobile]}`. Maps features → concrete
  screens (e.g., onboarding flow, event activation, country community feed, channel view, helper
  directory, helper profile, trip builder, intercity match view, SOS/safety, admin console).

## Stage 2 — Per-page design (`page_designer` ×N) + `asset_designer`
- Each `page_designer` produces, per page, **responsive HTML/CSS mockups** for desktop AND
  mobile-web viewports under `apps/web/design/<slug>/` (static, self-contained, theme via CSS
  vars). Output is real renderable HTML so screenshots can be captured.
- `asset_designer` produces shared design tokens (`docs/design/tokens.css`), an icon set
  (inline SVG), and any illustrations. All pages import the same tokens for consistency.
- Designers follow `frontend-design` skill guidance (typography, intentional non-default look,
  WCAG AA contrast, 44×44px targets per PRD §8.7, RTL-readiness per §8.6).

## Stage 3 — Refinement loops (`design_refiner`)
- Reviews pages in windows of `reviewer_window` (default 3), checking visual quality, usability,
  consistency with tokens, accessibility, and faithfulness to requirements.
- Emits per-page feedback; orchestrator loops the relevant `page_designer`s until the refiner
  signs off or `design_max_rounds` reached.

## Stage 4 — System-level review (`design_system_reviewer`)
- All refiners' sign-offs feed one reviewer that checks the **whole product** hangs together:
  consistent nav, shared components, coherent IA across flows, no orphan screens, mobile parity.
- Produces `docs/design/DESIGN_SYSTEM_REVIEW.md`.

## Stage 5 — Screenshot capture + README
- Orchestrator renders each design HTML to PNG (headless browser; see `scripts/screenshot.py`)
  into `docs/design/screens/`.
- Assembles `docs/design/DESIGN_README.md`: product overview, per-feature section with embedded
  desktop + mobile screenshots, design rationale, and a "what we're asking you to approve" summary.

## HUMAN GATE
- Orchestrator commits + pushes `design/phase2`, then writes `state/AWAITING_APPROVAL.md`
  pointing at `DESIGN_README.md` and stops.
- Resume with `--approve` (proceed to Phase 3) or `--revise "<feedback>"` (re-run Stages 3–5
  with feedback; `--revise-full` re-runs from Stage 1). See `docs/HOW_TO_APPROVE.md`.

## Exit criteria
- Design README + screens pushed; `AWAITING_APPROVAL.md` written; orchestrator halted awaiting
  human decision.
