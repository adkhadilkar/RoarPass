# Deploy dependencies (generated in Phase 3)

This file is (re)written by the `deploy_agent` from the ACTUAL implemented stack — it is not a
fixed list of "35 softwares". For the web + mobile-web single-event build, the typical set is:

- Node.js LTS + pnpm (web app, API)
- PostgreSQL (primary store for event/community/trip/helper data)
- Redis (matching cache + messaging pub/sub)
- Docker + docker-compose (local orchestration)
- The app's own packages (installed via pnpm)

Deployment and health checks run in parallel: as each service comes up, smoke checks run against
it and report into `docs/IMPLEMENTATION_REPORT.md`.

## Manual / privileged steps (surfaced, never auto-performed)
Anything needing elevated privileges, security-setting changes, or license/ToS acceptance is
listed here for you to run yourself. The agent will not perform these silently.
