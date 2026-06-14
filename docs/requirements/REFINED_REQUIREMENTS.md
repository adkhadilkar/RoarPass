# RoarPass — Refined Requirements

## Traceability

| Chunk | PRD refs | Spec |
|---|---|---|
| Event Registry & Configuration | 4, 5.1, 7.1, 7.8.2 | `docs/requirements/specs/event-registry.md` |
| User Identity, Onboarding & Roles | 5.3, 6, 7.2.1, 7.2.2, 7.2.3, 9.2 | `docs/requirements/specs/identity-onboarding.md` |
| Verification Tiers & Trust Signals | 7.2.4, 7.10.1, 5.3 | `docs/requirements/specs/verification-trust-tiers.md` |
| Country & City Communities | 5.2, 7.3.1, 7.3.2, 7.3.3 | `docs/requirements/specs/country-communities.md` |
| Community Moderation & Content Governance | 6.4, 7.3.2, 7.10.2, 7.12.2, 7.12.3 | `docs/requirements/specs/community-moderation.md` |
| Messaging & Real-Time Communications | 7.7.1, 7.7.3, 9.2 | `docs/requirements/specs/messaging-realtime.md` |
| In-App Translation & Phrase Cards | 7.7.2, 7.10.5, 8.6 | `docs/requirements/specs/translation-layer.md` |
| Notifications & Alert Delivery | 7.7.4, 7.8.3, 9.2 | `docs/requirements/specs/notifications.md` |
| Personal & Group Itinerary Planning | 5.5, 7.5.1, 7.5.2, 7.5.4 | `docs/requirements/specs/trip-itinerary.md` |
| Intercity Trip Coordination | 7.5.3, 7.4.1, 7.8.4 | `docs/requirements/specs/intercity-coordination.md` |
| Local Helper Network | 5.4, 6.2, 7.6.1, 7.6.2, 7.6.3, 7.6.4 | `docs/requirements/specs/helper-network.md` |
| Smart Fan Matching & Discovery | 7.4.1, 7.4.2, 7.4.3, 7.9.1, 7.9.2 | `docs/requirements/specs/matching-engine.md` |
| Official Information & Visa Intelligence | 7.8.1, 7.8.2, 7.8.4 | `docs/requirements/specs/official-info-layer.md` |
| Safety Modes, Meetup Safety & SOS | 7.10.2, 7.10.3, 7.10.4, 7.10.5 | `docs/requirements/specs/safety-trust-system.md` |
| Business Partner Portal | 6.5, 7.11.1, 7.11.2, 7.11.3 | `docs/requirements/specs/business-partner-portal.md` |
| Admin Console & Analytics Dashboard | 6.6, 7.12.1, 7.12.2, 7.12.3, 7.12.4, 9.2 | `docs/requirements/specs/admin-console-analytics.md` |
| AI Trip Assistant | 7.9.3 | `docs/requirements/specs/ai-trip-assistant.md` |
| Platform Foundation, Security & Compliance | 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.3, 9.4, 9.5 | `docs/requirements/specs/platform-foundation-nfr.md` |

---


# In-App Translation & Phrase Cards

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

# AI Trip Assistant

# AI Trip Assistant — Requirement Spec
**Chunk ID:** 17 | **Slug:** `ai-trip-assistant` | **PRD Ref:** 7.9.3  
**Phase:** 3 (Post-MVP)  
**Status:** Draft v1.0  
**Dependencies:** `trip-itinerary`, `intercity-coordination`, `helper-network`, `matching-engine`

---

## 1. Overview

The AI Trip Assistant is an LLM-powered conversational interface embedded in the RoarPass mobile and web apps. It operates as a context-aware planning companion that has access to the user's personal itinerary, the event schedule, intercity route data, helper availability, and matching signals. It synthesizes these data sources to produce actionable, personalized route, timing, and helper suggestions through natural conversation.

