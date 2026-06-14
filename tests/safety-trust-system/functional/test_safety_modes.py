"""
Functional tests for Safety Modes (Solo, Women, Family, Accessibility)
PRD refs: 7.10.2, 7.10.3, 7.10.4, 7.10.5
"""
import pytest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient
import asyncio

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

BASE_URL = "http://localhost:8000"

SAFETY_MODES = ["solo", "women", "family", "accessibility"]

SAMPLE_USER = {
    "id": str(uuid.uuid4()),
    "email": "tester@roarpass.test",
    "display_name": "Test Fan",
    "gender": "female",
    "has_disability": False,
    "travelling_with_minors": False,
    "country_code": "NG",
}

SAMPLE_TRUSTED_CONTACT = {
    "name": "Emergency Contact",
    "phone": "+2348012345678",
    "email": "ec@example.com",
    "relationship": "friend",
    "can_see_location": True,
    "notify_on_sos": True,
}


@pytest.fixture
def user_id():
    return str(uuid.uuid4())


@pytest.fixture
def auth_headers(user_id):
    return {"Authorization": f"Bearer test_token_{user_id}", "X-User-ID": user_id}


@pytest.fixture
def admin_headers():
    return {"Authorization": "Bearer admin_test_token", "X-User-ID": "admin-001"}


# ---------------------------------------------------------------------------
# AC-7.10.2 — Safety Mode Selection & Persistence
# ---------------------------------------------------------------------------

class TestSafetyModeSelection:
    """Verify that safety modes can be set, persisted, and retrieved."""

    @pytest.mark.asyncio
    async def test_set_solo_mode(self, user_id, auth_headers):
        """User can activate Solo safety mode."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "solo"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["safety_mode"] == "solo"
        assert body["activated_at"] is not None

    @pytest.mark.asyncio
    @pytest.mark.parametrize("mode", SAFETY_MODES)
    async def test_all_modes_accepted(self, user_id, auth_headers, mode):
        """All four safety modes are accepted and stored."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": mode},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Mode '{mode}' rejected: {resp.text}"
        assert resp.json()["safety_mode"] == mode

    @pytest.mark.asyncio
    async def test_invalid_mode_rejected(self, user_id, auth_headers):
        """An unknown safety mode returns 422."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "ninja"},
                headers=auth_headers,
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_mode_persists_across_sessions(self, user_id, auth_headers):
        """Safety mode survives a 'new session' (GET after PATCH)."""
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "women"},
                headers=auth_headers,
            )
            resp = await client.get(
                f"/api/v1/users/{user_id}/safety-mode",
                headers=auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["safety_mode"] == "women"

    @pytest.mark.asyncio
    async def test_mode_deactivation(self, user_id, auth_headers):
        """User can deactivate safety mode (set to None / 'none')."""
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "solo"},
                headers=auth_headers,
            )
            resp = await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": None},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["safety_mode"] is None

    @pytest.mark.asyncio
    async def test_cannot_set_other_users_mode(self, auth_headers):
        """User cannot change another user's safety mode (403)."""
        other_user_id = str(uuid.uuid4())
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/users/{other_user_id}/safety-mode",
                json={"mode": "solo"},
                headers=auth_headers,
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_women_mode_content_filtering(self, user_id, auth_headers):
        """Women mode activates content/helper filtering flags."""
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "women"},
                headers=auth_headers,
            )
            resp = await client.get(
                f"/api/v1/users/{user_id}/safety-preferences",
                headers=auth_headers,
            )
        prefs = resp.json()
        assert prefs.get("helper_gender_filter") in ("female_preferred", "any")
        assert prefs.get("women_only_communities_visible") is True

    @pytest.mark.asyncio
    async def test_family_mode_flags_minors(self, user_id, auth_headers):
        """Family mode marks profile as travelling with minors."""
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "family"},
                headers=auth_headers,
            )
            resp = await client.get(
                f"/api/v1/users/{user_id}/safety-preferences",
                headers=auth_headers,
            )
        prefs = resp.json()
        assert prefs.get("travelling_with_minors") is True

    @pytest.mark.asyncio
    async def test_accessibility_mode_flags(self, user_id, auth_headers):
        """Accessibility mode exposes relevant venue/route filters."""
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.patch(
                f"/api/v1/users/{user_id}/safety-mode",
                json={"mode": "accessibility"},
                headers=auth_headers,
            )
            resp = await client.get(
                f"/api/v1/users/{user_id}/safety-preferences",
                headers=auth_headers,
            )
        prefs = resp.json()
        assert prefs.get("accessible_routes_only") is True
        assert prefs.get("accessible_venue_filter") is True


# ---------------------------------------------------------------------------
# AC-7.10.3 — Trusted Contacts
# ---------------------------------------------------------------------------

