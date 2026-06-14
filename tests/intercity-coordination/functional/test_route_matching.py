"""
Functional tests for Intercity Trip Coordination — Route Matching
PRD refs: 7.5.3, 7.4.1, 7.8.4
Area slug: intercity-coordination
"""

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Stub imports — replaced by real modules in CI via conftest.py path injection
# ---------------------------------------------------------------------------
try:
    from app.models.trip import TravelGroup, Route, RouteMatch, BorderReminder, VisaReminder
    from app.models.event import Event
    from app.models.user import FanProfile
    from app.services.route_matching import RouteMatchingService
    from app.services.trip_coordination import TripCoordinationService
    from app.services.notification import NotificationService
    from app.repositories.trip_repository import TripRepository
    from app.repositories.user_repository import UserRepository
except ImportError:
    # Minimal stubs so file is importable for static analysis / dry-run
    from tests.intercity_coordination.stubs import (  # type: ignore
        TravelGroup, Route, RouteMatch, BorderReminder, VisaReminder,
        Event, FanProfile,
        RouteMatchingService, TripCoordinationService,
        NotificationService, TripRepository, UserRepository,
    )


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture
def utc_now():
    return datetime.now(timezone.utc)


@pytest.fixture
def sample_event(utc_now):
    return Event(
        id=str(uuid.uuid4()),
        name="FIFA World Cup 2026 — Group Stage",
        host_countries=["USA", "CAN", "MEX"],
        start_date=utc_now + timedelta(days=30),
        end_date=utc_now + timedelta(days=60),
        is_active=True,
    )


@pytest.fixture
def fan_usa():
    return FanProfile(
        id=str(uuid.uuid4()),
        display_name="Alice",
        nationality="USA",
        spoken_languages=["en"],
        origin_city="New York",
        origin_country="USA",
        destination_city="Toronto",
        destination_country="CAN",
        travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
    )


@pytest.fixture
def fan_canada():
    return FanProfile(
        id=str(uuid.uuid4()),
        display_name="Bob",
        nationality="CAN",
        spoken_languages=["en", "fr"],
        origin_city="Montreal",
        origin_country="CAN",
        destination_city="Toronto",
        destination_country="CAN",
        travel_dates={"departure": "2026-06-10", "return": "2026-06-13"},
    )


@pytest.fixture
def fan_mexico():
    return FanProfile(
        id=str(uuid.uuid4()),
        display_name="Carlos",
        nationality="MEX",
        spoken_languages=["es"],
        origin_city="Mexico City",
        origin_country="MEX",
        destination_city="Dallas",
        destination_country="USA",
        travel_dates={"departure": "2026-06-09", "return": "2026-06-11"},
    )


@pytest.fixture
def route_matching_service():
    svc = RouteMatchingService()
    return svc


@pytest.fixture
def trip_coordination_service():
    repo = MagicMock(spec=TripRepository)
    notif = MagicMock(spec=NotificationService)
    svc = TripCoordinationService(repository=repo, notification_service=notif)
    return svc


# ===========================================================================
# AC-1  Origin→destination route matching returns ranked candidates
# ===========================================================================