> **Phase placement:** PRD §10.3 explicitly places the AI Trip Assistant in Phase 3. All functional requirements herein are scoped for Phase 3 delivery and presuppose Phase 1 and Phase 2 features being live.

---

## 2. Functional Requirements

### 2.1 Core Conversational Interface

**REQ-AI-01** — The assistant MUST provide a persistent conversational chat interface accessible from a clearly labeled entry point in the app's primary navigation.

**REQ-AI-02** — The assistant MUST support multi-turn dialogue, maintaining conversational context across at minimum 20 prior turns within a session.

**REQ-AI-03** — The assistant MUST support text input in any of the platform's supported UI languages (≥20 at launch) and respond in the language in which the user initiates the conversation, or the user's declared preferred language.

**REQ-AI-04** — The assistant MUST gracefully handle out-of-scope queries (e.g., general sports trivia, unrelated travel questions) by politely redirecting focus to RoarPass-supported planning tasks, without fabricating information.

**REQ-AI-05** — The assistant MUST always clearly identify itself as an AI assistant and MUST NOT impersonate a human, local helper, or official representative of the event organizer.

**REQ-AI-06** — The assistant MUST display a timestamp, session ID, and a "clear session" control on every conversation thread for user auditability.

---

### 2.2 Itinerary-Aware Planning

**REQ-AI-07** — The assistant MUST have read access (with user consent) to the user's personal itinerary from `trip-itinerary`, including all trip objects: flights, ground transfers, accommodations, match sessions, meetups, and free-time blocks.

**REQ-AI-08** — When a user asks about travel between two cities, the assistant MUST cross-reference the user's confirmed match sessions to compute realistic intercity travel windows (e.g., "You need to be in Dallas by 19:00 on June 18; here are options that get you there with buffer time").

**REQ-AI-09** — The assistant MUST detect scheduling conflicts in the user's itinerary and proactively surface them (e.g., "Your current flight from Houston to Dallas lands at 17:30 but the stadium gates open at 16:00 — you may arrive late").

**REQ-AI-10** — The assistant MUST NOT modify the user's itinerary directly; it MUST surface suggestions that the user can then apply via the standard itinerary UI (deep-link to the relevant trip-itinerary screen).

---

### 2.3 Intercity Route Suggestions

**REQ-AI-11** — The assistant MUST query route data from `intercity-coordination` to surface known fan-traveled routes between host cities, including community-contributed tips and travel times.

**REQ-AI-12** — For each suggested route, the assistant MUST present at minimum: transport mode, estimated duration, approximate cost (where available from community tips), and any visa/border considerations relevant to the user's nationality.

**REQ-AI-13** — The assistant MUST present timing suggestions that account for match kick-off/start times, typical stadium arrival lead times (sourced from `official-info-layer`), and any known event-day transport disruptions surfaced by the notifications/alert system.

**REQ-AI-14** — When multiple fans from the same country community are traveling the same route on the same date (from `matching-engine` signals), the assistant MUST surface this as a coordination opportunity (e.g., "6 other Korean fans are doing this same route on June 19 — want to coordinate?").

---

### 2.4 Helper Recommendations

**REQ-AI-15** — The assistant MUST query `helper-network` to surface available, verified helpers in the user's next destination city who match the user's language preference and relevant offering categories.

**REQ-AI-16** — Helper suggestions MUST include: helper name (or alias), trust tier badge, languages spoken, offering categories, availability status for the user's travel dates, and a direct deep-link to the helper's profile.

**REQ-AI-17** — The assistant MUST NOT fabricate helper availability; it MUST only surface helpers whose availability calendars show openings overlapping the user's planned visit dates.

**REQ-AI-18** — The assistant MUST respect helper opt-in visibility settings and MUST NOT surface helpers who have not made themselves discoverable to the user's event/country context.

---

### 2.5 Event & Schedule Awareness

**REQ-AI-19** — The assistant MUST have read access to the full event schedule from `event-registry`, including match dates, venues, host cities, local and UTC kick-off times, and participating teams.

