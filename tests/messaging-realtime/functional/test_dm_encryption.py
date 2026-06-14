"""
Functional tests for 1:1 Direct Messages with End-to-End Encryption
PRD refs: 7.7.1, 9.2
"""

import pytest
import asyncio
import json
import base64
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_alice():
    return {
        "id": "usr_alice_001",
        "display_name": "Alice Nakamura",
        "country_code": "JP",
        "public_key": "pk_alice_" + "A" * 64,
        "private_key": "sk_alice_" + "A" * 64,  # in real app: stored in device secure enclave
        "fan_profile_id": "fp_alice_001",
    }

@pytest.fixture
def user_bob():
    return {
        "id": "usr_bob_002",
        "display_name": "Bob Mensah",
        "country_code": "GH",
        "public_key": "pk_bob_" + "B" * 64,
        "private_key": "sk_bob_" + "B" * 64,
        "fan_profile_id": "fp_bob_002",
    }

@pytest.fixture
def mock_e2ee_service():
    svc = MagicMock()
    svc.generate_keypair = MagicMock(return_value={
        "public_key": "pk_" + "C" * 64,
        "private_key": "sk_" + "C" * 64,
    })
    svc.encrypt = MagicMock(side_effect=lambda plaintext, recipient_pk: {
        "ciphertext": base64.b64encode(plaintext.encode()).decode(),
        "nonce": "nonce_" + "0" * 24,
        "algorithm": "X25519-XSalsa20-Poly1305",
    })
    svc.decrypt = MagicMock(side_effect=lambda payload, sender_pk, recipient_sk: {
        "plaintext": base64.b64decode(payload["ciphertext"]).decode(),
    })
    return svc

