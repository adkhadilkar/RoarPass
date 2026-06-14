"""
fanout.py — parallel sub-agent execution with a concurrency cap, plus the
worker -> reviewer feedback loop used by every phase.
"""
from __future__ import annotations
import json
import pathlib
from concurrent.futures import ThreadPoolExecutor, as_completed
import yaml

from . import agent

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_WF = yaml.safe_load((_ROOT / "config" / "workflow.yaml").read_text())
_CAP = _WF["fanout"]["max_parallel_agents"]


def parallel_map(role: str, tasks: list[dict], *, design: bool = False,
                 phase: int = -1, round_: int = 1) -> list[dict]:
    """Run `role` over many task dicts in parallel (capped). Each task dict must carry a
    'prompt' key and an 'id'. Returns list of {id, raw, files, json}."""
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=_CAP) as ex:
        futs = {
            ex.submit(agent.run_agent, role, t["prompt"], design=design,
                      phase=phase, agent_id=t["id"], round_=round_): t
            for t in tasks
        }
        for fut in as_completed(futs):
            t = futs[fut]
            raw = fut.result()
            results.append({
                "id": t["id"],
                "raw": raw,
                "files": agent.parse_files(raw),
                "json": agent.parse_json(raw),
            })
    return results


def write_files(repo_dir: pathlib.Path, file_pairs: list[tuple[str, str]]):
    for rel, content in file_pairs:
        dest = repo_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content)


def review_loop(*, worker_role: str, reviewer_role: str, repo_dir: pathlib.Path,
                worker_tasks: list[dict], reviewer_prompt_fn, max_rounds: int,
                design: bool = False, phase: int = -1) -> dict:
    """Generic worker->reviewer loop.
    - worker_tasks: initial fan-out tasks (each {id, prompt}).
    - reviewer_prompt_fn(written_files) -> reviewer prompt string.
    - Re-runs only workers whose slug appears in reviewer findings.
    Returns the final reviewer verdict dict.
    """
    findings_by_target: dict[str, list] = {}
    verdict = {"signed_off": False}
    for rnd in range(1, max_rounds + 1):
        # augment worker prompts with targeted feedback (round > 1)
        tasks = []
        for t in worker_tasks:
            fb = findings_by_target.get(t["id"], [])
            prompt = t["prompt"]
            if fb:
                prompt += "\n\n## Reviewer feedback to address:\n" + json.dumps(fb, indent=2)
            tasks.append({"id": t["id"], "prompt": prompt})

        outputs = parallel_map(worker_role, tasks, design=design, phase=phase, round_=rnd)
        for o in outputs:
            write_files(repo_dir, o["files"])

        # review
        review_raw = agent.run_agent(reviewer_role, reviewer_prompt_fn(outputs), design=False,
                                     phase=phase, agent_id=reviewer_role, round_=rnd)
        vj = agent.parse_json(review_raw)
        # reviewers may also emit report files
        write_files(repo_dir, agent.parse_files(review_raw))
        verdict = json.loads(vj) if vj else {"signed_off": True, "findings": []}
        verdict["round"] = rnd

        findings = verdict.get("findings", [])
        unresolved = [f for f in findings if f.get("severity") in ("high", "medium")]
        if verdict.get("signed_off") or not unresolved:
            return verdict

        # route feedback back to the offending workers only
        findings_by_target = {}
        for f in unresolved:
            findings_by_target.setdefault(f["target"], []).append(f)
        # keep only workers that need rework next round
        worker_tasks = [t for t in worker_tasks if t["id"] in findings_by_target]
        if not worker_tasks:
            return verdict
    return verdict
