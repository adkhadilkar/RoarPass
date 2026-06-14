import pytest
import uuid
from datetime import datetime, timedelta, timezone
from typing import Generator

import httpx

BASE_URL = "http://localhost:8000"
ADMIN_TOKEN = "Bearer ${ADMIN_JWT_TOKEN}"  # resolved from env at runtime


def admin_headers() -> dict:
    import os
    token = os.environ.get("ADMIN_JWT_TOKEN", "test-admin-token")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def user_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client() -> Generator[httpx.Client, None, None]:
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="module")
def wc_event(client: httpx.Client) -> dict:
    """Create a World-Cup-style event for the test session."""
    payload = {
        "name": "Test World Cup 2026",
        "slug": f"test-wc-2026-{uuid.uuid4().hex[:6]}",
        "sport": "football",
        "type": "world_cup",
        "start_date": "2026-06-11",
        "end_date": "2026-07-19",
        "host_countries": ["USA", "CAN", "MEX"],
        "host_cities": [
            {"city": "New York", "country": "USA", "venue": "MetLife Stadium"},
            {"city": "Los Angeles", "country": "USA", "venue": "SoFi Stadium"},
            {"city": "Toronto", "country": "CAN", "venue": "BMO Field"},
            {"city": "Mexico City", "country": "MEX", "venue": "Estadio Azteca"},
        ],
        "timezone": "America/New_York",
        "status": "draft",
    }
    resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
    assert resp.status_code == 201, f"Setup failed: {resp.text}"
    event = resp.json()
    yield event
    # Teardown
    client.delete(f"/api/v1/events/{event['id']}", headers=admin_headers())


@pytest.fixture(scope="module")
def club_wc_event(client: httpx.Client) -> dict:
    """Create a Club-World-Cup-style event for the test session."""
    payload = {
        "name": "Test Club World Cup 2025",
        "slug": f"test-cwc-2025-{uuid.uuid4().hex[:6]}",
        "sport": "football",
        "type": "club_world_cup",
        "start_date": "2025-06-15",
        "end_date": "2025-07-13",
        "host_countries": ["USA"],
        "host_cities": [
            {"city": "Miami", "country": "USA", "venue": "Hard Rock Stadium"},
        ],
        "timezone": "America/New_York",
        "status": "draft",
    }
    resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
    assert resp.status_code == 201, f"Setup failed: {resp.text}"
    event = resp.json()
    yield event
    client.delete(f"/api/v1/events/{event['id']}", headers=admin_headers())


# ===========================================================================
# AC-1: Admin can create an event with required fields
# ===========================================================================

class TestEventCreation:
    def test_create_world_cup_event_returns_201(self, client, wc_event):
        """PRD 4 – Admin creates WC event; system returns 201 with id."""
        assert wc_event["id"] is not None
        assert wc_event["sport"] == "football"
        assert wc_event["type"] == "world_cup"
        assert wc_event["status"] == "draft"

    def test_create_club_world_cup_event(self, client, club_wc_event):
        """PRD 4 – Admin creates Club WC event."""
        assert club_wc_event["id"] is not None
        assert club_wc_event["type"] == "club_world_cup"

    def test_create_event_missing_required_fields_returns_422(self, client):
        """Validation: missing name/sport/type/dates."""
        resp = client.post(
            "/api/v1/events",
            json={"name": "Incomplete Event"},
            headers=admin_headers(),
        )
        assert resp.status_code == 422
        errors = resp.json().get("detail", [])
        required = {e["loc"][-1] for e in errors}
        assert "sport" in required or "type" in required

    def test_create_event_invalid_sport_returns_422(self, client):
        """PRD 5.1 – Only supported sports accepted."""
        payload = {
            "name": "Bad Sport Event",
            "slug": "bad-sport",
            "sport": "underwater_basket_weaving",
            "type": "world_cup",
            "start_date": "2027-01-01",
            "end_date": "2027-02-01",
            "host_countries": ["USA"],
        }
        resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
        assert resp.status_code == 422

    def test_create_event_end_before_start_returns_422(self, client):
        """Date integrity: end_date must be after start_date."""
        payload = {
            "name": "Bad Dates",
            "slug": "bad-dates",
            "sport": "football",
            "type": "world_cup",
            "start_date": "2027-06-01",
            "end_date": "2026-01-01",  # before start
            "host_countries": ["USA"],
        }
        resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
        assert resp.status_code == 422

    def test_create_event_duplicate_slug_returns_409(self, client, wc_event):
        """Slug uniqueness constraint."""
        payload = {
            "name": "Duplicate Slug Event",
            "slug": wc_event["slug"],
            "sport": "football",
            "type": "world_cup",
            "start_date": "2028-01-01",
            "end_date": "2028-02-01",
            "host_countries": ["BRA"],
        }
        resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
        assert resp.status_code in (409, 422)

    def test_non_admin_cannot_create_event(self, client):
        """PRD 7.8.2 – RBAC: regular users cannot create events."""
        payload = {
            "name": "Unauthorized Event",
            "slug": "unauth-event",
            "sport": "football",
            "type": "world_cup",
            "start_date": "2029-01-01",
            "end_date": "2029-02-01",
            "host_countries": ["ARG"],
        }
        resp = client.post(
            "/api/v1/events",
            json=payload,
            headers=user_headers("regular-user-token"),
        )
        assert resp.status_code in (401, 403)

    def test_unauthenticated_cannot_create_event(self, client):
        """Security: no token → 401."""
        resp = client.post(
            "/api/v1/events",
            json={"name": "No Auth"},
        )
        assert resp.status_code == 401


