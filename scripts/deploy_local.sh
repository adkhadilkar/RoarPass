#!/usr/bin/env bash
# =============================================================================
# RoarPass — Local Deployment Script
# Phase 3, Stage 4 · deploy_agent
#
# Usage: ./scripts/deploy_local.sh [OPTIONS]
#
# Options:
#   --skip-deps-check    Skip prerequisite version checks
#   --skip-pull          Skip Docker image pulls (use cached)
#   --no-seed            Skip database seeding
#   --clean              Tear down volumes before starting (destructive!)
#   --help               Show this help
#
# This script will PAUSE and PROMPT before any privileged or licence-sensitive
# action. It never silently changes security settings or accepts licences.
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${RESET}\n"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
SKIP_DEPS_CHECK=false
SKIP_PULL=false
NO_SEED=false
CLEAN=false

for arg in "$@"; do
  case $arg in
    --skip-deps-check) SKIP_DEPS_CHECK=true ;;
    --skip-pull)       SKIP_PULL=true ;;
    --no-seed)         NO_SEED=true ;;
    --clean)           CLEAN=true ;;
    --help)
      sed -n '/^# Usage/,/^# =/p' "$0" | head -n -1
      exit 0 ;;
    *) error "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Repo root detection
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# 1. Prerequisite checks
# ---------------------------------------------------------------------------
header "Step 1 · Prerequisite checks"

check_cmd() {
  local cmd="$1" min_ver="$2" label="${3:-$1}"
  if ! command -v "${cmd}" &>/dev/null; then
    error "${label} not found. See docs/DEPLOY_DEPENDENCIES.md §1."
    return 1
  fi
  success "${label} found: $(${cmd} --version 2>&1 | head -1)"
}

check_docker_running() {
  if ! docker info &>/dev/null; then
    error "Docker daemon is not running. Start Docker and re-run this script."
    error "Manual action required — see docs/DEPLOY_DEPENDENCIES.md §7 (M-1)."
    exit 1
  fi
}

