# Phase 0 — Bootstrap

**Goal:** Prepare the workspace and the GitHub repo so every later phase can commit/push cleanly.
**Human gate after:** No.
**Push to GitHub after:** Yes (initial scaffold).

## Steps (orchestrator-driven, no fan-out)

1. **Load config + secrets.** Read `config/*.yaml`. Load `.env` into the environment. Verify
   `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_USER`, `GITHUB_REPO` are present. If any missing,
   stop with a clear message — do NOT proceed.

2. **Validate the API key cheaply.** Make one tiny `claude-haiku` or models-list call to confirm
   the key works and bills correctly. Abort early if unauthorized.

3. **Validate the repo.** Confirm the public repo exists and the token can push. Do NOT create
   repos or change visibility/permissions (that is a prohibited access-control action — if the
   repo doesn't exist, stop and ask the human to create it).

4. **Scaffold the project tree** (the *product* repo, distinct from this workflow bundle):
   ```
   roarpass/
   ├── README.md                 ← product README (grows each phase)
   ├── .gitignore                ← inherits secret-forbidding rules
   ├── docs/                     ← requirements, design, deploy docs land here
   ├── apps/
   │   ├── web/                  ← Next.js responsive web + mobile-web (Phase 3)
   │   └── api/                  ← single-event backend (Phase 3)
   ├── packages/
   │   └── shared/               ← shared types/contracts
   ├── data/seed/                ← FIFA WC 2026 seed data (Phase 4)
   ├── tests/                    ← test suites (Phase 4)
   └── demo/                     ← demo assets + presentation (Phase 4)
   ```

5. **Initialize state.** Write `state/run_state.json` with `{phase: 0, status: complete, ...}`.

6. **Commit & push.** Branch `main`, commit `chore: bootstrap RoarPass scaffold`, push.
   Scrub the token from any log line.

## Exit criteria
- Secrets validated, repo reachable, scaffold pushed, `run_state.json` shows phase 0 complete.