**REQ-AI-20** — All time references surfaced by the assistant MUST be displayed in both the user's local timezone and the host city's local timezone, per i18n NFR.

**REQ-AI-21** — When a user references a match informally (e.g., "the Korea game"), the assistant MUST resolve this to the correct scheduled match from the event registry and confirm the match identity with the user before using it as a planning anchor.

---

### 2.6 Preference Awareness

**REQ-AI-22** — The assistant MUST read user preferences from `identity-onboarding` (travel style, dietary preferences, languages, accessibility needs, fan profile) and use them to filter and rank suggestions.

**REQ-AI-23** — The assistant MUST allow in-conversation preference overrides (e.g., "this time I want budget options only") that apply for the current session without permanently modifying the user's profile.

**REQ-AI-24** — Accessibility-related preferences (e.g., wheelchair access, hearing assistance) MUST be respected in all suggestions and MUST NOT be overridable without explicit user confirmation.

---

### 2.7 Safety and Trust

**REQ-AI-25** — The assistant MUST NOT generate recommendations that conflict with active safety alerts from `safety-trust-system` or `notifications`. If a safety alert is active for a city or route, the assistant MUST proactively surface it and recommend the user review it before proceeding.

**REQ-AI-26** — The assistant MUST NOT recommend unverified third-party booking sites, external apps, or any commercial services not present in the RoarPass `business-partner-portal`. It MAY reference well-known public transport operators by name as generic informational references.

**REQ-AI-27** — The assistant MUST include a persistent disclaimer in the UI: *"Suggestions are AI-generated based on available community data and your itinerary. Always verify safety conditions, schedules, and visa requirements with official sources."*

**REQ-AI-28** — The assistant MUST enforce rate limiting per user to prevent abuse (max 100 queries/hour per user; configurable by platform admin).

---

### 2.8 Premium Gating

**REQ-AI-29** — Access to the AI Trip Assistant MUST be gated behind the Fan Premium subscription tier (PRD §11.1: $4.99/month or $9.99/event).

**REQ-AI-30** — Free-tier users MUST see a clear upgrade prompt when attempting to access the assistant, with a non-blocking explanation of what the feature offers.

**REQ-AI-31** — The platform MUST enforce a hard query cap for preview/trial access (e.g., 5 free queries per event activation) before requiring upgrade, to allow discovery of the feature.

---

### 2.9 Feedback and Quality

**REQ-AI-32** — Each assistant response MUST include a thumbs-up/thumbs-down feedback control. Negative feedback MUST prompt an optional free-text reason.

**REQ-AI-33** — Feedback data MUST be stored per response for LLM evaluation pipelines. Feedback MUST be anonymized before use in any model improvement processes, per GDPR/CCPA requirements.

**REQ-AI-34** — The assistant MUST log all prompt/response pairs (stripped of PII) in a separate audit log, retained for 90 days, accessible only to platform engineers with elevated access.

---

## 3. Acceptance Criteria

### AC-AI-01: Intercity Route Planning (Happy Path)
**Given** a premium fan with a confirmed itinerary containing Match Day 2 in Houston (June 19, 20:00 local) and Match Day 4 in Dallas (June 22, 18:00 local),  
**When** the fan asks "How should I get from Houston to Dallas?",  
**Then** the assistant responds with at least 2 transport options, each including duration, estimated cost, and departure windows that allow stadium arrival ≥90 minutes before kick-off; and surfaces any active fans doing the same route from `matching-engine`.

### AC-AI-02: Scheduling Conflict Detection
**Given** a fan with a flight from Houston to Dallas arriving at 17:45 on June 22, and a match with gates opening at 16:00,  
**When** the fan asks "Is my schedule okay for the Dallas match?",  
**Then** the assistant explicitly flags the timing conflict and suggests at least one earlier flight/transport option.

