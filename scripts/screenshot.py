#!/usr/bin/env python3
"""Render an HTML file to PNG using a headless browser.
Usage: screenshot.py <input.html> <output.png> <desktop|mobile>
Tries Playwright; if unavailable, prints install guidance (Claude Code installs on host).
"""
import sys, pathlib
def main():
    src, out, vp = sys.argv[1], sys.argv[2], sys.argv[3]
    size = {"desktop": (1440, 900), "mobile": (390, 844)}[vp]
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed. Claude Code: `pip install playwright && playwright install chromium`")
        return
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": size[0], "height": size[1]})
        page.goto(pathlib.Path(src).resolve().as_uri())
        page.screenshot(path=out, full_page=True)
        b.close()
if __name__ == "__main__":
    main()
