"""
executor.py — fully dynamic mode.

A planner agent designs the ENTIRE plan (phases, agents, fan-out, ordering, gates). This executor
runs whatever the planner emitted. It interprets a small set of step primitives and otherwise
imposes NO structure of its own.

The ONLY things the executor enforces regardless of the plan (safety invariants, not workflow
opinions):
  1. Secrets are never committed — git pushes go through git_ops, which has a forbidden-path
     check; additionally we scan step payloads for env-value leakage before writing files.
  2. Prohibited actions (repo permission/visibility changes, hard deletes, credential entry) are
     not exposed as primitives, so a plan cannot request them.

Everything else — including whether gates exist and where — is the planner's call.
"""
from __future__ import annotations
import json
import os
import pathlib

from . import agent, fanout, git_ops, gate, runlog, notify

_ROOT = pathlib.Path(__file__).resolve().parent.parent
PRODUCT = _ROOT.parent / "roarpass"

# crude secret-leak guard: refuse to write file content that contains an actual env secret value.
_SECRET_ENVS = ("ANTHROPIC_API_KEY", "GITHUB_TOKEN")

# in-process runtime state (gates passed this session, etc.)
_PLAN_RUNTIME: dict = {}


def _scan_for_secret_leak(file_pairs):
    leaks = []
    secret_values = [os.environ[k] for k in _SECRET_ENVS if os.environ.get(k)]
    for rel, content in file_pairs:
        for val in secret_values:
            if val and len(val) > 8 and val in content:
                leaks.append(rel)
    if leaks:
        raise RuntimeError(f"SAFETY: refusing to write files that contain secret values: {leaks}")


def _expand_items(items, plan_vars):
    if isinstance(items, str) and items.startswith("$"):
        return plan_vars.get(items[1:], [])
    return items or []


def _fmt(template: str, item, plan_vars) -> str:
    """Format a prompt template with an item (dict or str) and plan vars."""
    ctx = {"item": item, **plan_vars}
    if isinstance(item, dict):
        ctx.update(item)
    try:
        return template.format(**ctx)
    except (KeyError, IndexError):
        # be forgiving: fall back to appending the item JSON
        return template + "\n\n" + json.dumps(item)


def run_plan(plan: dict, st: dict):
    """Execute a planner-emitted plan. `st` carries run state (plan vars, etc.)."""
    plan_vars: dict = st.setdefault("plan_vars", {})
    print(f"[executor] plan rationale: {plan.get('rationale','')}")

    for phase in plan.get("phases", []):
        pid, pname = phase.get("id"), phase.get("name", "")
        # resume support: skip phases already complete
        if pid in st.get("completed_phases", []):
            continue
        print(f"== Phase {pid}: {pname} (dynamic) ==")
        runlog.log_phase(pid, pname, "running")

        for step in phase.get("steps", []):
            kind = step.get("kind")
            try:
                _run_step(kind, step, pid, plan_vars)
            except _GateRaised:
                # gate pauses the run; persist state and stop here
                st["paused_at_phase"] = pid
                st["status"] = "awaiting_approval"
                st.setdefault("completed_phases", [])  # this phase not complete yet
                st["plan_vars"] = plan_vars
                from .run import save_state  # local import to avoid cycle
                save_state(st)
                return "paused"

        st.setdefault("completed_phases", []).append(pid)
        runlog.log_phase(pid, pname, "complete")
        from .run import save_state
        st["plan_vars"] = plan_vars
        save_state(st)

    print("\n*** Dynamic plan complete. ***\n")
    return "complete"


class _GateRaised(Exception):
    pass


def _run_step(kind, step, pid, plan_vars):
    if kind == "single":
        raw = agent.run_agent(step["role"], _fmt(step.get("prompt", ""), {}, plan_vars),
                              phase=pid, agent_id=step.get("agent_id", step["role"]))
        files = agent.parse_files(raw)
        _scan_for_secret_leak(files)
        fanout.write_files(PRODUCT, files)
        if step.get("emits_plan_var"):
            j = agent.parse_json(raw)
            if j:
                data = json.loads(j)
                # store the first list-valued key, or the whole object
                val = next((v for v in data.values() if isinstance(v, list)), data)
                plan_vars[step["emits_plan_var"]] = val

    elif kind == "fanout":
        items = _expand_items(step.get("items"), plan_vars)
        tasks = [{"id": _item_id(it, i),
                  "prompt": _fmt(step["prompt_template"], it, plan_vars)}
                 for i, it in enumerate(items)]
        outs = fanout.parallel_map(step["role"], tasks, phase=pid)
        for o in outs:
            _scan_for_secret_leak(o["files"])
            fanout.write_files(PRODUCT, o["files"])

    elif kind == "review_loop":
        items = _expand_items(step.get("items"), plan_vars)
        tasks = [{"id": _item_id(it, i),
                  "prompt": _fmt(step["worker_prompt_template"], it, plan_vars)}
                 for i, it in enumerate(items)]
        fanout.review_loop(
            worker_role=step["worker_role"], reviewer_role=step["reviewer_role"],
            repo_dir=PRODUCT, worker_tasks=tasks,
            reviewer_prompt_fn=lambda outs: step["reviewer_prompt"],
            max_rounds=step.get("max_rounds", 3), phase=pid)

    elif kind == "gate":
        gid = step.get("gate_id", f"phase{pid}")
        # if this gate was already approved (resume), skip it
        import os as _os
        approved = gate.read_decision()
        cleared_gates = _PLAN_RUNTIME.setdefault("passed_gates", set())
        if gid in cleared_gates or (approved and approved.get("approved")
                                    and gid not in cleared_gates):
            cleared_gates.add(gid)
            print(f"[executor] gate '{gid}' already approved — continuing.")
            return
        runlog.log_gate("awaiting_approval")
        gate.raise_gate(PRODUCT, gate_id=gid, review_paths=step.get("review_paths"))
        notify.send_gate_notification(gid, step.get("review_paths"))
        raise _GateRaised()

    elif kind == "git_push":
        git_ops.commit_and_push(PRODUCT, step["message"], branch=step.get("branch"))
        runlog.log_git("push", step["message"], branch=step.get("branch", ""))

    elif kind == "script":
        import subprocess, sys
        script = _ROOT / "scripts" / step["script"]
        subprocess.run([sys.executable, str(script), *step.get("args", [])], cwd=_ROOT)

    else:
        print(f"[executor] WARNING: unknown step kind '{kind}', skipping.")


def _item_id(it, i):
    if isinstance(it, dict):
        return it.get("slug") or it.get("id") or f"item{i}"
    return str(it)[:40] or f"item{i}"
