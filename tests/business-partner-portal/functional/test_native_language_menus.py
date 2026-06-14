"""
Functional tests: Business Partner Portal — Native-Language Menus
PRD ref: 7.11.2
Covers: menu CRUD in multiple languages, RTL support, fallback locale,
        PDF/image menu upload, i18n validation.
"""

import pytest
import json
from unittest.mock import patch


@pytest.fixture
def verified_partner_id(fake_db, partner_fixture):
    return partner_fixture.id  # already verified, trust_tier ≥ 1


@pytest.fixture
def partner_fixture(fake_db):
    from tests.helpers.fake_db import FakeDB
    return fake_db.partners.create(
        business_name="Test Café",
        country_code="MA",
        status="verified",
        trust_tier=2,
        languages_spoken=["ar", "fr", "en"],
    )


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
def menu_payload_en():
    return {
        "locale": "en",
        "name": "Lunch Menu",
        "sections": [
            {
                "title": "Starters",
                "items": [
                    {"name": "Harira Soup", "price": 3.50, "currency": "MAD",
                     "description": "Traditional Moroccan soup", "allergens": ["gluten"]},
                ],
            }
        ],
    }


@pytest.fixture
def menu_payload_ar():
    return {
        "locale": "ar",
        "name": "قائمة الغداء",
        "direction": "rtl",
        "sections": [
            {
                "title": "المقبلات",
                "items": [
                    {"name": "شوربة الحريرة", "price": 3.50, "currency": "MAD",
                     "description": "شوربة مغربية تقليدية", "allergens": ["gluten"]},
                ],
            }
        ],
    }


# ---------------------------------------------------------------------------
# AC-15.3  Partners can create menus in their supported languages
# ---------------------------------------------------------------------------

class TestNativeLanguageMenus:

    def test_create_menu_english(self, api_client, verified_partner_id, menu_payload_en):
        resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus",
            json=menu_payload_en,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["locale"] == "en"
        assert body["name"] == "Lunch Menu"

    def test_create_menu_arabic_rtl(self, api_client, verified_partner_id, menu_payload_ar):
        resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus",
            json=menu_payload_ar,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["locale"] == "ar"
        assert body.get("direction") == "rtl"

    def test_create_menu_unsupported_locale_rejected(
        self, api_client, verified_partner_id, menu_payload_en
    ):
        """zh-TW not in the partner's languages_spoken list."""
        menu_payload_en["locale"] = "zh-TW"
        resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus",
            json=menu_payload_en,
        )
        assert resp.status_code == 422
        assert "unsupported locale" in resp.json()["detail"].lower()

    def test_create_menu_unverified_partner_forbidden(
        self, api_client, fake_db, menu_payload_en
    ):
        pending = fake_db.partners.create(
            business_name="Pending Café", country_code="MA", status="pending", trust_tier=None
        )
        resp = api_client.post(
            f"/api/v1/partners/{pending.id}/menus", json=menu_payload_en
        )
        assert resp.status_code == 403

    def test_list_menus_returns_all_locales(
        self, api_client, verified_partner_id, menu_payload_en, menu_payload_ar
    ):
        api_client.post(f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en)
        api_client.post(f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_ar)
        resp = api_client.get(f"/api/v1/partners/{verified_partner_id}/menus")
        assert resp.status_code == 200
        locales = {m["locale"] for m in resp.json()["menus"]}
        assert locales == {"en", "ar"}

    def test_get_menu_by_locale(self, api_client, verified_partner_id, menu_payload_en):
        api_client.post(f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en)
        resp = api_client.get(
            f"/api/v1/partners/{verified_partner_id}/menus",
            params={"locale": "en"},
        )
        assert resp.status_code == 200
        assert resp.json()["menus"][0]["locale"] == "en"

    def test_fallback_locale_returns_english_when_requested_locale_missing(
        self, api_client, verified_partner_id, menu_payload_en
    ):
        api_client.post(f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en)
        resp = api_client.get(
            f"/api/v1/partners/{verified_partner_id}/menus",
            params={"locale": "fr", "fallback": "true"},
        )
        assert resp.status_code == 200
        assert resp.json()["menus"][0]["locale"] == "en"

    def test_update_menu_item_price(self, api_client, verified_partner_id, menu_payload_en):
        create_resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en
        )
        menu_id = create_resp.json()["menu_id"]
        item_id = create_resp.json()["sections"][0]["items"][0]["item_id"]
        resp = api_client.patch(
            f"/api/v1/partners/{verified_partner_id}/menus/{menu_id}/items/{item_id}",
            json={"price": 4.00},
        )
        assert resp.status_code == 200
        assert resp.json()["price"] == 4.00

    def test_delete_menu(self, api_client, verified_partner_id, menu_payload_en):
        create_resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en
        )
        menu_id = create_resp.json()["menu_id"]
        del_resp = api_client.delete(
            f"/api/v1/partners/{verified_partner_id}/menus/{menu_id}"
        )
        assert del_resp.status_code == 204
        get_resp = api_client.get(
            f"/api/v1/partners/{verified_partner_id}/menus/{menu_id}"
        )
        assert get_resp.status_code == 404

    def test_allergen_list_preserved_in_all_locales(
        self, api_client, verified_partner_id, menu_payload_en, menu_payload_ar
    ):
        api_client.post(f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en)
        api_client.post(f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_ar)
        for loc in ("en", "ar"):
            resp = api_client.get(
                f"/api/v1/partners/{verified_partner_id}/menus", params={"locale": loc}
            )
            items = resp.json()["menus"][0]["sections"][0]["items"]
            assert any("gluten" in (i.get("allergens") or []) for i in items)

    def test_pdf_menu_upload(self, api_client, verified_partner_id):
        resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus/upload",
            files={"file": ("menu.pdf", b"%PDF-1.4 fake content", "application/pdf")},
            data={"locale": "fr"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["locale"] == "fr"
        assert body["type"] == "pdf"
        assert "url" in body

    def test_menu_xss_sanitisation(self, api_client, verified_partner_id, menu_payload_en):
        menu_payload_en["sections"][0]["items"][0]["description"] = (
            "<img src=x onerror=alert(1)>Soup"
        )
        resp = api_client.post(
            f"/api/v1/partners/{verified_partner_id}/menus", json=menu_payload_en
        )
        if resp.status_code == 201:
            desc = resp.json()["sections"][0]["items"][0]["description"]
            assert "<img" not in desc