### AC-AI-03: Helper Surfacing
**Given** a Korean-speaking fan traveling to Dallas on June 21,  
**When** the fan asks "Can anyone help me in Dallas?",  
**Then** the assistant returns at minimum 1 verified helper in Dallas with Korean language capability, available on June 21–22, with trust tier badge and deep-link to profile; and returns 0 helpers if none are available (no fabrication).

### AC-AI-04: Language Handling
**Given** a user whose preferred language is Arabic,  
**When** the user initiates a conversation in Arabic,  
**Then** all assistant responses are rendered in Arabic with correct RTL layout; all dates/times use Arabic-locale formatting.

### AC-AI-05: Safety Alert Integration
**Given** an active safety alert for City X on Date Y issued by platform admins,  
**When** the assistant is asked to plan a trip to City X on Date Y,  
**Then** the assistant surfaces the safety alert prominently before any route suggestions and recommends verifying conditions with official sources.

### AC-AI-06: No Direct Itinerary Modification
**Given** a suggestion from the assistant to change a flight,  
**When** the user accepts the suggestion,  
**Then** the assistant provides a deep-link to the relevant itinerary screen in `trip-itinerary` to make the change manually; the assistant MUST NOT modify the itinerary record itself.

### AC-AI-07: Premium Gate
**Given** a free-tier user with 5 prior trial queries used,  
**When** the user attempts a 6th query,  
**Then** the assistant responds with an upgrade prompt explaining the Premium tier, and the 6th query is not processed.

### AC-AI-08: Out-of-Scope Graceful Handling
**Given** a user asks "Who will win the World Cup?",  
**Then** the assistant declines to speculate and redirects: "I can't predict match outcomes, but I can help you plan your travel and find helpers for the upcoming matches."

### AC-AI-09: Feedback Capture
**Given** the user taps the thumbs-down icon on a response,  
**Then** a non-blocking inline prompt asks for an optional reason (with suggested categories: "Wrong information", "Not helpful", "Missing options", "Other"); submission is optional; the feedback event is logged.

---

## 4. Data Entities

### 4.1 AssistantSession
| Field | Type | Notes |
|---|---|---|
| `session_id` | UUID | PK |
| `user_id` | UUID | FK → Fan Profile |
| `event_id` | UUID | FK → Event Registry |
| `started_at` | timestamp (UTC) | |
| `last_active_at` | timestamp (UTC) | |
| `language_code` | string | BCP-47 (e.g., `ko`, `ar`) |
| `turn_count` | integer | |
| `status` | enum | `active`, `expired`, `cleared` |

### 4.2 AssistantTurn
| Field | Type | Notes |
|---|---|---|
| `turn_id` | UUID | PK |
| `session_id` | UUID | FK → AssistantSession |
| `sequence` | integer | Ordered position in session |
| `role` | enum | `user`, `assistant` |
| `content_encrypted` | text | Encrypted at rest (user PII possible) |
| `content_hash` | string | SHA-256 for audit log integrity |
| `created_at` | timestamp (UTC) | |
| `tokens_used` | integer | For cost tracking |
| `model_version` | string | LLM model/version identifier |

### 4.3 AssistantFeedback
| Field | Type | Notes |
|---|---|---|
| `feedback_id` | UUID | PK |
| `turn_id` | UUID | FK → AssistantTurn (assistant role only) |
| `rating` | enum | `positive`, `negative` |
| `reason_category` | enum (nullable) | `wrong_info`, `not_helpful`, `missing_options`, `other` |
| `reason_text` | string (nullable) | Max 500 chars; anonymized before ML use |
| `created_at` | timestamp (UTC) | |

### 4.4 AssistantContextSnapshot (per-turn, derived, not persisted long-term)
| Field | Type | Notes |
|---|---|---|
| `itinerary_summary` | object | Key trip objects for the active event |
| `event_schedule_window` | array | Upcoming matches in user's attended cities |
| `helper_availability_cache` | array | Available helpers in user's next 2 destination cities |
| `active_alerts` | array | Safety/operational alerts for user's cities |
| `matching_signals` | object | Co-travelers on same routes (from matching-engine) |
| `user_preferences` | object | Travel style, language, dietary, accessibility |

