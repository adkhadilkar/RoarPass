"""
Functional tests for Match/Schedule Feed with Timezone Conversion (PRD 7.8.2)
Area: official-info-layer
"""
import pytest
import httpx
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

# ---------------------------------------------------------------------------
# Fixtures (reuse pattern from test_per_event_guides.py)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def http_client():
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        yield client


@pytest.fixture(scope="session")
def auth_headers(http_client):
    resp = http_client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": "testfan@roarpass.test", "password": "TestPass123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def seeded_competition_id(http_client, auth_headers):
    resp = http_client.get(f"{API_PREFIX}/events?limit=1", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()["items"][0]["competition_id"]


# ---------------------------------------------------------------------------
# ACC-1: Schedule feed structure
# ---------------------------------------------------------------------------

class TestScheduleFeedStructure:

    def test_schedule_feed_returns_200(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_schedule_feed_has_pagination(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

    def test_schedule_feed_match_has_required_fields(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        items = resp.json()["items"]
        assert len(items) > 0, "Schedule feed is empty"
        match = items[0]
        required = {
            "match_id", "home_team", "away_team", "venue",
            "kickoff_utc", "kickoff_local", "timezone", "stage", "status"
        }
        missing = required - match.keys()
        assert not missing, f"Match object missing fields: {missing}"

    def test_schedule_kickoff_utc_is_valid_iso8601(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        for match in resp.json()["items"]:
            ts = match["kickoff_utc"]
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                assert dt.tzinfo is not None
            except ValueError:
                pytest.fail(f"Invalid ISO-8601 timestamp: {ts}")

    def test_schedule_status_values_are_known(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        valid_statuses = {"scheduled", "live", "finished", "postponed", "cancelled"}
        for match in resp.json()["items"]:
            assert match["status"] in valid_statuses, f"Unknown status: {match['status']}"

    def test_schedule_feed_sorted_ascending_by_kickoff(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule?sort=asc",
            headers=auth_headers,
        )
        items = resp.json()["items"]
        kickoffs = [datetime.fromisoformat(m["kickoff_utc"].replace("Z", "+00:00")) for m in items]
        assert kickoffs == sorted(kickoffs), "Schedule not sorted ascending by kickoff_utc"


# ---------------------------------------------------------------------------
# ACC-2: Timezone conversion
# ---------------------------------------------------------------------------

class TestTimezoneConversion:

    def test_kickoff_local_matches_timezone_field(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        for match in resp.json()["items"][:5]:  # spot-check first 5
            tz_name = match["timezone"]
            utc_dt = datetime.fromisoformat(match["kickoff_utc"].replace("Z", "+00:00"))
            local_dt = datetime.fromisoformat(match["kickoff_local"])
            expected_local = utc_dt.astimezone(ZoneInfo(tz_name))
            diff_seconds = abs((local_dt.replace(tzinfo=ZoneInfo(tz_name)) - expected_local).total_seconds())
            assert diff_seconds < 60, (
                f"kickoff_local mismatch for match {match['match_id']}: "
                f"expected ~{expected_local.isoformat()}, got {match['kickoff_local']}"
            )

    def test_schedule_converts_to_viewer_timezone_query_param(self, http_client, auth_headers, seeded_competition_id):
        """?viewer_tz=America/New_York should shift kickoff_local accordingly."""
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            "?viewer_tz=America/New_York",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("viewer_timezone") == "America/New_York"
        for match in data["items"][:3]:
            utc_dt = datetime.fromisoformat(match["kickoff_utc"].replace("Z", "+00:00"))
            local_dt = datetime.fromisoformat(match["kickoff_viewer_local"])
            expected_local = utc_dt.astimezone(ZoneInfo("America/New_York"))
            diff = abs((local_dt.replace(tzinfo=ZoneInfo("America/New_York")) - expected_local).total_seconds())
            assert diff < 60

    def test_invalid_viewer_timezone_returns_400(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            "?viewer_tz=Not/AReal_Zone",
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_dst_boundary_handling(self, http_client, auth_headers, seeded_competition_id):
        """Matches near DST change should still convert correctly."""
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            "?viewer_tz=Europe/London",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        # Verify no match has an impossible local time (25:xx or negative hour)
        for match in resp.json()["items"]:
            local_str = match.get("kickoff_viewer_local", match.get("kickoff_local", ""))
            if "T" in local_str:
                hour = int(local_str.split("T")[1].split(":")[0])
                assert 0 <= hour <= 23, f"Invalid hour in local time: {local_str}"


# ---------------------------------------------------------------------------
# ACC-3: Schedule filtering
# ---------------------------------------------------------------------------

class TestScheduleFiltering:

    def test_filter_by_team(self, http_client, auth_headers, seeded_competition_id):
        # first grab a known team
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        team_code = resp.json()["items"][0]["home_team"]["code"]

        filtered = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            f"?team={team_code}",
            headers=auth_headers,
        )
        assert filtered.status_code == 200
        for match in filtered.json()["items"]:
            codes = {match["home_team"]["code"], match["away_team"]["code"]}
            assert team_code in codes, f"Team {team_code} not in match {match['match_id']}"

    def test_filter_by_stage(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            "?stage=group_stage",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        for match in resp.json()["items"]:
            assert match["stage"] == "group_stage"

    def test_filter_by_date_range(self, http_client, auth_headers, seeded_competition_id):
        date_from = "2026-06-11"
        date_to = "2026-06-20"
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            f"?date_from={date_from}&date_to={date_to}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        for match in resp.json()["items"]:
            ko = match["kickoff_utc"][:10]
            assert date_from <= ko <= date_to, f"Match {match['match_id']} outside date range: {ko}"

    def test_filter_by_city(self, http_client, auth_headers, seeded_competition_id):
        resp_all = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        city = resp_all.json()["items"][0]["venue"]["city_slug"]
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            f"?city={city}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        for match in resp.json()["items"]:
            assert match["venue"]["city_slug"] == city


# ---------------------------------------------------------------------------
# ACC-4: Schedule feed live updates (SSE / polling)
# ---------------------------------------------------------------------------

class TestScheduleLiveUpdates:

    def test_match_detail_has_live_score_fields_when_live(self, http_client, auth_headers, seeded_competition_id):
        """If any match is live-status, it must contain score fields."""
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule"
            "?status=live",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        # Seed may have no live matches; skip if empty
        for match in resp.json()["items"]:
            assert "score" in match
            assert "minute" in match

    def test_schedule_feed_cache_max_age_header(self, http_client, auth_headers, seeded_competition_id):
        resp = http_client.get(
            f"{API_PREFIX}/official-info/competitions/{seeded_competition_id}/schedule",
            headers=auth_headers,
        )
        cache_control = resp.headers.get("cache-control", "")
        # Schedule feed should be short-lived (max 60 s) to reflect live updates
        assert "max-age" in cache_control
        max_age = int(
            next(p.split("=")[1] for p in cache_control.split(",") if "max-age" in p)
        )
        assert max_age <= 60, f"Cache max-age too long for live feed: {max_age}s"