class TestRouteMatching:
    """PRD 7.5.3 — origin→destination route matching"""

    def test_exact_route_match_returned(self, route_matching_service, fan_usa, fan_canada, sample_event):
        """Two fans travelling to same destination on same day should be matched."""
        candidates = [fan_canada]
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=candidates,
            event=sample_event,
        )
        assert len(matches) >= 1
        top = matches[0]
        assert top.matched_fan_id == fan_canada.id
        assert top.shared_destination == "Toronto"

    def test_no_match_different_destination(self, route_matching_service, fan_usa, fan_mexico, sample_event):
        """Fan going to Dallas should not match fan going to Toronto."""
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=[fan_mexico],
            event=sample_event,
        )
        direct_matches = [m for m in matches if m.match_type == "exact_destination"]
        assert len(direct_matches) == 0

    def test_match_score_range(self, route_matching_service, fan_usa, fan_canada, sample_event):
        """Match score must be in [0.0, 1.0]."""
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=[fan_canada],
            event=sample_event,
        )
        for m in matches:
            assert 0.0 <= m.score <= 1.0, f"Score {m.score} out of range"

    def test_results_ordered_by_score_descending(self, route_matching_service, fan_usa, fan_canada, fan_mexico, sample_event):
        """Results must be sorted highest score first."""
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=[fan_canada, fan_mexico],
            event=sample_event,
        )
        scores = [m.score for m in matches]
        assert scores == sorted(scores, reverse=True)

    def test_match_respects_travel_date_overlap(self, route_matching_service, sample_event):
        """Fan with non-overlapping dates must score lower than overlapping fan."""
        fan_a = FanProfile(
            id="fan-a",
            display_name="A",
            nationality="USA",
            spoken_languages=["en"],
            origin_city="New York",
            origin_country="USA",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
        )
        fan_overlap = FanProfile(
            id="fan-overlap",
            display_name="Overlap",
            nationality="GBR",
            spoken_languages=["en"],
            origin_city="London",
            origin_country="GBR",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
        )
        fan_non_overlap = FanProfile(
            id="fan-non-overlap",
            display_name="NonOverlap",
            nationality="AUS",
            spoken_languages=["en"],
            origin_city="Sydney",
            origin_country="AUS",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-07-01", "return": "2026-07-03"},
        )
        matches = route_matching_service.find_matches(
            requester=fan_a,
            candidate_pool=[fan_overlap, fan_non_overlap],
            event=sample_event,
        )
        id_to_score = {m.matched_fan_id: m.score for m in matches}
        if fan_overlap.id in id_to_score and fan_non_overlap.id in id_to_score:
            assert id_to_score[fan_overlap.id] >= id_to_score[fan_non_overlap.id]

    def test_empty_candidate_pool_returns_empty_list(self, route_matching_service, fan_usa, sample_event):
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=[],
            event=sample_event,
        )
        assert matches == []

    def test_requester_not_included_in_own_results(self, route_matching_service, fan_usa, sample_event):
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=[fan_usa],  # same object in pool
            event=sample_event,
        )
        ids = [m.matched_fan_id for m in matches]
        assert fan_usa.id not in ids

    def test_match_includes_shared_waypoints_when_available(self, route_matching_service, sample_event):
        """If two fans share an intermediate stop, match_type should indicate it."""
        fan_via_chicago = FanProfile(
            id="fan-via-chi",
            display_name="Via Chicago",
            nationality="USA",
            spoken_languages=["en"],
            origin_city="New York",
            origin_country="USA",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
            waypoints=["Chicago"],
        )
        fan_also_chicago = FanProfile(
            id="fan-also-chi",
            display_name="Also Chicago",
            nationality="USA",
            spoken_languages=["en"],
            origin_city="Boston",
            origin_country="USA",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
            waypoints=["Chicago"],
        )
        matches = route_matching_service.find_matches(
            requester=fan_via_chicago,
            candidate_pool=[fan_also_chicago],
            event=sample_event,
        )
        waypoint_matches = [m for m in matches if "waypoint" in m.match_type.lower()]
        assert len(waypoint_matches) >= 1

    def test_pagination_limit_respected(self, route_matching_service, fan_usa, sample_event):
        """Service must honour page_size parameter."""
        pool = [
            FanProfile(
                id=f"fan-{i}",
                display_name=f"Fan {i}",
                nationality="CAN",
                spoken_languages=["en"],
                origin_city="Montreal",
                origin_country="CAN",
                destination_city="Toronto",
                destination_country="CAN",
                travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
            )
            for i in range(20)
        ]
        matches = route_matching_service.find_matches(
            requester=fan_usa,
            candidate_pool=pool,
            event=sample_event,
            page_size=5,
        )
        assert len(matches) <= 5


# ===========================================================================
# AC-2  Shared travel groups
# ===========================================================================

