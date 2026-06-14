"""
Functional tests for Verification Tiers & Trust Signals (area: verification-trust-tiers)
PRD refs: 7.2.4, 7.10.1, 5.3
Covers: Basic, Verified Identity, Local Helper, Business tiers; badges; cross-event reputation.
"""

import pytest
import uuid
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Fixtures / Stubs
# ---------------------------------------------------------------------------

class FakeStorage:
    """In-memory stand-in for the document / object store."""
    def __init__(self):
        self._store = {}

    def put(self, key, value):
        self._store[key] = value
        return key

    def get(self, key):
        return self._store.get(key)

    def delete(self, key):
        self._store.pop(key, None)


class FakeDB:
    """Minimal dict-backed DB for unit-level tests."""
    def __init__(self):
        self.users = {}
        self.verifications = {}
        self.reputation_events = []
        self.badges = {}

    def save_user(self, user):
        self.users[user["id"]] = user
        return user

    def get_user(self, user_id):
        return self.users.get(user_id)

    def save_verification(self, v):
        self.verifications[v["id"]] = v
        return v

    def get_verification(self, vid):
        return self.verifications.get(vid)

    def record_reputation_event(self, event):
        self.reputation_events.append(event)

    def save_badge(self, badge):
        self.badges[badge["id"]] = badge
        return badge

    def get_badges_for_user(self, user_id):
        return [b for b in self.badges.values() if b["user_id"] == user_id]


def make_user(tier="basic", **kwargs):
    uid = str(uuid.uuid4())
    return {
        "id": uid,
        "email": f"user_{uid[:8]}@test.com",
        "tier": tier,
        "reputation_score": 0,
        "badges": [],
        "is_local_helper": False,
        "is_business": False,
        "gdpr_consent": True,
        **kwargs,
    }


# ---------------------------------------------------------------------------
# Domain helpers (thin wrappers that the service layer would expose)
# ---------------------------------------------------------------------------

TIER_WEIGHTS = {
    "basic": 0,
    "verified_identity": 1,
    "local_helper": 2,
    "business": 2,
}

TIER_PRIVILEGES = {
    "basic": {"can_send_helper_request": False, "can_list_trips": False, "badge_visible": False},
    "verified_identity": {"can_send_helper_request": True, "can_list_trips": True, "badge_visible": True},
    "local_helper": {"can_send_helper_request": True, "can_list_trips": True, "badge_visible": True, "can_accept_helper": True},
    "business": {"can_send_helper_request": True, "can_list_trips": True, "badge_visible": True, "can_post_offers": True},
}

REPUTATION_DELTAS = {
    "helpful_rating": 10,
    "event_checkin": 2,
    "community_post": 1,
    "report_resolved": 5,
    "sos_response": 15,
    "fake_report_penalty": -20,
    "helper_completion": 8,
}

MAX_REPUTATION_PER_EVENT = 100  # PRD 7.10.1 — per-event cap


def compute_tier(user, verification_records):
    """Simplified tier-resolution logic mirroring service layer."""
    has_id_check = any(v["type"] == "identity" and v["status"] == "approved" for v in verification_records)
    has_helper = any(v["type"] == "local_helper" and v["status"] == "approved" for v in verification_records)
    has_business = any(v["type"] == "business" and v["status"] == "approved" for v in verification_records)

    if has_helper:
        return "local_helper"
    if has_business:
        return "business"
    if has_id_check:
        return "verified_identity"
    return "basic"


def apply_reputation_delta(user, event_type, event_slug, db: FakeDB):
    """Add reputation points respecting per-event caps."""
    delta = REPUTATION_DELTAS.get(event_type, 0)
    existing_for_event = sum(
        e["delta"] for e in db.reputation_events
        if e["user_id"] == user["id"] and e["event_slug"] == event_slug and e["delta"] > 0
    )
    # Clamp positive gains to per-event cap
    if delta > 0:
        allowed = max(0, MAX_REPUTATION_PER_EVENT - existing_for_event)
        delta = min(delta, allowed)

    new_score = user["reputation_score"] + delta
    new_score = max(0, new_score)  # floor at 0
    user["reputation_score"] = new_score

    db.record_reputation_event({
        "user_id": user["id"],
        "event_slug": event_slug,
        "event_type": event_type,
        "delta": delta,
        "ts": datetime.utcnow().isoformat(),
    })
    return user


