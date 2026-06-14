"""
Functional tests for Per-Event / Per-City Guides (PRD 7.8.1)
Area: official-info-layer
"""
import pytest
import httpx
import asyncio
from datetime import datetime, timezone
from typing import Any

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def http_client():
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        yield client


@pytest.fixture(scope="session")
def auth_headers(http_client):
    """Obtain a valid JWT for a seeded test fan account."""
    resp = http_client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": "testfan@roarpass.test", "password": "TestPass123!"},
    )
    assert resp.status_code == 200, f"Auth failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def seeded_event_id(http_client, auth_headers):
    """Return the ID of the seeded WC Group-Stage event."""
    resp = http_client.get(f"{API_PREFIX}/events?type=group_stage&limit=1", headers=auth_headers)
    assert resp.status_code == 200
    events = resp.json()["items"]
    assert len(events) > 0, "No seeded events found"
    return events[0]["id"]


@pytest.fixture(scope="session")
def seeded_city_slug(http_client, auth_headers, seeded_event_id):
    """Return the city slug for the seeded event."""
    resp = http_client.get(f"{API_PREFIX}/events/{seeded_event_id}", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()["city_slug"]


# ---------------------------------------------------------------------------
# ACC-1: Event guide exists for every active event
# ---------------------------------------------------------------------------

class TestEventGuideExistence:

    def test_guide_endpoint_returns_200(self, http_client, auth_headers, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_guide_has_required_top_level_fields(self, http_client, auth_headers, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        data = resp.json()
        required = {"event_id", "city", "stadium", "sections"}
        missing = required - data.keys()
        assert not missing, f"Guide missing fields: {missing}"

    def test_guide_sections_contain_core_topics(self, http_client, auth_headers, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        sections = {s["slug"] for s in resp.json()["sections"]}
        required_sections = {"transport", "accommodation", "fan-zones", "stadium-rules", "local-tips"}
        missing = required_sections - sections
        assert not missing, f"Missing guide sections: {missing}"

    def test_guide_stadium_field_has_name_and_capacity(self, http_client, auth_headers, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        stadium = resp.json()["stadium"]
        assert "name" in stadium
        assert "capacity" in stadium
        assert isinstance(stadium["capacity"], int)
        assert stadium["capacity"] > 0

    def test_guide_has_official_source_attribution(self, http_client, auth_headers, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        data = resp.json()
        assert "source_attribution" in data
        assert data["source_attribution"].get("is_official") is True

    def test_guide_for_unknown_event_returns_404(self, http_client, auth_headers):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/nonexistent-event-id/guide",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_guide_unauthenticated_returns_401(self, http_client, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# ACC-2: City guide exists and contains locality-specific content
# ---------------------------------------------------------------------------

class TestCityGuideExistence:

    def test_city_guide_endpoint_returns_200(self, http_client, auth_headers, seeded_city_slug):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_city_guide_has_required_fields(self, http_client, auth_headers, seeded_city_slug):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=auth_headers,
        )
        data = resp.json()
        required = {"city_slug", "country_code", "currency", "language_tags", "sections"}
        missing = required - data.keys()
        assert not missing, f"City guide missing: {missing}"

    def test_city_guide_currency_field_is_iso_4217(self, http_client, auth_headers, seeded_city_slug):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=auth_headers,
        )
        currency = resp.json()["currency"]
        assert len(currency) == 3 and currency.isupper(), f"Invalid ISO-4217 currency: {currency}"

    def test_city_guide_emergency_contacts_present(self, http_client, auth_headers, seeded_city_slug):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=auth_headers,
        )
        sections = {s["slug"]: s for s in resp.json()["sections"]}
        assert "emergency-contacts" in sections
        contacts = sections["emergency-contacts"]["content"]
        assert any(c.get("type") == "police" for c in contacts)
        assert any(c.get("type") == "ambulance" for c in contacts)

    def test_city_guide_unknown_city_returns_404(self, http_client, auth_headers):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/city-that-does-not-exist/guide",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_city_guide_i18n_accept_language_header(self, http_client, auth_headers, seeded_city_slug):
        """Guide should return translated content when Accept-Language is sent."""
        headers = {**auth_headers, "Accept-Language": "ar"}
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=headers,
        )
        assert resp.status_code == 200
        # The response should declare the language it served
        assert "Content-Language" in resp.headers or "language" in resp.json()

    def test_city_guide_rtl_flag_set_for_arabic(self, http_client, auth_headers, seeded_city_slug):
        headers = {**auth_headers, "Accept-Language": "ar"}
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=headers,
        )
        data = resp.json()
        # RTL flag can live at root or inside locale meta
        rtl_value = data.get("rtl") or data.get("locale", {}).get("rtl")
        assert rtl_value is True, "Expected rtl=true for Arabic guide"


# ---------------------------------------------------------------------------
# ACC-3: Guide content freshness / last-updated metadata
# ---------------------------------------------------------------------------

class TestGuideContentFreshness:

    def test_event_guide_has_last_updated_timestamp(self, http_client, auth_headers, seeded_event_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        data = resp.json()
        assert "last_updated" in data
        ts = datetime.fromisoformat(data["last_updated"].replace("Z", "+00:00"))
        # Must be a recent timestamp (seeded data should be within last 1 year)
        age_days = (datetime.now(timezone.utc) - ts).days
        assert age_days < 365, f"Guide last_updated is unexpectedly old: {age_days} days"

    def test_city_guide_has_last_updated_timestamp(self, http_client, auth_headers, seeded_city_slug):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/cities/{seeded_city_slug}/guide",
            headers=auth_headers,
        )
        data = resp.json()
        assert "last_updated" in data

    def test_event_guide_etag_caching(self, http_client, auth_headers, seeded_event_id):
        """ETag must be present and conditional GET must return 304."""
        r1 = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers=auth_headers,
        )
        assert "etag" in r1.headers, "Missing ETag header"
        etag = r1.headers["etag"]
        r2 = http_client.get(
            f"{API_PREFIX}/official-info/events/{seeded_event_id}/guide",
            headers={**auth_headers, "If-None-Match": etag},
        )
        assert r2.status_code == 304, f"Expected 304 for unchanged guide, got {r2.status_code}"