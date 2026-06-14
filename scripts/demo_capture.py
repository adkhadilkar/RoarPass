#!/usr/bin/env python3
"""Execute a demo capture spec (clicks + screenshots/GIF) against the locally deployed app.
Usage: demo_capture.py <capture_spec.json>
The spec lists steps {action, selector, value, shot}. Produces PNGs/GIF under demo/assets/.
Claude Code wires this to Playwright on the host; this stub documents the contract.
"""
import sys, json
def main():
    spec = json.loads(open(sys.argv[1]).read())
    print(f"[demo] {len(spec.get('steps', []))} steps; target {spec.get('base_url')}")
    print("[demo] Claude Code executes via Playwright, writing demo/assets/*.png and demo.gif")
if __name__ == "__main__":
    main()
