# Phase 5 — Build-Story Animation

**Goal:** Render an animation of HOW the multi-agent workflow built the product, for slides.
**Human gate after:** No (final phase).
**Push to GitHub after:** Yes (GIF/MP4 into demo/).

## Why this is separate from the product demo
- Phase 4's demo shows the FINISHED PRODUCT (the FIFA WC 2026 fan journey).
- Phase 5 shows the PROCESS — phases lighting up, agents fanning out, review loops, the human
  gate, and GitHub pushes — ending on the finished product. Great for a Build Day "how we did it"
  slide.

## Input
- `state/run_log.jsonl` — the real, structured log written by every agent/phase/gate/git event
  across Phases 0–4. The animation is driven by actual events, not a mock.

## Steps
1. `scripts/build_animation.py` loads the log and reconstructs ordered "scenes" (cumulative
   phase status, agent counts per phase, captions, push counter).
2. Each scene is drawn to a 1280×720 PNG frame (Pillow — no browser needed).
3. Frames are composited into `demo/build_animation.gif` (always) and
   `demo/build_animation.mp4` (if ffmpeg is on PATH).
4. Individual frames land in `demo/build_frames/` for slide reuse.
5. Orchestrator commits + pushes `demo: build-story animation`.

## Run standalone (anytime, against any saved log)
```bash
python scripts/build_animation.py --log state/run_log.jsonl --out ../roarpass/demo
```

## Exit criteria
- `build_animation.gif` (and MP4 if ffmpeg present) produced and pushed; phase 5 complete →
  workflow done.
