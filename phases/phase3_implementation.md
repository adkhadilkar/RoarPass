# Phase 3 — Implementation + Local Deployment

**Goal:** Build the approved design as a working **web + mobile-web** app (full-stack, single
event = FIFA WC 2026), with parallel code/review/merge, push to GitHub iteratively, then deploy
locally with deployment+checks running in parallel.
**Human gate after:** No (resumes automatically after the Phase 2 approval).
**Push to GitHub after:** Yes — feature commits during, final tagged commit at end.

## Precondition
- `state/APPROVAL.json` shows the design was approved. If a `--revise` came in, Phase 2 re-ran
  first; Phase 3 only starts on a clean approval.

## Agent topology (per implementation chunk, in parallel waves)

```
 approved design + refined reqs + chunks.json
        │
        ▼ (dependency-ordered waves; within a wave, parallel up to max_parallel_agents)
   ┌──────────── per chunk ────────────┐
   │  coder  ──►  code_reviewer  ──► (loop code_review_max_rounds)
   │                  │                │
   └──────────────────┼────────────────┘
                      ▼
                 merge_agent  ──► integrates chunk branch into main, resolves conflicts
                      ▼
            (after all chunks merged)
                 deploy_agent ──► local deploy + checks (parallel)
```

## Stage 1 — Dependency-ordered build waves
- Orchestrator topologically sorts chunks by `dependencies[]`. Foundation chunks (identity, event
  registry, shared types) build first; dependent chunks (communities, trips, helpers, matching)
  follow. Within a wave, chunks build in parallel.

## Stage 2 — Per-chunk code + review loop
- `coder`: implements the chunk on branch `feat/<slug>` — frontend (Next.js, responsive +
  mobile-web), backend (single-event API), shared contracts. Writes unit tests alongside.
- `code_reviewer`: checks correctness, security (PRD §8.3: authz, input validation, no secrets in
  code, OWASP basics), adherence to the approved design, and the requirement's acceptance criteria.
  Returns actionable diffs/feedback. Loop until sign-off or `code_review_max_rounds`.
- Each accepted chunk is committed `feat({slug}): ...` and pushed.

## Stage 3 — Merge
- `merge_agent`: merges each accepted `feat/<slug>` branch into `main`, resolves conflicts,
  ensures the integrated build compiles and shared contracts stay consistent. Commits
  `merge: integrate {slug} into main`, pushes.

## Stage 4 — Local deployment (deploy + checks in parallel)
- `deploy_agent`: brings the app up locally. Dependencies are **derived from the actual stack**,
  not a fixed list — see `docs/DEPLOY_DEPENDENCIES.md`. Typical set: Node, pnpm, Postgres, Redis,
  Docker, and the app's own packages.
- Deployment and health-checking run concurrently: as services come up, smoke checks
  (`/health`, key routes render, DB migrations applied, seed-less boot succeeds) run in parallel
  and report into `docs/IMPLEMENTATION_REPORT.md`.
- **Prohibited-action guardrails:** the deploy agent must NOT install system packages requiring
  elevated/credentialed steps silently, modify security settings, or accept license/ToS prompts.
  Anything in those categories is surfaced to the human, not auto-accepted.

## Stage 5 — Finalize
- Tag `v0.1.0-demo`, commit `build: deployable web + mobile-web app`, push.

## Exit criteria
- App builds, all chunks merged to `main`, local deploy passes smoke checks, implementation report
  written, final tag pushed. `run_state.json` phase 3 complete.
