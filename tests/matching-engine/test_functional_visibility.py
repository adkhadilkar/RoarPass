"""
Functional tests — PRD 7.9.1 / 7.9.2
Opt-in visibility controls: public / connections-only / private.
"""

import pytest
import httpx
from conftest import _auth_headers, _seed_user, _login, BASE_URL


# ─── 7.9.1 — Visibility Settings ──────────────────────────────────────────────

class TestVisibilitySettings:

    def test_default_visibility_is_connections_only(self, http, fan_alice):
        """
        AC-7.9.1-A: A freshly created user without explicit setting has
        visibility=connections_only, not public.
        """
        new_user = _seed_user(http, {"visibility": None})  # no override → server default
        token = _login(http, new_user["email"], "T3stP@ssword!")
        resp = http.get("/me/privacy", headers=_auth_headers(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["discovery_visibility"] in ("connections_only", "private"), (
            "Default visibility must be 'connections_only' or 'private' for GDPR compliance, "
            f"got: {body['discovery_visibility']}"
        )

    def test_user_can_set_visibility_public(self, http, fan_alice):
        """AC-7.9.1-B: User sets visibility to public and it persists."""
        resp = http.patch(
            "/me/privacy",
            headers=_auth_headers(fan_alice["token"]),
            json={"discovery_visibility": "public"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["discovery_visibility"] == "public"

        # Verify persistence
        resp2 = http.get("/me/privacy", headers=_auth_headers(fan_alice["token"]))
        assert resp2.json()["discovery_visibility"] == "public"

    def test_user_can_set_visibility_private(self, http, fan_private):
        """AC-7.9.1-C: User sets visibility to private and it persists."""
        resp = http.patch(
            "/me/privacy",
            headers=_auth_headers(fan_private["token"]),
            json={"discovery_visibility": "private"},
        )
        assert resp.status_code == 200
        assert resp.json()["discovery_visibility"] == "private"

    def test_invalid_visibility_value_rejected(self, http, fan_alice):
        """AC-7.9.1-D: Invalid enum value returns 422."""
        resp = http.patch(
            "/me/privacy",
            headers=_auth_headers(fan_alice["token"]),
            json={"discovery_visibility": "everyone_can_see_me_lol"},
        )
        assert resp.status_code == 422

    def test_visibility_update_requires_auth(self, http):
        """AC-7.9.1-E: Unauthenticated PATCH to /me/privacy returns 401."""
        resp = http.patch(
            "/me/privacy",
            json={"discovery_visibility": "public"},
        )
        assert resp.status_code == 401

    def test_connections_only_visible_to_connections_not_strangers(
        self, http, fan_alice, fan_charlie
    ):
        """
        AC-7.9.1-F: A user with visibility=connections_only must NOT appear
        in fan_charlie's suggestions when they share no connection.
        """
        # Set Alice to connections_only temporarily
        http.patch(
            "/me/privacy",
            headers=_auth_headers(fan_alice["token"]),
            json={"discovery_visibility": "connections_only"},
        )
        resp = http.get(
            "/matching/suggestions",
            headers=_auth_headers(fan_charlie["token"]),
            params={"limit": 50},
        )
        assert resp.status_code == 200
        ids = [s["user_id"] for s in resp.json()["suggestions"]]
        assert fan_alice["id"] not in ids, (
            "connections_only user must not appear in stranger's suggestions"
        )
        # Restore public for subsequent tests
        http.patch(
            "/me/privacy",
            headers=_auth_headers(fan_alice["token"]),
            json={"discovery_visibility": "public"},
        )


# ─── 7.9.2 — Private fans never surface ───────────────────────────────────────

class TestPrivacyExclusion:

    def test_private_fan_excluded_from_all_suggestions(
        self, http, enrolled_fans, fan_alice
    ):
        """
        AC-7.9.2-A: fan_private has visibility=private.
        Must never appear in any other user's suggestion list,
        even when enrolled in the same event.
        """
        resp = http.get(
            "/matching/suggestions",
            headers=_auth_headers(fan_alice["token"]),
            params={"limit": 100},
        )
        assert resp.status_code == 200
        ids = [s["user_id"] for s in resp.json()["suggestions"]]
        assert enrolled_fans["private"]["id"] not in ids, (
            "Private fan must be excluded from all suggestion responses"
        )

    def test_private_fan_excluded_from_event_attendee_list(
        self, http, enrolled_fans, fan_alice
    ):
        """
        AC-7.9.2-B: Event attendee discovery must also exclude private fans.
        """
        event_id = enrolled_fans["event_id"]
        resp = http.get(
            f"/events/{event_id}/fans",
            headers=_auth_headers(fan_alice["token"]),
        )
        assert resp.status_code == 200
        ids = [a["user_id"] for a in resp.json()["attendees"]]
        assert enrolled_fans["private"]["id"] not in ids, (
            "Private fan must not be listed in public event attendee list"
        )

    def test_private_fan_profile_not_directly_fetchable_by_stranger(
        self, http, fan_private, fan_charlie
    ):
        """
        AC-7.9.2-C: Direct profile fetch of private fan by a stranger must
        return 403 or a redacted profile (no PII).
        """
        resp = http.get(
            f"/users/{fan_private['id']}/profile",
            headers=_auth_headers(fan_charlie["token"]),
        )
        if resp.status_code == 200:
            body = resp.json()
            # If 200, profile must be fully redacted
            assert body.get("email") is None, "Email must not be exposed for private fan"
            assert body.get("home_city") is None, "Home city must not be exposed for private fan"
            assert body.get("discovery_visibility") != "private" or body.get("redacted") is True
        else:
            assert resp.status_code == 403, (
                f"Expected 403 for private profile access by stranger, got {resp.status_code}"
            )

    def test_private_fan_own_profile_fully_visible(self, http, fan_private):
        """
        AC-7.9.2-D: Private fan can view their own full profile.
        """
        resp = http.get("/me/profile", headers=_auth_headers(fan_private["token"]))
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == fan_private["id"]
        assert body.get("display_name") is not None