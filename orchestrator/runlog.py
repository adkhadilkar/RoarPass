"""
runlog.py — observability for the RoarPass workflow.

Writes two things:
  1. state/run_log.jsonl   — one JSON line per agent invocation (audit + cost trail)
  2. state/agent_logs/<phase>/<role>-<id>.md — full input/output transcript per agent

Both are gitignored. The dashboard and the Phase 5 build animation read run_log.jsonl.
No secrets are ever written (prompts may contain PRD text but never env values).
"""
from __future__ import annotations
import json
import pathlib
import datetime
import threading

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_LOG = _ROOT / "state" / "run_log.jsonl"
_TRANSCRIPTS = _ROOT / "state" / "agent_logs"
_lock = threading.Lock()  # parallel agents append concurrently


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def log_event(**fields):
    """Append one structured event. Thread-safe for parallel fan-out."""
    fields.setdefault("ts", _now())
    line = json.dumps(fields, ensure_ascii=False)
    with _lock:
        _LOG.parent.mkdir(parents=True, exist_ok=True)
        with _LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")


def log_agent(*, phase: int, role: str, agent_id: str, model: str, round_: int,
              status: str, duration_s: float, tokens_in: int = 0, tokens_out: int = 0,
              prompt: str = "", output: str = ""):
    """Log a completed agent turn + save its transcript."""
    log_event(kind="agent", phase=phase, role=role, agent_id=agent_id, model=model,
              round=round_, status=status, duration_s=round(duration_s, 2),
              tokens_in=tokens_in, tokens_out=tokens_out)
    # transcript
    d = _TRANSCRIPTS / f"phase{phase}"
    d.mkdir(parents=True, exist_ok=True)
    safe_id = agent_id.replace("/", "_")
    (d / f"{role}-{safe_id}-r{round_}.md").write_text(
        f"# {role} / {agent_id} (phase {phase}, round {round_})\n\n"
        f"- model: {model}\n- status: {status}\n- duration: {duration_s:.2f}s\n"
        f"- tokens: in={tokens_in} out={tokens_out}\n\n"
        f"## Input\n\n```\n{prompt}\n```\n\n## Output\n\n```\n{output}\n```\n",
        encoding="utf-8")


def log_phase(phase: int, name: str, status: str, extra: dict | None = None):
    log_event(kind="phase", phase=phase, name=name, status=status, **(extra or {}))


def log_gate(status: str):
    log_event(kind="gate", status=status)


def log_git(action: str, message: str, branch: str = ""):
    log_event(kind="git", action=action, message=message, branch=branch)


def reset():
    """Clear logs at the start of a fresh run (not on --resume)."""
    if _LOG.exists():
        _LOG.unlink()
    if _TRANSCRIPTS.exists():
        import shutil
        shutil.rmtree(_TRANSCRIPTS)
