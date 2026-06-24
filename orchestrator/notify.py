"""
notify.py — phone notifications via ntfy.sh (free, no account).

Setup (one-time, on your phone):
  1. Install the "ntfy" app (iOS/Android).
  2. Subscribe to a topic name of your choosing, e.g. "roarpass-ak-7h2k9" (pick something
     unguessable — anyone who knows the topic can read its messages).
  3. Put that topic in .env as NTFY_TOPIC.

The orchestrator POSTs to https://ntfy.sh/<topic> at each gate. The notification includes the
design review path and (optionally) a click action. ntfy is best-effort; if NTFY_TOPIC is unset
or the POST fails, the run still pauses normally — the phone push is a convenience, not a
dependency.
"""
from __future__ import annotations
import os
import urllib.request

_BASE = os.environ.get("NTFY_SERVER", "https://ntfy.sh")


def _topic() -> str | None:
    return os.environ.get("NTFY_TOPIC")


def send_gate_notification(gate_id: str, review_paths=None):
    topic = _topic()
    if not topic:
        print("[notify] NTFY_TOPIC not set — skipping phone notification (run still paused).")
        return
    review = ", ".join(review_paths) if review_paths else "design artifacts"
    body = (f"RoarPass workflow paused at gate '{gate_id}'. Review {review}, then resume with "
            f"--approve or --revise.")
    headers = {
        "Title": "RoarPass — approval needed",
        "Priority": "high",
        "Tags": "pause_button,roarpass",
    }
    # optional deep-link/action: open the GitHub repo if provided
    repo = os.environ.get("GITHUB_REPO")
    user = os.environ.get("GITHUB_USER")
    if repo and user:
        url = f"https://github.com/{user}/{repo}/tree/design/phase2"
        headers["Actions"] = f"view, Open repo, {url}"
    try:
        req = urllib.request.Request(f"{_BASE}/{topic}", data=body.encode("utf-8"),
                                     headers=headers, method="POST")
        urllib.request.urlopen(req, timeout=10)
        print(f"[notify] phone notification sent to ntfy topic '{topic}'.")
    except Exception as e:  # noqa: BLE001
        print(f"[notify] ntfy POST failed ({e}); run still paused, approve from terminal.")


def send_done_notification(message: str):
    topic = _topic()
    if not topic:
        return
    try:
        req = urllib.request.Request(f"{_BASE}/{topic}", data=message.encode("utf-8"),
                                     headers={"Title": "RoarPass — done", "Tags": "white_check_mark"},
                                     method="POST")
        urllib.request.urlopen(req, timeout=10)
    except Exception:  # noqa: BLE001
        pass