---

## 5. API Surface Sketch

> All endpoints are REST under `/v1/assistant/` unless noted. Authenticated via Bearer JWT. Rate-limited per REQ-AI-28.

### 5.1 Start or Resume Session
```
POST /v1/assistant/sessions
Body: {
  "event_id": "uuid",
  "language_code": "ko"          // BCP-47; optional, defaults to profile preference
}
Response 201: {
  "session_id": "uuid",
  "status": "active",
  "trial_queries_remaining": 5 | null   // null if premium
}
```

### 5.2 Send a Message (Turn)
```
POST /v1/assistant/sessions/{session_id}/turns
Body: {
  "content": "How do I get from Houston to Dallas after the June 19 match?",
  "session_preference_overrides": {     // optional, session-scoped
    "travel_style": "budget"
  }
}
Response 200: {
  "turn_id": "uuid",
  "sequence": 4,
  "role": "assistant",
  "content": "...",                      // assistant reply in user's language
  "suggestions": [                       // structured suggestions (optional)
    {
      "type": "route",
      "summary": "FlixBus Houston → Dallas",
      "duration_minutes": 240,
      "estimated_cost_usd": 25,
      "depart_by": "2026-06-19T22:30:00-05:00",
      "deep_link": "/trips/intercity/routes/hou-dfw-20260619"
    },
    {
      "type": "helper",
      "helper_id": "uuid",
      "display_name": "Ji-hoon K.",
      "trust_tier": "local_helper",
      "languages": ["ko", "en"],
      "deep_link": "/helpers/uuid"
    }
  ],
  "active_alerts_surfaced": ["alert-uuid-1"],
  "safety_disclaimer_shown": true,
  "tokens_used": 842,
  "created_at": "2026-06-17T10:22:00Z"
}
Response 402: { "error": "premium_required", "trial_queries_used": 5 }
Response 429: { "error": "rate_limit_exceeded", "retry_after_seconds": 60 }
```

### 5.3 Retrieve Session History
```
GET /v1/assistant/sessions/{session_id}/turns?limit=20&before_sequence=10
Response 200: {
  "turns": [ { ...AssistantTurn objects... } ],
  "total": 9
}
```

### 5.4 Submit Feedback
```
POST /v1/assistant/turns/{turn_id}/feedback
Body: {
  "rating": "negative",
  "reason_category": "wrong_info",
  "reason_text": "The bus schedule was incorrect for that date."
}
Response 201: { "feedback_id": "uuid" }
```

### 5.5 Clear Session
```
DELETE /v1/assistant/sessions/{session_id}
Response 204
```

### 5.6 Get Assistant Availability / Premium Status
```
GET /v1/assistant/status
Response 200: {
  "assistant_available": true,
  "premium_active": false,
  "trial_queries_remaining": 3,
  "trial_queries_total": 5
}
```

---

## 6. LLM Integration Architecture

### 6.1 Context Assembly Pipeline
At each turn, a server-side **Context Assembler** service builds a structured system prompt by injecting:

1. **User Identity Context** — nationality, languages, travel style, accessibility needs (from `identity-onboarding`).
2. **Itinerary Context** — upcoming trip objects for the active event (from `trip-itinerary`).
3. **Event Schedule Context** — matches in the user's declared host cities for the next 14 days (from `event-registry`).
4. **Intercity Route Data** — community-contributed route tips for the user's anticipated city pairs (from `intercity-coordination`).
5. **Helper Availability Context** — top-N available helpers in the user's next 1–2 destination cities, filtered by language (from `helper-network`).
6. **Matching Signals** — co-traveler count on same route/dates (from `matching-engine`).
7. **Active Alerts** — safety, weather, and operational alerts for the user's cities (from `safety-trust-system` / `notifications`).
8. **Platform Guardrails** — static system instructions: scope restrictions, disclaimer requirements, no-fabrication rules, no-external-booking-site rules.

