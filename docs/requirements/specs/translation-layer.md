# Translation Layer — In-App Translation & Phrase Cards
**Spec slug:** `translation-layer`
**Chunk ID:** 7
**PRD refs:** 7.7.2, 7.10.5, 8.6
**Status:** Round 2 (reviewer feedback addressed)

---

## 1. Overview

This specification covers all real-time and on-demand language translation capabilities within RoarPass:

1. **Message Translation** — auto-detection of message language and one-tap, non-destructive overlay translation for any message in any channel type.
2. **Emergency Phrase Cards** — a curated, always-accessible deck of pre-translated emergency and safety phrases in the host city's local language(s), callable from the Emergency SOS widget.

Both features are powered by an external translation API (DeepL preferred; Google Cloud Translation or Azure Cognitive Services as fallback).

---

## 2. Dependency Map

| Dependency | Slug | Nature |
|---|---|---|
| Required upstream | `messaging-realtime` | All channel/message types to be translated are defined here. Translated messages must be overlaid on the existing message model. |
| Required upstream | `identity-onboarding` | `UserTranslationPreference` extends Fan Profile. `preferred_language` from the profile seeds default translation target; profile `languages_spoken` informs auto-translate skip logic. |
| Informing (indirect) | `safety-trust-system` | Emergency Phrase Cards surface inside the Emergency SOS flow (PRD 7.10.5). |
| Informing (indirect) | `country-communities` | Community-level language preference setting (PRD 8.6) modulates auto-translate defaults per channel. |
| Informing (indirect) | `platform-foundation-nfr` | i18n/RTL, WCAG 2.1 AA, GDPR/CCPA privacy, performance SLAs. |

> **Reviewer finding addressed (medium):** The initial dependency list in `chunks.json` omitted `identity-onboarding`. `UserTranslationPreference` (see §6) is a sub-document of the Fan Profile (defined in `identity-onboarding`). The `preferred_language` field set during onboarding seeds the default translation target language, and `languages_spoken` drives the "skip translation" heuristic. This spec explicitly marks `identity-onboarding` as a required upstream dependency. The `chunks.json` entry for `translation-layer` must be updated to include `"identity-onboarding"` in its `dependencies` array alongside `"messaging-realtime"`.

---

## 3. Functional Requirements

### 3.1 Message Translation

**REQ-TRANS-01 — Language Auto-Detection**
The Translation Service MUST call the configured translation API to detect the source language of every inbound message that is stored in the Messaging Service, attaching a `detected_language` ISO 639-1 code and a `detection_confidence` float (0–1) to the message metadata. Detection MUST be performed asynchronously on storage and not block message delivery.

**REQ-TRANS-02 — One-Tap Translation Trigger**
For any message whose `detected_language` differs from the viewing user's `preferred_language`, the client MUST display a **Translate** action affordance (button or icon). Tapping/clicking it MUST fetch and display the translated text within 2 seconds (p95 under normal network conditions).

**REQ-TRANS-03 — Non-Destructive Overlay**
Translation MUST be rendered as an overlay beneath (or adjacent to) the original message text. The original text MUST remain visible and selectable at all times. The translated text MUST be visually distinguished (e.g., lighter weight, icon prefix, or labelled "Translated").

**REQ-TRANS-04 — Per-User Translation Preference**
Users MUST be able to configure:
- `preferred_language` (target translation language; defaults to the `preferred_language` from their Fan Profile set during onboarding).
- `auto_translate_enabled` (boolean; if true, messages in foreign languages are translated automatically without requiring a tap).
- `auto_translate_threshold` (confidence float; messages with `detection_confidence` below this value are not auto-translated; default 0.80).

**REQ-TRANS-05 — Auto-Translate Skip Logic**
If `detected_language` matches any language in the user's `languages_spoken` array (from Fan Profile), the system MUST NOT surface a translation affordance for that message.

**REQ-TRANS-06 — Scope of Translation**
Translation MUST apply to message text in all channel types exposed by `messaging-realtime`:
- 1:1 Direct Messages
- Group chat messages
- Community channel threaded messages
- Match-day live chat messages
- Voice note auto-transcriptions (translate the transcribed text, not the audio)

Translation MUST NOT apply to:
- System/bot messages
- Moderator announcements where the moderator has flagged the message as "official" (to prevent semantic drift in safety-critical content)
- Structured metadata fields (usernames, timestamps, message IDs)

