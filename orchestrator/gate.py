"""
gate.py — the single human-approval gate after Phase 2.

After Phase 2 completes, the orchestrator writes AWAITING_APPROVAL.md and halts.
The human resumes with --approve or --revise "<feedback>".
"""
from __future__ import annotations
import json
import pathlib
import datetime
import yaml

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_WF = yaml.safe_load((_ROOT / "config" / "workflow.yaml").read_text())
_GATE = _WF["gate"]


def raise_gate(product_repo: pathlib.Path, gate_id: str = "phase2", review_paths=None):
    awaiting = _ROOT / _GATE["awaiting_file"]
    if review_paths:
        review_block = "\n".join(f"- `{product_repo.name}/{p}`" for p in review_paths)
    else:
        review_block = (
            f"- Design walkthrough: `{product_repo.name}/docs/design/DESIGN_README.md`\n"
            f"- Screens: `{product_repo.name}/docs/design/screens/`\n"
            f"- System review: `{product_repo.name}/docs/design/DESIGN_SYSTEM_REVIEW.md`")
    awaiting.write_text(
        f"# RoarPass — Awaiting Your Approval (gate: {gate_id})\n\n"
        f"_Written {datetime.datetime.utcnow().isoformat()}Z_\n\n"
        "The workflow has paused for your approval and pushed its artifacts to GitHub.\n\n"
        "## Review this\n"
        f"{review_block}\n\n"
        "## Then resume\n"
        "```bash\n"
        "python orchestrator/run.py --resume --approve\n"
        "#   or\n"
        'python orchestrator/run.py --resume --revise "your change requests"\n'
        "#   or, to redesign from scratch with feedback:\n"
        'python orchestrator/run.py --resume --revise-full "your change requests"\n'
        "```\n"
    )
    print(f"\n*** GATE '{gate_id}': ready for review. See {awaiting} ***")
    print("*** Workflow halted. Resume with --approve or --revise. ***\n")


def read_decision() -> dict | None:
    f = _ROOT / _GATE["approval_file"]
    if f.exists():
        return json.loads(f.read_text())
    return None


def record_decision(approved: bool, feedback: str = "", full: bool = False):
    f = _ROOT / _GATE["approval_file"]
    f.write_text(json.dumps({
        "approved": approved,
        "feedback": feedback,
        "revise_full": full,
        "at": datetime.datetime.utcnow().isoformat() + "Z",
    }, indent=2))


def clear_gate():
    awaiting = _ROOT / _GATE["awaiting_file"]
    if awaiting.exists():
        awaiting.unlink()
