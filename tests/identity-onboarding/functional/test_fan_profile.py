"""
Functional tests for Fan Profile management.
PRD refs: 5.3, 7.2.2
Covers: profile CRUD, avatar upload, display name, locale/timezone, privacy settings.
"""
import pytest

from tests.identity_onboarding.helpers.fixtures import (
    api_client, db_session, authenticated_client, seed_user,
    seed_events
)
from tests.identity_onboarding.helpers.assertions import (
    assert_profile_shape, assert_gdpr_fields
)


class TestFanProfileRead:

    def test_get_own_profile(self, authenticated_client):
        resp = authenticated_client.get("/api/v1/profile/me")
        assert resp.status_code == 200
        assert_profile_shape(resp.json())

    def test_get_own_profile_unauthenticated_returns_401(self, api_client):
        resp = api_client.get("/api/v1/profile/me")
        assert resp.status_code == 401

    def test_get_public_profile_by_id(self, api_client, seed_user):
        resp = api_client.get(f"/api/v1/profile/{seed_user['id']}/public")
        assert resp.status_code == 200
        body = resp.json()
        # Public profile should not expose PII
        assert "email" not in body
        assert "phone" not in body
        assert "displayName" in body

    def test_private_profile_not_exposed_without_auth(self, api_client, seed_user):
        """If user has set profile to private, public endpoint returns 404 or minimal data."""
        # Seed a private user via DB
        resp = api_client.get(f"/api/v1/profile/{seed_user['private_id']}/public")
        assert resp.status_code in (404, 200)
        if resp.status_code == 200:
            # Must not expose identifying fields
            assert "email" not in resp.json()


class TestFanProfileUpdate:

    def test_update_display_name(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={"displayName": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "New Name"

    def test_display_name_max_length(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={"displayName": "A" * 65})
        assert resp.status_code == 422

    def test_update_locale(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={"locale": "ar-SA"})
        assert resp.status_code == 200
        assert resp.json()["locale"] == "ar-SA"

    def test_invalid_locale_rejected(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={"locale": "xx-ZZ-INVALID"})
        assert resp.status_code == 422

    def test_update_timezone(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={"timezone": "America/New_York"})
        assert resp.status_code == 200

    def test_update_favourite_teams(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={
            "favouriteTeams": ["BRA", "ARG", "ENG"]
        })
        assert resp.status_code == 200
        assert set(resp.json()["favouriteTeams"]) == {"BRA", "ARG", "ENG"}

    def test_favourite_teams_max_10(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={
            "favouriteTeams": [f"T{i:02d}" for i in range(11)]
        })
        assert resp.status_code == 422

    def test_update_bio(self, authenticated_client):
        bio = "Football fan since 1990, been to 3 World Cups!"
        resp = authenticated_client.patch("/api/v1/profile/me", json={"bio": bio})
        assert resp.status_code == 200
        assert resp.json()["bio"] == bio

    def test_bio_max_length(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={"bio": "x" * 501})
        assert resp.status_code == 422

    def test_cannot_update_another_users_profile(self, authenticated_client, seed_user):
        resp = authenticated_client.patch(
            f"/api/v1/profile/{seed_user['id']}",
            json={"displayName": "Hacked"}
        )
        assert resp.status_code in (403, 404)

    def test_update_privacy_settings(self, authenticated_client):
        resp = authenticated_client.patch("/api/v1/profile/me", json={
            "privacySettings": {
                "profileVisibility": "friends",
                "showLocation": False,
                "showFavouriteTeams": True,
            }
        })
        assert resp.status_code == 200
        ps = resp.json()["privacySettings"]
        assert ps["profileVisibility"] == "friends"
        assert ps["showLocation"] is False


class TestAvatarUpload:

    def test_avatar_upload_jpeg(self, authenticated_client):
        import io
        fake_img = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)  # minimal JPEG header
        resp = authenticated_client.put(
            "/api/v1/profile/me/avatar",
            files={"avatar": ("test.jpg", fake_img, "image/jpeg")}
        )
        assert resp.status_code in (200, 202)
        assert "avatarUrl" in resp.json()

    def test_avatar_upload_non_image_rejected(self, authenticated_client):
        import io
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake content")
        resp = authenticated_client.put(
            "/api/v1/profile/me/avatar",
            files={"avatar": ("test.pdf", fake_pdf, "application/pdf")}
        )
        assert resp.status_code == 422

    def test_avatar_upload_oversized_rejected(self, authenticated_client):
        import io
        big_img = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * (6 * 1024 * 1024))  # 6MB
        resp = authenticated_client.put(
            "/api/v1/profile/me/avatar",
            files={"avatar": ("big.jpg", big_img, "image/jpeg")}
        )
        assert resp.status_code == 413

    def test_avatar_delete(self, authenticated_client):
        resp = authenticated_client.delete("/api/v1/profile/me/avatar")
        assert resp.status_code in (200, 204)


class TestProfileDataExport:
    """GDPR Article 20 - right to data portability."""

    def test_data_export_request(self, authenticated_client):
        resp = authenticated_client.post("/api/v1/profile/me/data-export")
        assert resp.status_code == 202
        assert resp.json()["status"] == "EXPORT_QUEUED"

    def test_data_deletion_request(self, authenticated_client):
        resp = authenticated_client.post("/api/v1/profile/me/delete-account")
        assert resp.status_code == 202
        assert resp.json()["status"] in ("DELETION_QUEUED", "DELETED")