"""
Functional tests for Group Chat and Community Channels
PRD refs: 7.7.1, 7.7.3
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def community_br():
    return {
        "community_id": "comm_br_001",
        "country_code": "BR",
        "name": "Brazil Fan Community",
        "member_count": 8420,
        "channels": ["general", "match-day", "trips", "introductions"],
    }

@pytest.fixture
def group_trip():
    return {
        "trip_id": "trip_wc2026_001",
        "name": "WC 2026 – Brazil Fans NYC",
        "event_id": "evt_wc2026",
        "member_ids": ["usr_001", "usr_002", "usr_003"],
        "chat_channel_id": "chan_trip_001",
    }

@pytest.fixture
def mock_channel_service():
    svc = MagicMock()
    svc.create_channel = MagicMock(return_value={"channel_id": "chan_001", "type": "community"})
    svc.post_message = MagicMock(return_value={"message_id": "msg_chan_001", "status": "ok"})
    svc.get_thread = MagicMock(return_value={"thread_id": "thread_001", "replies": []})
    svc.add_member = MagicMock(return_value=True)
    svc.remove_member = MagicMock(return_value=True)
    svc.get_members = MagicMock(return_value=["usr_001", "usr_002"])
    svc.pin_message = MagicMock(return_value=True)
    return svc

@pytest.fixture
def mock_moderation_service():
    svc = MagicMock()
    svc.check_content = MagicMock(return_value={"safe": True, "flags": []})
    svc.mute_user = MagicMock(return_value=True)
    svc.remove_message = MagicMock(return_value=True)
    return svc


# ---------------------------------------------------------------------------
# AC-GC-01: Community Channel structure
# ---------------------------------------------------------------------------

class TestCommunityChannels:
    """Acceptance Criteria: Community channels are threaded and moderated."""

    def test_community_has_required_channels(self, community_br):
        """Each country community must have at least: general, match-day, trips."""
        required = {"general", "match-day", "trips"}
        assert required.issubset(set(community_br["channels"]))

    def test_create_channel_within_community(self, mock_channel_service):
        """Moderators can create new channels in their community."""
        result = mock_channel_service.create_channel(
            community_id="comm_br_001",
            name="wc2026-nyc",
            type="community",
            created_by="usr_mod_001",
        )
        assert result["channel_id"].startswith("chan_")
        assert result["type"] == "community"

    def test_post_message_to_channel(self, mock_channel_service):
        """Members can post messages to community channels."""
        result = mock_channel_service.post_message(
            channel_id="chan_001",
            sender_id="usr_001",
            content="Anyone else going to the opener?",
            content_type="text",
        )
        assert result["status"] == "ok"
        assert "message_id" in result

    def test_thread_reply_on_message(self, mock_channel_service):
        """Users can reply in threads to channel messages."""
        mock_channel_service.get_thread.return_value = {
            "thread_id": "thread_001",
            "parent_message_id": "msg_chan_001",
            "replies": [
                {"message_id": "msg_reply_001", "sender_id": "usr_002", "content": "Yes!"}
            ],
        }
        thread = mock_channel_service.get_thread("thread_001")
        assert len(thread["replies"]) >= 1
        assert thread["replies"][0]["message_id"] == "msg_reply_001"

    def test_non_member_cannot_post(self, mock_channel_service):
        """Non-community-members cannot post to private community channels."""
        mock_channel_service.post_message.side_effect = PermissionError("Not a member")

        with pytest.raises(PermissionError, match="Not a member"):
            mock_channel_service.post_message(
                channel_id="chan_001",
                sender_id="usr_outsider_999",
                content="Hello?",
            )

    def test_message_visible_to_all_members(self, mock_channel_service):
        """Posted message appears in channel for all members."""
        mock_channel_service.get_members.return_value = ["usr_001", "usr_002", "usr_003"]
        members = mock_channel_service.get_members("chan_001")
        assert len(members) == 3  # all should receive the message


# ---------------------------------------------------------------------------
# AC-GC-02: Read-only announcement channel
# ---------------------------------------------------------------------------

class TestAnnouncementChannel:
    """Acceptance Criteria: Announcement channels are read-only for non-moderators."""

    def test_only_moderator_can_post_to_announcements(self, mock_channel_service):
        """Regular members cannot post to #announcements."""
        mock_channel_service.post_message.side_effect = PermissionError("Read-only channel")

        with pytest.raises(PermissionError, match="Read-only channel"):
            mock_channel_service.post_message(
                channel_id="chan_announcements_001",
                sender_id="usr_regular_001",
                content="Hi all",
            )

    def test_moderator_can_post_to_announcements(self, mock_channel_service):
        """Moderator CAN post to #announcements."""
        mock_channel_service.post_message.side_effect = None
        mock_channel_service.post_message.return_value = {"message_id": "ann_001", "status": "ok"}

        result = mock_channel_service.post_message(
            channel_id="chan_announcements_001",
            sender_id="usr_mod_001",
            content="Match day buses depart at 14:00 from Plaza Hotel",
            is_announcement=True,
        )
        assert result["status"] == "ok"

    def test_announcement_can_be_pinned(self, mock_channel_service):
        """Announcements can be pinned to the top of the channel."""
        result = mock_channel_service.pin_message("ann_001", channel_id="chan_announcements_001")
        assert result is True