**REQ-TRANS-07 — Caching of Translations**
Translated results MUST be cached server-side keyed on `(message_id, target_language)`. Subsequent requests by any user for the same `(message_id, target_language)` pair MUST be served from cache without a new API call to the external provider. Cache TTL: 30 days or until the source message is deleted, whichever is earlier.

**REQ-TRANS-08 — Dismiss / Hide Translation**
A user who has triggered or auto-received a translation MUST be able to dismiss/hide it, reverting the display to original text only. This preference for an individual message MUST be persisted for the session.

**REQ-TRANS-09 — Translation Attribution**
The client MUST display a small attribution label (e.g., "Translated by DeepL") adjacent to each translated message, in compliance with provider API terms of service.

**REQ-TRANS-10 — Community-Level Language Preference**
Moderators MUST be able to set a `community_default_language` on a Community Channel. When set, this language is used as the default translation target for users who have not explicitly set `preferred_language`, overriding the platform default (English).

---

### 3.2 Emergency Phrase Cards

**REQ-TRANS-11 — Phrase Card Library**
The system MUST maintain a curated library of emergency and safety phrases organized by `category` and `target_language`. Phrase entries are pre-translated and stored statically (not fetched from external API at runtime).

**REQ-TRANS-12 — Phrase Categories**
The library MUST include at minimum the following categories:

| Category | Example Phrases |
|---|---|
| Medical Emergency | "I need an ambulance", "I am having an allergic reaction", "Call a doctor" |
| Police / Security | "I need the police", "I have been robbed", "I need help" |
| Lost / Navigation | "Where is the nearest hospital?", "I am lost", "Please call this number" |
| Stadium / Crowd | "I need to exit", "I have lost my group", "I have a ticket problem" |
| Language Barrier | "Do you speak English?", "Please write it down", "I do not understand" |
| Dietary / Medical | "I am allergic to nuts", "I need halal food", "I am diabetic" |
| Accommodation | "I am locked out of my room", "There is an emergency in my building" |

**REQ-TRANS-13 — Host Language Targeting**
The Phrase Card viewer MUST default to showing phrases translated into the primary language of the user's **current host city** (resolved from event activation data and, if available, device location). Users MUST be able to manually switch the target language to any language available in the library.

**REQ-TRANS-14 — SOS Screen Integration**
When a user activates the Emergency SOS button (defined in `safety-trust-system`), the Phrase Cards screen MUST be accessible within one tap from the SOS overlay. Phrase Cards MUST load without any network call (fully offline-capable).

**REQ-TRANS-15 — Offline Availability**
All Phrase Card content for the user's activated event host cities MUST be downloaded and cached on device at event activation time, and refreshed on each app launch when online. Phrase Cards MUST function fully offline.

**REQ-TRANS-16 — Text-to-Speech for Phrase Cards**
Each phrase MUST have a **Speak** affordance that plays a TTS audio rendering of the phrase in the target language. TTS audio MAY be pre-rendered and bundled (preferred for offline reliability) or fetched via a TTS API when online. When fetched, audio MUST be cached locally after first play.

**REQ-TRANS-17 — Large-Font / Show-Screen Mode**
Phrase Cards MUST support a "show screen" mode where the phrase is rendered at a minimum of 28pt / 32sp, suitable for showing a device screen to another person. This mode MUST maximize contrast and disable surrounding UI chrome.

**REQ-TRANS-18 — Phrase Library Administration**
Platform admins MUST be able to add, edit, retire, and translate phrase entries via the Admin Console. Adding a new host city to an event MUST trigger a workflow to ensure all phrase categories are available in that city's primary language before the event goes live.

---

## 4. Acceptance Criteria

### AC-TRANS-01 — Auto-Detection and Tap-to-Translate
```
Given a community channel message in Korean (detected_language="ko", confidence=0.95)
  And the viewing user has preferred_language="en"
  And languages_spoken does NOT include "ko"
When the user views the message
Then a "Translate" affordance is displayed
When the user taps "Translate"
Then the English translation appears below the original Korean text within 2 seconds (p95)
  And the original Korean text remains fully visible
  And an attribution label "Translated by [Provider]" is shown
```

### AC-TRANS-02 — Non-Destructive Overlay
```
Given a translated message is displayed
When the user taps "Show original" or dismisses the translation
Then the translated text is hidden
  And only the original text is shown
  And this dismiss state persists for the current session
```

### AC-TRANS-03 — Skip Logic for Spoken Languages
```
Given a user has languages_spoken = ["en", "fr"]
  And a message arrives with detected_language = "fr"
When the message is rendered
Then NO translation affordance is shown
  And no translation API call is made
```

