# Platform Foundation, Security & Compliance — Test Suite

## Area: `platform-foundation-nfr`
## PRD Refs: 8.1–8.7, 9.1, 9.3–9.5

### Overview
This test suite covers all cross-cutting non-functional requirements:
- **8.1** Multi-region cloud architecture & availability
- **8.2** Performance & scalability (response times, load targets)
- **8.3** Security (auth, encryption, headers, injection prevention)
- **8.4** GDPR / CCPA / PDPA privacy compliance
- **8.5** i18n / RTL / locale support
- **8.6** WCAG 2.1 AA accessibility
- **8.7** Observability & alerting
- **9.1** Data residency & sovereignty
- **9.3** Dependency scanning & SBOM
- **9.4** Pen-test readiness
- **9.5** Incident response / SLO

### Prerequisites
```bash
# 1. Node.js >= 20 + pnpm
# 2. Python >= 3.11 (for locust + py-tests)
# 3. Docker (for OWASP ZAP, axe-core containers)
# 4. Environment variables (never hardcode secrets):
#    ROARPASS_BASE_URL, ROARPASS_API_URL,
#    TEST_USER_JWT, ADMIN_JWT,
#    DB_READ_REPLICA_URLS (comma-separated, one per region),
#    REDIS_CLUSTER_URL, METRICS_ENDPOINT, TRACES_ENDPOINT
```

### Running All Tests
```bash
cd tests/platform-foundation-nfr

# Install JS deps
pnpm install

# Install Python deps
pip install -r requirements.txt

# Run full suite
pnpm test              # Jest unit + integration
pnpm test:e2e          # Playwright accessibility + i18n
pnpm test:security     # OWASP ZAP + header checks
pnpm test:load         # Locust performance
pnpm test:privacy      # GDPR/CCPA/PDPA flows
pnpm test:observability # Metrics / tracing checks

# All at once (CI gate)
pnpm test:all
```