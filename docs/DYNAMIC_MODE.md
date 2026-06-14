# Fully dynamic mode

Instead of the fixed Phase 0–5 sequence, a **planner agent** (Opus 4.8) reads the PRD and designs
the entire plan: phases, agents, fan-out shape, ordering, and where (if anywhere) human approval
gates go. The executor then runs whatever plan was emitted.

```bash
python orchestrator/run.py --prd docs/RoarPass_PRD.md --dynamic
```

The generated plan is saved to `roarpass/docs/GENERATED_PLAN.json` so you can see exactly what
the planner decided before/while it runs.

## What the planner controls
Everything about structure: number and names of phases, which agents run, parallel fan-out,
review loops, commit/push points, and gate placement (zero, one, or many — its choice).

## The two things the planner CANNOT override (safety rails, enforced by the executor)
1. **Secrets are never committed.** Pushes go through the git layer's forbidden-path check, and
   the executor scans generated file content for actual env secret values and refuses to write
   them. This protects your PUBLIC demo repo.
2. **Prohibited actions stay blocked.** Changing repo visibility/permissions, hard-deleting data,
   and entering credentials into forms are not exposed as plan primitives, so a plan cannot
   request them.

These are not workflow opinions — they are safety boundaries. The planner can route the build any
way it likes; it just cannot leak your token or perform a destructive/credentialed action.

## Resuming after a gate (if the planner created one)
Same as static mode — the run pauses, fires a phone notification (ntfy), and writes
`state/AWAITING_APPROVAL.md`:
```bash
python orchestrator/run.py --resume --approve
python orchestrator/run.py --resume --revise "feedback"
```

## Tradeoff (honest note)
A self-planned workflow is more flexible but less predictable than the fixed pipeline. If the
planner ever emits a plan you don't like, inspect `GENERATED_PLAN.json` and re-run; or use the
fixed pipeline (omit `--dynamic`) when you want guaranteed phase/gate structure.
