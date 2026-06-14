# Tracking a run

Three layers of observability, all written to `state/` (gitignored):

## 1. Structured run log — `state/run_log.jsonl`
One JSON line per event. Kinds:
- `phase`  — phase status changes (running/complete/awaiting_approval)
- `agent`  — every sub-agent turn: phase, role, agent_id, model, round, status, duration, tokens
- `gate`   — awaiting_approval / approved / revising
- `git`    — each push with its commit message

Quick analysis examples:
```bash
# token + rough cost per phase
python - <<'PY'
import json,collections
tok=collections.Counter()
for l in open("state/run_log.jsonl"):
    e=json.loads(l)
    if e.get("kind")=="agent": tok[e["phase"]]+=e["tokens_in"]+e["tokens_out"]
print(dict(tok))
PY

# how many agents ran in phase 1
grep '"kind": "agent"' state/run_log.jsonl | grep '"phase": 1' | wc -l
```

## 2. Live dashboard — `scripts/dashboard.py`
```bash
python scripts/dashboard.py --serve 8800
# open http://localhost:8800/dashboard.html
```
Auto-refreshes every 3s while a run is in progress: phase timeline, per-phase agent counts,
running/done/looping status, token spend + estimated cost, and the gate banner.

## 3. Per-agent transcripts — `state/agent_logs/phaseN/<role>-<id>-rN.md`
Full input + output for every agent turn. Inspect exactly what any sub-agent saw and produced,
including each review-loop round (r1, r2, ...). This is how you debug "why did the design refiner
keep looping on the helper page".

## The build animation
`scripts/build_animation.py` turns `run_log.jsonl` into a GIF/MP4 of the orchestration for slides
(Phase 5, or run standalone). See `phases/phase5_build_animation.md`.
