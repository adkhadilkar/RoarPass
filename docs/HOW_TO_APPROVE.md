# How to approve (the one human gate)

After Phase 2, the workflow stops and writes `state/AWAITING_APPROVAL.md`.

1. Review in the **product repo** (`../roarpass/`):
   - `docs/design/DESIGN_README.md` — feature-by-feature walkthrough with desktop + mobile screenshots.
   - `docs/design/screens/` — all rendered PNGs.
   - `docs/design/DESIGN_SYSTEM_REVIEW.md` — whole-system coherence review.
   These are also pushed to GitHub on branch `design/phase2`.

2. Decide:
   - **Approve** → implementation begins, code is pushed to GitHub iteratively, app deploys locally, then data+tests+demo run:
     ```
     python orchestrator/run.py --resume --approve
     ```
   - **Revise** (tweak the existing designs) →
     ```
     python orchestrator/run.py --resume --revise "make helper cards larger; tighten community feed spacing"
     ```
   - **Redesign from scratch** (re-chunk + redesign) →
     ```
     python orchestrator/run.py --resume --revise-full "rethink the trip planner as a timeline, not a list"
     ```

A revise loops back to this same gate when done. There is no second mandatory gate — Phase 4 ends by producing the demo.
