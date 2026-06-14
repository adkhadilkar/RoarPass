"""
Functional tests – Admin Event Management
PRD refs: 6.6, 7.12.1
Acceptance criteria:
  - Super-admin can CRUD events
  - Event status transitions (draft → active → archived)
  - Event activation triggers auto-join for linked country communities
  - Unauthorised roles cannot mutate events
  - Audit log entry created on each mutation
"""

import uuid
import pytest
import requests
from conftest import ADMIN_API_BASE, API_BASE


class TestEventCRUD:
    def test_create_event_as_super_admin(self, admin_headers):
        """AC: Super-admin can create an event in draft state."""
        payload = {
            "name": f"CRUD Event {uuid.uuid4().hex[:6]}",
            "type": "world_cup",
            "start_date": "2026-06-01T00:00:00Z",
            "end_date": "2026-07-15T00:00:00Z",
            "host_countries": ["US", "CA", "MX"],
            "status": "draft",
        }
        resp = requests.post(f"{ADMIN_API_BASE}/events", json=payload, headers=admin_headers, timeout=10)
        assert resp.status_code in (200, 201), f"Expected 200/201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["status"] == "draft"
        assert set(data["host_countries"]) == {"US", "CA", "MX"}
        self.__class__._created_event_id = data["id"]

    def test_read_event(self, admin_headers):
        """AC: Super-admin can retrieve event details."""
        event_id = self.__class__._created_event_id
        resp = requests.get(f"{ADMIN_API_BASE}/events/{event_id}", headers=admin_headers, timeout=10)
        assert resp.status_code == 200
        assert resp.json()["id"] == event_id

    def test_update_event(self, admin_headers):
        """AC: Super-admin can update event metadata."""
        event_id = self.__class__._created_event_id
        resp = requests.patch(
            f"{ADMIN_API_BASE}/events/{event_id}",
            json={"name": "Updated WC Event Name"},
            headers=admin_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated WC Event Name"

    def test_delete_event(self, admin_headers):
        """AC: Super-admin can delete a draft event."""
        event_id = self.__class__._created_event_id
        resp = requests.delete(f"{ADMIN_API_BASE}/events/{event_id}", headers=admin_headers, timeout=10)
        assert resp.status_code in (200, 204)

    def test_list_events_pagination(self, admin_headers):
        """AC: Event listing supports pagination."""
        resp = requests.get(
            f"{ADMIN_API_BASE}/events?page=1&page_size=10",
            headers=admin_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body

    def test_regular_user_cannot_create_event(self, user_headers):
        """AC: Non-admin role receives 403 on event creation."""
        payload = {"name": "Hack Event", "type": "world_cup", "status": "draft"}
        resp = requests.post(f"{ADMIN_API_BASE}/events", json=payload, headers=user_headers, timeout=10)
        assert resp.status_code == 403

    def test_event_admin_cannot_delete_event(self, event_admin_headers, seeded_event):
        """AC: Event-admin role cannot delete events (insufficient privilege)."""
        resp = requests.delete(
            f"{ADMIN_API_BASE}/events/{seeded_event['id']}",
            headers=event_admin_headers,
            timeout=10,
        )
        assert resp.status_code in (403, 404)


class TestEventStatusTransitions:
    def test_draft_to_active_transition(self, admin_headers, seeded_event):
        """AC: Transition draft → active succeeds for super-admin."""
        resp = requests.patch(
            f"{ADMIN_API_BASE}/events/{seeded_event['id']}/status",
            json={"status": "active"},
            headers=admin_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_invalid_transition_active_to_draft(self, admin_headers, activated_event):
        """AC: Backward transition active → draft is rejected (422 or 400)."""
        resp = requests.patch(
            f"{ADMIN_API_BASE}/events/{activated_event['id']}/status",
            json={"status": "draft"},
            headers=admin_headers,
            timeout=10,
        )
        assert resp.status_code in (400, 422), f"Expected 400/422, got {resp.status_code}"

    def test_active_to_archived_transition(self, admin_headers):
        """AC: Transition active → archived succeeds."""
        # Create + activate a fresh event for this test
        payload = {
            "name": f"Archive Me {uuid.uuid4().hex[:6]}",
            "type": "club_world_cup",
            "start_date": "2025-12-01T00:00:00Z",
            "end_date": "2025-12-15T00:00:00Z",
            "host_countries": ["SA"],
            "status": "draft",
        }
        ev = requests.post(f"{ADMIN_API_BASE}/events", json=payload, headers=admin_headers, timeout=10).json()
        requests.patch(f"{ADMIN_API_BASE}/events/{ev['id']}/status", json={"status": "active"}, headers=admin_headers, timeout=10)
        resp = requests.patch(
            f"{ADMIN_API_BASE}/events/{ev['id']}/status",
            json={"status": "archived"},
            headers=admin_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"
        # cleanup
        requests.delete(f"{ADMIN_API_BASE}/events/{ev['id']}", headers=admin_headers, timeout=10)


class TestEventActivationAutoJoin:
    """
    Integration test: Event activation → auto-join community members.
    Dependency: community-moderation, event-registry.
    """

    def test_activation_triggers_community_auto_join(self, admin_headers, seeded_event, seeded_users):
        """
        AC (integration): When event is activated and has a community with auto_join=True,
        all users whose country matches are automatically enrolled.
        """
        # Create community linked to seeded_event with auto_join=True
        comm_payload = {
            "event_id": seeded_event["id"],
            "country_code": "QA",
            "display_name": "AutoJoin QA",
            "auto_join": True,
        }
        comm_resp = requests.post(f"{ADMIN_API_BASE}/communities", json=comm_payload, headers=admin_headers, timeout=10)
        assert comm_resp.status_code in (200, 201)
        community = comm_resp.json()

        # Activate the event
        act_resp = requests.patch(
            f"{ADMIN_API_BASE}/events/{seeded_event['id']}/status",
            json={"status": "active"},
            headers=admin_headers,
            timeout=10,
        )
        assert act_resp.status_code == 200

        # Verify community membership was created for matching users
        members_resp = requests.get(
            f"{ADMIN_API_BASE}/communities/{community['id']}/members",
            headers=admin_headers,
            timeout=10,
        )
        assert members_resp.status_code == 200
        members = members_resp.json()
        member_ids = {m["user_id"] for m in members.get("items", members if isinstance(members, list) else [])}

        qa_users = [u for u in seeded_users if u.get("country_code") == "QA"]
        for user in qa_users:
            assert user["id"] in member_ids, (
                f"User {user['id']} (QA) should be auto-joined to community {community['id']}"
            )

        # cleanup community
        requests.delete(f"{ADMIN_API_BASE}/communities/{community['id']}", headers=admin_headers, timeout=10)


class TestAuditLog:
    def test_event_mutation_creates_audit_entry(self, admin_headers, seeded_event):
        """AC (PRD 9.2): Every admin mutation records an audit log entry."""
        # Perform a mutation
        requests.patch(
            f"{ADMIN_API_BASE}/events/{seeded_event['id']}",
            json={"name": f"Audit Test {uuid.uuid4().hex[:4]}"},
            headers=admin_headers,
            timeout=10,
        )
        # Check audit log
        resp = requests.get(
            f"{ADMIN_API_BASE}/audit-log?resource_type=event&resource_id={seeded_event['id']}&limit=5",
            headers=admin_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        entries = resp.json().get("items", resp.json() if isinstance(resp.json(), list) else [])
        assert len(entries) >= 1
        latest = entries[0]
        assert latest["resource_type"] == "event"
        assert latest["resource_id"] == str(seeded_event["id"])
        assert "actor_id" in latest
        assert "action" in latest
        assert "timestamp" in latest

    def test_audit_log_non_admin_access_denied(self, user_headers, seeded_event):
        """AC (PRD 9.2): Regular users cannot read audit logs."""
        resp = requests.get(
            f"{ADMIN_API_BASE}/audit-log?resource_type=event&resource_id={seeded_event['id']}",
            headers=user_headers,
            timeout=10,
        )
        assert resp.status_code == 403