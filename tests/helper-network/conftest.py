"""
Pytest configuration and fixtures for the Helper Network test suite.
Area: helper-network (PRD refs: 5.4, 6.2, 7.6.1-7.6.4)
"""

import pytest
import asyncio
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Async event loop
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for all async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# Database / app bootstrap
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
async def app():
    """
    Bootstrap the FastAPI application with a test database.
    Uses TEST_DATABASE_URL env var (e.g. postgres://... or sqlite+aiosqlite://).
    """
    import os
    from app.main import create_app
    from app.db import engine, Base

    os.environ.setdefault("ENV", "test")
    test_app = create_app(testing=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield test_app

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="session")
async def db(app):
    """Session-level async DB session factory."""
    from app.db import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def db_session(db):
    """Per-test transaction that rolls back after each test."""
    async with db.begin_nested() as nested:
        yield db
        await nested.rollback()


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
async def client(app):
    from httpx import AsyncClient
    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def make_user_payload():
    """Factory: minimal user registration payload."""
    def _make(
        *,
        email: str | None = None,
        country: str = "MA",
        full_name: str = "Test User",
        role: str = "fan",
    ) -> dict:
        uid = uuid.uuid4().hex[:8]
        return {
            "email": email or f"user_{uid}@roarpass-test.io",
            "password": "Str0ng!Pass#99",
            "full_name": full_name,
            "country_code": country,
            "role": role,
        }
    return _make


@pytest.fixture
def make_helper_payload():
    """Factory: helper-specific profile payload."""
    def _make(
        *,
        languages: list[str] | None = None,
        offering_categories: list[str] | None = None,
        hourly_rate_usd: float = 0.0,
        is_paid: bool = False,
        availability: list[dict] | None = None,
        city: str = "Casablanca",
        country_code: str = "MA",
        bio: str = "Experienced local guide for football fans.",
    ) -> dict:
        return {
            "bio": bio,
            "city": city,
            "country_code": country_code,
            "languages": languages or ["ar", "fr", "en"],
            "offering_categories": offering_categories or [
                "transportation", "accommodation_tips", "stadium_tours"
            ],
            "hourly_rate_usd": hourly_rate_usd,
            "is_paid_offering": is_paid,
            "availability": availability or [
                {"date": (date.today() + timedelta(days=i)).isoformat(), "slots": ["09:00", "14:00"]}
                for i in range(1, 8)
            ],
        }
    return _make


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

async def register_and_login(client, payload: dict) -> tuple[dict, str]:
    """Register a user and return (user_json, jwt_token)."""
    r = await client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201, r.text
    user = r.json()

    r2 = await client.post("/api/v1/auth/token", data={
        "username": payload["email"],
        "password": payload["password"],
    })
    assert r2.status_code == 200, r2.text
    token = r2.json()["access_token"]
    return user, token


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Seeded actors
# ---------------------------------------------------------------------------

@pytest.fixture
async def fan_user(client, make_user_payload):
    payload = make_user_payload(role="fan", full_name="Fatima Fan", country="MA")
    user, token = await register_and_login(client, payload)
    return {"user": user, "token": token, "payload": payload}


@pytest.fixture
async def helper_user(client, make_user_payload):
    payload = make_user_payload(role="helper", full_name="Hassan Helper", country="MA")
    user, token = await register_and_login(client, payload)
    return {"user": user, "token": token, "payload": payload}


@pytest.fixture
async def second_helper_user(client, make_user_payload):
    payload = make_user_payload(role="helper", full_name="Houda Helper2", country="MA")
    user, token = await register_and_login(client, payload)
    return {"user": user, "token": token, "payload": payload}


@pytest.fixture
async def verified_helper(client, helper_user, make_helper_payload):
    """Create + verify a helper profile (simulates verification-trust-tier)."""
    hdr = auth_headers(helper_user["token"])
    r = await client.post(
        "/api/v1/helpers/profile",
        json=make_helper_payload(is_paid=False),
        headers=hdr,
    )
    assert r.status_code == 201, r.text
    profile = r.json()

    # Simulate admin verification bypass for tests
    r2 = await client.post(
        f"/api/v1/admin/helpers/{profile['id']}/verify",
        headers={"X-Admin-Test-Key": "test-admin-key"},
    )
    assert r2.status_code == 200, r2.text
    return {"profile": r2.json(), "user": helper_user["user"], "token": helper_user["token"]}


@pytest.fixture
async def paid_helper(client, second_helper_user, make_helper_payload):
    """Create + verify a PAID helper profile."""
    hdr = auth_headers(second_helper_user["token"])
    r = await client.post(
        "/api/v1/helpers/profile",
        json=make_helper_payload(
            is_paid=True,
            hourly_rate_usd=50.0,
            offering_categories=["private_tour", "translation", "vip_hospitality"],
        ),
        headers=hdr,
    )
    assert r.status_code == 201, r.text
    profile = r.json()

    r2 = await client.post(
        f"/api/v1/admin/helpers/{profile['id']}/verify",
        headers={"X-Admin-Test-Key": "test-admin-key"},
    )
    assert r2.status_code == 200, r2.text
    return {"profile": r2.json(), "user": second_helper_user["user"], "token": second_helper_user["token"]}


@pytest.fixture
async def seeded_event(client):
    """Create a minimal football event for FK-integrity in requests."""
    r = await client.post(
        "/api/v1/admin/events",
        json={
            "title": "WC 2030 Group A - Match 1",
            "venue": "Grand Stade de Casablanca",
            "country_code": "MA",
            "event_date": (date.today() + timedelta(days=30)).isoformat(),
            "community_tag": "wc2030-ma",
        },
        headers={"X-Admin-Test-Key": "test-admin-key"},
    )
    assert r.status_code == 201, r.text
    return r.json()