### AC-TRANS-04 — Auto-Translate Mode
```
Given a user has auto_translate_enabled = true
  And auto_translate_threshold = 0.80
  And a message arrives with detected_language="ar", detection_confidence=0.92
  And preferred_language="en"
When the message is rendered
Then the Arabic text and its English translation are both shown automatically
  And no user tap is required
```

### AC-TRANS-05 — Translation Cache Hit
```
Given user A has previously requested translation of message_id="M1" to "en"
  And the result is cached
When user B views message_id="M1" and requests English translation
Then the cached translation is returned
  And no new external API call is made
```

### AC-TRANS-06 — Phrase Cards Offline
```
Given the user activated Event X with host cities [City A, City B]
  And the device has been online at least once since activation
When the device is in airplane mode
  And the user opens Emergency SOS
  And navigates to Phrase Cards
Then phrase cards for City A and City B primary languages are displayed
  And no network error occurs
  And TTS audio plays for at least the pre-bundled phrases
```

### AC-TRANS-07 — SOS One-Tap Access
```
Given the Emergency SOS button is tapped from any screen
When the SOS overlay appears
Then a "Phrase Cards" button is present
When tapped
Then Phrase Cards open within 1 second
  And the target language defaults to the primary language of the current host city
```

### AC-TRANS-08 — Large-Font Show-Screen Mode
```
Given a Phrase Card is displayed
When the user activates "Show Screen" mode
Then the phrase text renders at ≥28pt / 32sp
  And surrounding navigation chrome is hidden
  And color contrast ratio is ≥ 7:1 (WCAG AAA, given safety-critical context)
```

### AC-TRANS-09 — Community Language Default Override
```
Given a moderator sets community_default_language = "ar" on a channel
  And a user with no explicit preferred_language preference views a message
Then the default translation target for that channel is Arabic
  And the user can override this in their personal settings
```

### AC-TRANS-10 — Official Message No-Translate
```
Given a moderator posts an announcement flagged as "official"
When any user views the message
Then no "Translate" affordance is shown
  And the message is NOT auto-translated
```

---

## 5. Data Entities & Key Fields

### 5.1 `UserTranslationPreference`
Sub-document extending Fan Profile (owned by `identity-onboarding`).

| Field | Type | Description |
|---|---|---|
| `user_id` | UUID | FK → Fan Profile |
| `preferred_language` | string (ISO 639-1) | Default translation target; seeded from onboarding `preferred_language` |
| `auto_translate_enabled` | boolean | Auto-translate without tap; default `false` |
| `auto_translate_threshold` | float [0–1] | Min confidence for auto-translate; default `0.80` |
| `updated_at` | timestamp | Last preference update |

### 5.2 `MessageTranslationMetadata`
Attached to every `Message` record (owned by `messaging-realtime`).

| Field | Type | Description |
|---|---|---|
| `message_id` | UUID | FK → Message |
| `detected_language` | string (ISO 639-1) | Result of language detection |
| `detection_confidence` | float [0–1] | Provider confidence score |
| `is_official` | boolean | If true, translation is suppressed |
| `detected_at` | timestamp | When detection was run |

### 5.3 `TranslationCache`
Server-side cache record.

| Field | Type | Description |
|---|---|---|
| `cache_id` | UUID | PK |
| `message_id` | UUID | FK → Message |
| `target_language` | string (ISO 639-1) | Language translated into |
| `translated_text` | text | Translated content |
| `provider` | enum | `DEEPL`, `GOOGLE`, `AZURE` |
| `provider_attribution` | string | Provider-mandated attribution string |
| `created_at` | timestamp | |
| `expires_at` | timestamp | TTL = min(30 days, message deletion) |

### 5.4 `PhraseCard`
Static phrase library entry.

| Field | Type | Description |
|---|---|---|
| `phrase_id` | UUID | PK |
| `category` | enum | `MEDICAL`, `POLICE`, `NAVIGATION`, `STADIUM`, `LANGUAGE_BARRIER`, `DIETARY`, `ACCOMMODATION` |
| `source_text` | string | Canonical phrase in English |
| `target_language` | string (ISO 639-1) | Language of translation |
| `translated_text` | string | Pre-translated phrase |
| `romanization` | string \| null | Romanized pronunciation hint (for non-Latin scripts) |
| `tts_audio_url` | string \| null | CDN URL to pre-rendered audio file |
| `is_active` | boolean | Soft-delete / retire flag |
| `created_by` | UUID | Admin user ID |
| `updated_at` | timestamp | |