### 6.2 LLM Provider Abstraction
- The LLM provider MUST be abstracted behind an internal **AI Gateway service** to allow provider substitution without client changes.
- The gateway MUST support at minimum: OpenAI GPT-4-class models, Anthropic Claude-class models, and a self-hosted open-source fallback.
- The AI Gateway MUST strip all PII from prompts before transmission to third-party LLM providers (replace with anonymized tokens; reverse-map in response).
- LLM API keys MUST be stored as environment secrets (`AI_GATEWAY_OPENAI_KEY`, `AI_GATEWAY_ANTHROPIC_KEY`) and never transmitted to clients.

### 6.3 Response Post-Processing
- All assistant responses MUST pass through a **Content Safety Filter** before delivery to the user (keyword and classifier-based check for harmful content, scam patterns, prohibited external references).
- Structured `suggestions` objects MUST be extracted from LLM output via function-calling or structured output schemas — not free-text parsing.
- Deep links in suggestions MUST be validated against live data before inclusion (e.g., helper profile must still exist and be visible).

---

## 7. Edge Cases

| # | Scenario | Expected Behavior |
|---|---|---|
| EC-01 | User has no itinerary yet for the event | Assistant informs the user and offers to guide them through adding key match sessions; does NOT fabricate itinerary data |
| EC-02 | Queried route has no community-contributed tips | Assistant returns generic transport guidance from public knowledge only and clearly labels it as general information, not platform-verified |
| EC-03 | No helpers available in destination city for user's language | Assistant explicitly states no helpers are currently available and suggests the user post a help request in the community channel; surfaces the community deep-link |
| EC-04 | LLM provider unavailable (timeout/error) | Assistant returns a graceful degradation message: "The AI assistant is temporarily unavailable. You can still browse helpers and routes manually." Base app features remain fully operational (REQ-AI-NFR-04) |
| EC-05 | User asks about a match their team is not playing in | Assistant answers using event schedule data but notes the team context; no restriction on match scope |
| EC-06 | Safety alert issued mid-conversation | On next turn, assistant surfaces new alert proactively even if the user's question is unrelated |
| EC-07 | User switches language mid-conversation | Assistant detects language shift and responds in the new language for all subsequent turns; session `language_code` is updated |
| EC-08 | Conversation history exceeds 20-turn context window | Oldest turns are summarized and stored as a compressed context block; the summary is injected into the system prompt; full turn history remains available via GET endpoint |
| EC-09 | User is in a region with LLM provider data residency restrictions | AI Gateway routes to a compliant regional LLM endpoint or self-hosted model; if none available, assistant is marked unavailable for that user with an explanation |
| EC-10 | Premium subscription lapses mid-event | Existing sessions remain readable; new turns return 402 with upgrade prompt; existing session history is preserved for 90 days |
| EC-11 | User provides false event context in prompt injection attempt | System prompt guardrails instruct LLM to use only the server-injected context; prompt injection patterns are flagged by Content Safety Filter and logged |
| EC-12 | Visa/border data requested for multi-country route | Assistant surfaces high-level awareness from `intercity-coordination` border tips and refers user to `official-info-layer` for authoritative visa intelligence; MUST NOT generate visa advice beyond platform-verified data |

---

