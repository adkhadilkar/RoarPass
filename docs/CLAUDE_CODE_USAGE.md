# Running this with Claude Code

This bundle is meant to be handed to Claude Code along with the PRD.

## One-time setup
1. Place the PRD at `docs/RoarPass_PRD.md` inside this bundle (or pass another path with `--prd`).
2. `cp .env.example .env` and fill in ANTHROPIC_API_KEY (your key — all usage bills to it), plus GITHUB_TOKEN/USER/REPO for the existing public demo repo.
3. `pip install -r requirements.txt`

## Drive it
Either run the orchestrator directly:
```
python orchestrator/run.py --prd docs/RoarPass_PRD.md     # → halts at design gate
python orchestrator/run.py --resume --approve             # → builds, deploys, tests, demos
```
…or use the slash commands: `/roarpass-run`, `/roarpass-status`, `/roarpass-approve`.

## What Claude Code provides on the host
- A headless browser for `scripts/screenshot.py` and `scripts/demo_capture.py` (Playwright + Chromium).
- Package managers for the implemented stack (Node/pnpm, Postgres, Redis, Docker) per `DEPLOY_DEPENDENCIES.md`, which is generated from the actual code rather than a fixed list.

## Safety boundaries the orchestrator enforces
- Secrets only via env vars; never committed (gitignored + a commit-time forbidden-path check).
- Git layer only commits/branches/pushes to an existing repo. It never creates repos or changes visibility/permissions.
- The deploy agent surfaces (does not silently perform) privileged installs, security-setting changes, or license/ToS acceptance.