### 5.5 `EventHostLanguageMapping`
Resolves host city → primary language(s) for phrase card defaulting.

| Field | Type | Description |
|---|---|---|
| `event_id` | UUID | FK → Event (from `event-registry`) |
| `host_city_id` | UUID | FK → HostCity |
| `primary_languages` | string[] (ISO 639-1) | Ordered list; first = default |
| `phrase_cards_ready` | boolean | Workflow gate: all phrase categories available |

---

## 6. API Surface Sketch

All paths are prefixed `/v1`. Auth via JWT Bearer token unless noted.

### 6.1 User Translation Preferences

```
GET  /translation/preferences
Response: UserTranslationPreference

PATCH /translation/preferences
Body:
{
  "preferred_language": "en",         // optional
  "auto_translate_enabled": true,     // optional
  "auto_translate_threshold": 0.85    // optional
}
Response: UserTranslationPreference
```

### 6.2 On-Demand Message Translation

```
POST /translation/messages/{message_id}/translate
Body:
{
  "target_language": "en"   // ISO 639-1; if omitted, uses preferred_language
}
Response:
{
  "message_id": "uuid",
  "source_language": "ko",
  "target_language": "en",
  "translated_text": "...",
  "provider": "DEEPL",
  "provider_attribution": "Translated by DeepL",
  "from_cache": true,
  "detection_confidence": 0.97
}
HTTP 422 if message is_official=true → { "error": "TRANSLATION_SUPPRESSED_OFFICIAL" }
HTTP 429 if rate limit exceeded
```

### 6.3 Phrase Cards

```
GET /translation/phrase-cards
Query params:
  target_language: ISO 639-1  (required)
  category: enum              (optional; if omitted returns all categories)
  event_id: UUID              (optional; used to filter by event-relevant languages)
Response:
{
  "target_language": "ja",
  "cards": [
    {
      "phrase_id": "uuid",
      "category": "MEDICAL",
      "source_text": "I need an ambulance",
      "translated_text": "救急車を呼んでください",
      "romanization": "Kyūkyūsha wo yonde kudasai",
      "tts_audio_url": "https://cdn.roarpass.com/tts/ja/phrase-001.mp3"
    }
  ]
}
// This endpoint is also callable offline via cached client-side data.
// Online responses must include Cache-Control: max-age=86400 for client caching.
```

### 6.4 Event Host Language Mapping (Admin)

```
GET  /admin/events/{event_id}/host-language-mappings
Response: EventHostLanguageMapping[]

PUT  /admin/events/{event_id}/host-cities/{host_city_id}/languages
Body:
{
  "primary_languages": ["ja", "en"],
  "phrase_cards_ready": true
}
Response: EventHostLanguageMapping
```

### 6.5 Phrase Card Administration (Admin)

```
POST   /admin/phrase-cards
PUT    /admin/phrase-cards/{phrase_id}
DELETE /admin/phrase-cards/{phrase_id}   // soft-delete (sets is_active=false)
GET    /admin/phrase-cards
  Query: category, target_language, is_active
```

### 6.6 Internal Service Endpoint (Translation Service → Messaging Service)

Called asynchronously by the Messaging Service after message storage:
```
POST /internal/translation/detect-language
Body: { "message_id": "uuid", "text": "..." }
Response: { "detected_language": "ko", "confidence": 0.97 }
```
This endpoint is NOT exposed externally; mTLS or internal service mesh authentication required.

---

## 7. Non-Functional Requirements (Inherited)

### 7.1 Performance
- Language detection MUST complete within 500ms (p95) and MUST NOT delay message delivery to recipients (async, fire-and-forget).
- On-demand translation (cache miss) MUST complete within 2 seconds (p95) end-to-end including external API round-trip.
- On-demand translation (cache hit) MUST complete within 200ms (p95).
- Phrase Card retrieval (online) MUST complete within 300ms (p95) per PRD §8.1.
- Phrase Card retrieval (offline) MUST complete within 100ms as it is local-only.

### 7.2 Scalability
- Translation cache MUST be implemented on a horizontally scalable store (Redis cluster or DynamoDB); a single cache miss for a high-volume match-day message (e.g., 10,000 viewers) MUST trigger only one upstream API call via a cache stampede prevention mechanism (e.g., probabilistic early expiry or lock-based refresh).
- Match-day live chat during peak events may generate thousands of unique messages per minute; the detection pipeline MUST be queued (e.g., SQS/EventBridge) to absorb spikes without blocking the Messaging Service.