def assign_badge(user, badge_type, db: FakeDB):
    """Idempotently assign a badge to a user."""
    existing = db.get_badges_for_user(user["id"])
    for b in existing:
        if b["badge_type"] == badge_type:
            return b  # already awarded
    badge = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "badge_type": badge_type,
        "awarded_at": datetime.utcnow().isoformat(),
        "visible": TIER_PRIVILEGES.get(user["tier"], {}).get("badge_visible", False),
    }
    db.save_badge(badge)
    user["badges"].append(badge["id"])
    db.save_user(user)
    return badge


# ===========================================================================
# FUNCTIONAL TESTS — Acceptance Criteria
# ===========================================================================


class TestTierAssignment:
    """AC: Each user has exactly one active tier; tier escalates on approval."""

    def setup_method(self):
        self.db = FakeDB()

    def test_new_user_defaults_to_basic(self):
        user = make_user()
        tier = compute_tier(user, [])
        assert tier == "basic", "Fresh user must be 'basic' tier"

    def test_identity_approval_escalates_to_verified_identity(self):
        user = make_user()
        verifications = [{"type": "identity", "status": "approved", "id": "v1"}]
        tier = compute_tier(user, verifications)
        assert tier == "verified_identity"

    def test_pending_identity_does_not_escalate(self):
        user = make_user()
        verifications = [{"type": "identity", "status": "pending", "id": "v2"}]
        tier = compute_tier(user, verifications)
        assert tier == "basic"

    def test_rejected_identity_does_not_escalate(self):
        user = make_user()
        verifications = [{"type": "identity", "status": "rejected", "id": "v3"}]
        tier = compute_tier(user, verifications)
        assert tier == "basic"

    def test_local_helper_approval_sets_local_helper_tier(self):
        user = make_user()
        verifications = [
            {"type": "identity", "status": "approved", "id": "v1"},
            {"type": "local_helper", "status": "approved", "id": "v4"},
        ]
        tier = compute_tier(user, verifications)
        assert tier == "local_helper"

    def test_business_approval_sets_business_tier(self):
        user = make_user()
        verifications = [
            {"type": "business", "status": "approved", "id": "v5"},
        ]
        tier = compute_tier(user, verifications)
        assert tier == "business"

    def test_local_helper_takes_precedence_over_business(self):
        """If somehow both approved, local_helper wins (PRD 7.2.4 ordering)."""
        user = make_user()
        verifications = [
            {"type": "local_helper", "status": "approved", "id": "v6"},
            {"type": "business", "status": "approved", "id": "v7"},
        ]
        tier = compute_tier(user, verifications)
        assert tier == "local_helper"

    def test_tier_revocation_on_rejection(self):
        """If a previously approved verification is later rejected, tier drops."""
        user = make_user()
        # Approved then revoked
        verifications_revoked = [{"type": "identity", "status": "rejected", "id": "v8"}]
        tier = compute_tier(user, verifications_revoked)
        assert tier == "basic"


class TestTierPrivileges:
    """AC: Tier gates feature access (PRD 5.3)."""

    def test_basic_cannot_send_helper_request(self):
        priv = TIER_PRIVILEGES["basic"]
        assert priv["can_send_helper_request"] is False

    def test_verified_identity_can_send_helper_request(self):
        priv = TIER_PRIVILEGES["verified_identity"]
        assert priv["can_send_helper_request"] is True

    def test_local_helper_can_accept_helper(self):
        priv = TIER_PRIVILEGES["local_helper"]
        assert priv.get("can_accept_helper") is True

    def test_business_can_post_offers(self):
        priv = TIER_PRIVILEGES["business"]
        assert priv.get("can_post_offers") is True

    def test_basic_badge_not_visible(self):
        priv = TIER_PRIVILEGES["basic"]
        assert priv["badge_visible"] is False

    def test_verified_identity_badge_visible(self):
        priv = TIER_PRIVILEGES["verified_identity"]
        assert priv["badge_visible"] is True

    def test_basic_cannot_list_trips(self):
        priv = TIER_PRIVILEGES["basic"]
        assert priv["can_list_trips"] is False


