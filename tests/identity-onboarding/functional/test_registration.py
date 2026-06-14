"""
Functional tests for User Registration flows.
PRD refs: 5.3, 6, 7.2.1
Covers: email/phone/OAuth registration, validation, GDPR consent, duplicate detection.
"""
import pytest
import re
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from tests.identity_onboarding.helpers.fixtures import (
    api_client, db_session, redis_client, mock_email_service,
    mock_sms_service, mock_oauth_provider, seed_events,
    valid_registration_payload, valid_phone_payload
)
from tests.identity_onboarding.helpers.assertions import (
    assert_jwt_structure, assert_profile_shape, assert_gdpr_fields,
    assert_no_pii_in_logs, assert_password_not_stored_plaintext
)


# ---------------------------------------------------------------------------
# 1. Email Registration
# ---------------------------------------------------------------------------

class TestEmailRegistration:
    """AC: User can register with email + password; receives verification email."""

    def test_email_registration_success(self, api_client, db_session, mock_email_service):
        payload = valid_registration_payload()
        response = api_client.post("/api/v1/auth/register", json=payload)

        assert response.status_code == 201
        body = response.json()

        # Profile shape
        assert_profile_shape(body["profile"])
        assert body["profile"]["email"] == payload["email"].lower()
        assert body["profile"]["emailVerified"] is False

        # JWT issued but scoped to unverified
        assert_jwt_structure(body["token"])
        assert body["token"]["scope"] == "unverified"

        # Verification email dispatched
        mock_email_service.send_verification.assert_called_once_with(
            to=payload["email"].lower(),
            locale=payload.get("locale", "en"),
        )

    def test_email_normalised_to_lowercase(self, api_client):
        payload = valid_registration_payload(email="UPPER@Example.COM")
        response = api_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 201
        assert response.json()["profile"]["email"] == "upper@example.com"

    def test_duplicate_email_returns_409(self, api_client, db_session):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        response = api_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

    def test_weak_password_rejected(self, api_client):
        payload = valid_registration_payload(password="short")
        response = api_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422
        errors = response.json()["error"]["fields"]
        assert any(f["field"] == "password" for f in errors)

    def test_invalid_email_format_rejected(self, api_client):
        payload = valid_registration_payload(email="not-an-email")
        response = api_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422

    def test_password_not_stored_plaintext(self, api_client, db_session):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        assert_password_not_stored_plaintext(db_session, payload["email"], payload["password"])

    def test_gdpr_consent_required(self, api_client):
        payload = valid_registration_payload()
        payload.pop("gdprConsent", None)
        response = api_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422
        errors = response.json()["error"]["fields"]
        assert any(f["field"] == "gdprConsent" for f in errors)

    def test_gdpr_consent_false_rejected(self, api_client):
        payload = valid_registration_payload(gdprConsent=False)
        response = api_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422

    def test_gdpr_fields_persisted(self, api_client, db_session):
        payload = valid_registration_payload()
        response = api_client.post("/api/v1/auth/register", json=payload)
        profile_id = response.json()["profile"]["id"]
        assert_gdpr_fields(db_session, profile_id)

    def test_no_pii_in_response_beyond_profile(self, api_client):
        payload = valid_registration_payload()
        response = api_client.post("/api/v1/auth/register", json=payload)
        body_str = str(response.json())
        assert payload["password"] not in body_str

    def test_rate_limiting_registration(self, api_client):
        """Max 10 registrations per IP per minute."""
        payload = valid_registration_payload()
        responses = []
        for i in range(12):
            p = valid_registration_payload(email=f"user{i}@test.com")
            responses.append(api_client.post("/api/v1/auth/register", json=p))
        rate_limited = [r for r in responses if r.status_code == 429]
        assert len(rate_limited) >= 1

    def test_email_verification_flow(self, api_client, db_session, mock_email_service):
        payload = valid_registration_payload()
        reg = api_client.post("/api/v1/auth/register", json=payload)
        token = mock_email_service.last_verification_token()
        verify_resp = api_client.get(f"/api/v1/auth/verify-email?token={token}")
        assert verify_resp.status_code == 200
        assert verify_resp.json()["profile"]["emailVerified"] is True

    def test_expired_verification_token_rejected(self, api_client, mock_email_service):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        expired_token = mock_email_service.last_verification_token(expired=True)
        resp = api_client.get(f"/api/v1/auth/verify-email?token={expired_token}")
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


# ---------------------------------------------------------------------------
# 2. Phone Registration
# ---------------------------------------------------------------------------