### 7.3 Privacy & GDPR/CCPA
- Message text sent to the external translation API constitutes processing of potentially personal data. A Data Processing Agreement (DPA) MUST be in place with the translation provider before launch.
- Message content sent for translation MUST be pseudonymized at the API boundary: user identifiers and message IDs MUST NOT be included in the payload sent to the external provider.
- Users MUST be informed (in the privacy policy and in-app disclosure at first use of translation) that message content is processed by a third-party translation service.
- Translation cache entries MUST be purged when the source message is deleted (user-initiated or moderation action), honouring the right to erasure.
- `UserTranslationPreference` is user PII; it MUST be included in data export and deletion flows.

### 7.4 Internationalization & RTL
- All translated text MUST be rendered with correct directionality: RTL for Arabic (ar), Hebrew (he), Urdu (ur), and Farsi (fa). The client MUST apply `dir="rtl"` (web) or equivalent layout direction (mobile) based on the `target_language` of the translated text.
- Phrase Cards in RTL languages MUST be rendered RTL in both normal and large-font show-screen modes.
- The Phrase Card library MUST include Arabic, French, Spanish, Portuguese, Japanese, Korean, Hindi, Urdu, and Mandarin Chinese as required languages at launch (aligned with PRD §8.6 minimum 20-language target).
- Romanization/transliteration hints SHOULD be provided for languages using non-Latin scripts to aid pronunciation.

### 7.5 Accessibility (WCAG 2.1 AA)
- Translate button/icon MUST have an accessible label: `aria-label="Translate message to [language]"` (web) / `contentDescription` (Android) / `accessibilityLabel` (iOS).
- Translated text and original text MUST meet WCAG AA contrast ratio (≥ 4.5:1 for normal text).
- Show-screen mode on Phrase Cards MUST meet WCAG AAA contrast (≥ 7:1) given the safety-critical context.
- TTS audio on Phrase Cards must have a visual label of the phrase text so the feature is not audio-only (serves users who are Deaf/hard-of-hearing and need to show text to another person).
- Touch targets for Translate affordance and Phrase Card controls MUST be ≥ 44×44px.
- Screen readers MUST announce translated text with a prefix such as "Translation: [text]" to distinguish it from original content.

### 7.6 Security
- The `/internal/translation/detect-language` endpoint MUST use mTLS or internal service mesh auth and MUST NOT be reachable from the public internet.
- The external translation API key MUST be stored in a secrets manager (e.g., AWS Secrets Manager) and never embedded in client code.
- Rate limiting: `/translation/messages/{id}/translate` MUST be rate-limited per user (e.g., 100 requests/minute) to prevent abuse and cost runaway.
- Admin phrase card management endpoints MUST require `ADMIN` role JWT claim.
- Translation cache keys MUST NOT expose message content; use opaque `(message_id, target_language)` keys.

### 7.7 Reliability & Graceful Degradation
- If the external translation API is unavailable, on-demand translation MUST return a graceful error to the client (HTTP 503 with `"error": "TRANSLATION_UNAVAILABLE"`) and MUST NOT cause message display to fail.
- Phrase Cards, being fully offline-capable, MUST remain functional even if the translation API is unreachable indefinitely post-sync.
- The Translation Service MUST support configuring a primary provider (DeepL) and a fallback provider (Google Cloud Translate or Azure Cognitive Services) with automatic failover.
- Provider failover MUST be transparent to the client; the `provider` field in the response reflects which provider was actually used.

---

## 8. Edge Cases