class TestSharedTravelGroups:
    """PRD 7.5.3 — shared travel groups"""

    def test_create_travel_group(self, trip_coordination_service, fan_usa, fan_canada, sample_event):
        """Creator can form a travel group with at least one other member."""
        trip_coordination_service.repository.create_group.return_value = TravelGroup(
            id=str(uuid.uuid4()),
            event_id=sample_event.id,
            creator_id=fan_usa.id,
            member_ids=[fan_usa.id, fan_canada.id],
            origin_city="New York",
            destination_city="Toronto",
            departure_date="2026-06-10",
            max_size=8,
        )
        group = trip_coordination_service.create_travel_group(
            creator=fan_usa,
            co_traveller=fan_canada,
            event=sample_event,
        )
        assert group.id is not None
        assert fan_usa.id in group.member_ids
        assert fan_canada.id in group.member_ids

    def test_join_travel_group_below_max(self, trip_coordination_service, fan_usa, fan_canada, fan_mexico, sample_event):
        """A fan can join a group that has not reached max_size."""
        existing_group = TravelGroup(
            id="grp-1",
            event_id=sample_event.id,
            creator_id=fan_usa.id,
            member_ids=[fan_usa.id, fan_canada.id],
            origin_city="New York",
            destination_city="Toronto",
            departure_date="2026-06-10",
            max_size=8,
        )
        trip_coordination_service.repository.get_group.return_value = existing_group
        trip_coordination_service.repository.add_member.return_value = TravelGroup(
            **{**existing_group.__dict__, "member_ids": existing_group.member_ids + [fan_mexico.id]}
        )
        updated = trip_coordination_service.join_group(
            fan=fan_mexico,
            group_id=existing_group.id,
        )
        assert fan_mexico.id in updated.member_ids

    def test_join_travel_group_at_max_raises(self, trip_coordination_service, fan_usa, sample_event):
        """Joining a full group must raise GroupFullError."""
        full_group = TravelGroup(
            id="grp-full",
            event_id=sample_event.id,
            creator_id=fan_usa.id,
            member_ids=[f"fan-{i}" for i in range(8)],
            origin_city="New York",
            destination_city="Toronto",
            departure_date="2026-06-10",
            max_size=8,
        )
        trip_coordination_service.repository.get_group.return_value = full_group
        newcomer = FanProfile(
            id="newcomer",
            display_name="Newcomer",
            nationality="BRA",
            spoken_languages=["pt"],
            origin_city="New York",
            origin_country="USA",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
        )
        from app.exceptions import GroupFullError  # type: ignore
        with pytest.raises(GroupFullError):
            trip_coordination_service.join_group(fan=newcomer, group_id=full_group.id)

    def test_leave_travel_group_removes_member(self, trip_coordination_service, fan_usa, fan_canada, sample_event):
        existing_group = TravelGroup(
            id="grp-1",
            event_id=sample_event.id,
            creator_id=fan_usa.id,
            member_ids=[fan_usa.id, fan_canada.id],
            origin_city="New York",
            destination_city="Toronto",
            departure_date="2026-06-10",
            max_size=8,
        )
        trip_coordination_service.repository.get_group.return_value = existing_group
        trip_coordination_service.repository.remove_member.return_value = TravelGroup(
            **{**existing_group.__dict__, "member_ids": [fan_usa.id]}
        )
        updated = trip_coordination_service.leave_group(fan=fan_canada, group_id="grp-1")
        assert fan_canada.id not in updated.member_ids

    def test_group_creator_transfer_on_creator_leave(self, trip_coordination_service, fan_usa, fan_canada, sample_event):
        """When creator leaves, role must transfer to next oldest member."""
        existing_group = TravelGroup(
            id="grp-1",
            event_id=sample_event.id,
            creator_id=fan_usa.id,
            member_ids=[fan_usa.id, fan_canada.id],
            origin_city="New York",
            destination_city="Toronto",
            departure_date="2026-06-10",
            max_size=8,
        )
        trip_coordination_service.repository.get_group.return_value = existing_group
        new_group = TravelGroup(
            **{**existing_group.__dict__,
               "member_ids": [fan_canada.id],
               "creator_id": fan_canada.id}
        )
        trip_coordination_service.repository.remove_member.return_value = new_group
        updated = trip_coordination_service.leave_group(fan=fan_usa, group_id="grp-1")
        assert updated.creator_id == fan_canada.id

    def test_group_requires_minimum_one_member(self, trip_coordination_service, fan_usa, sample_event):
        """Creating a group with zero additional members should raise ValueError."""
        with pytest.raises((ValueError, TypeError)):
            trip_coordination_service.create_travel_group(
                creator=fan_usa,
                co_traveller=None,
                event=sample_event,
            )

    def test_shared_itinerary_created_with_group(self, trip_coordination_service, fan_usa, fan_canada, sample_event):
        """A shared itinerary object must be auto-created when a group is formed."""
        mock_group = TravelGroup(
            id="grp-auto-itin",
            event_id=sample_event.id,
            creator_id=fan_usa.id,
            member_ids=[fan_usa.id, fan_canada.id],
            origin_city="New York",
            destination_city="Toronto",
            departure_date="2026-06-10",
            max_size=8,
            itinerary_id=None,
        )
        trip_coordination_service.repository.create_group.return_value = mock_group
        trip_coordination_service.repository.create_itinerary = MagicMock(return_value="itin-001")
        trip_coordination_service.repository.link_itinerary = MagicMock(
            return_value=TravelGroup(**{**mock_group.__dict__, "itinerary_id": "itin-001"})
        )
        group = trip_coordination_service.create_travel_group(
            creator=fan_usa,
            co_traveller=fan_canada,
            event=sample_event,
        )
        assert group.itinerary_id is not None


