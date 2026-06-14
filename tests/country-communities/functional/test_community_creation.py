"""
Functional tests for Country & City Communities (slug: country-communities)
PRD refs: 5.2, 7.3.1, 7.3.2, 7.3.3
Covers: event-scoped communities, city sub-communities, channels, cross-country affinity,
        community features (posts, polls, media, moderation).
"""

import pytest
import uuid
from datetime import datetime, timezone
from typing import Any

from tests.country_communities.helpers.client import RoarPassAPIClient
from tests.country_communities.helpers.factories import (
    make_user,
    make_event,
    make_community,
    make_trip,
)
from tests.country_communities.helpers.assertions import (
    assert_community_shape,
    assert_channel_shape,
    assert_post_shape,
)


# ─────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────

@pytest.fixture(scope="module")
def api():
    return RoarPassAPIClient()


@pytest.fixture(scope="module")
def wc_event(api):
    """World Cup event seeded via event-registry."""
    ev = api.events.get_by_slug("world-cup-2026")
    assert ev["status"] == "active", "Seed WC-2026 event missing or not active"
    return ev


@pytest.fixture(scope="module")
def club_wc_event(api):
    ev = api.events.get_by_slug("club-world-cup-2025")
    assert ev["status"] == "active"
    return ev


@pytest.fixture(scope="module")
def admin_token(api):
    return api.auth.login_admin()


@pytest.fixture()
def brazil_fan(api):
    user = make_user(nationality="BR", home_city="São Paulo")
    token = api.auth.register_and_login(user)
    return {"user": user, "token": token}


@pytest.fixture()
def germany_fan(api):
    user = make_user(nationality="DE", home_city="Berlin")
    token = api.auth.register_and_login(user)
    return {"user": user, "token": token}


@pytest.fixture()
def argentina_fan(api):
    user = make_user(nationality="AR", home_city="Buenos Aires")
    token = api.auth.register_and_login(user)
    return {"user": user, "token": token}


# ─────────────────────────────────────────────
# PRD 7.3.1 – Event-scoped Country Communities
# ─────────────────────────────────────────────

class TestEventScopedCountryCommunities:
    """AC: Each event has exactly one country community per participating nation."""

    def test_community_created_on_event_activation(self, api, wc_event):
        """Activating an event auto-generates country communities for all registered nations."""
        communities = api.communities.list_by_event(wc_event["id"])
        country_codes = {c["country_code"] for c in communities}
        # WC 2026 seed includes at least 32 nations
        assert len(communities) >= 32, (
            f"Expected ≥32 country communities, got {len(communities)}"
        )
        # Each entry has required shape
        for c in communities[:5]:  # spot-check 5
            assert_community_shape(c)

    def test_community_is_event_scoped(self, api, wc_event, club_wc_event):
        """Brazil community for WC-2026 is distinct from Brazil community for Club WC-2025."""
        br_wc = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        br_cwc = api.communities.get_by_event_and_country(club_wc_event["id"], "BR")
        assert br_wc["id"] != br_cwc["id"], "Same community shared across events — scoping broken"
        assert br_wc["event_id"] == wc_event["id"]
        assert br_cwc["event_id"] == club_wc_event["id"]

    def test_community_slug_is_unique_per_event(self, api, wc_event):
        communities = api.communities.list_by_event(wc_event["id"])
        slugs = [c["slug"] for c in communities]
        assert len(slugs) == len(set(slugs)), "Duplicate community slugs within an event"

    def test_community_metadata_fields(self, api, wc_event):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        assert br["country_code"] == "BR"
        assert br["event_id"] == wc_event["id"]
        assert "name" in br
        assert "flag_emoji" in br or "flag_url" in br
        assert "member_count" in br
        assert "created_at" in br

    def test_community_not_created_for_non_participating_country(self, api, wc_event):
        """A country not registered for the event must not have a community."""
        resp = api.communities.get_by_event_and_country(wc_event["id"], "ZZ", expect_error=True)
        assert resp["status_code"] == 404

    def test_community_visibility_requires_event_access(self, api, wc_event):
        """Unauthenticated users can see community list but not private channels."""
        communities = api.communities.list_by_event(wc_event["id"], auth=False)
        assert isinstance(communities, list)
        # Private channels must be hidden
        for c in communities:
            channels = api.communities.list_channels(c["id"], auth=False)
            private = [ch for ch in channels if ch.get("visibility") == "private"]
            assert not private, f"Private channel exposed to anon in community {c['slug']}"


