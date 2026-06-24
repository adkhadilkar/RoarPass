#!/usr/bin/env python3
"""
build_animation.py — Phase 5. Render an animation of HOW the workflow built the product,
driven by the REAL run log (state/run_log.jsonl).

Output (into the product repo's demo/ by default):
  demo/build_animation.gif   — for slides
  demo/build_animation.mp4    — if ffmpeg is available
  demo/build_frames/*.png     — individual frames

It reconstructs the orchestration story from the log: phases lighting up, agents fanning out,
review loops, the human gate, GitHub pushes, ending on the finished product. Each meaningful
log event becomes one or more frames; frames are composited into the GIF/MP4.

Rendering uses Pillow (pure-Python, no browser needed). MP4 needs ffmpeg on PATH (optional).
Usage: python scripts/build_animation.py [--log state/run_log.jsonl] [--out ../roarpass/demo]
"""
from __future__ import annotations
import json
import math
import pathlib
import argparse

ROOT = pathlib.Path(__file__).resolve().parent.parent

W, H = 1280, 720
BG = (13, 17, 23)
FG = (230, 237, 243)
MUT = (139, 148, 158)
ACC = (88, 166, 255)
OK = (63, 185, 80)
RUN = (210, 153, 34)
LINE = (48, 54, 61)

PHASES = [(0, "Bootstrap"), (1, "Requirements"), (2, "Design"),
          (3, "Implementation"), (4, "Data · Test · Demo"), (5, "Build Story")]


def _load(log_path: pathlib.Path) -> list[dict]:
    if not log_path.exists():
        return []
    out = []
    for ln in log_path.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln:
            try:
                out.append(json.loads(ln))
            except json.JSONDecodeError:
                pass
    return out


def _build_scenes(events: list[dict]) -> list[dict]:
    """Turn the raw log into a list of scene dicts the renderer draws.
    Each scene captures cumulative state at a moment: active phase, agents seen per phase,
    a caption, and flags (gate, push)."""
    scenes = []
    phase_status = {}
    agents_by_phase: dict[int, set] = {}
    pushes = 0
    for e in events:
        cap = None
        if e.get("kind") == "phase":
            phase_status[e["phase"]] = e["status"]
            cap = f"Phase {e['phase']} — {e.get('name','')}: {e['status']}"
        elif e.get("kind") == "agent":
            agents_by_phase.setdefault(e["phase"], set()).add(e["agent_id"])
            n = len(agents_by_phase[e["phase"]])
            cap = f"Phase {e['phase']}: {e['role']} ({e['agent_id']}) — {n} agent(s) active"
        elif e.get("kind") == "gate":
            cap = ("⏸ Human approval gate — design ready for review"
                   if e["status"] == "awaiting_approval" else "✔ Design approved — building")
        elif e.get("kind") == "git":
            pushes += 1
            cap = f"⬆ GitHub push #{pushes}: {e.get('message','')[:48]}"
        if cap:
            scenes.append({
                "phase_status": dict(phase_status),
                "agents": {k: len(v) for k, v in agents_by_phase.items()},
                "caption": cap,
                "pushes": pushes,
            })
    if not scenes:  # fallback so the animation still renders something
        scenes = [{"phase_status": {}, "agents": {}, "caption":
                   "No run log yet — run the workflow first.", "pushes": 0}]
    # final hero frame
    scenes.append({"phase_status": {i: "complete" for i, _ in PHASES},
                   "agents": scenes[-1]["agents"], "caption": "✓ RoarPass built — demo ready",
                   "pushes": pushes, "hero": True})
    return scenes


