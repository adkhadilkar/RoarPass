"""
Functional tests: Business Partner Portal — Sponsored Placement
PRD ref: 7.11.3
Covers: campaign creation, budget management, impression tracking,
        placement priority rules, geographic targeting, GDPR ad transparency.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock


@pytest.fixture
def fake_db():
    from tests.helpers.fake_db import FakeDB
    return FakeDB()


@pytest.fixture
def api_client(fake_db):
    from tests.helpers.test_app import build_test_app
    from starlette.testclient import TestClient
    return TestClient(build_test_app(db=fake_db))


@pytest.fixture
def verified_partner(fake_db):
    return fake_db.partners.create(
        business_name="Stadium Grill",
        country_code="QA",
        city="Doha",
        status="verified",
        trust_tier=3,
    )


@pytest.fixture
def sponsored_campaign_payload(verified_partner):
    return {
        "partner_id": verified_partner.id,
        "title": "50% off Match Day Meals",
        "description": "Show your ticket for half-price meals during WC matches.",
        "budget_usd": 500.00,
        "daily_cap_usd": 50.00,
        "start_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        "target_country_codes": ["QA"],
        "placement_type": "banner",
        "priority": 1,
    }


# ---------------------------------------------------------------------------
# AC-15.4  Sponsored placement creation & budget enforcement
# ---------------------------------------------------------------------------

class TestSponsoredPlacement:

    def test_create_campaign_returns_201(self, api_client, sponsored_campaign_payload):
        resp = api_client.post("/api/v1/partner-campaigns", json=sponsored_campaign_payload)
        assert resp.status_code == 201
        body = resp.json()
        assert "campaign_id" in body
        assert body["status"] == "pending_review"

    def test_zero_budget_rejected(self, api_client, sponsored_campaign_payload):
        sponsored_campaign_payload["budget_usd"] = 0
        resp = api_client.post("/api/v1/partner-campaigns", json=sponsored_campaign_payload)
        assert resp.status_code == 422

    def test_daily_cap_exceeds_total_budget_rejected(
        self, api_client, sponsored_campaign_payload
    ):
        sponsored_campaign_payload["daily_cap_usd"] = 1000.00  # > 500 total
        resp = api_client.post("/api/v1/partner-campaigns", json=sponsored_campaign_payload)
        assert resp.status_code == 422

    def test_end_date_before_start_date_rejected(self, api_client, sponsored_campaign_payload):
        sponsored_campaign_payload["end_date"] = (
            datetime.utcnow() - timedelta(days=1)
        ).isoformat()
        resp = api_client.post("/api/v1/partner-campaigns", json=sponsored_campaign_payload)
        assert resp.status_code == 422

    def test_unverified_partner_cannot_create_campaign(
        self, api_client, fake_db, sponsored_campaign_payload
    ):
        pending = fake_db.partners.create(
            business_name="Pending Bar", country_code="QA", status="pending", trust_tier=None
        )
        sponsored_campaign_payload["partner_id"] = pending.id
        resp = api_client.post("/api/v1/partner-campaigns", json=sponsored_campaign_payload)
        assert resp.status_code == 403

    def test_admin_approves_campaign(self, api_client, sponsored_campaign_payload, fake_db):
        create_resp = api_client.post(
            "/api/v1/partner-campaigns", json=sponsored_campaign_payload
        )
        campaign_id = create_resp.json()["campaign_id"]
        resp = api_client.post(
            f"/api/v1/admin/partner-campaigns/{campaign_id}/approve",
            headers={"X-Admin-Token": "test-admin-secret"},
        )
        assert resp.status_code == 200
        assert fake_db.campaigns.get(campaign_id).status == "active"

    def test_impression_recorded(self, api_client, fake_db, sponsored_campaign_payload):
        """Every time a campaign is served to a fan, impressions increment."""
        create_resp = api_client.post(
            "/api/v1/partner-campaigns", json=sponsored_campaign_payload
        )
        campaign_id = create_resp.json()["campaign_id"]
        fake_db.campaigns.update(campaign_id, status="active")
        resp = api_client.post(
            f"/api/v1/partner-campaigns/{campaign_id}/impression",
            json={"fan_id": "fan-abc", "placement": "home_feed"},
        )
        assert resp.status_code == 200
        assert fake_db.campaigns.get(campaign_id).impressions == 1

    def test_daily_cap_halts_delivery(self, api_client, fake_db, sponsored_campaign_payload):
        """When daily spend reaches cap, campaign yields no new impressions."""
        sponsored_campaign_payload["daily_cap_usd"] = 0.01
        create_resp = api_client.post(
            "/api/v1/partner-campaigns", json=sponsored_campaign_payload
        )
        campaign_id = create_resp.json()["campaign_id"]
        fake_db.campaigns.update(campaign_id, status="active", daily_spend_usd=0.01)
        resp = api_client.get(
            "/api/v1/partner-campaigns/serve",
            params={"fan_id": "fan-xyz", "country_code": "QA"},
        )
        ids_served = [c["campaign_id"] for c in resp.json().get("campaigns", [])]
        assert campaign_id not in ids_served

    def test_geographic_targeting_filters_correctly(
        self, api_client, fake_db, sponsored_campaign_payload
    ):
        """A QA-only campaign must not appear for a DE fan."""
        create_resp = api_client.post(
            "/api/v1/partner-campaigns", json=sponsored_campaign_payload
        )
        campaign_id = create_resp.json()["campaign_id"]
        fake_db.campaigns.update(campaign_id, status="active")
        resp = api_client.get(
            "/api/v1/partner-campaigns/serve",
            params={"fan_id": "fan-de", "country_code": "DE"},
        )
        ids_served = [c["campaign_id"] for c in resp.json().get("campaigns", [])]
        assert campaign_id not in ids_served

    def test_gdpr_ad_label_present_in_response(
        self, api_client, fake_db, sponsored_campaign_payload
    ):
        """GDPR Art.6(1)(a) — sponsored content must be labelled."""
        create_resp = api_client.post(
            "/api/v1/partner-campaigns", json=sponsored_campaign_payload
        )
        campaign_id = create_resp.json()["campaign_id"]
        fake_db.campaigns.update(campaign_id, status="active")
        resp = api_client.get(
            "/api/v1/partner-campaigns/serve",
            params={"fan_id": "fan-qa", "country_code": "QA"},
        )
        for campaign in resp.json().get("campaigns", []):
            assert campaign.get("is_sponsored") is True
            assert "advertiser_name" in campaign

    def test_priority_ordering_respected(self, api_client, fake_db, verified_partner):
        """Higher-priority (lower int) campaigns appear first in serve response."""
        for priority, title in [(2, "Low Priority"), (1, "High Priority")]:
            payload = {
                "partner_id": verified_partner.id,
                "title": title,
                "budget_usd": 100.0,
                "daily_cap_usd": 10.0,
                "start_date": datetime.utcnow().isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "target_country_codes": ["QA"],
                "placement_type": "banner",
                "priority": priority,
            }
            cr = api_client.post("/api/v1/partner-campaigns", json=payload)
            cid = cr.json()["campaign_id"]
            fake_db.campaigns.update(cid, status="active")

        resp = api_client.get(
            "/api/v1/partner-campaigns/serve",
            params={"fan_id": "fan-qa2", "country_code": "QA"},
        )
        campaigns = resp.json().get("campaigns", [])
        priorities = [c["priority"] for c in campaigns]
        assert priorities == sorted(priorities)