# ─────────────────────────────────────────────
# PRD 7.3.2 – City Sub-communities & Channels
# ─────────────────────────────────────────────

class TestCitySubCommunities:
    """AC: Country communities nest city sub-communities for host cities."""

    def test_host_cities_have_sub_communities(self, api, wc_event):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        subs = api.communities.list_sub_communities(br["id"])
        city_names = {s["city"] for s in subs}
        # WC 2026 seed cities
        assert len(subs) >= 1, "No city sub-communities found for Brazil"
        for s in subs:
            assert s["parent_id"] == br["id"]
            assert "city" in s
            assert "country_code" in s

    def test_sub_community_inherits_event_scope(self, api, wc_event):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        subs = api.communities.list_sub_communities(br["id"])
        for s in subs:
            assert s["event_id"] == wc_event["id"]

    def test_default_channels_created_in_country_community(self, api, wc_event):
        """Every country community must have: #general, #match-day, #travel-tips, #local-help."""
        required = {"general", "match-day", "travel-tips", "local-help"}
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        channel_slugs = {ch["slug"] for ch in channels}
        missing = required - channel_slugs
        assert not missing, f"Missing default channels: {missing}"

    def test_channel_shape(self, api, wc_event):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        for ch in channels:
            assert_channel_shape(ch)

    def test_city_sub_community_has_local_channel(self, api, wc_event):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        subs = api.communities.list_sub_communities(br["id"])
        if not subs:
            pytest.skip("No city sub-communities in seed data")
        city = subs[0]
        channels = api.communities.list_channels(city["id"])
        slugs = {ch["slug"] for ch in channels}
        assert "local-meetups" in slugs or "local" in slugs, (
            "City sub-community missing a local channel"
        )

    def test_member_can_join_city_sub_community(self, api, wc_event, brazil_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        subs = api.communities.list_sub_communities(br["id"])
        if not subs:
            pytest.skip("No city sub-communities")
        city = subs[0]
        resp = api.communities.join(city["id"], token=brazil_fan["token"])
        assert resp["status"] in ("joined", "already_member")
        members = api.communities.list_members(city["id"], token=brazil_fan["token"])
        member_ids = {m["user_id"] for m in members}
        assert brazil_fan["user"]["id"] in member_ids

    def test_channel_post_count_increments(self, api, wc_event, brazil_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        before = gen.get("post_count", 0)
        api.communities.post_message(
            br["id"], gen["id"],
            content="Vai Brasil! 🇧🇷",
            token=brazil_fan["token"]
        )
        after = api.communities.get_channel(br["id"], gen["id"])["post_count"]
        assert after == before + 1


# ─────────────────────────────────────────────
# PRD 7.3.3 – Cross-Country Affinity Communities
# ─────────────────────────────────────────────

class TestCrossCountryAffinityCommunities:
    """AC: System creates affinity communities bridging fans of different nations."""

    def test_affinity_community_created_for_rival_matchup(self, api, wc_event):
        """When a match is scheduled, a rivalry affinity community appears."""
        # Seed match: Brazil vs Germany
        match = api.matches.get_by_teams(wc_event["id"], "BR", "DE")
        if not match:
            pytest.skip("BR vs DE match not in seed data")
        affinity = api.communities.get_affinity_by_match(match["id"])
        assert affinity is not None, "No affinity community for BR vs DE match"
        assert set(affinity["country_codes"]) == {"BR", "DE"}
        assert affinity["event_id"] == wc_event["id"]

    def test_fan_can_join_rival_affinity_community(self, api, wc_event, brazil_fan, germany_fan):
        match = api.matches.get_by_teams(wc_event["id"], "BR", "DE")
        if not match:
            pytest.skip("BR vs DE match not in seed data")
        affinity = api.communities.get_affinity_by_match(match["id"])
        for fan in (brazil_fan, germany_fan):
            resp = api.communities.join(affinity["id"], token=fan["token"])
            assert resp["status"] in ("joined", "already_member")

    def test_affinity_community_has_banter_channel(self, api, wc_event):
        match = api.matches.get_by_teams(wc_event["id"], "BR", "DE")
        if not match:
            pytest.skip("BR vs DE match not in seed data")
        affinity = api.communities.get_affinity_by_match(match["id"])
        channels = api.communities.list_channels(affinity["id"])
        slugs = {ch["slug"] for ch in channels}
        assert "banter" in slugs or "trash-talk" in slugs, (
            "Affinity community missing a banter channel"
        )

    def test_non_match_fan_can_join_affinity_community(self, api, wc_event, argentina_fan):
        """Fans of third countries may join affinity communities."""
        match = api.matches.get_by_teams(wc_event["id"], "BR", "DE")
        if not match:
            pytest.skip()
        affinity = api.communities.get_affinity_by_match(match["id"])
        resp = api.communities.join(affinity["id"], token=argentina_fan["token"])
        assert resp["status"] in ("joined", "already_member")

    def test_affinity_community_deactivated_after_match(self, api, wc_event, admin_token):
        """After a match ends, the affinity community becomes read-only."""
        match = api.matches.get_by_teams(wc_event["id"], "BR", "DE")
        if not match:
            pytest.skip()
        # Simulate match completion
        api.matches.mark_completed(match["id"], token=admin_token)
        affinity = api.communities.get_affinity_by_match(match["id"])
        assert affinity["read_only"] is True, (
            "Affinity community not set to read-only after match completion"
        )

    def test_interest_based_affinity_community(self, api, wc_event, brazil_fan, germany_fan):
        """Shared-interest affinity communities (e.g., 'Away Fans', 'Families') exist."""
        affinity_communities = api.communities.list_affinity(wc_event["id"], type="interest")
        assert len(affinity_communities) >= 1, "No interest-based affinity communities"
        away_fans = next(
            (c for c in affinity_communities if "away" in c["slug"].lower()), None
        )
        if away_fans:
            resp = api.communities.join(away_fans["id"], token=brazil_fan["token"])
            assert resp["status"] in ("joined", "already_member")


# ─────────────────────────────────────────────
# PRD 5.2 – Community Features (Posts, Polls, Media, Moderation)
# ─────────────────────────────────────────────

class TestCommunityFeatures:

    def test_member_can_post_text_message(self, api, wc_event, brazil_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        post = api.communities.post_message(
            br["id"], gen["id"],
            content="Anyone arriving in NYC early? 🗽",
            token=brazil_fan["token"]
        )
        assert_post_shape(post)
        assert post["author_id"] == brazil_fan["user"]["id"]
        assert post["content"] == "Anyone arriving in NYC early? 🗽"

    def test_member_can_create_poll(self, api, wc_event, brazil_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        poll = api.communities.create_poll(
            br["id"], gen["id"],
            question="Which city for the semi-final watch party?",
            options=["NYC", "LA", "Dallas"],
            token=brazil_fan["token"]
        )
        assert poll["question"] == "Which city for the semi-final watch party?"
        assert len(poll["options"]) == 3
        assert poll["total_votes"] == 0

    def test_member_can_vote_in_poll(self, api, wc_event, brazil_fan, germany_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        poll = api.communities.create_poll(
            br["id"], gen["id"],
            question="Best jersey colour?",
            options=["Yellow", "Blue", "White"],
            token=brazil_fan["token"]
        )
        # brazil_fan votes
        api.communities.vote_poll(
            br["id"], gen["id"], poll["id"], option="Yellow",
            token=brazil_fan["token"]
        )
        updated = api.communities.get_poll(br["id"], gen["id"], poll["id"])
        assert updated["total_votes"] == 1
        yellow_opt = next(o for o in updated["options"] if o["label"] == "Yellow")
        assert yellow_opt["votes"] == 1

    def test_duplicate_poll_vote_rejected(self, api, wc_event, brazil_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        poll = api.communities.create_poll(
            br["id"], gen["id"],
            question="Duplicate vote test?",
            options=["A", "B"],
            token=brazil_fan["token"]
        )
        api.communities.vote_poll(br["id"], gen["id"], poll["id"], option="A",
                                  token=brazil_fan["token"])
        resp = api.communities.vote_poll(
            br["id"], gen["id"], poll["id"], option="B",
            token=brazil_fan["token"], expect_error=True
        )
        assert resp["status_code"] == 409, "Duplicate vote not rejected"

    def test_member_can_upload_media_attachment(self, api, wc_event, brazil_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        post = api.communities.post_message(
            br["id"], gen["id"],
            content="Check this shot from the stadium!",
            attachment_path="tests/country_communities/fixtures/sample_stadium.jpg",
            token=brazil_fan["token"]
        )
        assert post["attachment"] is not None
        assert post["attachment"]["type"] in ("image/jpeg", "image/png")
        assert post["attachment"]["url"].startswith("https://")

    def test_non_member_cannot_post(self, api, wc_event, germany_fan):
        """Germany fan cannot post in Brazil-only channel without joining."""
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        resp = api.communities.post_message(
            br["id"], gen["id"],
            content="Hello from Germany!",
            token=germany_fan["token"],
            expect_error=True
        )
        assert resp["status_code"] == 403

    def test_moderator_can_delete_post(self, api, wc_event, brazil_fan, admin_token):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        post = api.communities.post_message(
            br["id"], gen["id"],
            content="This will be deleted",
            token=brazil_fan["token"]
        )
        api.communities.delete_post(br["id"], gen["id"], post["id"], token=admin_token)
        resp = api.communities.get_post(br["id"], gen["id"], post["id"], expect_error=True)
        assert resp["status_code"] == 404

    def test_report_post_reaches_moderation_queue(self, api, wc_event, brazil_fan, germany_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        # germany_fan joins first
        api.communities.join(br["id"], token=germany_fan["token"])
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        post = api.communities.post_message(
            br["id"], gen["id"],
            content="Offensive content placeholder",
            token=brazil_fan["token"]
        )
        api.communities.report_post(
            br["id"], gen["id"], post["id"],
            reason="offensive",
            token=germany_fan["token"]
        )
        queue = api.moderation.get_queue(community_id=br["id"], token=admin_token)
        report_ids = {r["post_id"] for r in queue}
        assert post["id"] in report_ids, "Reported post not in moderation queue"

    def test_pinned_post_appears_first(self, api, wc_event, brazil_fan, admin_token):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        pinned = api.communities.post_message(
            br["id"], gen["id"],
            content="📌 Welcome to the Brazil community!",
            token=brazil_fan["token"]
        )
        api.communities.pin_post(br["id"], gen["id"], pinned["id"], token=admin_token)
        posts = api.communities.list_posts(br["id"], gen["id"])
        assert posts[0]["id"] == pinned["id"], "Pinned post not at top of feed"
        assert posts[0]["pinned"] is True

    def test_reaction_on_post(self, api, wc_event, brazil_fan, germany_fan):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        post = api.communities.post_message(
            br["id"], gen["id"],
            content="React to this!",
            token=brazil_fan["token"]
        )
        api.communities.react(br["id"], gen["id"], post["id"], emoji="🔥",
                              token=germany_fan["token"])
        updated = api.communities.get_post(br["id"], gen["id"], post["id"])
        fire_reaction = next(
            (r for r in updated["reactions"] if r["emoji"] == "🔥"), None
        )
        assert fire_reaction is not None
        assert fire_reaction["count"] == 1


# ─────────────────────────────────────────────
# Privacy / GDPR / WCAG
# ─────────────────────────────────────────────

class TestPrivacyAndAccessibility:

    def test_private_profile_hides_real_name_in_community(self, api, wc_event):
        user = make_user(nationality="BR", profile_visibility="private")
        token = api.auth.register_and_login(user)
        api.communities.join(
            api.communities.get_by_event_and_country(wc_event["id"], "BR")["id"],
            token=token
        )
        members = api.communities.list_members(
            api.communities.get_by_event_and_country(wc_event["id"], "BR")["id"],
            token=token
        )
        me = next((m for m in members if m["user_id"] == user["id"]), None)
        assert me is not None
        assert "email" not in me, "Email leaked in member list"
        assert me.get("display_name") != user["real_name"], (
            "Real name exposed for private-profile user"
        )

    def test_community_data_export_includes_posts(self, api, wc_event, brazil_fan):
        """GDPR right-to-access: user can export their community data."""
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        channels = api.communities.list_channels(br["id"])
        gen = next(ch for ch in channels if ch["slug"] == "general")
        api.communities.post_message(
            br["id"], gen["id"], content="Export test post",
            token=brazil_fan["token"]
        )
        export = api.users.request_data_export(token=brazil_fan["token"])
        assert "community_posts" in export
        content_texts = [p["content"] for p in export["community_posts"]]
        assert "Export test post" in content_texts

    def test_api_responses_include_content_language_header(self, api, wc_event):
        br = api.communities.get_by_event_and_country(wc_event["id"], "BR")
        resp = api.communities.get_raw_response(br["id"])
        assert "Content-Language" in resp.headers, (
            "Missing Content-Language header — i18n non-functional requirement"
        )

    def test_rtl_display_name_stored_correctly(self, api, wc_event):
        """Arabic display name (RTL) round-trips correctly."""
        user = make_user(nationality="SA", display_name="مشجع كرة القدم")
        token = api.auth.register_and_login(user)
        profile = api.users.get_profile(user["id"], token=token)
        assert profile["display_name"] == "مشجع كرة القدم"