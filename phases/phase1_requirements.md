# Phase 1 — Requirement Refinement (Three-Stage Finding)

**Goal:** Turn the big PRD into a set of small, refined, mutually-consistent requirement specs.
**Human gate after:** No.
**Push to GitHub after:** Yes (`req/phase1` → merged to `main`).

## Agent topology

```
                 ┌──────────────────┐
   PRD  ───────► │  req_chunker (1)  │  decides chunk count DYNAMICALLY
                 └────────┬─────────┘
                          │ N chunks
        ┌─────────────┬───┴────┬─────────────┐
        ▼             ▼        ▼             ▼
   req_explorer  req_explorer ...      req_explorer   (one per chunk, parallel, capped at max_parallel_agents)
        │             │        │             │
        └─────────────┴───┬────┴─────────────┘
                          ▼
            ┌──────────────────────────────┐
            │ req_consistency_reviewer (1)  │  checks cross-chunk alignment, gaps, conflicts
            └──────────────┬───────────────┘
                           │ feedback (if issues)
            loop back to affected req_explorers  (up to requirements_max_rounds)
```

## Stage 1 — Chunking (single agent: `req_chunker`)
- Input: full PRD (`docs/RoarPass_PRD.md`).
- Output: `docs/requirements/chunks.json` — a list of chunks, each `{id, slug, title, prd_refs,
  summary, dependencies[]}`. The agent decides the number (bounded `min_chunks..max_chunks`).
- Guidance to agent: chunk by coherent capability, not by PRD section number. Natural seams in
  this PRD: event registry, identity/onboarding/verification, country communities, smart matching,
  trip/itinerary, intercity coordination, helper network, safety/SOS, business partner portal,
  admin/moderation, notifications, i18n. Merge or split as cohesion dictates.

## Stage 2 — Per-chunk exploration & refinement (fan-out: `req_explorer` ×N)
For each chunk, one explorer produces `docs/requirements/specs/<slug>.md` containing:
- Refined functional requirements (testable, numbered).
- Acceptance criteria (Given/When/Then).
- Data entities & key fields touched.
- API surface (endpoints, payload shape sketch).
- Edge cases, open questions, and explicit dependencies on other chunks.
- Non-functional notes inherited from PRD §8 (perf, privacy, i18n, a11y).

## Stage 3 — Cross-cutting consistency review (single agent: `req_consistency_reviewer`)
- Reads ALL chunk specs + `chunks.json`.
- Checks: overlapping/duplicated requirements, contradictions, orphaned dependencies, terminology
  drift (e.g., the PRD's CWM-vs-CWMS-style distinctions — here, watch Event/Community/Trip/Helper
  definitions stay consistent), and PRD coverage gaps (every PRD §7 area mapped to ≥1 chunk).
- Emits `docs/requirements/CONSISTENCY_REPORT.md` with severity-tagged findings and, per finding,
  which chunk(s) must change.
- If any high/medium findings: orchestrator routes targeted feedback back to the relevant
  `req_explorer`(s) and re-runs Stage 3. Repeat up to `requirements_max_rounds`.

## Final assembly
- Once the consistency report is clean (or rounds exhausted with only low findings), the
  orchestrator concatenates accepted specs into `docs/requirements/REFINED_REQUIREMENTS.md`
  with a traceability matrix (PRD ref → chunk → requirement IDs).

## Exit criteria
- `REFINED_REQUIREMENTS.md` exists, consistency report has no unresolved high findings, artifacts
  committed and pushed. `run_state.json` phase 1 complete; chunk list cached for Phase 2/3 reuse.