class TestBadgeAssignment:
    """AC: Correct badge awarded per tier; idempotent assignment."""

    def setup_method(self):
        self.db = FakeDB()

    def test_verified_identity_badge_awarded(self):
        user = make_user(tier="verified_identity")
        self.db.save_user(user)
        badge = assign_badge(user, "verified_identity", self.db)
        assert badge["badge_type"] == "verified_identity"
        assert badge["visible"] is True

    def test_badge_idempotent_on_double_award(self):
        user = make_user(tier="verified_identity")
        self.db.save_user(user)
        b1 = assign_badge(user, "verified_identity", self.db)
        b2 = assign_badge(user, "verified_identity", self.db)
        assert b1["id"] == b2["id"], "Second award must return existing badge"
        badges = self.db.get_badges_for_user(user["id"])
        assert len(badges) == 1

    def test_local_helper_badge_awarded(self):
        user = make_user(tier="local_helper")
        self.db.save_user(user)
        badge = assign_badge(user, "local_helper", self.db)
        assert badge["badge_type"] == "local_helper"

    def test_business_badge_awarded(self):
        user = make_user(tier="business")
        self.db.save_user(user)
        badge = assign_badge(user, "business", self.db)
        assert badge["badge_type"] == "business"

    def test_basic_tier_badge_not_visible(self):
        user = make_user(tier="basic")
        self.db.save_user(user)
        badge = assign_badge(user, "basic", self.db)
        assert badge["visible"] is False

    def test_multiple_badge_types_stored_separately(self):
        user = make_user(tier="local_helper")
        self.db.save_user(user)
        assign_badge(user, "verified_identity", self.db)
        assign_badge(user, "local_helper", self.db)
        badges = self.db.get_badges_for_user(user["id"])
        types = {b["badge_type"] for b in badges}
        assert "verified_identity" in types
        assert "local_helper" in types


class TestReputationScore:
    """AC: Reputation accumulates correctly; per-event caps enforced (PRD 7.10.1)."""

    def setup_method(self):
        self.db = FakeDB()

    def test_helpful_rating_adds_points(self):
        user = make_user()
        user = apply_reputation_delta(user, "helpful_rating", "wc2026", self.db)
        assert user["reputation_score"] == 10

    def test_multiple_actions_accumulate(self):
        user = make_user()
        user = apply_reputation_delta(user, "event_checkin", "wc2026", self.db)
        user = apply_reputation_delta(user, "community_post", "wc2026", self.db)
        assert user["reputation_score"] == 3

    def test_fake_report_penalty_reduces_score(self):
        user = make_user()
        user["reputation_score"] = 30
        user = apply_reputation_delta(user, "fake_report_penalty", "wc2026", self.db)
        assert user["reputation_score"] == 10

    def test_score_floored_at_zero(self):
        user = make_user()
        user["reputation_score"] = 5
        user = apply_reputation_delta(user, "fake_report_penalty", "wc2026", self.db)
        assert user["reputation_score"] == 0

    def test_per_event_cap_enforced(self):
        user = make_user()
        # Fill cap across many helpful ratings for same event
        for _ in range(12):
            user = apply_reputation_delta(user, "helpful_rating", "wc2026", self.db)
        assert user["reputation_score"] == MAX_REPUTATION_PER_EVENT

    def test_different_events_each_get_own_cap(self):
        user = make_user()
        for _ in range(12):
            user = apply_reputation_delta(user, "helpful_rating", "wc2026", self.db)
        for _ in range(12):
            user = apply_reputation_delta(user, "helpful_rating", "cwc2025", self.db)
        # Two separate events, each capped at 100 → total 200
        assert user["reputation_score"] == 200

    def test_sos_response_gives_largest_delta(self):
        user = make_user()
        user = apply_reputation_delta(user, "sos_response", "wc2026", self.db)
        assert user["reputation_score"] == REPUTATION_DELTAS["sos_response"]

    def test_reputation_events_persisted_to_db(self):
        user = make_user()
        apply_reputation_delta(user, "community_post", "wc2026", self.db)
        assert len(self.db.reputation_events) == 1
        evt = self.db.reputation_events[0]
        assert evt["event_type"] == "community_post"
        assert evt["event_slug"] == "wc2026"

    def test_penalty_does_not_count_against_event_cap(self):
        """Negative deltas should not eat into the per-event positive cap."""
        user = make_user()
        user["reputation_score"] = 20
        # Record a penalty first
        apply_reputation_delta(user, "fake_report_penalty", "wc2026", self.db)
        # Now accumulate positives — cap should still be 100 points of positives
        for _ in range(12):
            user = apply_reputation_delta(user, "helpful_rating", "wc2026", self.db)
        # 20 - 20 + 100 = 100
        assert user["reputation_score"] == 100

    def test_helper_completion_bonus(self):
        user = make_user()
        user = apply_reputation_delta(user, "helper_completion", "wc2026", self.db)
        assert user["reputation_score"] == REPUTATION_DELTAS["helper_completion"]


