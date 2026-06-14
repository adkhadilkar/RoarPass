"""
agent.py — thin wrapper around the Anthropic API for a single sub-agent turn.

Billing: uses ANTHROPIC_API_KEY from the environment. Never logs or stores the key.
Model routing: resolved from config/models.yaml by role name.
"""
from __future__ import annotations
import os
import re
import time
import pathlib
import yaml
from anthropic import Anthropic

from . import runlog

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_MODELS = yaml.safe_load((_ROOT / "config" / "models.yaml").read_text())
_COMMON = (_ROOT / "prompts" / "system_common.md").read_text()
_CONTRACT = (_ROOT / "prompts" / "output_contract.md").read_text()

# Single client; reads ANTHROPIC_API_KEY from env automatically.
_client = Anthropic()


def model_for(role: str) -> str:
    roles = _MODELS.get("roles", {})
    if role in roles:
        return roles[role]
    # tier fallback
    tier = "reviewer" if role.endswith("reviewer") else (
        "orchestrator" if role in ("orchestrator",) else "worker")
    return _MODELS["defaults"][tier]


def _agent_system(role: str) -> str:
    role_file = _ROOT / "agents" / f"{role}.md"
    role_spec = role_file.read_text() if role_file.exists() else f"# Agent: {role}"
    return f"{_COMMON}\n\n{_CONTRACT}\n\n{role_spec}"


def run_agent(role: str, task: str, *, design: bool = False, max_tokens: int | None = None,
              phase: int = -1, agent_id: str | None = None, round_: int = 1) -> str:
    """Run one agent turn. `task` carries the concrete inputs the agent needs.
    Returns the raw assistant text (caller parses FILE/JSON blocks).
    Every call is logged to state/run_log.jsonl + a per-agent transcript."""
    params = _MODELS["params"]
    #temperature = params["design_temperature"] if design else params["temperature"]
    model = model_for(role)
    aid = agent_id or role
    t0 = time.time()
    status, output, tin, tout = "ok", "", 0, 0
    try:
        resp = _client.messages.create(
            model=model,
            max_tokens=max_tokens or params["max_tokens"],
            #temperature=temperature,
            system=_agent_system(role),
            messages=[{"role": "user", "content": task}],
        )
        output = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        tin = getattr(resp.usage, "input_tokens", 0)
        tout = getattr(resp.usage, "output_tokens", 0)
        return output
    except Exception as e:  # noqa: BLE001
        status, output = "error", str(e)
        raise
    finally:
        runlog.log_agent(phase=phase, role=role, agent_id=aid, model=model, round_=round_,
                         status=status, duration_s=time.time() - t0,
                         tokens_in=tin, tokens_out=tout, prompt=task, output=output)


# ---- output-contract parsers -------------------------------------------------
_FILE_RE = re.compile(r"===FILE:\s*(.+?)===\s*\n(.*?)\n===END FILE===", re.DOTALL)
_JSON_RE = re.compile(r"===JSON===\s*\n(.*?)\n===END JSON===", re.DOTALL)


def parse_files(text: str) -> list[tuple[str, str]]:
    return [(m.group(1).strip(), m.group(2)) for m in _FILE_RE.finditer(text)]


def parse_json(text: str) -> str | None:
    m = _JSON_RE.search(text)
    return m.group(1).strip() if m else None
