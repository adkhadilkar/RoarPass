# Community Moderation & Content Governance — Test Suite

## Area
`community-moderation` (Feature Area ID: 5)

## PRD References
- 6.4 — Moderator Roles & Permissions
- 7.3.2 — Pinned Guides & Announcements
- 7.10.2 — Reporting & Blocking
- 7.12.2 — Moderation Queue & SLAs
- 7.12.3 — Auto-Moderation & Audit Logging

## Dependencies
- `country-communities` — Community creation, membership, posts
- `verification-trust-tiers` — User trust tiers (T0–T4), verified status

## Prerequisites

### Environment Variables
```
API_BASE_URL        Base URL of the RoarPass API (e.g. https://api.roarpass.test)
TEST_ADMIN_TOKEN    JWT for super-admin user
TEST_MOD_TOKEN      JWT for community moderator user
TEST_MEMBER_TOKEN   JWT for regular community member
TEST_HELPER_TOKEN   JWT for verified local helper (T3)
TEST_ANON_TOKEN     JWT for anonymous/unverified user (T0)
REDIS_URL           Redis connection string (for queue inspection)
DB_URL              Postgres connection string (for audit log assertions)
MODERATION_WEBHOOK_SECRET  HMAC secret for webhook verification
```

### Seed Data
Run `npm run seed:moderation-tests` before executing this suite.
This creates:
- Community `community-id-wc2026-brazil` (country: BRA, event: WC2026)
- Community `community-id-cwc2025-usa`   (country: USA, event: CWC2025)
- Users: admin, moderator, member, helper, anon (mapped to env tokens above)
- 10 sample posts, 3 flagged posts, 1 auto-mod test post

### Running Tests
```bash
# All tests
npx jest tests/community-moderation --runInBand --forceExit

# Functional only
npx jest tests/community-moderation/functional --runInBand

# Integration only
npx jest tests/community-moderation/integration --runInBand

# With coverage
npx jest tests/community-moderation --coverage --coverageDirectory=coverage/community-moderation
```

### Teardown
`npm run seed:moderation-tests:teardown` removes all seeded data.

## Test Architecture
```
tests/community-moderation/
├── README.md
├── fixtures/
│   ├── communities.json
│   ├── users.json
│   └── posts.json
├── helpers/
│   ├── api-client.ts
│   ├── db-utils.ts
│   └── queue-utils.ts
├── functional/
│   ├── moderator-roles.test.ts
│   ├── pinned-guides-announcements.test.ts
│   ├── reporting-blocking.test.ts
│   ├── moderation-queue-sla.test.ts
│   └── auto-moderation-audit.test.ts
└── integration/
    ├── mod-queue-cross-community.test.ts
    ├── trust-tier-escalation.test.ts
    └── event-activation-mod-flow.test.ts
```