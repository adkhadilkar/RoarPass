"""
Functional tests: Helper Profile creation, retrieval, update, offering categories,
availability calendar, and public listing.

PRD refs: 5.4, 7.6.1
Acceptance criteria:
  - AC-HN-01: Helper can create a profile with bio, categories, language, city.
  - AC-HN-02: Availability calendar is per-day with time slots.
  - AC-HN-03: Profile visible in public listing; filterable by category/city/language.
  - AC-HN-04: Helper can update their own profile; fans cannot.
  - AC-HN-05: Unverified helpers do not appear in default public listing.
  - AC-HN-06: GDPR — helper email not exposed in public profile.
"""

import pytest
from datetime import date, timedelta
from .conftest import auth_headers


@pytest.mark.asyncio
class TestHelperProfileCreation:
    """AC-HN-01, AC-HN-02"""

    async def test_create_profile_success(self, client, helper_user, make_helper_payload):
        """Helper creates a valid profile — 201, schema check."""
        payload = make_helper_payload()
        r = await client.post(
            "/api/v1/helpers/profile",
            json=payload,
            headers=auth_headers(helper_user["token"]),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["bio"] == payload["bio"]
        assert data["city"] == payload["city"]
        assert set(data["languages"]) == set(payload["languages"])
        assert set(data["offering_categories"]) == set(payload["offering_categories"])
        assert data["is_verified"] is False  # not verified yet
        assert data["is_paid_offering"] is False

    async def test_duplicate_profile_rejected(self, client, helper_user, make_helper_payload):
        """Helper cannot create a second profile — 409."""
        payload = make_helper_payload()
        # First create
        r1 = await client.post(
            "/api/v1/helpers/profile",
            json=payload,
            headers=auth_headers(helper_user["token"]),
        )
        assert r1.status_code in (201, 409)  # may already exist from fixture order
        # Second attempt must be 409
        r2 = await client.post(
            "/api/v1/helpers/profile",
            json=payload,
            headers=auth_headers(helper_user["token"]),
        )
        assert r2.status_code == 409
        assert "already exists" in r2.json().get("detail", "").lower()

    async def test_fan_cannot_create_helper_profile(self, client, fan_user, make_helper_payload):
        """Fan role is forbidden from creating helper profiles — 403."""
        r = await client.post(
            "/api/v1/helpers/profile",
            json=make_helper_payload(),
            headers=auth_headers(fan_user["token"]),
        )
        assert r.status_code == 403

    async def test_availability_calendar_structure(self, client, helper_user, make_helper_payload):
        """Availability contains per-day slots in ISO format."""
        today = date.today()
        availability = [
            {"date": (today + timedelta(days=i)).isoformat(), "slots": ["09:00", "14:00", "18:00"]}
            for i in range(1, 5)
        ]
        payload = make_helper_payload(availability=availability)
        r = await client.post(
            "/api/v1/helpers/profile",
            json=payload,
            headers=auth_headers(helper_user["token"]),
        )
        # Accept 201 or 409 if already created; fetch profile instead
        if r.status_code == 409:
            r = await client.get(
                "/api/v1/helpers/me",
                headers=auth_headers(helper_user["token"]),
            )
            assert r.status_code == 200
            data = r.json()
        else:
            assert r.status_code == 201
            data = r.json()

        avail = data.get("availability", [])
        assert len(avail) >= 4
        for slot in avail[:4]:
            assert "date" in slot
            assert isinstance(slot["slots"], list)
            assert len(slot["slots"]) > 0

    async def test_invalid_category_rejected(self, client, helper_user, make_helper_payload):
        """Unknown offering category returns 422."""
        payload = make_helper_payload(offering_categories=["INVALID_CATEGORY_XYZ"])
        r = await client.post(
            "/api/v1/helpers/profile",
            json=payload,
            headers=auth_headers(helper_user["token"]),
        )
        assert r.status_code == 422

    async def test_missing_required_fields_rejected(self, client, helper_user):
        """Profile without bio fails validation."""
        r = await client.post(
            "/api/v1/helpers/profile",
            json={"city": "Casablanca"},  # missing many required fields
            headers=auth_headers(helper_user["token"]),
        )
        assert r.status_code == 422

    async def test_bio_max_length_enforced(self, client, helper_user, make_helper_payload):
        """Bio exceeding 1000 chars returns 422."""
        payload = make_helper_payload(bio="x" * 1001)
        r = await client.post(
            "/api/v1/helpers/profile",
            json=payload,
            headers=auth_headers(helper_user["token"]),
        )
        assert r.status_code == 422


@pytest.mark.asyncio
class TestHelperProfileRetrieval:
    """AC-HN-03, AC-HN-05, AC-HN-06"""

    async def test_verified_helper_appears_in_public_list(self, client, verified_helper):
        """Verified helper appears in /helpers listing."""
        r = await client.get("/api/v1/helpers")
        assert r.status_code == 200
        ids = [h["id"] for h in r.json().get("items", [])]
        assert verified_helper["profile"]["id"] in ids

    async def test_unverified_helper_excluded_from_public_list(self, client, helper_user, make_helper_payload):
        """Unverified helper NOT in default listing."""
        # ensure profile created
        await client.post(
            "/api/v1/helpers/profile",
            json=make_helper_payload(),
            headers=auth_headers(helper_user["token"]),
        )
        r = await client.get("/api/v1/helpers")
        assert r.status_code == 200
        # All returned helpers must be verified
        for h in r.json().get("items", []):
            assert h.get("is_verified") is True

    async def test_filter_by_category(self, client, verified_helper):
        """Filter listing by offering category."""
        r = await client.get(
            "/api/v1/helpers",
            params={"category": "transportation"},
        )
        assert r.status_code == 200
        for h in r.json().get("items", []):
            assert "transportation" in h["offering_categories"]

    async def test_filter_by_language(self, client, verified_helper):
        """Filter listing by language code."""
        r = await client.get("/api/v1/helpers", params={"language": "ar"})
        assert r.status_code == 200
        for h in r.json().get("items", []):
            assert "ar" in h["languages"]

    async def test_filter_by_city(self, client, verified_helper):
        """Filter listing by city."""
        r = await client.get("/api/v1/helpers", params={"city": "Casablanca"})
        assert r.status_code == 200
        for h in r.json().get("items", []):
            assert h["city"].lower() == "casablanca"

    async def test_public_profile_hides_email(self, client, verified_helper):
        """GDPR AC-HN-06: email NOT in public profile response."""
        helper_id = verified_helper["profile"]["id"]
        r = await client.get(f"/api/v1/helpers/{helper_id}")
        assert r.status_code == 200
        data = r.json()
        assert "email" not in data
        assert "password" not in data

    async def test_public_profile_shows_rating_summary(self, client, verified_helper):
        """Public profile includes average_rating and review_count fields."""
        helper_id = verified_helper["profile"]["id"]
        r = await client.get(f"/api/v1/helpers/{helper_id}")
        assert r.status_code == 200
        data = r.json()
        assert "average_rating" in data
        assert "review_count" in data

    async def test_pagination(self, client):
        """Listing supports page/page_size params."""
        r = await client.get("/api/v1/helpers", params={"page": 1, "page_size": 5})
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert len(body["items"]) <= 5


@pytest.mark.asyncio
class TestHelperProfileUpdate:
    """AC-HN-04"""

    async def test_helper_can_update_own_profile(self, client, verified_helper):
        """Helper can PATCH their own profile."""
        hid = verified_helper["profile"]["id"]
        r = await client.patch(
            f"/api/v1/helpers/{hid}",
            json={"bio": "Updated bio — WC 2030 specialist."},
            headers=auth_headers(verified_helper["token"]),
        )
        assert r.status_code == 200
        assert r.json()["bio"] == "Updated bio — WC 2030 specialist."

    async def test_helper_cannot_update_other_profile(self, client, verified_helper, paid_helper):
        """Helper cannot PATCH another helper's profile — 403."""
        other_id = paid_helper["profile"]["id"]
        r = await client.patch(
            f"/api/v1/helpers/{other_id}",
            json={"bio": "Malicious update"},
            headers=auth_headers(verified_helper["token"]),
        )
        assert r.status_code == 403

    async def test_fan_cannot_update_helper_profile(self, client, verified_helper, fan_user):
        """Fan cannot update any helper profile — 403."""
        hid = verified_helper["profile"]["id"]
        r = await client.patch(
            f"/api/v1/helpers/{hid}",
            json={"bio": "Fan takeover"},
            headers=auth_headers(fan_user["token"]),
        )
        assert r.status_code == 403

    async def test_update_availability(self, client, verified_helper):
        """Helper can update availability calendar."""
        hid = verified_helper["profile"]["id"]
        new_avail = [
            {
                "date": (date.today() + timedelta(days=i)).isoformat(),
                "slots": ["10:00"]
            }
            for i in range(1, 3)
        ]
        r = await client.patch(
            f"/api/v1/helpers/{hid}",
            json={"availability": new_avail},
            headers=auth_headers(verified_helper["token"]),
        )
        assert r.status_code == 200
        updated = r.json()
        assert len(updated["availability"]) >= 2