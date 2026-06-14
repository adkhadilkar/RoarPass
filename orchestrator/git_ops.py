"""
git_ops.py — GitHub push helpers. Token/user/repo come from the environment.
The token is injected into the remote URL only in-process and scrubbed from any log line.
This module performs ONLY commit/branch/push to an EXISTING repo. It never creates repos,
changes visibility, or alters permissions (those are prohibited access-control actions).
"""
from __future__ import annotations
import os
import re
import subprocess
import pathlib
import yaml

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_GIT = yaml.safe_load((_ROOT / "config" / "git.yaml").read_text())


def _env(name_key: str) -> str:
    var = _GIT["credentials"][name_key]
    val = os.environ.get(var)
    if not val:
        raise RuntimeError(f"Missing required env var {var} (configured as {name_key}).")
    return val


def _scrub(s: str, token: str) -> str:
    return s.replace(token, "***") if token else s


def _run(args: list[str], cwd: pathlib.Path, token: str = "") -> str:
    proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    out = _scrub(proc.stdout + proc.stderr, token)
    if proc.returncode != 0:
        raise RuntimeError(f"git failed: {_scrub(' '.join(args), token)}\n{out}")
    return out


def remote_url() -> tuple[str, str]:
    token = _env("token_env")
    user = _env("user_env")
    repo = _env("repo_env")
    url = _GIT["credentials"]["remote_url_template"].format(user=user, token=token, repo=repo)
    return url, token


def _assert_no_forbidden(repo_dir: pathlib.Path):
    """Refuse to commit forbidden paths (secrets) even if staged accidentally."""
    forbidden = _GIT["push_policy"]["forbid_paths"]
    staged = subprocess.run(["git", "diff", "--cached", "--name-only"],
                            cwd=repo_dir, capture_output=True, text=True).stdout.split()
    for path in staged:
        for pat in forbidden:
            if re.fullmatch(pat.replace("*", ".*"), path):
                raise RuntimeError(f"Refusing to commit forbidden path: {path}")


def commit_and_push(repo_dir: pathlib.Path, message: str, branch: str | None = None):
    url, token = remote_url()
    if branch:
        _run(["git", "checkout", "-B", branch], repo_dir, token)
    _run(["git", "add", "-A"], repo_dir, token)
    _assert_no_forbidden(repo_dir)
    # commit may be a no-op if nothing changed; tolerate that
    proc = subprocess.run(["git", "commit", "-m", message], cwd=repo_dir,
                          capture_output=True, text=True)
    if proc.returncode != 0 and "nothing to commit" not in (proc.stdout + proc.stderr):
        raise RuntimeError(_scrub(proc.stdout + proc.stderr, token))
    cur = branch or _GIT["branching"]["main_branch"]
    _run(["git", "push", url, f"HEAD:{cur}"], repo_dir, token)
    print(f"[git] pushed '{message[:50]}...' to {cur}")


def tag_and_push(repo_dir: pathlib.Path, tag: str):
    url, token = remote_url()
    _run(["git", "tag", "-f", tag], repo_dir, token)
    _run(["git", "push", "-f", url, tag], repo_dir, token)
    print(f"[git] pushed tag {tag}")
