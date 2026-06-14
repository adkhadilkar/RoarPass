"""
Pytest configuration and shared fixtures for matching-engine tests.
RoarPass · Smart Fan Matching & Discovery (slug: matching-engine)
PRD refs: 7.4.1, 7.4.2, 7.4.3, 7.9.1, 7.9.2
"""

import os
import uuid
import pytest
import httpx
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# ─── Config ───────────────────────────────────────────────────────────────────
BASE_URL = os.environ.get("ROARPASS_API_URL", "http://localhost:8000")
AUTH_SERVICE_URL = os.environ.get("ROARPASS_AUTH_URL", "http://localhost:8001")
MATCHING_SERVICE_URL = os.environ.get("ROARPASS_MATCHING_URL", "http://localhost:8002")
COMMUNITY_SERVICE_URL = os.environ.get("ROARPASS_COMMUNITY_URL", "http://localhost:8003")
TRIP_SERVICE_URL = os.environ.get("ROARPASS_TRIP_URL", "http://localhost:8004")
HELPER_SERVICE_URL = os.environ.get("ROARPASS_HELPER_URL", "http://localhost:8005")
SEED_API_KEY = os.environ.get("ROARPASS_SEED_API_KEY", "seed-test-key")

# ─── Timeouts ─────────────────────────────────────────────────────────────────
HTTP_TIMEOUT = 15.0
ASYNC_MATCH_TIMEOUT = 30.0   # seconds to wait for async match job to complete


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _uid() -> str:
    return str(uuid.uuid4())


def _future_date(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


# ─── Low-level HTTP client ─────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def http():
    """Synchronous HTTPX client for simple request/response."""
    with httpx.Client(base_url=BASE_URL, timeout=HTTP_TIMEOUT) as client:
        yield client


@pytest.fixture(scope="session")
def event_loop():
    """Provide a session-scoped asyncio event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_http():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=HTTP_TIMEOUT) as client:
        yield client


# ─── Seed helper (calls internal seed API) ────────────────────────────────────

def _seed_user(http_client: httpx.Client, overrides: Dict = None) -> Dict:
    payload = {
        "email": f"testfan_{_uid()}@roarpass-test.invalid",
        "password": "T3stP@ssword!",
        "display_name": f"TestFan_{_uid()[:8]}",
        "language_codes": ["en"],
        "visibility": "public",  # opt-in by default in tests
    }
    if overrides:
        payload.update(overrides)
    resp = http_client.post(
        "/internal/seed/user",
        json=payload,
        headers={"X-Seed-Key": SEED_API_KEY},
    )
    assert resp.status_code == 201, f"Seed user failed: {resp.text}"
    return resp.json()


def _seed_event(http_client: httpx.Client, overrides: Dict = None) -> Dict:
    payload = {
        "name": f"Test Match {_uid()[:8]}",
        "city": "Doha",
        "country": "QA",
        "venue": "Lusail Stadium",
        "starts_at": _future_date(30),
        "ends_at": _future_date(30),
        "competition": "World Cup",
        "home_team": "ARG",
        "away_team": "FRA",
    }
    if overrides:
        payload.update(overrides)
    resp = http_client.post(
        "/internal/seed/event",
        json=payload,
        headers={"X-Seed-Key": SEED_API_KEY},
    )
    assert resp.status_code == 201, f"Seed event failed: {resp.text}"
    return resp.json()


def _login(http_client: httpx.Client, email: str, password: str) -> str:
    """Return JWT access token."""
    resp = http_client.post("/auth/token", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def _auth_headers(token: str) -> Dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Composite fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def seeded_event(http):
    return _seed_event(http)


@pytest.fixture(scope="session")
def fan_alice(http):
    """Fan attending WC, speaks EN+ES, travels from Madrid."""
    data = _seed_user(http, {
        "display_name": "Alice_Test",
        "language_codes": ["en", "es"],
        "home_city": "Madrid",
        "home_country": "ES",
        "visibility": "public",
    })
    data["token"] = _login(http, data["email"], "T3stP@ssword!")
    return data


@pytest.fixture(scope="session")
def fan_bob(http):
    """Fan attending same event, speaks EN+PT, travels from São Paulo."""
    data = _seed_user(http, {
        "display_name": "Bob_Test",
        "language_codes": ["en", "pt"],
        "home_city": "São Paulo",
        "home_country": "BR",
        "visibility": "public",
    })
    data["token"] = _login(http, data["email"], "T3stP@ssword!")
    return data


@pytest.fixture(scope="session")
def fan_charlie(http):
    """Fan attending different event, speaks DE only — should NOT match Alice on event criteria."""
    data = _seed_user(http, {
        "display_name": "Charlie_Test",
        "language_codes": ["de"],
        "home_city": "Berlin",
        "home_country": "DE",
        "visibility": "public",
    })
    data["token"] = _login(http, data["email"], "T3stP@ssword!")
    return data


@pytest.fixture(scope="session")
def fan_private(http):
    """Fan with visibility=private — must never appear in others' suggestions."""
    data = _seed_user(http, {
        "display_name": "PrivateFan_Test",
        "language_codes": ["en"],
        "visibility": "private",
    })
    data["token"] = _login(http, data["email"], "T3stP@ssword!")
    return data


@pytest.fixture(scope="session")
def local_helper(http):
    """Helper profile registered in Doha, speaks AR+EN."""
    data = _seed_user(http, {
        "display_name": "LocalHelper_Test",
        "language_codes": ["ar", "en"],
        "home_city": "Doha",
        "home_country": "QA",
        "visibility": "public",
        "is_helper": True,
    })
    data["token"] = _login(http, data["email"], "T3stP@ssword!")
    return data


@pytest.fixture(scope="session")
def enrolled_fans(http, seeded_event, fan_alice, fan_bob, fan_private):
    """Enroll Alice, Bob, and PrivateFan in the same event so matching engine can see them."""
    event_id = seeded_event["id"]
    for fan in [fan_alice, fan_bob, fan_private]:
        resp = http.post(
            f"/events/{event_id}/attend",
            headers=_auth_headers(fan["token"]),
            json={"travel_from": fan.get("home_city", "Unknown")},
        )
        assert resp.status_code in (200, 201, 409), (
            f"Enrollment failed for {fan['display_name']}: {resp.text}"
        )
    return {"event_id": event_id, "alice": fan_alice, "bob": fan_bob, "private": fan_private}