# ===========================================================================
# AC-2: Admin can read / list events
# ===========================================================================

class TestEventRead:
    def test_get_event_by_id(self, client, wc_event):
        resp = client.get(f"/api/v1/events/{wc_event['id']}", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == wc_event["id"]
        assert data["name"] == wc_event["name"]

    def test_get_event_by_slug(self, client, wc_event):
        resp = client.get(f"/api/v1/events/slug/{wc_event['slug']}", headers=admin_headers())
        assert resp.status_code == 200
        assert resp.json()["slug"] == wc_event["slug"]

    def test_get_nonexistent_event_returns_404(self, client):
        resp = client.get("/api/v1/events/nonexistent-id-000", headers=admin_headers())
        assert resp.status_code == 404

    def test_list_events_returns_paginated_response(self, client):
        resp = client.get("/api/v1/events?page=1&page_size=10", headers=admin_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert isinstance(body["items"], list)

    def test_list_events_filter_by_sport(self, client):
        resp = client.get("/api/v1/events?sport=football", headers=admin_headers())
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["sport"] == "football"

    def test_list_events_filter_by_status(self, client, wc_event):
        resp = client.get("/api/v1/events?status=draft", headers=admin_headers())
        assert resp.status_code == 200
        statuses = {e["status"] for e in resp.json()["items"]}
        assert statuses <= {"draft"}

    def test_list_events_filter_by_type(self, client):
        resp = client.get("/api/v1/events?type=world_cup", headers=admin_headers())
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["type"] == "world_cup"

    def test_public_can_read_active_events(self, client):
        """PRD 7.1 – Published events are publicly readable."""
        resp = client.get("/api/v1/events?status=active")
        assert resp.status_code == 200

    def test_public_cannot_see_draft_events(self, client):
        """Draft events must not appear in public listing."""
        resp = client.get("/api/v1/events?status=draft")
        # Unauthenticated → either 200 with empty list or 403
        if resp.status_code == 200:
            assert resp.json()["items"] == []
        else:
            assert resp.status_code == 403


# ===========================================================================
# AC-3: Admin can update event configuration
# ===========================================================================

class TestEventUpdate:
    def test_update_event_name(self, client, wc_event):
        new_name = "Updated World Cup 2026"
        resp = client.patch(
            f"/api/v1/events/{wc_event['id']}",
            json={"name": new_name},
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == new_name

    def test_update_host_cities(self, client, wc_event):
        cities = wc_event.get("host_cities", [])
        cities.append({"city": "Chicago", "country": "USA", "venue": "Soldier Field"})
        resp = client.patch(
            f"/api/v1/events/{wc_event['id']}",
            json={"host_cities": cities},
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        returned_cities = {c["city"] for c in resp.json()["host_cities"]}
        assert "Chicago" in returned_cities

    def test_update_timezone(self, client, wc_event):
        resp = client.patch(
            f"/api/v1/events/{wc_event['id']}",
            json={"timezone": "America/Chicago"},
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["timezone"] == "America/Chicago"

    def test_cannot_change_type_after_creation(self, client, wc_event):
        """Immutable field: event type must not change after creation."""
        resp = client.patch(
            f"/api/v1/events/{wc_event['id']}",
            json={"type": "club_world_cup"},
            headers=admin_headers(),
        )
        # Either rejected (422) or silently ignored (200 with original type)
        if resp.status_code == 200:
            assert resp.json()["type"] == wc_event["type"]
        else:
            assert resp.status_code == 422

    def test_non_admin_cannot_update_event(self, client, wc_event):
        resp = client.patch(
            f"/api/v1/events/{wc_event['id']}",
            json={"name": "Hacker name"},
            headers=user_headers("regular-user-token"),
        )
        assert resp.status_code in (401, 403)


# ===========================================================================
# AC-4: Schedule / Match management
# ===========================================================================

class TestScheduleManagement:
    @pytest.fixture(scope="class")
    def sample_match(self, client, wc_event) -> dict:
        payload = {
            "event_id": wc_event["id"],
            "home_team": "Brazil",
            "away_team": "Argentina",
            "venue": "MetLife Stadium",
            "city": "New York",
            "country": "USA",
            "kickoff_utc": "2026-06-14T18:00:00Z",
            "stage": "group",
            "group": "C",
        }
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/matches",
            json=payload,
            headers=admin_headers(),
        )
        assert resp.status_code == 201, resp.text
        yield resp.json()
        client.delete(
            f"/api/v1/events/{wc_event['id']}/matches/{resp.json()['id']}",
            headers=admin_headers(),
        )

    def test_add_match_to_event(self, client, sample_match):
        assert sample_match["id"] is not None
        assert sample_match["home_team"] == "Brazil"

    def test_get_event_schedule(self, client, wc_event, sample_match):
        resp = client.get(
            f"/api/v1/events/{wc_event['id']}/matches",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        match_ids = [m["id"] for m in resp.json()["items"]]
        assert sample_match["id"] in match_ids

    def test_filter_matches_by_stage(self, client, wc_event, sample_match):
        resp = client.get(
            f"/api/v1/events/{wc_event['id']}/matches?stage=group",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        for m in resp.json()["items"]:
            assert m["stage"] == "group"

    def test_filter_matches_by_city(self, client, wc_event, sample_match):
        resp = client.get(
            f"/api/v1/events/{wc_event['id']}/matches?city=New+York",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        cities = {m["city"] for m in resp.json()["items"]}
        assert "New York" in cities

    def test_update_match_kickoff_time(self, client, wc_event, sample_match):
        new_time = "2026-06-14T20:00:00Z"
        resp = client.patch(
            f"/api/v1/events/{wc_event['id']}/matches/{sample_match['id']}",
            json={"kickoff_utc": new_time},
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["kickoff_utc"] == new_time

    def test_add_match_with_invalid_team_returns_422(self, client, wc_event):
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/matches",
            json={
                "event_id": wc_event["id"],
                "home_team": "",  # empty team name
                "away_team": "France",
                "venue": "MetLife Stadium",
                "city": "New York",
                "country": "USA",
                "kickoff_utc": "2026-06-15T18:00:00Z",
                "stage": "group",
            },
            headers=admin_headers(),
        )
        assert resp.status_code == 422


# ===========================================================================
# AC-5: Participating Teams management
# ===========================================================================

class TestTeamManagement:
    @pytest.fixture(scope="class")
    def teams(self, client, wc_event) -> list:
        created = []
        for t in [
            {"name": "Brazil", "country": "BRA", "confederation": "CONMEBOL", "group": "C"},
            {"name": "Argentina", "country": "ARG", "confederation": "CONMEBOL", "group": "C"},
            {"name": "France", "country": "FRA", "confederation": "UEFA", "group": "D"},
        ]:
            resp = client.post(
                f"/api/v1/events/{wc_event['id']}/teams",
                json=t,
                headers=admin_headers(),
            )
            assert resp.status_code == 201, resp.text
            created.append(resp.json())
        yield created
        for team in created:
            client.delete(
                f"/api/v1/events/{wc_event['id']}/teams/{team['id']}",
                headers=admin_headers(),
            )

    def test_add_teams_to_event(self, client, teams):
        assert len(teams) == 3

    def test_list_teams(self, client, wc_event, teams):
        resp = client.get(
            f"/api/v1/events/{wc_event['id']}/teams",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        names = {t["name"] for t in resp.json()["items"]}
        assert {"Brazil", "Argentina", "France"} <= names

    def test_filter_teams_by_confederation(self, client, wc_event, teams):
        resp = client.get(
            f"/api/v1/events/{wc_event['id']}/teams?confederation=CONMEBOL",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        for t in resp.json()["items"]:
            assert t["confederation"] == "CONMEBOL"

    def test_filter_teams_by_group(self, client, wc_event, teams):
        resp = client.get(
            f"/api/v1/events/{wc_event['id']}/teams?group=C",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        for t in resp.json()["items"]:
            assert t.get("group") == "C"

    def test_duplicate_team_in_same_event_returns_409(self, client, wc_event, teams):
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/teams",
            json={"name": "Brazil", "country": "BRA", "confederation": "CONMEBOL", "group": "C"},
            headers=admin_headers(),
        )
        assert resp.status_code in (409, 422)


# ===========================================================================
# AC-6: Event activation logic (status transitions)
# ===========================================================================

class TestEventActivation:
    def test_draft_event_can_be_published(self, client, wc_event):
        """PRD 7.1 – draft → published transition."""
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/publish",
            headers=admin_headers(),
        )
        assert resp.status_code in (200, 202)
        body = resp.json()
        assert body["status"] in ("published", "active")

    def test_published_event_can_be_activated(self, client, wc_event):
        """PRD 7.1 – published → active transition."""
        # Ensure published first
        client.post(f"/api/v1/events/{wc_event['id']}/publish", headers=admin_headers())
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/activate",
            headers=admin_headers(),
        )
        assert resp.status_code in (200, 202)
        assert resp.json()["status"] == "active"

    def test_active_event_can_be_deactivated(self, client, wc_event):
        """Admin can suspend/deactivate an event."""
        # Ensure active
        client.post(f"/api/v1/events/{wc_event['id']}/publish", headers=admin_headers())
        client.post(f"/api/v1/events/{wc_event['id']}/activate", headers=admin_headers())
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/deactivate",
            headers=admin_headers(),
        )
        assert resp.status_code in (200, 202)
        assert resp.json()["status"] in ("inactive", "suspended", "draft")

    def test_invalid_status_transition_returns_422(self, client):
        """Cannot skip draft → active without publish."""
        payload = {
            "name": "Transition Test Event",
            "slug": f"transition-test-{uuid.uuid4().hex[:6]}",
            "sport": "football",
            "type": "world_cup",
            "start_date": "2030-01-01",
            "end_date": "2030-02-01",
            "host_countries": ["GER"],
            "status": "draft",
        }
        resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
        assert resp.status_code == 201
        event_id = resp.json()["id"]
        try:
            resp2 = client.post(
                f"/api/v1/events/{event_id}/activate",
                headers=admin_headers(),
            )
            assert resp2.status_code in (409, 422)
        finally:
            client.delete(f"/api/v1/events/{event_id}", headers=admin_headers())

    def test_non_admin_cannot_activate_event(self, client, wc_event):
        resp = client.post(
            f"/api/v1/events/{wc_event['id']}/activate",
            headers=user_headers("regular-user-token"),
        )
        assert resp.status_code in (401, 403)


# ===========================================================================
# AC-7: Event deletion
# ===========================================================================

class TestEventDeletion:
    def test_soft_delete_draft_event(self, client):
        payload = {
            "name": "To Be Deleted",
            "slug": f"to-delete-{uuid.uuid4().hex[:6]}",
            "sport": "football",
            "type": "world_cup",
            "start_date": "2032-01-01",
            "end_date": "2032-02-01",
            "host_countries": ["GBR"],
            "status": "draft",
        }
        create_resp = client.post("/api/v1/events", json=payload, headers=admin_headers())
        assert create_resp.status_code == 201
        event_id = create_resp.json()["id"]

        del_resp = client.delete(f"/api/v1/events/{event_id}", headers=admin_headers())
        assert del_resp.status_code in (200, 204)

        get_resp = client.get(f"/api/v1/events/{event_id}", headers=admin_headers())
        # Soft-deleted → 404 or status=deleted
        if get_resp.status_code == 200:
            assert get_resp.json().get("status") in ("deleted", "archived")
        else:
            assert get_resp.status_code == 404

    def test_cannot_delete_active_event(self, client, club_wc_event):
        """Active events must not be hard-deleted."""
        client.post(f"/api/v1/events/{club_wc_event['id']}/publish", headers=admin_headers())
        client.post(f"/api/v1/events/{club_wc_event['id']}/activate", headers=admin_headers())
        resp = client.delete(
            f"/api/v1/events/{club_wc_event['id']}",
            headers=admin_headers(),
        )
        assert resp.status_code in (409, 422)

    def test_non_admin_cannot_delete_event(self, client, wc_event):
        resp = client.delete(
            f"/api/v1/events/{wc_event['id']}",
            headers=user_headers("regular-user-token"),
        )
        assert resp.status_code in (401, 403)