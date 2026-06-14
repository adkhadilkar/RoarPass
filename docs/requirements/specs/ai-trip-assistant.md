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