## 8. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| OQ-01 | Which LLM provider is the primary at Phase 3 launch? GPT-4o, Claude 3.5 Sonnet, or a managed AWS Bedrock model? This affects data residency, cost, latency, and EU compliance. | Engineering / Legal | High |
| OQ-02 | PII stripping strategy in the AI Gateway: tokenization vs. on-device inference vs. federated approach? Impacts GDPR Article 28 processor obligations for third-party LLM providers. | Privacy / Engineering | High |
| OQ-03 | Should the assistant support voice input (push-to-talk) given that `messaging-realtime` already supports voice notes? Scope for Phase 3 or defer to Phase 4? | Product | Medium |
| OQ-04 | Context assembly: should intercity route tips be retrieved real-time per turn or cached per user session? Real-time is fresher but adds latency; caching risks stale helper availability data. | Engineering | Medium |
| OQ-05 | Should the assistant be capable of initiating a help request to a helper on the user's behalf (write action), or remain read-only/suggestion-only? If write actions are introduced, the trust and consent model becomes significantly more complex. | Product / Legal | High |
| OQ-06 | Trial query limit (5 per event): should this reset on event reactivation? On subscription lapse and re-subscribe? | Product / Billing | Low |
| OQ-07 | LLM cost management: what is the per-user monthly LLM cost budget at scale (50k users), and does the premium price point ($4.99/month) cover it with margin? | Finance / Engineering | High |
| OQ-08 | For multi-country events (ICC Cricket World Cup), should the assistant surface visa/border intelligence proactively as part of itinerary conflict detection, or only when explicitly asked? Proactive is more useful but raises liability questions if data is stale. | Product / Legal | Medium |
| OQ-09 | Should assistant session history be included in GDPR right-to-access and right-to-erasure export/deletion flows? Implied yes — needs explicit confirmation from legal and alignment with `identity-onboarding` data deletion workflows. | Legal / Privacy | High |
| OQ-10 | Is there a content liability risk if the assistant's routing suggestion leads to a safety incident (e.g., recommends a route that traverses an area with an unlogged hazard)? What disclaimers and legal terms are needed? | Legal | High |

---

## 9. Cross-Chunk Dependencies

| Dependency Chunk | Slug | What AI Trip Assistant Consumes |
|---|---|---|
| Personal & Group Itinerary Planning | `trip-itinerary` | Read access to all trip objects for context assembly; deep-link targets for suggestions |
| Intercity Trip Coordination | `intercity-coordination` | Route tips, known fan-traveled city pairs, border crossing notes |
| Local Helper Network | `helper-network` | Helper profiles, availability calendars, offering categories, trust tiers |
| Smart Fan Matching & Discovery | `matching-engine` | Co-traveler signals on same routes/dates |
| Event Registry & Configuration | `event-registry` | Full event schedule, host cities, match times (indirect; via trip-itinerary and intercity-coordination) |
| User Identity, Onboarding & Roles | `identity-onboarding` | User preferences, language, accessibility needs, nationality, premium subscription status |
| Verification Tiers & Trust Signals | `verification-trust-tiers` | Helper trust tier badges surfaced in suggestions |
| Official Information & Visa Intelligence | `official-info-layer` | Visa/entry data referenced for multi-country itinerary gaps |
| Safety Modes, Meetup Safety & SOS | `safety-trust-system` | Active safety alerts injected into context |
| Notifications & Alert Delivery | `notifications` | Operational alerts (transport disruptions, stadium changes) injected into context |
| Platform Foundation, Security & Compliance | `platform-foundation-nfr` | All NFRs inherited (see §10) |

---

## 10. Inherited Non-Functional Requirements

### 10.1 Performance
- **REQ-AI-NFR-01** — AI assistant turn response time (p95) MUST be ≤ 5,000ms (3,000ms target), accounting for context assembly + LLM inference + post-processing. This is distinct from the standard 300ms API p95 target, which applies to all non-LLM endpoints.
- **REQ-AI-NFR-02** — The Context Assembler MUST cache helper availability and event schedule data with a TTL of 5 minutes to reduce dependency latency. The cache MUST be invalidated immediately on any relevant data change event.
- **REQ-AI-NFR-03** — The assistant MUST implement streaming responses (server-sent events or WebSocket) so the user sees tokens appearing progressively rather than waiting for full response generation.
- **REQ-AI-NFR-04** — If the LLM service is unavailable, the rest of the app MUST degrade gracefully — no impact to community, messaging, itinerary, or helper features (§8.5 graceful degradation).

