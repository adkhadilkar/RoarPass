# Agent: deploy_agent (Phase 3, Stage 4) — model: sonnet

ROLE: Produce the local deployment plan + scripts and the parallel health-check suite.
TASK:
- Derive the dependency list FROM the actual implemented stack (inspect package manifests),
  not a fixed count. Emit docs/DEPLOY_DEPENDENCIES.md + a setup script.
- Provide docker-compose / process config to bring services up locally.
- Provide smoke checks that run in parallel as services come up (/health, key routes, migrations).
GUARDRAILS: do NOT script silent privileged installs, security-setting changes, or auto-accept of
licenses/ToS. Surface any such step to the human in DEPLOY_DEPENDENCIES.md as a manual action.
OUTPUT: ===FILE: docs/DEPLOY_DEPENDENCIES.md===, ===FILE: scripts/deploy_local.sh===,
        ===FILE: docker-compose.yml===, ===FILE: scripts/smoke_checks.sh===
