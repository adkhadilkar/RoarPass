"""
Functional tests for auto-detect and one-tap message translation (PRD 7.7.2, 7.10.5).
Area: translation-layer
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, call
from typing import Optional
import json
import time

# ---------------------------------------------------------------------------
# Stubs / lightweight in-process stand-ins so tests run without a live server
# ---------------------------------------------------------------------------

class FakeTranslationAPIClient:
    """Mimics an external translation API (e.g. DeepL / Google Translate)."""

    SUPPORTED_LANGS = {"en", "fr", "de", "ar", "zh", "ja", "es", "pt", "ko", "ru", "hi"}

    TRANSLATION_FIXTURES = {
        ("en", "fr", "Hello, how are you?"): "Bonjour, comment allez-vous ?",
        ("en", "ar", "Hello, how are you?"): "مرحباً، كيف حالك؟",
        ("fr", "en", "Bonjour tout le monde"): "Hello everyone",
        ("en", "zh", "Match starts in 10 minutes"): "比赛将在10分钟后开始",
        ("es", "en", "¿Dónde está el estadio?"): "Where is the stadium?",
        ("de", "en", "Haben Sie eine Eintrittskarte?"): "Do you have a ticket?",
    }

    async def detect_language(self, text: str) -> dict:
        """Return detected language code and confidence."""
        # Naive heuristic for tests
        if any(c in text for c in "áéíóúñ¿"):
            return {"lang": "es", "confidence": 0.97}
        if any(c in text for c in "àâçèéêëîïôùûü"):
            return {"lang": "fr", "confidence": 0.95}
        if any(c in text for c in "äöüß"):
            return {"lang": "de", "confidence": 0.94}
        if any(c in text for c in "\u0600-\u06ff"):
            return {"lang": "ar", "confidence": 0.99}
        if any("\u4e00" <= c <= "\u9fff" for c in text):
            return {"lang": "zh", "confidence": 0.99}
        return {"lang": "en", "confidence": 0.91}

    async def translate(
        self, text: str, target_lang: str, source_lang: Optional[str] = None
    ) -> dict:
        """Translate text to target_lang."""
        if target_lang not in self.SUPPORTED_LANGS:
            raise ValueError(f"Unsupported target language: {target_lang}")
        if source_lang and source_lang not in self.SUPPORTED_LANGS:
            raise ValueError(f"Unsupported source language: {source_lang}")

        detected = source_lang or (await self.detect_language(text))["lang"]
        key = (detected, target_lang, text)
        translated = self.TRANSLATION_FIXTURES.get(
            key, f"[translated:{target_lang}] {text}"
        )
        return {
            "original": text,
            "translated": translated,
            "source_lang": detected,
            "target_lang": target_lang,
            "character_count": len(text),
        }


class FakeMessage:
    def __init__(
        self,
        message_id: str,
        sender_id: str,
        content: str,
        channel_id: str,
        detected_lang: Optional[str] = None,
    ):
        self.message_id = message_id
        self.sender_id = sender_id
        self.content = content
        self.channel_id = channel_id
        self.detected_lang = detected_lang
        self._translations: dict[str, str] = {}  # {user_id: translated_text}

    def get_translation_for_user(self, user_id: str) -> Optional[str]:
        return self._translations.get(user_id)

    def store_translation(self, user_id: str, translated_text: str):
        """Non-destructive: original content is preserved."""
        self._translations[user_id] = translated_text


class TranslationService:
    """
    Application-level translation service under test.
    Wraps the external API client and provides message-level operations.
    """

    def __init__(self, api_client: FakeTranslationAPIClient, rate_limit_per_user=100):
        self.api = api_client
        self._rate_limit = rate_limit_per_user
        self._usage_counters: dict[str, int] = {}
        self._cache: dict[tuple, str] = {}  # (text, target_lang) -> translation
        self._audit_log: list[dict] = []

    def _check_rate_limit(self, user_id: str):
        count = self._usage_counters.get(user_id, 0)
        if count >= self._rate_limit:
            raise PermissionError(f"Rate limit exceeded for user {user_id}")
        self._usage_counters[user_id] = count + 1

    async def auto_detect_language(self, text: str) -> dict:
        return await self.api.detect_language(text)

    async def translate_message_for_user(
        self, message: FakeMessage, requesting_user_id: str, target_lang: str
    ) -> dict:
        """
        One-tap translation: translate a message for a specific user.
        Non-destructive — original message.content is never modified.
        """
        self._check_rate_limit(requesting_user_id)

        cache_key = (message.content, target_lang)
        if cache_key in self._cache:
            translated = self._cache[cache_key]
            source_lang = "cached"
        else:
            result = await self.api.translate(
                message.content, target_lang, source_lang=message.detected_lang
            )
            translated = result["translated"]
            source_lang = result["source_lang"]
            self._cache[cache_key] = translated

        message.store_translation(requesting_user_id, translated)

        self._audit_log.append(
            {
                "user_id": requesting_user_id,
                "message_id": message.message_id,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "timestamp": time.time(),
            }
        )

        return {
            "original": message.content,
            "translated": translated,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "non_destructive": True,
        }

    async def bulk_translate(
        self, messages: list[FakeMessage], requesting_user_id: str, target_lang: str
    ) -> list[dict]:
        results = []
        for msg in messages:
            if msg.detected_lang == target_lang:
                results.append(
                    {
                        "message_id": msg.message_id,
                        "skipped": True,
                        "reason": "already_in_target_language",
                    }
                )
                continue
            result = await self.translate_message_for_user(msg, requesting_user_id, target_lang)
            results.append({"message_id": msg.message_id, **result})
        return results


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return FakeTranslationAPIClient()


@pytest.fixture
def translation_service(api_client):
    return TranslationService(api_client)


@pytest.fixture
def sample_message():
    return FakeMessage(
        message_id="msg-001",
        sender_id="user-fr-001",
        content="Bonjour tout le monde",
        channel_id="channel-wcq-morocco",
    )


@pytest.fixture
def arabic_message():
    return FakeMessage(
        message_id="msg-002",
        sender_id="user-ar-001",
        content="مرحباً بالجميع",
        channel_id="channel-wcq-morocco",
        detected_lang="ar",
    )


@pytest.fixture
def english_message():
    return FakeMessage(
        message_id="msg-003",
        sender_id="user-en-001",
        content="Hello, how are you?",
        channel_id="channel-wcq-england",
        detected_lang="en",
    )


# ---------------------------------------------------------------------------
# AC-1: Auto-detect language on message ingestion
# ---------------------------------------------------------------------------

class TestAutoDetectLanguage:

    @pytest.mark.asyncio
    async def test_detect_english(self, translation_service):
        result = await translation_service.auto_detect_language("The match starts soon")
        assert result["lang"] == "en"
        assert result["confidence"] >= 0.80

    @pytest.mark.asyncio
    async def test_detect_french(self, translation_service):
        result = await translation_service.auto_detect_language("Bonjour tout le monde")
        assert result["lang"] == "fr"
        assert result["confidence"] >= 0.80

    @pytest.mark.asyncio
    async def test_detect_arabic(self, translation_service):
        # Arabic text — must detect ar
        result = await translation_service.auto_detect_language("مرحباً كيف حالك")
        assert result["lang"] == "ar"
        assert result["confidence"] >= 0.90

    @pytest.mark.asyncio
    async def test_detect_spanish(self, translation_service):
        result = await translation_service.auto_detect_language("¿Dónde está el estadio?")
        assert result["lang"] == "es"
        assert result["confidence"] >= 0.90

    @pytest.mark.asyncio
    async def test_detect_chinese(self, translation_service):
        result = await translation_service.auto_detect_language("比赛将在10分钟后开始")
        assert result["lang"] == "zh"
        assert result["confidence"] >= 0.90

    @pytest.mark.asyncio
    async def test_detect_german(self, translation_service):
        result = await translation_service.auto_detect_language("Haben Sie eine Eintrittskarte?")
        assert result["lang"] == "de"
        assert result["confidence"] >= 0.80

    @pytest.mark.asyncio
    async def test_detection_returns_confidence_score(self, translation_service):
        result = await translation_service.auto_detect_language("Hello world")
        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0

    @pytest.mark.asyncio
    async def test_empty_string_does_not_crash(self, translation_service):
        # Should return a result (may be low confidence)
        result = await translation_service.auto_detect_language("")
        assert "lang" in result


# ---------------------------------------------------------------------------
# AC-2: One-tap non-destructive translation
# ---------------------------------------------------------------------------

class TestOneTapTranslation:

    @pytest.mark.asyncio
    async def test_translate_message_returns_translated_text(
        self, translation_service, sample_message
    ):
        result = await translation_service.translate_message_for_user(
            sample_message, "user-en-002", "en"
        )
        assert "translated" in result
        assert result["translated"] == "Hello everyone"

    @pytest.mark.asyncio
    async def test_original_content_is_preserved_non_destructive(
        self, translation_service, sample_message
    ):
        original_content = sample_message.content
        await translation_service.translate_message_for_user(
            sample_message, "user-en-002", "en"
        )
        assert sample_message.content == original_content  # PRD non-destructive requirement

    @pytest.mark.asyncio
    async def test_translation_stored_per_user_not_globally(
        self, translation_service, sample_message
    ):
        await translation_service.translate_message_for_user(
            sample_message, "user-en-002", "en"
        )
        # user-en-003 has NOT requested a translation yet
        assert sample_message.get_translation_for_user("user-en-003") is None
        assert sample_message.get_translation_for_user("user-en-002") is not None

    @pytest.mark.asyncio
    async def test_two_users_see_different_target_languages(
        self, translation_service, english_message
    ):
        await translation_service.translate_message_for_user(
            english_message, "user-fr-001", "fr"
        )
        await translation_service.translate_message_for_user(
            english_message, "user-ar-001", "ar"
        )
        fr_translation = english_message.get_translation_for_user("user-fr-001")
        ar_translation = english_message.get_translation_for_user("user-ar-001")
        assert fr_translation != ar_translation

    @pytest.mark.asyncio
    async def test_result_includes_non_destructive_flag(
        self, translation_service, sample_message
    ):
        result = await translation_service.translate_message_for_user(
            sample_message, "user-en-002", "en"
        )
        assert result.get("non_destructive") is True

    @pytest.mark.asyncio
    async def test_translate_english_to_french(
        self, translation_service, english_message
    ):
        result = await translation_service.translate_message_for_user(
            english_message, "user-fr-x", "fr"
        )
        assert result["target_lang"] == "fr"
        assert result["translated"] is not None

    @pytest.mark.asyncio
    async def test_translate_english_to_arabic(
        self, translation_service, english_message
    ):
        result = await translation_service.translate_message_for_user(
            english_message, "user-ar-x", "ar"
        )
        assert result["target_lang"] == "ar"
        assert result["translated"] is not None

    @pytest.mark.asyncio
    async def test_unsupported_language_raises_error(
        self, translation_service, english_message
    ):
        with pytest.raises(ValueError, match="Unsupported target language"):
            await translation_service.translate_message_for_user(
                english_message, "user-zz-x", "xx"  # unsupported lang code
            )

    @pytest.mark.asyncio
    async def test_caching_avoids_redundant_api_calls(
        self, translation_service, english_message, api_client
    ):
        # Spy on API calls
        call_count = 0
        original_translate = api_client.translate

        async def counting_translate(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return await original_translate(*args, **kwargs)

        api_client.translate = counting_translate

        await translation_service.translate_message_for_user(
            english_message, "user-a", "fr"
        )
        await translation_service.translate_message_for_user(
            english_message, "user-b", "fr"  # same content + target lang = cache hit
        )
        assert call_count == 1  # Second call should hit cache

    @pytest.mark.asyncio
    async def test_audit_log_records_translation_events(
        self, translation_service, english_message
    ):
        await translation_service.translate_message_for_user(
            english_message, "user-audit-001", "fr"
        )
        log = translation_service._audit_log
        assert len(log) >= 1
        last = log[-1]
        assert last["user_id"] == "user-audit-001"
        assert last["target_lang"] == "fr"
        assert last["message_id"] == english_message.message_id

    @pytest.mark.asyncio
    async def test_rate_limit_enforcement(self, api_client):
        """Users exceeding their quota get PermissionError, not silent failure."""
        tight_service = TranslationService(api_client, rate_limit_per_user=2)
        msg = FakeMessage("m-rl", "s", "Hello world", "ch", "en")
        await tight_service.translate_message_for_user(msg, "user-limited", "fr")
        await tight_service.translate_message_for_user(msg, "user-limited", "de")
        with pytest.raises(PermissionError):
            await tight_service.translate_message_for_user(msg, "user-limited", "es")


# ---------------------------------------------------------------------------
# AC-3: Bulk translation across a channel's history
# ---------------------------------------------------------------------------

class TestBulkTranslation:

    @pytest.mark.asyncio
    async def test_bulk_translate_multiple_messages(self, translation_service):
        msgs = [
            FakeMessage("m1", "s1", "Hello", "ch1", "en"),
            FakeMessage("m2", "s2", "Bonjour", "ch1", "fr"),
            FakeMessage("m3", "s3", "Hola", "ch1", "es"),
        ]
        results = await translation_service.bulk_translate(msgs, "user-de-x", "de")
        assert len(results) == 3
        for r in results:
            assert "message_id" in r

    @pytest.mark.asyncio
    async def test_bulk_translate_skips_same_language_messages(
        self, translation_service
    ):
        msgs = [
            FakeMessage("m1", "s1", "Hello", "ch1", "en"),
            FakeMessage("m2", "s2", "World", "ch1", "en"),  # same target
        ]
        results = await translation_service.bulk_translate(msgs, "user-en-x", "en")
        skipped = [r for r in results if r.get("skipped")]
        assert len(skipped) == 2

    @pytest.mark.asyncio
    async def test_bulk_translate_preserves_original_contents(
        self, translation_service
    ):
        msgs = [
            FakeMessage("m1", "s1", "Bonjour", "ch1", "fr"),
            FakeMessage("m2", "s2", "Hola mundo", "ch1", "es"),
        ]
        originals = [m.content for m in msgs]
        await translation_service.bulk_translate(msgs, "user-en-x", "en")
        for msg, original in zip(msgs, originals):
            assert msg.content == original  # non-destructive