### 10.2 Privacy & Compliance (GDPR/CCPA/PDPA)
- **REQ-AI-NFR-05** — Before the assistant is enabled for a user, explicit consent MUST be obtained for: (a) use of itinerary data as LLM context, (b) transmission of anonymized conversation data to third-party LLM providers, (c) retention of anonymized feedback for model improvement. Consent is revocable.
- **REQ-AI-NFR-06** — All conversation turn content MUST be encrypted at rest (AES-256). PII MUST be stripped or tokenized before transmission to external LLM providers.
- **REQ-AI-NFR-07** — Assistant session history MUST be included in the user's GDPR data export and MUST be fully deleted (including AI Gateway logs) upon GDPR/CCPA deletion request, within the platform's standard deletion SLA.
- **REQ-AI-NFR-08** — Anonymized, aggregated feedback data used for model improvement MUST NOT be re-identifiable. A privacy impact assessment MUST be completed before any feedback data leaves the platform's data boundary.
- **REQ-AI-NFR-09** — Users in jurisdictions with restrictions on AI-processed personal data (e.g., certain EU member state interpretations) MUST be able to opt out of the AI assistant without losing access to any other platform feature.

### 10.3 Internationalization (i18n / RTL)
- **REQ-AI-NFR-10** — The assistant chat UI MUST support RTL layout for Arabic, Hebrew, Urdu, and Farsi. Text directionality MUST switch per-message based on the language of that message.
- **REQ-AI-NFR-11** — All dates, times, and currency values in assistant responses MUST use locale-appropriate formatting (e.g., `DD/MM/YYYY` vs. `MM/DD/YYYY`) as defined in §8.6.
- **REQ-AI-NFR-12** — The LLM system prompt MUST instruct the model to use the user's locale for all formatting in responses. Structured `suggestions` objects MUST carry raw ISO 8601 timestamps and ISO 4217 currency codes alongside display values.

### 10.4 Accessibility (WCAG 2.1 AA)
- **REQ-AI-NFR-13** — The assistant chat interface MUST be fully navigable by keyboard on web and fully announced by VoiceOver (iOS) and TalkBack (Android).
- **REQ-AI-NFR-14** — Streaming token output MUST be implemented in a way that does not break screen reader announcement flow; a "response complete" announcement MUST fire when streaming ends.
- **REQ-AI-NFR-15** — All interactive suggestion cards (route, helper deep-links) MUST have accessible labels describing the action, not just visual icons.
- **REQ-AI-NFR-16** — Touch targets for feedback controls (thumbs-up/thumbs-down) MUST meet the 44×44px minimum.

### 10.5 Security
- **REQ-AI-NFR-17** — The AI Gateway MUST implement prompt injection detection: user input containing instructions targeting the system prompt (e.g., "ignore previous instructions") MUST be flagged, logged, and the turn MUST be processed with the injection attempt neutralized by the guardrail layer.
- **REQ-AI-NFR-18** — LLM API credentials MUST be stored as encrypted environment secrets and rotated on a quarterly basis. They MUST never appear in client-side code, logs, or error messages.
- **REQ-AI-NFR-19** — Rate limiting (REQ-AI-28: 100 queries/hour/user) MUST be enforced at the API gateway layer, not the application layer, to prevent bypass via direct API calls.
- **REQ-AI-NFR-20** — The Content Safety Filter MUST be tested against OWASP LLM Top 10 attack patterns before Phase 3 launch.

### 10.6 Scalability
- **REQ-AI-NFR-21** — The AI assistant service MUST scale independently of other platform services. LLM inference load MUST NOT impact latency for community, messaging, or itinerary endpoints.
- **REQ-AI-NFR-22** — During match-day peak traffic (10× baseline per §8.1), the AI assistant MAY implement a queue with user-visible wait indicators rather than returning errors, with a target queue wait ≤ 30 seconds.

---

*Spec version 1.0. Authored by req_explorer agent. Review by consistency-reviewer required before implementation handoff.*