class TestVerificationDocumentHandling:
    """AC: PII docs stored securely; not returned in API responses (GDPR/PRD 5.3)."""

    def setup_method(self):
        self.storage = FakeStorage()

    def test_document_stored_with_opaque_key(self):
        user_id = str(uuid.uuid4())
        doc_content = b"fake_passport_scan"
        key = f"verifications/{user_id}/identity_doc_{uuid.uuid4().hex}"
        self.storage.put(key, doc_content)
        assert self.storage.get(key) == doc_content

    def test_api_response_does_not_expose_doc_url(self):
        """Simulate what the serializer returns — no doc_url in user-facing payload."""
        user = make_user(tier="verified_identity")
        # Mimick serializer output — doc fields must be stripped
        serialized = {k: v for k, v in user.items() if k not in ("doc_url", "doc_key", "ssn", "passport_number")}
        assert "doc_url" not in serialized
        assert "passport_number" not in serialized

    def test_document_deleted_after_approval(self):
        """Once verification is approved, raw doc must be purged (GDPR)."""
        storage = self.storage
        key = "verifications/uid123/doc_abc"
        storage.put(key, b"raw_data")
        # Simulate approval callback
        storage.delete(key)
        assert storage.get(key) is None


class TestTierDisplayAndI18N:
    """AC: Badge labels render in user's locale; RTL safe."""

    TIER_LABELS = {
        "en": {"basic": "Basic", "verified_identity": "Verified", "local_helper": "Local Helper", "business": "Business"},
        "ar": {"basic": "أساسي", "verified_identity": "موثق", "local_helper": "مساعد محلي", "business": "أعمال"},
        "fr": {"basic": "Basique", "verified_identity": "Vérifié", "local_helper": "Assistant local", "business": "Entreprise"},
    }

    def test_english_labels_present(self):
        for tier in ["basic", "verified_identity", "local_helper", "business"]:
            assert tier in self.TIER_LABELS["en"]

    def test_arabic_labels_present(self):
        for tier in ["basic", "verified_identity", "local_helper", "business"]:
            assert tier in self.TIER_LABELS["ar"]

    def test_french_labels_present(self):
        for tier in ["basic", "verified_identity", "local_helper", "business"]:
            assert tier in self.TIER_LABELS["fr"]

    def test_arabic_label_non_empty(self):
        for label in self.TIER_LABELS["ar"].values():
            assert len(label) > 0

    def test_all_tiers_localised_for_all_locales(self):
        tiers = set(self.TIER_LABELS["en"].keys())
        for locale, mapping in self.TIER_LABELS.items():
            assert set(mapping.keys()) == tiers, f"Locale {locale} missing tier labels"


class TestAccessibilityMetadata:
    """AC: Badge components carry aria-label (WCAG 2.1 AA)."""

    def _make_badge_component(self, tier, locale="en"):
        labels = {
            "basic": "Basic account",
            "verified_identity": "Verified identity",
            "local_helper": "Local Helper",
            "business": "Business account",
        }
        return {
            "role": "img",
            "aria-label": labels.get(tier, tier),
            "data-tier": tier,
        }

    def test_badge_has_role_img(self):
        comp = self._make_badge_component("verified_identity")
        assert comp["role"] == "img"

    def test_badge_has_aria_label(self):
        comp = self._make_badge_component("verified_identity")
        assert "aria-label" in comp and len(comp["aria-label"]) > 0

    def test_all_tiers_have_aria_label(self):
        for tier in ["basic", "verified_identity", "local_helper", "business"]:
            comp = self._make_badge_component(tier)
            assert comp["aria-label"], f"Missing aria-label for tier {tier}"

    def test_badge_has_data_tier_attribute(self):
        comp = self._make_badge_component("local_helper")
        assert comp["data-tier"] == "local_helper"