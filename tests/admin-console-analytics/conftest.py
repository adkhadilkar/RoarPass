"""
Shared pytest fixtures for admin-console-analytics test suite.
Area: admin-console-analytics (id=16)
PRD refs: 6.6, 7.12.1, 7.12.2, 7.12.3, 7.12.4, 9.2
"""

import os
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone
from typing import Generator, Dict, Any

# ---------------------------------------------------------------------------
# Base URLs – resolved from environment variables (never hard-coded secrets)
# ---------------------------------------------------------------------------
API_BASE = os.environ.get("ROARPASS_API_BASE", "http://localhost:8000/api/v1")
ADMIN_API_BASE = os.environ.get("ROARPASS_ADMIN_API_BASE", "http://localhost:8000/api/admin/v1")
ANALYTICS_API_BASE = os.environ.get("ROARPASS_ANALYTICS_API_BASE", "http://localhost:8000/api/analytics/v1")
WS_BASE = os.environ.get("ROARPASS_WS_BASE", "ws://localhost:8000/ws")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_token(username: str, password: str) -> str:
    resp = requests.post(
        f"{API_BASE}/auth/token",
        json={"username": username, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def super_admin_token() -> str:
    return _get_token(
        os.environ["ROARPASS_SUPER_ADMIN_USER"],
        os.environ["ROARPASS_SUPER_ADMIN_PASS"],
    )


@pytest.fixture(scope="session")
def event_admin_token() -> str:
    return _get_token(
        os.environ["ROARPASS_EVENT_ADMIN_USER"],
        os.environ["ROARPASS_EVENT_ADMIN_PASS"],
    )


@pytest.fixture(scope="session")
def community_mod_token() -> str:
    return _get_token(
        os.environ["ROARPASS_COMMUNITY_MOD_USER"],
        os.environ["ROARPASS_COMMUNITY_MOD_PASS"],
    )


@pytest.fixture(scope="session")
def regular_user_token() -> str:
    return _get_token(
        os.environ["ROARPASS_REGULAR_USER"],
        os.environ["ROARPASS_REGULAR_PASS"],
    )


@pytest.fixture(scope="session")
def admin_headers(super_admin_token) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {super_admin_token}",
        "Content-Type": "application/json",
        "Accept-Language": "en",
    }


@pytest.fixture(scope="session")
def event_admin_headers(event_admin_token) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {event_admin_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def mod_headers(community_mod_token) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {community_mod_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def user_headers(regular_user_token) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {regular_user_token}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Seed data fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def seeded_event(admin_headers) -> Dict[str, Any]:
    """Create a test event via admin API and return its data."""
    payload = {
        "name": f"Test WC Event {uuid.uuid4().hex[:6]}",
        "type": "world_cup",
        "start_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
        "host_countries": ["QA"],
        "status": "draft",
    }
    resp = requests.post(f"{ADMIN_API_BASE}/events", json=payload, headers=admin_headers, timeout=10)
    resp.raise_for_status()
    event = resp.json()
    yield event
    # cleanup
    requests.delete(f"{ADMIN_API_BASE}/events/{event['id']}", headers=admin_headers, timeout=10)


@pytest.fixture(scope="session")
def activated_event(admin_headers, seeded_event) -> Dict[str, Any]:
    """Activate the seeded event."""
    resp = requests.patch(
        f"{ADMIN_API_BASE}/events/{seeded_event['id']}/status",
        json={"status": "active"},
        headers=admin_headers,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


@pytest.fixture(scope="session")
def seeded_community(admin_headers, activated_event) -> Dict[str, Any]:
    """Create a country community linked to the activated event."""
    payload = {
        "event_id": activated_event["id"],
        "country_code": "QA",
        "display_name": "Qatar Community",
        "auto_join": True,
    }
    resp = requests.post(f"{ADMIN_API_BASE}/communities", json=payload, headers=admin_headers, timeout=10)
    resp.raise_for_status()
    community = resp.json()
    yield community
    requests.delete(f"{ADMIN_API_BASE}/communities/{community['id']}", headers=admin_headers, timeout=10)


@pytest.fixture(scope="session")
def seeded_users(admin_headers) -> list:
    """Bulk-create test fan profiles for analytics."""
    users = []
    for i in range(5):
        payload = {
            "email": f"testfan_{uuid.uuid4().hex[:8]}@roarpass.test",
            "display_name": f"Fan {i}",
            "country_code": "QA",
            "roles": ["fan"],
        }
        resp = requests.post(f"{ADMIN_API_BASE}/users", json=payload, headers=admin_headers, timeout=10)
        if resp.status_code in (200, 201):
            users.append(resp.json())
    yield users
    for u in users:
        requests.delete(f"{ADMIN_API_BASE}/users/{u['id']}", headers=admin_headers, timeout=10)


@pytest.fixture(scope="session")
def seeded_helper(admin_headers, seeded_community) -> Dict[str, Any]:
    """Register a local helper in the seeded community."""
    payload = {
        "community_id": seeded_community["id"],
        "display_name": "LocalHelper_QA",
        "skills": ["translation", "transport"],
        "trust_level": "verified",
    }
    resp = requests.post(f"{ADMIN_API_BASE}/helpers", json=payload, headers=admin_headers, timeout=10)
    resp.raise_for_status()
    helper = resp.json()
    yield helper
    requests.delete(f"{ADMIN_API_BASE}/helpers/{helper['id']}", headers=admin_headers, timeout=10)


@pytest.fixture(scope="session")
def seeded_trip(admin_headers, seeded_community, seeded_users) -> Dict[str, Any]:
    """Create a community trip."""
    if not seeded_users:
        pytest.skip("No seeded users available for trip creation")
    payload = {
        "community_id": seeded_community["id"],
        "organizer_id": seeded_users[0]["id"],
        "title": "QA Trip Alpha",
        "departure": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
        "arrival": (datetime.now(timezone.utc) + timedelta(days=28)).isoformat(),
    }
    resp = requests.post(f"{ADMIN_API_BASE}/trips", json=payload, headers=admin_headers, timeout=10)
    resp.raise_for_status()
    trip = resp.json()
    yield trip
    requests.delete(f"{ADMIN_API_BASE}/trips/{trip['id']}", headers=admin_headers, timeout=10)