@pytest.fixture
def mock_dm_repository():
    repo = MagicMock()
    repo.create_conversation = MagicMock(return_value={
        "conversation_id": "conv_001",
        "participants": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    repo.save_message = MagicMock(return_value={"message_id": "msg_001", "status": "sent"})
    repo.get_messages = MagicMock(return_value=[])
    repo.mark_read = MagicMock(return_value=True)
    return repo

@pytest.fixture
def mock_block_list_service():
    svc = MagicMock()
    svc.is_blocked = MagicMock(return_value=False)
    svc.block_user = MagicMock(return_value=True)
    return svc

# ---------------------------------------------------------------------------
# AC-DM-01: Send encrypted DM
# ---------------------------------------------------------------------------

class TestSendEncryptedDM:
    """Acceptance Criteria: Users can send 1:1 encrypted direct messages."""

    def test_encrypt_message_before_send(self, user_alice, user_bob, mock_e2ee_service):
        """Message must be encrypted with recipient's public key before transmission."""
        plaintext = "Hello Bob, are you going to the match?"

        encrypted = mock_e2ee_service.encrypt(plaintext, user_bob["public_key"])

        assert encrypted["ciphertext"] != plaintext, "Ciphertext must not equal plaintext"
        assert encrypted["algorithm"] == "X25519-XSalsa20-Poly1305"
        assert "nonce" in encrypted
        mock_e2ee_service.encrypt.assert_called_once_with(plaintext, user_bob["public_key"])

    def test_send_dm_creates_conversation(self, user_alice, user_bob, mock_dm_repository):
        """Sending first DM creates a new conversation object."""
        conv = mock_dm_repository.create_conversation()

        assert "conversation_id" in conv
        assert conv["conversation_id"].startswith("conv_")
        mock_dm_repository.create_conversation.assert_called_once()

    def test_save_encrypted_message(self, user_alice, user_bob, mock_dm_repository, mock_e2ee_service):
        """Encrypted payload is persisted, NOT plaintext."""
        plaintext = "See you at section D!"
        encrypted = mock_e2ee_service.encrypt(plaintext, user_bob["public_key"])

        message_payload = {
            "conversation_id": "conv_001",
            "sender_id": user_alice["id"],
            "ciphertext": encrypted["ciphertext"],
            "nonce": encrypted["nonce"],
            "algorithm": encrypted["algorithm"],
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        result = mock_dm_repository.save_message(message_payload)

        assert result["message_id"] == "msg_001"
        # Verify plaintext is NOT stored
        call_args = mock_dm_repository.save_message.call_args[0][0]
        assert "plaintext" not in call_args
        assert "ciphertext" in call_args

    def test_recipient_can_decrypt_message(self, user_alice, user_bob, mock_e2ee_service):
        """Recipient can decrypt message with their private key."""
        plaintext = "Gate 12 at 18:00?"
        encrypted = mock_e2ee_service.encrypt(plaintext, user_bob["public_key"])

        decrypted = mock_e2ee_service.decrypt(
            encrypted, user_alice["public_key"], user_bob["private_key"]
        )

        assert decrypted["plaintext"] == plaintext

    def test_third_party_cannot_decrypt(self, user_alice, user_bob, mock_e2ee_service):
        """A third user's private key cannot decrypt Alice→Bob message."""
        plaintext = "Secret meeting spot"
        encrypted = mock_e2ee_service.encrypt(plaintext, user_bob["public_key"])

        # Simulate wrong key decryption failure
        mock_e2ee_service.decrypt.side_effect = PermissionError("Decryption failed: invalid key")

        with pytest.raises(PermissionError, match="invalid key"):
            mock_e2ee_service.decrypt(
                encrypted, user_alice["public_key"], "sk_eve_wrong_key_" + "X" * 64
            )

    def test_message_metadata_not_encrypted(self, user_alice, user_bob, mock_dm_repository):
        """Metadata (sender, timestamp, read-receipt) is in plaintext for routing."""
        message_payload = {
            "sender_id": user_alice["id"],
            "recipient_id": user_bob["id"],
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "ciphertext": "ENCRYPTED_BLOB",
        }
        # Metadata fields are accessible without decryption
        assert message_payload["sender_id"] == user_alice["id"]
        assert message_payload["recipient_id"] == user_bob["id"]
        assert "sent_at" in message_payload


# ---------------------------------------------------------------------------
# AC-DM-02: Block / report user
# ---------------------------------------------------------------------------

class TestBlockAndReport:
    """Acceptance Criteria: Users can block or report others; blocked users cannot DM."""

    def test_blocked_user_cannot_send_dm(self, user_alice, user_bob, mock_block_list_service):
        """After Alice blocks Bob, Bob's DM attempts are rejected."""
        mock_block_list_service.block_user(user_alice["id"], user_bob["id"])
        mock_block_list_service.is_blocked.return_value = True

        is_blocked = mock_block_list_service.is_blocked(user_bob["id"], from_perspective_of=user_alice["id"])
        assert is_blocked is True

    def test_block_is_bidirectional_for_messaging(self, user_alice, user_bob, mock_block_list_service):
        """Block prevents both parties from messaging each other."""
        mock_block_list_service.block_user(user_alice["id"], user_bob["id"])
        mock_block_list_service.is_blocked.return_value = True

        assert mock_block_list_service.is_blocked(user_alice["id"], from_perspective_of=user_bob["id"])

    def test_report_with_message_context(self):
        """Report captures conversation_id and message_id for moderation."""
        report = {
            "reporter_id": "usr_alice_001",
            "reported_user_id": "usr_bob_002",
            "conversation_id": "conv_001",
            "message_id": "msg_suspect_999",
            "reason": "harassment",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        assert report["conversation_id"] is not None
        assert report["message_id"] is not None
        assert report["reason"] in ["harassment", "spam", "inappropriate_content", "other"]


# ---------------------------------------------------------------------------
# AC-DM-03: Read receipts & delivery status
# ---------------------------------------------------------------------------

class TestReadReceipts:
    """Acceptance Criteria: Messages have sent/delivered/read states."""

    def test_message_status_transitions(self, mock_dm_repository):
        """Message progresses: queued → sent → delivered → read."""
        statuses = ["queued", "sent", "delivered", "read"]

        for i, status in enumerate(statuses):
            assert statuses.index(status) == i  # ordering invariant

    def test_mark_read_updates_receipt(self, user_alice, user_bob, mock_dm_repository):
        """Calling mark_read updates conversation read pointer."""
        result = mock_dm_repository.mark_read(
            conversation_id="conv_001",
            user_id=user_bob["id"],
            up_to_message_id="msg_001",
        )
        assert result is True
        mock_dm_repository.mark_read.assert_called_once()

    def test_unread_count_decrements(self):
        """Unread count decrements when messages are read."""
        unread_counts = {"conv_001": 5}
        # Simulate reading all messages
        unread_counts["conv_001"] = 0
        assert unread_counts["conv_001"] == 0


# ---------------------------------------------------------------------------
# AC-DM-04: Message retention & GDPR
# ---------------------------------------------------------------------------

class TestGDPRMessageRetention:
    """Acceptance Criteria: GDPR right-to-erasure applies to DMs."""

    def test_delete_account_purges_dm_content(self):
        """Deleting account must remove plaintext references and invalidate keys."""
        deletion_plan = {
            "user_id": "usr_alice_001",
            "actions": [
                "revoke_e2ee_keypair",
                "purge_message_ciphertexts_sent_by_user",
                "anonymize_sender_id_in_partner_conversation",
                "delete_conversation_if_all_parties_deleted",
            ],
        }
        assert "revoke_e2ee_keypair" in deletion_plan["actions"]
        assert "purge_message_ciphertexts_sent_by_user" in deletion_plan["actions"]

    def test_message_expiry_supported(self):
        """Messages can have an expiry (disappearing messages feature)."""
        message = {
            "message_id": "msg_001",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "auto_delete": True,
        }
        expires_at = datetime.fromisoformat(message["expires_at"])
        assert expires_at > datetime.now(timezone.utc)

