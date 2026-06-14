Run the RoarPass multi-agent build workflow end to end.

Steps for you (Claude Code) to perform:
1. Ensure `.env` exists with ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO. If not, ask the user to create it from `.env.example`. Never print secret values.
2. `pip install -r requirements.txt`
3. Confirm the PRD is at `docs/RoarPass_PRD.md`.
4. Run: `python orchestrator/run.py --prd docs/RoarPass_PRD.md`
5. The workflow will execute Phase 0 → 1 → 2 and then HALT at the design approval gate, writing `state/AWAITING_APPROVAL.md`. Show that file's contents to the user and stop. Do not auto-approve.