| # | Edge Case | Handling |
|---|---|---|
| EC-1 | Message contains mixed languages (e.g., code-switching between Hindi and English) | Surface translation affordance; detected language is the dominant one. Translate entire message. Note in UI: "Mixed language detected." |
| EC-2 | Detection confidence < threshold (e.g., very short message: "Ok") | Do not auto-translate; do not show affordance if confidence < 0.50. Show affordance but no auto-translate if 0.50–threshold. |
| EC-3 | `target_language` = `source_language` | Return original text immediately without API call; do not cache. |
| EC-4 | Message is deleted after translation is cached | On message deletion event (from `messaging-realtime`), purge `TranslationCache` entries for that `message_id`. |
| EC-5 | User changes `preferred_language` after translations are displayed | Already-rendered translations remain in their original target language for the session; new tap-to-translates use the updated preference. |
| EC-6 | Voice note message — translation of transcription | Translation applies to the auto-transcribed text (produced by `messaging-realtime` voice transcription). If transcription fails, translation affordance is not shown. |
| EC-7 | Phrase Card library missing a language for a host city | `phrase_cards_ready = false` flag surfaces as an admin console alert. App falls back to English phrase cards with a notice. |
| EC-8 | Very long message (>5,000 characters) | Truncate to 5,000 characters for translation API call; display a notice "Translation may be partial for long messages." Log truncation. |
| EC-9 | Translation API returns empty string or garbled output | Show error state: "Translation unavailable for this message." Do not cache the failure. |
| EC-10 | RTL translated text embedded in LTR conversation thread | Apply bidirectional text isolation (Unicode `bdi` element on web, or per-paragraph directionality on mobile) to prevent layout corruption. |
| EC-11 | Official announcement message — translation suppressed | Client hides translate affordance. If auto-translate is on, suppression takes precedence. Log suppression for audit. |
| EC-12 | User has `languages_spoken` not yet set (new user) | Fall back to `preferred_language` only for skip logic; skip-logic check against `languages_spoken` is a no-op if array is empty. |

---

## 9. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| OQ-1 | Which translation provider is the primary contract? DeepL preferred per PRD 7.7.2, but procurement/DPA status is unknown. The fallback chain (DeepL → Google → Azure) needs confirmation before implementation. | Product / Legal | High |
| OQ-2 | Should phrase card TTS audio be pre-rendered and bundled in the app binary (larger app size, better offline) or fetched-and-cached (smaller binary, requires at least one online session)? A hybrid approach (bundle the 7 safety-critical categories, cache-on-demand for others) may be optimal. | Engineering / Product | Medium |
| OQ-3 | Is romanization/transliteration of phrase cards required at launch for all non-Latin scripts, or only for specific high-priority languages (e.g., Japanese, Korean, Arabic for FIFA World Cup 2026)? | Product / i18n | Medium |
| OQ-4 | Should translation cache be shared across all users (preferred for cost efficiency and covered by this spec) or per-user (stricter privacy isolation but dramatically higher API costs)? GDPR review needed on shared cache model given message content sensitivity. | Legal / Engineering | High |
| OQ-5 | Does the `is_official` flag on moderator announcements need a separate moderation workflow to apply it, or is it auto-applied to all moderator-role posts in announcement channels? | Product / `community-moderation` team | Low |
| OQ-6 | What is the cost budget for translation API calls per event period, and what rate-limiting or caching policies should be enforced to stay within budget? This informs the `auto_translate_threshold` default and rate limits. | Product / Finance | High |
| OQ-7 | For the shared translation cache (OQ-4 permitting), should cache be event-scoped, community-scoped, or global? Global maximises hit rate but may complicate cache invalidation on deletion. | Engineering | Medium |

---

## 10. Cross-Chunk Dependency Notes

| Chunk | Dependency Type | Detail |
|---|---|---|
| `messaging-realtime` (id: 6) | **Hard upstream** | All channel/message types must expose `message_id`, `text`, and `is_official` to the Translation Service. The internal detection endpoint is called by the Messaging Service post-store. Translation cache invalidation is triggered by message deletion events from this service. |
| `identity-onboarding` (id: 2) | **Hard upstream** | `UserTranslationPreference` is a sub-document of Fan Profile. `preferred_language` and `languages_spoken` set during onboarding are consumed by this spec. Changes to Fan Profile deletion/export must cascade to `UserTranslationPreference`. |
| `safety-trust-system` (id: 14) | **Hard downstream consumer** | Emergency Phrase Cards are surfaced within the SOS flow. The SOS spec must reserve a one-tap navigation slot for Phrase Cards and guarantee the flow works offline. |
| `country-communities` (id: 4) | **Soft dependency** | `community_default_language` (REQ-TRANS-10) is a property on community channels. The Community Service schema must accommodate this field; coordination needed. |
| `event-registry` (id: 1) | **Indirect** | `EventHostLanguageMapping` (§5.5) references `event_id` and `host_city_id` from the Event Registry. The phrase cards readiness workflow is triggered by new host city additions. |
| `platform-foundation-nfr` (id: 18) | **NFR governing** | RTL layout, WCAG 2.1 AA, GDPR/CCPA privacy, performance budgets, secrets management, and DPA requirements all flow from this chunk. |