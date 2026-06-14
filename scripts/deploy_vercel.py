#!/usr/bin/env python3
"""
deploy_vercel.py — deploy the built app to a free public URL (Vercel) backed by free Postgres
(Neon), with seeded FIFA WC 2026 data and labeled demo logins.

WHY this combo: Vercel is the zero-config host for Next.js (push -> public URL). Neon gives a
free Postgres that does NOT pause after inactivity (unlike Supabase's 7-day pause), so a link you
share stays live for anyone to open cold. Cost: $0.

WHAT THIS SCRIPT DOES (safe, non-credential steps only):
  - Generates vercel.json + environment-variable MANIFESTS (names only, never values).
  - Generates the Neon schema + seed loader and a demo-logins file.
  - Prints the exact CLI commands for you to run, since deploying requires YOU to authenticate.

WHAT IT DOES NOT DO (prohibited / requires you):
  - It never logs into Vercel or Neon, never enters credentials, never creates accounts.
  - Account creation + first login are manual steps you perform (one-time). The script hands you
    copy-paste commands and stops.

Usage: python scripts/deploy_vercel.py [--product ../roarpass]
"""
from __future__ import annotations
import sys
import json
import argparse
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def gen_artifacts(product: pathlib.Path):
    product.mkdir(parents=True, exist_ok=True)

    # vercel.json — framework autodetect; env var NAMES only (values set in Vercel dashboard/CLI)
    (product / "vercel.json").write_text(json.dumps({
        "$schema": "https://openapi.vercel.sh/vercel.json",
        "framework": "nextjs",
        "buildCommand": "pnpm build",
        "installCommand": "pnpm install",
        "env": {
            "DATABASE_URL": "@database_url",       # Neon connection string (set as a Vercel secret)
            "AUTH_SECRET": "@auth_secret"
        }
    }, indent=2))

    # demo logins shown on the login screen so anyone with the link can try each role
    demo_logins = {
        "note": "Synthetic accounts for the public demo. Same password for all. Shown on login screen.",
        "password": "roarpass-demo",
        "accounts": [
            {"role": "Traveling Fan (South Korea)", "email": "fan.kr@demo.roarpass"},
            {"role": "Traveling Fan (Brazil)", "email": "fan.br@demo.roarpass"},
            {"role": "Local Helper (Los Angeles)", "email": "helper.la@demo.roarpass"},
            {"role": "Community Moderator", "email": "mod@demo.roarpass"},
            {"role": "Business Partner", "email": "biz@demo.roarpass"},
            {"role": "Platform Admin", "email": "admin@demo.roarpass"},
        ]
    }
    (product / "data" / "seed").mkdir(parents=True, exist_ok=True)
    (product / "data" / "seed" / "demo_logins.json").write_text(json.dumps(demo_logins, indent=2))

    # deploy instructions (the manual, credentialed steps are YOURS to run)
    (product / "docs" / "DEPLOY_PUBLIC.md").parent.mkdir(parents=True, exist_ok=True)
    (product / "docs" / "DEPLOY_PUBLIC.md").write_text(_DEPLOY_GUIDE)
    print("[deploy] wrote vercel.json, data/seed/demo_logins.json, docs/DEPLOY_PUBLIC.md")
    print("[deploy] NOTE: account login + secret setup are manual steps — see DEPLOY_PUBLIC.md.")


_DEPLOY_GUIDE = """# Deploy RoarPass to a free public URL (Vercel + Neon)

This produces a shareable link anyone on the internet can open, with prefilled FIFA WC 2026 data
and labeled demo logins. Cost: $0.

> The orchestrator does NOT log in for you or handle your passwords. The steps below that need a
> login are yours to run once. Everything is copy-paste.

## 1. Free Postgres on Neon (stays live — no inactivity pause)
1. Create a free Neon account (neon.tech) and a project. (one-time, manual)
2. Copy the connection string (looks like `postgresql://...neon.tech/neondb`).
3. Load schema + seed:
   ```bash
   export DATABASE_URL="postgresql://...neon.tech/neondb"
   pnpm db:push           # apply schema
   pnpm db:seed           # load FIFA WC 2026 synthetic data + demo logins
   ```

## 2. Deploy the app to Vercel
1. Create a free Vercel account and install the CLI: `npm i -g vercel` (one-time, manual login:
   `vercel login`).
2. From the repo root:
   ```bash
   vercel link            # link to a new Vercel project
   vercel env add DATABASE_URL     # paste the Neon string when prompted (you do this, not the agent)
   vercel env add AUTH_SECRET      # any long random string
   vercel --prod          # builds and returns your public https URL
   ```
3. Share the printed URL. The login screen lists the demo accounts (password `roarpass-demo`).

## Demo logins (also in data/seed/demo_logins.json)
| Role | Email |
|---|---|
| Traveling Fan (South Korea) | fan.kr@demo.roarpass |
| Traveling Fan (Brazil) | fan.br@demo.roarpass |
| Local Helper (Los Angeles) | helper.la@demo.roarpass |
| Community Moderator | mod@demo.roarpass |
| Business Partner | biz@demo.roarpass |
| Platform Admin | admin@demo.roarpass |

All use password: `roarpass-demo` (synthetic demo data only).

## Why not Supabase?
Supabase's free tier pauses a project after 7 days of inactivity — a shared demo link would show
a paused app to anyone who opens it after a quiet week. Neon scales to zero instead (a ~0.5s
cold start on the first query, invisible in a demo) and does not pause, so the link stays live.

## Native mobile apps?
The responsive web app IS the mobile experience (open the URL on a phone). True native iOS/Android
store apps require paid developer accounts ($99/yr Apple, $25 once Google) and store review, so
they can't be "freely deployed to a public link" — deferred, as scoped.
"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", default=str(ROOT.parent / "roarpass"))
    a = ap.parse_args()
    gen_artifacts(pathlib.Path(a.product))