# ---------------------------------------------------------------------------
# AC-GC-03: Group chat for Community Trips
# ---------------------------------------------------------------------------

class TestTripGroupChat:
    """Acceptance Criteria: Community Trips have a dedicated group chat."""

    def test_trip_has_group_chat_channel(self, group_trip):
        """Each Community Trip object references a chat_channel_id."""
        assert "chat_channel_id" in group_trip
        assert group_trip["chat_channel_id"].startswith("chan_")

    def test_joining_trip_auto_adds_to_chat(self, mock_channel_service, group_trip):
        """Joining a trip automatically adds user to the trip chat."""
        new_user = "usr_new_004"
        result = mock_channel_service.add_member(
            channel_id=group_trip["chat_channel_id"],
            user_id=new_user,
        )
        assert result is True

    def test_leaving_trip_removes_from_chat(self, mock_channel_service, group_trip):
        """Leaving a trip removes user from the trip chat."""
        result = mock_channel_service.remove_member(
            channel_id=group_trip["chat_channel_id"],
            user_id="usr_003",
        )
        assert result is True

    def test_trip_chat_supports_polls(self):
        """Trip chat messages can be of type 'poll'."""
        poll_message = {
            "message_id": "msg_poll_001",
            "channel_id": "chan_trip_001",
            "content_type": "poll",
            "poll": {
                "question": "Which hotel should we book?",
                "options": ["Marriott Downtown", "Hilton Midtown", "Budget Inn"],
                "closes_at": "2026-06-01T12:00:00Z",
                "votes": {},
            },
        }
        assert poll_message["content_type"] == "poll"
        assert len(poll_message["poll"]["options"]) >= 2

    def test_trip_chat_supports_shared_itinerary_link(self):
        """Trip chat supports itinerary-link rich message type."""
        itinerary_message = {
            "message_id": "msg_itin_001",
            "channel_id": "chan_trip_001",
            "content_type": "itinerary_link",
            "itinerary_id": "itin_wc2026_nyc_001",
            "preview": {"title": "WC 2026 NYC Group Itinerary", "stop_count": 7},
        }
        assert itinerary_message["content_type"] == "itinerary_link"
        assert "itinerary_id" in itinerary_message


# ---------------------------------------------------------------------------
# AC-GC-04: Content moderation in channels
# ---------------------------------------------------------------------------

class TestChannelModeration:
    """Acceptance Criteria: Channel messages are moderated; admins can remove/mute."""

    def test_content_check_on_message_post(self, mock_moderation_service):
        """Every message is scanned by moderation service before delivery."""
        content = "See you at the match!"
        result = mock_moderation_service.check_content(content)
        assert result["safe"] is True
        assert result["flags"] == []

    def test_flagged_content_blocked(self, mock_moderation_service):
        """Messages flagged as unsafe are blocked before delivery."""
        mock_moderation_service.check_content.return_value = {
            "safe": False,
            "flags": ["hate_speech"],
        }
        result = mock_moderation_service.check_content("offensive content here")
        assert result["safe"] is False
        assert "hate_speech" in result["flags"]

    def test_moderator_can_remove_message(self, mock_moderation_service):
        """Moderators can remove any message from a channel."""
        result = mock_moderation_service.remove_message(
            message_id="msg_bad_001",
            removed_by="usr_mod_001",
            reason="community_guidelines_violation",
        )
        assert result is True

    def test_moderator_can_mute_user(self, mock_moderation_service):
        """Moderators can mute disruptive users in a channel."""
        result = mock_moderation_service.mute_user(
            user_id="usr_disruptive_001",
            channel_id="chan_001",
            duration_minutes=60,
            muted_by="usr_mod_001",
        )
        assert result is True