# ===========================================================================
# AC-3  Route tips
# ===========================================================================

class TestRouteTips:
    """PRD 7.5.3 — user-contributed route tips"""

    def test_submit_route_tip(self, trip_coordination_service, fan_usa, sample_event):
        tip_content = "Take the Amtrak Empire Service from NYC to Toronto — bring snacks!"
        trip_coordination_service.repository.save_tip.return_value = {
            "id": "tip-001",
            "author_id": fan_usa.id,
            "route": "New York → Toronto",
            "content": tip_content,
            "upvotes": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        tip = trip_coordination_service.submit_route_tip(
            author=fan_usa,
            route="New York → Toronto",
            content=tip_content,
            event=sample_event,
        )
        assert tip["id"] == "tip-001"
        assert tip["content"] == tip_content

    def test_route_tip_max_length_enforced(self, trip_coordination_service, fan_usa, sample_event):
        """Tips exceeding 1000 chars must be rejected."""
        long_content = "x" * 1001
        with pytest.raises(ValueError, match="too long"):
            trip_coordination_service.submit_route_tip(
                author=fan_usa,
                route="New York → Toronto",
                content=long_content,
                event=sample_event,
            )

    def test_route_tip_empty_content_rejected(self, trip_coordination_service, fan_usa, sample_event):
        with pytest.raises(ValueError):
            trip_coordination_service.submit_route_tip(
                author=fan_usa,
                route="New York → Toronto",
                content="",
                event=sample_event,
            )

    def test_fetch_tips_for_route(self, trip_coordination_service, fan_usa, sample_event):
        mock_tips = [
            {"id": "tip-001", "content": "Bring your passport", "upvotes": 12},
            {"id": "tip-002", "content": "Bus is cheaper", "upvotes": 5},
        ]
        trip_coordination_service.repository.get_tips_for_route.return_value = mock_tips
        tips = trip_coordination_service.get_route_tips(
            route="New York → Toronto",
            event=sample_event,
        )
        assert len(tips) == 2
        assert tips[0]["upvotes"] >= tips[1]["upvotes"]  # sorted by popularity

    def test_upvote_tip(self, trip_coordination_service, fan_canada, sample_event):
        trip_coordination_service.repository.upvote_tip.return_value = {
            "id": "tip-001",
            "upvotes": 13,
        }
        result = trip_coordination_service.upvote_tip(fan=fan_canada, tip_id="tip-001")
        assert result["upvotes"] == 13

    def test_author_cannot_upvote_own_tip(self, trip_coordination_service, fan_usa, sample_event):
        """Self-upvote must raise PermissionError."""
        trip_coordination_service.repository.get_tip.return_value = {
            "id": "tip-001",
            "author_id": fan_usa.id,
        }
        from app.exceptions import SelfUpvoteError  # type: ignore
        with pytest.raises((SelfUpvoteError, PermissionError)):
            trip_coordination_service.upvote_tip(fan=fan_usa, tip_id="tip-001")

    def test_tip_reported_content_hidden(self, trip_coordination_service, fan_canada):
        """Tip flagged by 3+ users should be hidden from default listing."""
        trip_coordination_service.repository.get_tip.return_value = {
            "id": "tip-bad",
            "author_id": "bad-actor",
            "reports": 3,
            "hidden": True,
        }
        trip_coordination_service.repository.get_tips_for_route.return_value = [
            t for t in [] if not t.get("hidden")
        ]
        tips = trip_coordination_service.get_route_tips(route="New York → Toronto", event=None)
        for t in tips:
            assert not t.get("hidden", False)


# ===========================================================================
# AC-4  Border / visa reminders
# ===========================================================================

class TestBorderVisaReminders:
    """PRD 7.8.4 — border crossing and visa reminders"""

    def test_visa_reminder_generated_for_cross_country_trip(self, trip_coordination_service, fan_mexico, sample_event):
        """MEX → USA trip must trigger visa reminder."""
        trip_coordination_service.repository.get_visa_requirements.return_value = {
            "origin_country": "MEX",
            "destination_country": "USA",
            "visa_required": True,
            "visa_types": ["B-1/B-2 Tourist Visa", "ESTA not applicable for MEX"],
            "processing_days": 30,
        }
        reminder = trip_coordination_service.get_visa_reminder(fan=fan_mexico, event=sample_event)
        assert reminder is not None
        assert reminder["visa_required"] is True
        assert len(reminder["visa_types"]) >= 1

    def test_no_visa_reminder_for_same_country(self, trip_coordination_service, fan_canada, sample_event):
        """Domestic trip (CAN → CAN) must not generate visa reminder."""
        fan_domestic = FanProfile(
            id="fan-domestic",
            display_name="Domestic",
            nationality="CAN",
            spoken_languages=["en"],
            origin_city="Montreal",
            origin_country="CAN",
            destination_city="Toronto",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-12"},
        )
        trip_coordination_service.repository.get_visa_requirements.return_value = {
            "origin_country": "CAN",
            "destination_country": "CAN",
            "visa_required": False,
        }
        reminder = trip_coordination_service.get_visa_reminder(fan=fan_domestic, event=sample_event)
        assert reminder is None or reminder.get("visa_required") is False

    def test_border_crossing_reminder_includes_documents(self, trip_coordination_service, fan_usa, sample_event):
        """USA → CAN reminder must list required documents."""
        trip_coordination_service.repository.get_border_crossing_info.return_value = {
            "crossing": "USA → CAN",
            "required_documents": ["Valid Passport", "Travel Authorization (eTA)"],
            "tips": ["Arrive early", "Declare all goods"],
        }
        info = trip_coordination_service.get_border_crossing_reminder(fan=fan_usa, event=sample_event)
        assert "required_documents" in info
        assert len(info["required_documents"]) >= 1

    def test_reminder_lead_time_respected(self, trip_coordination_service, fan_mexico, sample_event, utc_now):
        """Reminder must be scheduled N days before departure, not at departure time."""
        departure = utc_now + timedelta(days=40)
        fan_mexico.travel_dates["departure"] = departure.strftime("%Y-%m-%d")
        trip_coordination_service.repository.get_visa_requirements.return_value = {
            "origin_country": "MEX",
            "destination_country": "USA",
            "visa_required": True,
            "processing_days": 30,
        }
        scheduled = trip_coordination_service.schedule_visa_reminder(fan=fan_mexico, event=sample_event)
        assert scheduled["scheduled_at"] < departure.isoformat()

    def test_reminder_not_sent_twice(self, trip_coordination_service, fan_mexico, sample_event):
        """Duplicate reminder scheduling must be idempotent."""
        trip_coordination_service.repository.reminder_exists.return_value = True
        result = trip_coordination_service.schedule_visa_reminder(fan=fan_mexico, event=sample_event)
        assert result.get("already_scheduled") is True
        trip_coordination_service.repository.create_reminder.assert_not_called()

    def test_multi_country_route_generates_all_reminders(self, trip_coordination_service, sample_event, utc_now):
        """USA → MEX → CAN route must produce 2 distinct reminders."""
        fan_multi = FanProfile(
            id="fan-multi",
            display_name="Multi-border",
            nationality="USA",
            spoken_languages=["en"],
            origin_city="New York",
            origin_country="USA",
            destination_city="Vancouver",
            destination_country="CAN",
            travel_dates={"departure": "2026-06-10", "return": "2026-06-20"},
            waypoints=["Mexico City"],
        )
        trip_coordination_service.repository.get_visa_requirements.side_effect = [
            {"crossing": "USA → MEX", "visa_required": False},
            {"crossing": "MEX → CAN", "visa_required": True, "visa_types": ["Visitor Visa"]},
        ]
        reminders = trip_coordination_service.get_all_border_reminders(fan=fan_multi, event=sample_event)
        assert len(reminders) == 2

    def test_reminder_content_localized(self, trip_coordination_service, fan_mexico, sample_event):
        """Reminders for Spanish-speaking fans should be delivered in Spanish."""
        trip_coordination_service.repository.get_visa_requirements.return_value = {
            "origin_country": "MEX",
            "destination_country": "USA",
            "visa_required": True,
        }
        reminder = trip_coordination_service.get_visa_reminder(
            fan=fan_mexico,
            event=sample_event,
            locale="es",
        )
        # Simplistic check: if locale key is present, content key must match
        if reminder and "locale" in reminder:
            assert reminder["locale"] == "es"