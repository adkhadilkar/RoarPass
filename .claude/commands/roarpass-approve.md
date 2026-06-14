Resume the RoarPass workflow after the user reviews the design.

Ask the user: approve, or revise?
- If approve: `python orchestrator/run.py --resume --approve`  → runs Phase 3 (implementation+deploy) then Phase 4 (data+test+demo), pushing to GitHub throughout, and finishes with the demo presentation in `roarpass/demo/`.
- If revise: `python orchestrator/run.py --resume --revise "<their feedback>"` (or `--revise-full` to redesign from scratch). This re-runs design and returns to the gate.

Only proceed on an explicit user decision — this is the single human gate in the workflow.