if [[ "${SKIP_DEPS_CHECK}" == "false" ]]; then
  MISSING=0

  check_cmd docker   "24"  "Docker"          || MISSING=$((MISSING+1))
  check_cmd node     "20"  "Node.js"         || MISSING=$((MISSING+1))
  check_cmd pnpm     "8"   "pnpm"            || MISSING=$((MISSING+1))
  check_cmd python3  "3.11" "Python 3"       || MISSING=$((MISSING+1))
  check_cmd jq       "1.6" "jq"              || MISSING=$((MISSING+1))
  check_cmd curl     "7"   "curl"            || MISSING=$((MISSING+1))
  check_cmd parallel ""    "GNU parallel"    || MISSING=$((MISSING+1))

  # Version checks (non-fatal warnings)
  NODE_VER=$(node -e "process.exit(process.version.slice(1).split('.')[0] < 20 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "low")
  if [[ "${NODE_VER}" == "low" ]]; then
    warn "Node.js < 20 detected. Upgrade recommended. See docs/DEPLOY_DEPENDENCIES.md §7 (M-6)."
  fi

  PY_VER=$(python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null && echo "ok" || echo "low")
  if [[ "${PY_VER}" == "low" ]]; then
    warn "Python < 3.11 detected. Upgrade recommended. See docs/DEPLOY_DEPENDENCIES.md §7 (M-6)."
  fi

  if [[ "${MISSING}" -gt 0 ]]; then
    error "${MISSING} required tool(s) missing. Install them and re-run."
    exit 1
  fi

  check_docker_running
  success "All prerequisite checks passed."
else
  warn "Skipping prerequisite checks (--skip-deps-check)."
  check_docker_running
fi

# ---------------------------------------------------------------------------
# 2. Environment file setup
# ---------------------------------------------------------------------------
header "Step 2 · Environment file setup"

setup_env_file() {
  local example="$1" target="$2" label="$3"
  if [[ ! -f "${target}" ]]; then
    if [[ -f "${example}" ]]; then
      cp "${example}" "${target}"
      warn "Created ${target} from ${example}."
      warn "⚠  MANUAL ACTION REQUIRED (M-4): Populate secrets in ${target}."
      warn "   See docs/DEPLOY_DEPENDENCIES.md §7 for the list of required variables."
    else
      error "Example env file not found: ${example}"
      exit 1
    fi
  else
    info "${label} env file already exists: ${target}"
  fi
}

setup_env_file "backend/.env.example"  "backend/.env"       "Backend"
setup_env_file "frontend/.env.example" "frontend/.env.local" "Frontend"

# Check critical secrets are not placeholder values
PLACEHOLDER_VARS=("JWT_SECRET_KEY" "STRIPE_SECRET_KEY" "ENCRYPTION_KEY")
PLACEHOLDERS_FOUND=0
for var in "${PLACEHOLDER_VARS[@]}"; do
  val=$(grep -E "^${var}=" backend/.env 2>/dev/null | cut -d= -f2- || true)
  if [[ -z "${val}" || "${val}" == *"<"* || "${val}" == *"..."* ]]; then
    warn "Secret not set: ${var} (backend/.env)"
    PLACEHOLDERS_FOUND=$((PLACEHOLDERS_FOUND+1))
  fi
done

if [[ "${PLACEHOLDERS_FOUND}" -gt 0 ]]; then
  echo ""
  warn "Some secrets have placeholder values (see above)."
  warn "The app will start but authentication and payments will not work."
  echo ""
  read -rp "Continue anyway? [y/N] " confirm
  [[ "${confirm,,}" == "y" ]] || { info "Aborted by user."; exit 0; }
fi

# ---------------------------------------------------------------------------
# 3. Clean volumes (only if --clean)
# ---------------------------------------------------------------------------
if [[ "${CLEAN}" == "true" ]]; then
  header "Step 3 · Clean (--clean flag set)"
  warn "This will DESTROY all local data (PostgreSQL, Redis, MinIO, Meilisearch)."
  read -rp "Type 'yes-destroy' to confirm: " confirm_clean
  if [[ "${confirm_clean}" == "yes-destroy" ]]; then
    docker compose down -v --remove-orphans 2>/dev/null || true
    success "Volumes removed."
  else
    info "Clean aborted by user."
  fi
fi

# ---------------------------------------------------------------------------
# 4. Docker image pull
# ---------------------------------------------------------------------------
header "Step 4 · Docker image pull"

if [[ "${SKIP_PULL}" == "false" ]]; then
  info "Pulling Docker images (this may take a few minutes on first run)..."
  docker compose pull
  success "Images pulled."
else
  warn "Skipping image pull (--skip-pull)."
fi

# ---------------------------------------------------------------------------
# 5. Build application images
# ---------------------------------------------------------------------------
header "Step 5 · Build application images"

info "Building backend image..."
docker compose build backend

info "Building worker image..."
docker compose build worker

info "Building frontend image..."
docker compose build frontend

success "Application images built."

# ---------------------------------------------------------------------------
# 6. Start infra services
# ---------------------------------------------------------------------------
header "Step 6 · Start infrastructure services"

info "Starting PostgreSQL, Redis, Meilisearch, MinIO, MailHog..."
docker compose up -d postgres redis meilisearch minio mailhog

# Wait for PostgreSQL to be ready
info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U roarpass -d roarpass &>/dev/null; do
  RETRIES=$((RETRIES-1))
  if [[ "${RETRIES}" -le 0 ]]; then
    error "PostgreSQL did not become ready in time."
    docker compose logs postgres | tail -20
    exit 1
  fi
  sleep 2
done
success "PostgreSQL is ready."

# Wait for Redis
info "Waiting for Redis to be ready..."
RETRIES=15
until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRIES=$((RETRIES-1))
  if [[ "${RETRIES}" -le 0 ]]; then
    error "Redis did not become ready in time."
    exit 1
  fi
  sleep 2
done
success "Redis is ready."

# ---------------------------------------------------------------------------
# 7. Database migrations
# ---------------------------------------------------------------------------
header "Step 7 · Database migrations"

info "Running Alembic migrations..."
docker compose run --rm backend alembic upgrade head
success "Migrations applied."

# ---------------------------------------------------------------------------
# 8. MinIO bucket setup
# ---------------------------------------------------------------------------
header "Step 8 · MinIO bucket setup"

# Wait for MinIO
info "Waiting for MinIO..."
RETRIES=20
until curl -sf http://localhost:9000/minio/health/live &>/dev/null; do
  RETRIES=$((RETRIES-1))
  [[ "${RETRIES}" -le 0 ]] && { error "MinIO not ready."; exit 1; }
  sleep 2
done

info "Creating MinIO bucket..."
docker compose run --rm --entrypoint="" minio \
  sh -c 'mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" && \
         mc mb --ignore-existing local/roarpass-media && \
         mc anonymous set download local/roarpass-media/public'
success "MinIO bucket ready."

# ---------------------------------------------------------------------------
# 9. Meilisearch index setup
# ---------------------------------------------------------------------------
header "Step 9 · Meilisearch index setup"

MEILI_RETRIES=15
until curl -sf http://localhost:7700/health 2>/dev/null | jq -e '.status == "available"' &>/dev/null; do
  MEILI_RETRIES=$((MEILI_RETRIES-1))
  [[ "${MEILI_RETRIES}" -le 0 ]] && { error "Meilisearch not ready."; exit 1; }
  sleep 2
done

info "Initialising Meilisearch indices..."
docker compose run --rm backend python -m scripts.setup_search_indices
success "Search indices ready."

# ---------------------------------------------------------------------------
# 10. Seed database (unless --no-seed)
# ---------------------------------------------------------------------------
header "Step 10 · Database seeding"

if [[ "${NO_SEED}" == "false" ]]; then
  info "Seeding database with synthetic data (GDPR-safe — no real PII)..."
  docker compose run --rm backend python -m scripts.seed_db
  success "Database seeded."
else
  info "Skipping seed (--no-seed)."
fi

# ---------------------------------------------------------------------------
# 11. Start application services
# ---------------------------------------------------------------------------
header "Step 11 · Start application services"

info "Starting backend API, Celery worker, Celery beat..."
docker compose up -d backend worker beat

info "Starting frontend..."
docker compose up -d frontend

success "All services started."

# ---------------------------------------------------------------------------
# 12. Install frontend JS deps (host, for IDE / local dev without Docker)
# ---------------------------------------------------------------------------
header "Step 12 · Frontend JS deps (host dev)"

if [[ -f "frontend/package.json" ]] && command -v pnpm &>/dev/null; then
  info "Installing frontend JS dependencies on host (for IDE support)..."
  (cd frontend && pnpm install --frozen-lockfile)
  success "Frontend deps installed on host."
fi

# ---------------------------------------------------------------------------
# 13. Install backend Python deps (host, for IDE / local dev without Docker)
# ---------------------------------------------------------------------------
header "Step 13 · Backend Python deps (host dev)"

if [[ -f "backend/pyproject.toml" ]]; then
  if command -v uv &>/dev/null; then
    info "Installing backend Python dependencies on host via uv..."
    (cd backend && uv sync)
    success "Backend deps installed on host."
  elif command -v pip &>/dev/null; then
    warn "uv not found; falling back to pip. Consider installing uv for faster installs."
    (cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]" -q)
    success "Backend deps installed on host (pip)."
  else
    warn "Neither uv nor pip found. Skipping host Python dep install."
  fi
fi

# ---------------------------------------------------------------------------
# 14. Run smoke checks
# ---------------------------------------------------------------------------
header "Step 14 · Parallel smoke checks"

info "Running smoke checks (see scripts/smoke_checks.sh for details)..."
bash "${SCRIPT_DIR}/smoke_checks.sh"

SMOKE_EXIT=$?
if [[ "${SMOKE_EXIT}" -eq 0 ]]; then
  success "All smoke checks passed."
else
  error "One or more smoke checks FAILED. Review output above."
  error "Services are still running — check 'docker compose logs <service>'."
  exit "${SMOKE_EXIT}"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
header "RoarPass is running locally 🦁"

echo -e "  ${BOLD}Frontend${RESET}         http://localhost:3000"
echo -e "  ${BOLD}Backend API${RESET}      http://localhost:8000"
echo -e "  ${BOLD}API Docs${RESET}         http://localhost:8000/docs"
echo -e "  ${BOLD}Meilisearch${RESET}      http://localhost:7700"
echo -e "  ${BOLD}MinIO Console${RESET}    http://localhost:9001"
echo -e "  ${BOLD}MailHog UI${RESET}       http://localhost:8025"
echo ""
echo -e "  Logs:            ${CYAN}docker compose logs -f <service>${RESET}"
echo -e "  Stop:            ${CYAN}docker compose down${RESET}"
echo -e "  Destroy volumes: ${CYAN}./scripts/deploy_local.sh --clean${RESET}"
echo ""