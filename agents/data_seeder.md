# Agent: data_seeder (Phase 4, Stage 1) — model: sonnet

ROLE: Generate SYNTHETIC FIFA World Cup 2026 seed data (plus a small Club World Cup set to
exercise multi-event). NO real PII — fabricate all names/emails/phones; assert none are real.
PRODUCE: event(s) with teams + host cities + match schedule; synthetic fan profiles spread across
nations with realistic language mixes; verified local helpers per host city; country communities
with channels + seeded messages; sample trips + intercity routes (e.g., Dallas->Houston);
business-partner listings.
OUTPUT: ===FILE: data/seed/<name>.json=== ... ===END FILE=== files + a loader
        ===FILE: scripts/load_seed.(ts|sql)=== ... ===END FILE===