class TestPhoneRegistration:
    """AC: User can register with phone number; receives OTP via SMS."""

    def test_phone_registration_initiates_otp(self, api_client, mock_sms_service):
        payload = valid_phone_payload()
        response = api_client.post("/api/v1/auth/register/phone", json=payload)
        assert response.status_code == 202
        assert response.json()["status"] == "OTP_SENT"
        mock_sms_service.send_otp.assert_called_once()

    def test_otp_verification_completes_registration(self, api_client, db_session, mock_sms_service):
        payload = valid_phone_payload()
        api_client.post("/api/v1/auth/register/phone", json=payload)
        otp = mock_sms_service.last_otp()
        verify_resp = api_client.post("/api/v1/auth/register/phone/verify", json={
            "phone": payload["phone"],
            "otp": otp,
            "gdprConsent": True,
            "displayName": "Tester",
        })
        assert verify_resp.status_code == 201
        body = verify_resp.json()
        assert_profile_shape(body["profile"])
        assert body["profile"]["phoneVerified"] is True

    def test_wrong_otp_rejected(self, api_client, mock_sms_service):
        payload = valid_phone_payload()
        api_client.post("/api/v1/auth/register/phone", json=payload)
        resp = api_client.post("/api/v1/auth/register/phone/verify", json={
            "phone": payload["phone"],
            "otp": "000000",
            "gdprConsent": True,
            "displayName": "Tester",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_OTP"

    def test_otp_max_attempts_lockout(self, api_client, mock_sms_service):
        payload = valid_phone_payload()
        api_client.post("/api/v1/auth/register/phone", json=payload)
        for _ in range(5):
            api_client.post("/api/v1/auth/register/phone/verify", json={
                "phone": payload["phone"], "otp": "000000",
                "gdprConsent": True, "displayName": "Tester",
            })
        resp = api_client.post("/api/v1/auth/register/phone/verify", json={
            "phone": payload["phone"], "otp": "000000",
            "gdprConsent": True, "displayName": "Tester",
        })
        assert resp.status_code == 429

    def test_duplicate_phone_returns_409(self, api_client, db_session, mock_sms_service):
        payload = valid_phone_payload()
        api_client.post("/api/v1/auth/register/phone", json=payload)
        otp = mock_sms_service.last_otp()
        api_client.post("/api/v1/auth/register/phone/verify", json={
            "phone": payload["phone"], "otp": otp,
            "gdprConsent": True, "displayName": "Tester",
        })
        # Attempt re-registration
        api_client.post("/api/v1/auth/register/phone", json=payload)
        otp2 = mock_sms_service.last_otp()
        resp = api_client.post("/api/v1/auth/register/phone/verify", json={
            "phone": payload["phone"], "otp": otp2,
            "gdprConsent": True, "displayName": "Tester",
        })
        assert resp.status_code == 409

    def test_e164_phone_normalisation(self, api_client, mock_sms_service):
        for fmt in ["+447911123456", "07911123456", "447911123456"]:
            payload = valid_phone_payload(phone=fmt)
            resp = api_client.post("/api/v1/auth/register/phone", json=payload)
            # All should normalise — 202 or 409 (already registered)
            assert resp.status_code in (202, 409)


# ---------------------------------------------------------------------------
# 3. OAuth Registration / Login
# ---------------------------------------------------------------------------

class TestOAuthRegistration:
    """AC: User can register/login via Google, Apple, Facebook."""

    @pytest.mark.parametrize("provider", ["google", "apple", "facebook"])
    def test_oauth_initiation_redirects(self, api_client, provider):
        resp = api_client.get(f"/api/v1/auth/oauth/{provider}", allow_redirects=False)
        assert resp.status_code == 302
        assert "state=" in resp.headers["Location"]

    @pytest.mark.parametrize("provider", ["google", "apple", "facebook"])
    def test_oauth_callback_creates_profile(self, api_client, db_session, mock_oauth_provider, provider):
        state = api_client.get(
            f"/api/v1/auth/oauth/{provider}", allow_redirects=False
        ).headers["Location"].split("state=")[1].split("&")[0]

        mock_oauth_provider.configure(provider, email=f"oauth_{provider}@test.com")
        resp = api_client.get(f"/api/v1/auth/oauth/{provider}/callback?code=AUTHCODE&state={state}")
        assert resp.status_code in (200, 201)
        body = resp.json()
        assert_profile_shape(body["profile"])
        assert body["profile"]["oauthProvider"] == provider

    def test_oauth_existing_email_links_account(self, api_client, db_session, mock_oauth_provider):
        """If email already exists via email registration, OAuth should link not duplicate."""
        email = "shared@test.com"
        api_client.post("/api/v1/auth/register", json=valid_registration_payload(email=email))

        mock_oauth_provider.configure("google", email=email)
        state = api_client.get("/api/v1/auth/oauth/google", allow_redirects=False).headers["Location"].split("state=")[1].split("&")[0]
        resp = api_client.get(f"/api/v1/auth/oauth/google/callback?code=AUTHCODE&state={state}")
        assert resp.status_code == 200
        # Same profile id
        profile = resp.json()["profile"]
        db_count = db_session.execute(
            "SELECT COUNT(*) FROM fan_profiles WHERE email = :e", {"e": email}
        ).scalar()
        assert db_count == 1

    def test_oauth_state_csrf_protection(self, api_client, mock_oauth_provider):
        mock_oauth_provider.configure("google", email="csrf@test.com")
        resp = api_client.get("/api/v1/auth/oauth/google/callback?code=AUTHCODE&state=INVALID_STATE")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "INVALID_OAUTH_STATE"

    def test_oauth_provider_returns_no_email(self, api_client, mock_oauth_provider):
        """Edge case: provider doesn't return email (Apple private relay)."""
        mock_oauth_provider.configure("apple", email=None, sub="apple_sub_123")
        state = api_client.get("/api/v1/auth/oauth/apple", allow_redirects=False).headers["Location"].split("state=")[1].split("&")[0]
        resp = api_client.get(f"/api/v1/auth/oauth/apple/callback?code=AUTHCODE&state={state}")
        # Should still create profile using sub as identifier
        assert resp.status_code in (200, 201)
        assert resp.json()["profile"]["id"] is not None


# ---------------------------------------------------------------------------
# 4. Login
# ---------------------------------------------------------------------------

class TestLogin:
    """AC: Registered users can log in; JWT issued with correct claims."""

    def test_email_login_success(self, api_client, db_session, mock_email_service):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        token = mock_email_service.last_verification_token()
        api_client.get(f"/api/v1/auth/verify-email?token={token}")

        resp = api_client.post("/api/v1/auth/login", json={
            "email": payload["email"],
            "password": payload["password"],
        })
        assert resp.status_code == 200
        assert_jwt_structure(resp.json()["token"])
        assert resp.json()["token"]["scope"] == "verified"

    def test_wrong_password_returns_401(self, api_client):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        resp = api_client.post("/api/v1/auth/login", json={
            "email": payload["email"],
            "password": "WrongPassword!99",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"

    def test_unverified_email_login_limited_scope(self, api_client):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        resp = api_client.post("/api/v1/auth/login", json={
            "email": payload["email"],
            "password": payload["password"],
        })
        assert resp.status_code == 200
        assert resp.json()["token"]["scope"] == "unverified"

    def test_brute_force_lockout(self, api_client, db_session, mock_email_service):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        for _ in range(10):
            api_client.post("/api/v1/auth/login", json={
                "email": payload["email"], "password": "Wrong!Pass1",
            })
        resp = api_client.post("/api/v1/auth/login", json={
            "email": payload["email"], "password": payload["password"],
        })
        assert resp.status_code == 429
        assert resp.json()["error"]["code"] == "ACCOUNT_LOCKED"

    def test_token_refresh(self, api_client, db_session, mock_email_service):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        token = mock_email_service.last_verification_token()
        api_client.get(f"/api/v1/auth/verify-email?token={token}")
        login = api_client.post("/api/v1/auth/login", json={
            "email": payload["email"], "password": payload["password"],
        })
        refresh_token = login.json()["token"]["refreshToken"]
        resp = api_client.post("/api/v1/auth/token/refresh", json={"refreshToken": refresh_token})
        assert resp.status_code == 200
        assert_jwt_structure(resp.json()["token"])

    def test_logout_invalidates_token(self, api_client, db_session, mock_email_service):
        payload = valid_registration_payload()
        api_client.post("/api/v1/auth/register", json=payload)
        token = mock_email_service.last_verification_token()
        api_client.get(f"/api/v1/auth/verify-email?token={token}")
        login = api_client.post("/api/v1/auth/login", json={
            "email": payload["email"], "password": payload["password"],
        })
        access_token = login.json()["token"]["accessToken"]
        api_client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {access_token}"})
        # Attempt to use invalidated token
        resp = api_client.get("/api/v1/profile/me", headers={"Authorization": f"Bearer {access_token}"})
        assert resp.status_code == 401