"""
Functional tests: Business Partner Portal — Registration & Verification
PRD refs: 6.5, 7.11.1
Covers: partner onboarding, document upload, verification state machine,
        trust-tier linkage (dependency: verification-trust-tiers)
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, AsyncMock
from typing import Generator

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def partner_payload() -> dict:
    """Minimal valid business partner registration payload."""
    uid = uuid.uuid4().hex[:8]
    return {
        "business_name": f"Fußball Bistro {uid}",
        "legal_name": f"Fußball Bistro GmbH {uid}",
        "country_code": "DE",
        "city": "Munich",
        "business_type": "restaurant",
        "contact_email": f"owner_{uid}@fb-bistro.de",
        "contact_phone": "+4989123456",
        "website": f"https://fb-bistro-{uid}.de",
        "languages_spoken": ["de", "en"],
        "vat_number": f"DE{uid[:9]}",
        "registration_number": f"HRB{uid[:6]}",
    }


@pytest.fixture
def unverified_partner(partner_payload, fake_db):
    """Creates a partner record in PENDING state."""
    partner = fake_db.partners.create(
        **partner_payload,
        status="pending",
        trust_tier=None,
        created_at=datetime.utcnow(),
    )
    return partner


@pytest.fixture
def verified_partner(unverified_partner, fake_db):
    """Advances partner to VERIFIED state with tier 2."""
    fake_db.partners.update(
        unverified_partner.id,
        status="verified",
        trust_tier=2,
        verified_at=datetime.utcnow(),
    )
    return fake_db.partners.get(unverified_partner.id)


@pytest.fixture
def fake_db():
    """In-memory fake DB for unit-level tests."""
    from tests.helpers.fake_db import FakeDB
    return FakeDB()


@pytest.fixture
def api_client(fake_db):
    from tests.helpers.test_app import build_test_app
    app = build_test_app(db=fake_db)
    from starlette.testclient import TestClient
    return TestClient(app)


# ---------------------------------------------------------------------------
# AC-15.1  Partner registration form submits successfully
# ---------------------------------------------------------------------------

class TestPartnerRegistration:

    def test_register_new_partner_returns_201(self, api_client, partner_payload):
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert "partner_id" in body
        assert body["status"] == "pending"

    def test_register_duplicate_email_returns_409(self, api_client, partner_payload):
        api_client.post("/api/v1/partners/register", json=partner_payload)
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    def test_register_missing_required_field_returns_422(self, api_client, partner_payload):
        del partner_payload["business_name"]
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        assert resp.status_code == 422

    def test_register_invalid_country_code_returns_422(self, api_client, partner_payload):
        partner_payload["country_code"] = "XX"
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        assert resp.status_code == 422

    def test_register_invalid_email_returns_422(self, api_client, partner_payload):
        partner_payload["contact_email"] = "not-an-email"
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        assert resp.status_code == 422

    def test_register_xss_in_business_name_is_sanitised(self, api_client, partner_payload):
        partner_payload["business_name"] = "<script>alert(1)</script>Bar"
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        if resp.status_code == 201:
            body = resp.json()
            assert "<script>" not in body.get("business_name", "")

    def test_register_sql_injection_in_vat_is_rejected(self, api_client, partner_payload):
        partner_payload["vat_number"] = "'; DROP TABLE partners; --"
        resp = api_client.post("/api/v1/partners/register", json=partner_payload)
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# AC-15.2  Document upload & verification state machine
# ---------------------------------------------------------------------------

class TestPartnerVerification:

    def test_upload_document_accepted(self, api_client, unverified_partner):
        resp = api_client.post(
            f"/api/v1/partners/{unverified_partner.id}/documents",
            files={"file": ("business_license.pdf", b"%PDF-1.4 fake", "application/pdf")},
            data={"doc_type": "business_license"},
        )
        assert resp.status_code == 200
        assert resp.json()["doc_status"] == "under_review"

    def test_upload_oversized_document_rejected(self, api_client, unverified_partner):
        big_file = b"0" * (11 * 1024 * 1024)  # 11 MB > 10 MB limit
        resp = api_client.post(
            f"/api/v1/partners/{unverified_partner.id}/documents",
            files={"file": ("huge.pdf", big_file, "application/pdf")},
            data={"doc_type": "business_license"},
        )
        assert resp.status_code == 413

    def test_upload_unsupported_mime_rejected(self, api_client, unverified_partner):
        resp = api_client.post(
            f"/api/v1/partners/{unverified_partner.id}/documents",
            files={"file": ("script.exe", b"MZ", "application/octet-stream")},
            data={"doc_type": "business_license"},
        )
        assert resp.status_code == 415

    def test_pending_to_verified_transition(self, api_client, unverified_partner, fake_db):
        """Admin approves → status becomes verified, trust_tier assigned."""
        resp = api_client.post(
            f"/api/v1/admin/partners/{unverified_partner.id}/verify",
            json={"trust_tier": 2},
            headers={"X-Admin-Token": "test-admin-secret"},
        )
        assert resp.status_code == 200
        partner = fake_db.partners.get(unverified_partner.id)
        assert partner.status == "verified"
        assert partner.trust_tier == 2

    def test_verified_to_suspended_transition(self, api_client, verified_partner, fake_db):
        resp = api_client.post(
            f"/api/v1/admin/partners/{verified_partner.id}/suspend",
            json={"reason": "policy_violation"},
            headers={"X-Admin-Token": "test-admin-secret"},
        )
        assert resp.status_code == 200
        partner = fake_db.partners.get(verified_partner.id)
        assert partner.status == "suspended"

    def test_suspended_partner_listing_hidden(self, api_client, verified_partner, fake_db):
        fake_db.partners.update(verified_partner.id, status="suspended")
        resp = api_client.get("/api/v1/partners", params={"country_code": "DE"})
        ids = [p["id"] for p in resp.json()["results"]]
        assert verified_partner.id not in ids

    def test_trust_tier_linkage_propagated_to_community(
        self, api_client, unverified_partner, fake_db
    ):
        """Verifying a partner updates the country community's partner list."""
        fake_db.communities.seed(country_code="DE", slug="germany-fans")
        api_client.post(
            f"/api/v1/admin/partners/{unverified_partner.id}/verify",
            json={"trust_tier": 3},
            headers={"X-Admin-Token": "test-admin-secret"},
        )
        community = fake_db.communities.get_by_slug("germany-fans")
        assert unverified_partner.id in community.verified_partner_ids

    def test_verification_email_sent_on_approval(self, api_client, unverified_partner):
        with patch("app.services.email.send_email") as mock_email:
            api_client.post(
                f"/api/v1/admin/partners/{unverified_partner.id}/verify",
                json={"trust_tier": 1},
                headers={"X-Admin-Token": "test-admin-secret"},
            )
            mock_email.assert_called_once()
            call_kwargs = mock_email.call_args.kwargs
            assert call_kwargs["template"] == "partner_verified"
            assert call_kwargs["to"] == unverified_partner.contact_email