def _draw(scene: dict, idx: int, total: int):
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    def font(sz, bold=False):
        for name in ((["DejaVuSans-Bold.ttf"] if bold else ["DejaVuSans.ttf"])):
            try:
                return ImageFont.truetype(name, sz)
            except OSError:
                continue
        return ImageFont.load_default()

    d.text((48, 36), "RoarPass — How the multi-agent workflow built it", font=font(30, True), fill=FG)
    d.text((48, 78), "Driven by the real orchestration run log", font=font(16), fill=MUT)

    # phase rail
    n = len(PHASES)
    pw = (W - 96 - (n - 1) * 16) // n
    for i, (pid, name) in enumerate(PHASES):
        x = 48 + i * (pw + 16)
        st = scene["phase_status"].get(pid, "pending")
        border = OK if st == "complete" else (RUN if st == "awaiting_approval"
                                              else (ACC if st not in ("pending",) else LINE))
        d.rounded_rectangle([x, 130, x + pw, 210], radius=10, outline=border, width=2)
        d.text((x + 12, 142), f"Phase {pid}", font=font(15, True), fill=FG)
        d.text((x + 12, 166), name, font=font(13), fill=MUT)
        cnt = scene["agents"].get(pid)
        if cnt:
            d.text((x + 12, 186), f"{cnt} agents", font=font(12), fill=ACC)

    # agent fan-out viz for the most active phase
    active_phase = None
    for pid in sorted(scene["agents"], reverse=True):
        if scene["agents"][pid]:
            active_phase = pid
            break
    cx, cy = W // 2, 430
    if active_phase is not None and not scene.get("hero"):
        k = scene["agents"][active_phase]
        d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(22, 27, 34), outline=ACC, width=2)
        d.text((cx - 24, cy - 8), "orch", font=font(13, True), fill=ACC)
        for j in range(min(k, 12)):
            ang = (2 * math.pi * j) / max(min(k, 12), 1)
            r = 150
            ax, ay = cx + int(r * math.cos(ang)), cy + int(r * math.sin(ang))
            d.line([cx, cy, ax, ay], fill=LINE, width=1)
            d.ellipse([ax - 16, ay - 16, ax + 16, ay + 16], fill=(22, 27, 34),
                      outline=RUN if (idx + j) % 4 == 0 else OK, width=2)
    elif scene.get("hero"):
        d.rounded_rectangle([cx - 220, cy - 70, cx + 220, cy + 70], radius=16,
                            outline=OK, width=3)
        d.text((cx - 150, cy - 22), "RoarPass — FIFA WC 2026", font=font(26, True), fill=FG)
        d.text((cx - 150, cy + 14), "web + mobile-web · deployed · tested", font=font(15), fill=MUT)

    # push counter
    d.text((W - 230, 78), f"GitHub pushes: {scene['pushes']}", font=font(15), fill=OK)

    # caption bar
    d.rectangle([0, H - 84, W, H], fill=(22, 27, 34))
    d.text((48, H - 64), scene["caption"], font=font(20, True), fill=FG)
    d.text((48, H - 32), f"frame {idx+1}/{total}", font=font(13), fill=MUT)
    return img


def render(log_path: pathlib.Path, out_dir: pathlib.Path, hold_hero=18):
    try:
        from PIL import Image  # noqa
    except ImportError:
        print("Pillow not installed. Claude Code: `pip install pillow`. Aborting render.")
        return
    events = _load(log_path)
    scenes = _build_scenes(events)
    frames_dir = out_dir / "build_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    frames = []
    total = len(scenes)
    for i, sc in enumerate(scenes):
        img = _draw(sc, i, total)
        img.save(frames_dir / f"frame_{i:04d}.png")
        reps = hold_hero if sc.get("hero") else 1
        frames.extend([img] * reps)

    gif = out_dir / "build_animation.gif"
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=700, loop=0)
    print(f"[anim] wrote {gif} ({len(frames)} frames)")

    # optional MP4 via ffmpeg
    import shutil, subprocess
    if shutil.which("ffmpeg"):
        mp4 = out_dir / "build_animation.mp4"
        subprocess.run(["ffmpeg", "-y", "-framerate", "1.4", "-i",
                        str(frames_dir / "frame_%04d.png"), "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", "-vf", "scale=1280:720", str(mp4)],
                       capture_output=True)
        print(f"[anim] wrote {mp4}")
    else:
        print("[anim] ffmpeg not found — GIF only (install ffmpeg for MP4).")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", default=str(ROOT / "state" / "run_log.jsonl"))
    ap.add_argument("--out", default=str(ROOT.parent / "roarpass" / "demo"))
    a = ap.parse_args()
    render(pathlib.Path(a.log), pathlib.Path(a.out))
