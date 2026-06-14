"""
Functional tests for Personal Itinerary Builder (PRD §5.5, §7.5.1)
Area: trip-itinerary
"""
import pytest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from typing import Any

# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def user_jwt():
    """Simulate a signed-in fan JWT payload."""
    return {
        "sub": str(uuid.uuid4()),
        "email": "fan@example.com",
        "roles": ["fan"],
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=8)).timestamp()),
    }


@pytest.fixture
def event_fixture():
    return {
        "id": "wc2026-match-42",
        "name": "WC 2026 — Group Stage Match 42",
        "venue": "MetLife Stadium",
        "city": "East Rutherford",
        "country": "US",
        "kickoff_utc": "2026-06-20T18:00:00Z",
        "timezone": "America/New_York",
    }


@pytest.fixture
def itinerary_client(user_jwt, event_fixture):
    """Thin wrapper that mimics HTTP client calls; swap for httpx.AsyncClient in CI."""

    class _FakeItineraryClient:
        def __init__(self):
            self._store: dict[str, Any] = {}
            self._items: dict[str, list] = {}
            self.user_id = user_jwt["sub"]

        # ---- Trip CRUD ---------------------------------------------------
        def create_trip(self, payload: dict) -> dict:
            trip_id = str(uuid.uuid4())
            trip = {
                "id": trip_id,
                "owner_id": self.user_id,
                "title": payload["title"],
                "event_ids": payload.get("event_ids", []),
                "destination": payload.get("destination"),
                "start_date": payload.get("start_date"),
                "end_date": payload.get("end_date"),
                "visibility": payload.get("visibility", "private"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self._store[trip_id] = trip
            self._items[trip_id] = []
            return trip

        def get_trip(self, trip_id: str) -> dict | None:
            return self._store.get(trip_id)

        def update_trip(self, trip_id: str, payload: dict) -> dict:
            trip = self._store[trip_id]
            trip.update(payload)
            trip["updated_at"] = datetime.now(timezone.utc).isoformat()
            return trip

        def delete_trip(self, trip_id: str) -> bool:
            return self._store.pop(trip_id, None) is not None

        def list_trips(self) -> list:
            return [t for t in self._store.values() if t["owner_id"] == self.user_id]

        # ---- Itinerary items ---------------------------------------------
        def add_item(self, trip_id: str, item: dict) -> dict:
            item_id = str(uuid.uuid4())
            entry = {
                "id": item_id,
                "trip_id": trip_id,
                "type": item["type"],   # match | flight | hotel | activity | note
                "title": item["title"],
                "start_time": item.get("start_time"),
                "end_time": item.get("end_time"),
                "location": item.get("location"),
                "notes": item.get("notes", ""),
                "order": len(self._items[trip_id]),
            }
            self._items[trip_id].append(entry)
            return entry

        def get_items(self, trip_id: str) -> list:
            return list(self._items.get(trip_id, []))

        def reorder_items(self, trip_id: str, ordered_ids: list[str]) -> list:
            items = {i["id"]: i for i in self._items[trip_id]}
            reordered = []
            for idx, iid in enumerate(ordered_ids):
                items[iid]["order"] = idx
                reordered.append(items[iid])
            self._items[trip_id] = reordered
            return reordered

        def delete_item(self, trip_id: str, item_id: str) -> bool:
            before = len(self._items[trip_id])
            self._items[trip_id] = [i for i in self._items[trip_id] if i["id"] != item_id]
            return len(self._items[trip_id]) < before

    return _FakeItineraryClient()


# ===========================================================================
# TC-PI-01  Create personal trip
# ===========================================================================
class TestCreatePersonalTrip:
    def test_create_trip_returns_id(self, itinerary_client, event_fixture):
        payload = {
            "title": "My WC 2026 Adventure",
            "event_ids": [event_fixture["id"]],
            "destination": "East Rutherford, NJ",
            "start_date": "2026-06-18",
            "end_date": "2026-06-22",
            "visibility": "private",
        }
        trip = itinerary_client.create_trip(payload)
        assert "id" in trip
        assert trip["title"] == "My WC 2026 Adventure"
        assert trip["visibility"] == "private"

    def test_trip_links_event(self, itinerary_client, event_fixture):
        trip = itinerary_client.create_trip({
            "title": "Match 42 trip",
            "event_ids": [event_fixture["id"]],
        })
        assert event_fixture["id"] in trip["event_ids"]

    def test_trip_owner_is_current_user(self, itinerary_client, user_jwt):
        trip = itinerary_client.create_trip({"title": "Solo trip"})
        assert trip["owner_id"] == user_jwt["sub"]

    def test_trip_timestamps_present(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "Timestamp check"})
        assert trip["created_at"]
        assert trip["updated_at"]

    def test_create_trip_without_event_ids_allowed(self, itinerary_client):
        trip = itinerary_client.create_trip({
            "title": "Blank trip",
            "destination": "Madrid",
        })
        assert trip["event_ids"] == []


# ===========================================================================
# TC-PI-02  Add & manage itinerary items
# ===========================================================================
class TestItineraryItems:
    def test_add_match_item(self, itinerary_client, event_fixture):
        trip = itinerary_client.create_trip({"title": "T"})
        item = itinerary_client.add_item(trip["id"], {
            "type": "match",
            "title": "WC Group Stage Match 42",
            "start_time": event_fixture["kickoff_utc"],
            "location": event_fixture["venue"],
        })
        assert item["type"] == "match"
        assert item["id"] is not None

    def test_add_flight_item(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        item = itinerary_client.add_item(trip["id"], {
            "type": "flight",
            "title": "JFK → LAX",
            "start_time": "2026-06-18T14:00:00Z",
            "end_time": "2026-06-18T17:30:00Z",
        })
        assert item["type"] == "flight"

    def test_add_hotel_item(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        item = itinerary_client.add_item(trip["id"], {
            "type": "hotel",
            "title": "Marriott NJ",
            "start_time": "2026-06-18",
            "end_time": "2026-06-22",
            "location": "50 Kenny Pl, Saddle Brook, NJ",
        })
        assert item["type"] == "hotel"

    def test_add_activity_item(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        item = itinerary_client.add_item(trip["id"], {
            "type": "activity",
            "title": "Times Square Fan Zone",
            "start_time": "2026-06-19T12:00:00Z",
        })
        assert item["type"] == "activity"

    def test_items_ordered_by_insertion(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        for i in range(3):
            itinerary_client.add_item(trip["id"], {"type": "note", "title": f"Note {i}"})
        items = itinerary_client.get_items(trip["id"])
        assert [it["order"] for it in items] == [0, 1, 2]

    def test_reorder_items(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        ids = []
        for i in range(3):
            item = itinerary_client.add_item(trip["id"], {"type": "note", "title": f"Note {i}"})
            ids.append(item["id"])
        reversed_ids = list(reversed(ids))
        reordered = itinerary_client.reorder_items(trip["id"], reversed_ids)
        assert [it["id"] for it in reordered] == reversed_ids

    def test_delete_item(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        item = itinerary_client.add_item(trip["id"], {"type": "note", "title": "Delete me"})
        result = itinerary_client.delete_item(trip["id"], item["id"])
        assert result is True
        items = itinerary_client.get_items(trip["id"])
        assert all(i["id"] != item["id"] for i in items)

    def test_delete_nonexistent_item_returns_false(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        result = itinerary_client.delete_item(trip["id"], "nonexistent-id")
        assert result is False


# ===========================================================================
# TC-PI-03  Trip CRUD operations
# ===========================================================================
class TestTripCRUD:
    def test_list_trips_only_shows_own(self, itinerary_client):
        for i in range(3):
            itinerary_client.create_trip({"title": f"Trip {i}"})
        trips = itinerary_client.list_trips()
        assert len(trips) == 3
        assert all(t["owner_id"] == itinerary_client.user_id for t in trips)

    def test_update_trip_title(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "Old Title"})
        updated = itinerary_client.update_trip(trip["id"], {"title": "New Title"})
        assert updated["title"] == "New Title"

    def test_update_trip_refreshes_updated_at(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        original_ts = trip["updated_at"]
        import time; time.sleep(0.01)
        updated = itinerary_client.update_trip(trip["id"], {"title": "T2"})
        assert updated["updated_at"] >= original_ts

    def test_delete_trip(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        result = itinerary_client.delete_trip(trip["id"])
        assert result is True
        assert itinerary_client.get_trip(trip["id"]) is None

    def test_trip_visibility_default_private(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T"})
        assert trip["visibility"] == "private"

    def test_trip_visibility_can_be_set_to_friends(self, itinerary_client):
        trip = itinerary_client.create_trip({"title": "T", "visibility": "friends"})
        assert trip["visibility"] == "friends"