class TestTrustedContacts:
    """Manage up to N trusted contacts; verify notification & location sharing."""

    MAX_TRUSTED_CONTACTS = 5  # PRD limit

    @pytest.mark.asyncio
    async def test_add_trusted_contact(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == SAMPLE_TRUSTED_CONTACT["name"]
        assert "id" in body

    @pytest.mark.asyncio
    async def test_list_trusted_contacts(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
            resp = await client.get(
                f"/api/v1/users/{user_id}/trusted-contacts",
                headers=auth_headers,
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_max_trusted_contacts_enforced(self, user_id, auth_headers):
        """Adding more than MAX contacts returns 409/422."""
        async with AsyncClient(base_url=BASE_URL) as client:
            for i in range(self.MAX_TRUSTED_CONTACTS):
                tc = {**SAMPLE_TRUSTED_CONTACT, "email": f"ec{i}@example.com",
                      "phone": f"+2348{i:08d}"}
                await client.post(
                    f"/api/v1/users/{user_id}/trusted-contacts",
                    json=tc,
                    headers=auth_headers,
                )
            # One more should fail
            overflow = {**SAMPLE_TRUSTED_CONTACT, "email": "overflow@example.com",
                        "phone": "+2349099999999"}
            resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=overflow,
                headers=auth_headers,
            )
        assert resp.status_code in (409, 422)

    @pytest.mark.asyncio
    async def test_delete_trusted_contact(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            create_resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
            contact_id = create_resp.json()["id"]
            del_resp = await client.delete(
                f"/api/v1/users/{user_id}/trusted-contacts/{contact_id}",
                headers=auth_headers,
            )
        assert del_resp.status_code == 204

    @pytest.mark.asyncio
    async def test_trusted_contact_location_sharing_flag(self, user_id, auth_headers):
        """can_see_location flag is stored and returned."""
        async with AsyncClient(base_url=BASE_URL) as client:
            tc_data = {**SAMPLE_TRUSTED_CONTACT, "can_see_location": True}
            resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=tc_data,
                headers=auth_headers,
            )
        assert resp.json()["can_see_location"] is True

    @pytest.mark.asyncio
    async def test_duplicate_contact_rejected(self, user_id, auth_headers):
        """Adding a contact with same phone/email twice returns conflict."""
        async with AsyncClient(base_url=BASE_URL) as client:
            await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
            resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_contact_notification_preference_stored(self, user_id, auth_headers):
        """notify_on_sos preference is stored correctly."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json={**SAMPLE_TRUSTED_CONTACT, "notify_on_sos": True},
                headers=auth_headers,
            )
        assert resp.json()["notify_on_sos"] is True


# ---------------------------------------------------------------------------
# AC-7.10.4 — Meetup Check-In / Check-Out
# ---------------------------------------------------------------------------

SAMPLE_MEETUP = {
    "location_name": "Stadium Gate 3",
    "latitude": 6.4541,
    "longitude": 3.3947,
    "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
    "participants": [],
}


class TestMeetupCheckInOut:
    """Verify scheduled meetup creation, check-in, check-out, and missed-meetup alerts."""

    @pytest.mark.asyncio
    async def test_create_meetup(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                f"/api/v1/meetups",
                json={**SAMPLE_MEETUP, "organiser_id": user_id},
                headers=auth_headers,
            )
        assert resp.status_code == 201
        body = resp.json()
        assert "id" in body
        assert body["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_checkin_meetup(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            create_resp = await client.post(
                "/api/v1/meetups",
                json={**SAMPLE_MEETUP, "organiser_id": user_id},
                headers=auth_headers,
            )
            meetup_id = create_resp.json()["id"]
            checkin_resp = await client.post(
                f"/api/v1/meetups/{meetup_id}/checkin",
                json={"latitude": 6.4541, "longitude": 3.3947},
                headers=auth_headers,
            )
        assert checkin_resp.status_code == 200
        assert checkin_resp.json()["checked_in"] is True
        assert checkin_resp.json()["checked_in_at"] is not None

    @pytest.mark.asyncio
    async def test_checkout_meetup(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            create_resp = await client.post(
                "/api/v1/meetups",
                json={**SAMPLE_MEETUP, "organiser_id": user_id},
                headers=auth_headers,
            )
            meetup_id = create_resp.json()["id"]
            await client.post(
                f"/api/v1/meetups/{meetup_id}/checkin",
                json={"latitude": 6.4541, "longitude": 3.3947},
                headers=auth_headers,
            )
            checkout_resp = await client.post(
                f"/api/v1/meetups/{meetup_id}/checkout",
                headers=auth_headers,
            )
        assert checkout_resp.status_code == 200
        assert checkout_resp.json()["checked_out"] is True

    @pytest.mark.asyncio
    async def test_checkout_without_checkin_rejected(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            create_resp = await client.post(
                "/api/v1/meetups",
                json={**SAMPLE_MEETUP, "organiser_id": user_id},
                headers=auth_headers,
            )
            meetup_id = create_resp.json()["id"]
            resp = await client.post(
                f"/api/v1/meetups/{meetup_id}/checkout",
                headers=auth_headers,
            )
        assert resp.status_code in (400, 409)

    @pytest.mark.asyncio
    async def test_missed_meetup_triggers_alert(self, user_id, auth_headers):
        """Simulates a past-due meetup; service should flag as 'missed'."""
        past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        async with AsyncClient(base_url=BASE_URL) as client:
            create_resp = await client.post(
                "/api/v1/meetups",
                json={
                    **SAMPLE_MEETUP,
                    "organiser_id": user_id,
                    "scheduled_at": past_time,
                },
                headers=auth_headers,
            )
            meetup_id = create_resp.json()["id"]
            # Trigger the scheduler's missed-meetup check
            resp = await client.post(
                f"/api/v1/meetups/{meetup_id}/check-missed",
                headers={"Authorization": "Bearer internal_scheduler_token"},
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "missed"

    @pytest.mark.asyncio
    async def test_meetup_participants_notified_on_host_checkin(
        self, user_id, auth_headers
    ):
        """When host checks in, participants should receive a notification."""
        participant_id = str(uuid.uuid4())
        async with AsyncClient(base_url=BASE_URL) as client:
            create_resp = await client.post(
                "/api/v1/meetups",
                json={
                    **SAMPLE_MEETUP,
                    "organiser_id": user_id,
                    "participants": [participant_id],
                },
                headers=auth_headers,
            )
            meetup_id = create_resp.json()["id"]
            with patch("app.services.notification.send_push") as mock_push:
                await client.post(
                    f"/api/v1/meetups/{meetup_id}/checkin",
                    json={"latitude": 6.4541, "longitude": 3.3947},
                    headers=auth_headers,
                )
                # At least one push was attempted for the participant
                mock_push.assert_called()

    @pytest.mark.asyncio
    async def test_meetup_location_required(self, user_id, auth_headers):
        """Meetup without coordinates is rejected."""
        bad_meetup = {
            "location_name": "No Coords",
            "scheduled_at": SAMPLE_MEETUP["scheduled_at"],
            "organiser_id": user_id,
        }
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                "/api/v1/meetups",
                json=bad_meetup,
                headers=auth_headers,
            )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# AC-7.10.5 — Emergency SOS
# ---------------------------------------------------------------------------

SOS_PAYLOAD = {
    "latitude": 6.4541,
    "longitude": 3.3947,
    "message": "I feel unsafe",
}


class TestEmergencySOS:
    """Verify SOS alert creation, notification chain, and always-visible button."""

    @pytest.mark.asyncio
    async def test_sos_alert_created(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                f"/api/v1/users/{user_id}/sos",
                json=SOS_PAYLOAD,
                headers=auth_headers,
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["alert_id"] is not None
        assert body["status"] == "active"

    @pytest.mark.asyncio
    async def test_sos_notifies_trusted_contacts(self, user_id, auth_headers):
        """SOS fires notifications to all trusted contacts with notify_on_sos=True."""
        async with AsyncClient(base_url=BASE_URL) as client:
            # Add a trusted contact
            tc_resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json={**SAMPLE_TRUSTED_CONTACT, "notify_on_sos": True},
                headers=auth_headers,
            )
            assert tc_resp.status_code == 201

            with patch("app.services.notification.send_sms") as mock_sms, \
                 patch("app.services.notification.send_email") as mock_email:
                sos_resp = await client.post(
                    f"/api/v1/users/{user_id}/sos",
                    json=SOS_PAYLOAD,
                    headers=auth_headers,
                )
                assert sos_resp.status_code == 201
                mock_sms.assert_called()
                mock_email.assert_called()

    @pytest.mark.asyncio
    async def test_sos_location_included_in_notification(self, user_id, auth_headers):
        """Notification payload contains GPS coords."""
        async with AsyncClient(base_url=BASE_URL) as client:
            with patch("app.services.notification.send_sms") as mock_sms:
                await client.post(
                    f"/api/v1/users/{user_id}/sos",
                    json=SOS_PAYLOAD,
                    headers=auth_headers,
                )
                if mock_sms.called:
                    call_kwargs = mock_sms.call_args
                    msg = str(call_kwargs)
                    assert "6.4541" in msg or "location" in msg.lower()

    @pytest.mark.asyncio
    async def test_sos_notifies_platform_safety_team(self, user_id, auth_headers):
        """SOS also alerts RoarPass internal safety team."""
        async with AsyncClient(base_url=BASE_URL) as client:
            with patch("app.services.safety_team.notify") as mock_team:
                resp = await client.post(
                    f"/api/v1/users/{user_id}/sos",
                    json=SOS_PAYLOAD,
                    headers=auth_headers,
                )
                assert resp.status_code == 201
                mock_team.assert_called_once()

    @pytest.mark.asyncio
    async def test_sos_unauthenticated_still_accepted(self):
        """SOS must be reachable even without auth (panic scenario)."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                "/api/v1/sos/anonymous",
                json={**SOS_PAYLOAD, "reporter_description": "Fan in red shirt"},
            )
        # Should be 201 or 200 — NOT 401/403
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_sos_resolve(self, user_id, auth_headers):
        """User or admin can mark SOS as resolved."""
        async with AsyncClient(base_url=BASE_URL) as client:
            sos_resp = await client.post(
                f"/api/v1/users/{user_id}/sos",
                json=SOS_PAYLOAD,
                headers=auth_headers,
            )
            alert_id = sos_resp.json()["alert_id"]
            resolve_resp = await client.patch(
                f"/api/v1/sos/{alert_id}/resolve",
                json={"resolution_note": "User confirmed safe"},
                headers=auth_headers,
            )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["status"] == "resolved"

    @pytest.mark.asyncio
    async def test_sos_without_location_accepted(self, user_id, auth_headers):
        """SOS should still be accepted if GPS is unavailable."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                f"/api/v1/users/{user_id}/sos",
                json={"message": "I need help, no GPS"},
                headers=auth_headers,
            )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_sos_rate_limiting_not_blocking_genuine(self, user_id, auth_headers):
        """Back-to-back SOS from same user in emergency are accepted (not rate-limited
        to zero within a reasonable burst window)."""
        async with AsyncClient(base_url=BASE_URL) as client:
            resp1 = await client.post(
                f"/api/v1/users/{user_id}/sos",
                json=SOS_PAYLOAD,
                headers=auth_headers,
            )
            resp2 = await client.post(
                f"/api/v1/users/{user_id}/sos",
                json=SOS_PAYLOAD,
                headers=auth_headers,
            )
        # Both should succeed or second de-duplicates to existing alert (200/201)
        assert resp1.status_code in (200, 201)
        assert resp2.status_code in (200, 201, 409)  # 409 = already active SOS


# ---------------------------------------------------------------------------
# Location Sharing (live & scheduled)
# ---------------------------------------------------------------------------

class TestLocationSharing:
    """Real-time and scheduled location sharing with trusted contacts."""

    @pytest.mark.asyncio
    async def test_start_location_sharing(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            tc_resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
            contact_id = tc_resp.json()["id"]
            resp = await client.post(
                f"/api/v1/users/{user_id}/location-sharing",
                json={
                    "contact_ids": [contact_id],
                    "duration_minutes": 120,
                    "reason": "stadium_day",
                },
                headers=auth_headers,
            )
        assert resp.status_code in (200, 201)
        body = resp.json()
        assert body["sharing_active"] is True
        assert body["expires_at"] is not None

    @pytest.mark.asyncio
    async def test_stop_location_sharing(self, user_id, auth_headers):
        async with AsyncClient(base_url=BASE_URL) as client:
            tc_resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json=SAMPLE_TRUSTED_CONTACT,
                headers=auth_headers,
            )
            contact_id = tc_resp.json()["id"]
            start_resp = await client.post(
                f"/api/v1/users/{user_id}/location-sharing",
                json={"contact_ids": [contact_id], "duration_minutes": 60},
                headers=auth_headers,
            )
            session_id = start_resp.json()["session_id"]
            stop_resp = await client.delete(
                f"/api/v1/users/{user_id}/location-sharing/{session_id}",
                headers=auth_headers,
            )
        assert stop_resp.status_code in (200, 204)

    @pytest.mark.asyncio
    async def test_location_not_shared_without_consent(self, user_id, auth_headers):
        """Contacts without can_see_location=True cannot see location."""
        async with AsyncClient(base_url=BASE_URL) as client:
            tc_resp = await client.post(
                f"/api/v1/users/{user_id}/trusted-contacts",
                json={**SAMPLE_TRUSTED_CONTACT, "can_see_location": False},
                headers=auth_headers,
            )
            contact_id = tc_resp.json()["id"]
            resp = await client.post(
                f"/api/v1/users/{user_id}/location-sharing",
                json={"contact_ids": [contact_id], "duration_minutes": 60},
                headers=auth_headers,
            )
        # Either rejected or sharing is marked as 'no_permission'
        if resp.status_code == 200:
            assert resp.json().get("contacts_with_permission_denied") == [contact_id]
        else:
            assert resp.status_code in (400, 403)