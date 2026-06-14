# RoarPass — Universal Global Sports Fan Coordination Platform
## Product Requirements Document (PRD) v1.0

**Prepared by:** Product & Engineering  
**Date:** June 2026  
**Version:** 1.0 — Public Draft  
**Status:** Active  

---

## 1. Executive Summary

RoarPass is a universal, event-agnostic fan coordination platform that connects international sports fans traveling to major global events — connecting them with fellow supporters from the same country, diaspora locals in the host region, and vetted community helpers. The platform enables country-based communities, intercity trip coordination, and local assistance networks for any large-scale sports event anywhere in the world.

The platform is architected as a multi-tenant, multi-event system. A single user account persists across events — their South Korea supporter profile works for the FIFA World Cup, the Cricket World Cup, the Olympics, the IPL, and beyond. Communities, trips, and helper networks are organized by the combination of **sport + event + country**, allowing the platform to scale across events with no per-event re-architecture.

The global sports tourism market is valued at approximately $984 billion in 2026 and is projected to grow at a CAGR of 10–13% through 2033[cite:19][cite:22]. RoarPass is positioned to become the operational layer for the fan side of that market.

---

## 2. Problem Statement

International sports fans traveling to multi-city, multi-country events face a common set of friction points:

- No single coordination layer for fans from the same country in the same host city.
- No structured way to tap into diaspora knowledge, language help, or community-based guidance.
- Trip planning tools (flights, hotels, itineraries) are disconnected from match calendars, fan schedules, and community movement.
- Intercity logistics (fan movement between Dallas and Houston, or Toronto and New York) are unplanned and fragmented.
- Safety risks for solo or first-time international travelers are high, with no community safety net.
- These problems repeat identically for every major global event — FIFA World Cup, ICC Cricket World Cup, Summer Olympics, IPL, English Premier League, NFL, Rugby World Cup, Formula 1 Grand Prix calendar, and more.

Currently, fans self-organize through WhatsApp groups, Reddit threads, and Facebook groups — all disconnected, unsafe, and ephemeral. RoarPass creates a permanent, structured, trustworthy layer that persists and learns across events.[cite:2]

---

## 3. Vision and Mission

**Vision:** Every sports fan who travels internationally should feel like a local — connected to their country, helped by their community, and never alone.

**Mission:** Build the world's most trusted fan travel and community coordination platform, purpose-built for major global sports events.

---

## 4. Target Events and Leagues

RoarPass is designed to serve any large-scale sports event with international audiences. The platform uses an **Event Registry** model where events are configured and activated, rather than hard-coded.

### 4.1 Tier 1 Events — Global Multi-Country

| Event | Cadence | Countries | Host Structure |
|---|---|---|---|
| FIFA World Cup | Every 4 years | 48 teams | Multi-city, multi-country |
| Summer Olympics | Every 4 years | 200+ countries | Multi-sport, single host city |
| Winter Olympics | Every 4 years | 90+ countries | Multi-venue, single region |
| ICC Cricket World Cup | Every 4 years | 10–14 teams | Multi-city, multi-country |
| Rugby World Cup | Every 4 years | 20 teams | Multi-city, single country |
| T20 Cricket World Cup | Every 2 years | 20 teams | Multi-country |
| Commonwealth Games | Every 4 years | 70+ countries | Multi-sport, single host city |
| Asian Games | Every 4 years | 45+ countries | Multi-sport, single host city |

### 4.2 Tier 2 Events — Domestic Leagues with International Fanbase

| League | Sport | Fanbase | Notes |
|---|---|---|---|
| English Premier League (EPL) | Football/Soccer | Global | International matchday travel, London derbies |
| Indian Premier League (IPL) | Cricket | Global South Asian diaspora | Highly concentrated diaspora fanbase |
| UEFA Champions League | Football/Soccer | Global | Final draws international fans to single city |
| NFL | American Football | North America + expats | International games series (London, Munich) |
| NBA | Basketball | Global | International games, expat fan travel |
| Major League Baseball (MLB) | Baseball | Americas + Japan/Korea | Series travel, World Series |
| Formula 1 | Motorsport | Global | Race calendar = 24 cities in 24 countries per year |
| Grand Slam Tennis | Tennis | Global | Australian Open, Roland Garros, Wimbledon, US Open |
| Six Nations Rugby | Rugby | Europe + diaspora | Cross-country travel concentrated in 6 weeks |

### 4.3 Tier 3 Events — Regional, Emerging, or Niche

| Event | Notes |
|---|---|
| Copa América | South American football, regional travel |
| Africa Cup of Nations (AFCON) | Pan-African football |
| Ryder Cup (Golf) | US vs. Europe, passionate diaspora travel |
| ICC Women's World Cup | Growing global fanbase |
| Women's FIFA World Cup | Large and growing international travel |
| Kabaddi World Cup | Significant South Asian diaspora interest |
| Esports World Championships | Digital-native, emerging physical event travel |

---

## 5. Core Platform Concepts

RoarPass is built on five foundational concepts that apply uniformly across all events and leagues.

### 5.1 Event

An event is any organized sports competition with a defined schedule, set of host cities, and participating countries or teams. Events are created and configured in the RoarPass Admin Registry. Every community, trip, and helper offering exists within the context of an event.

### 5.2 Country Community

Each active event generates country-based communities automatically for every participating nation. A South Korean fan at the World Cup joins the "South Korea · FIFA World Cup 2026" community. A Pakistani fan during IPL joins the "Pakistan · IPL 2026 · Mumbai" community. Communities nest by event → country → host city.

### 5.3 Fan Profile

A single persistent identity across all events. The profile stores nationality, supported teams, languages, travel history, verified status, and a cross-event reputation score. Fans do not re-register per event — they activate new events on their existing profile.

### 5.4 Local Helper

A resident of a host city or country who volunteers or registers to help incoming fans from a specific country or language background. Helpers are the platform's most differentiated social layer. An Indian-origin resident in Manchester is a valuable helper for IPL fans watching an India match in London.

### 5.5 Community Trip

A structured group travel coordination object — a shared plan for a group of fans to move together between airports, stadiums, cities, or countries. Trips are not bookings; they are coordination layers that help fans align travel plans and share logistics.

---

## 6. User Roles and Personas

### 6.1 Traveling Fan (Primary)
**Who:** An international fan traveling from their home country to attend matches or events in a host city or country.

**Goals:**
- Connect with other fans from home.
- Find help from locals who speak their language.
- Coordinate intercity travel and match-day plans.
- Stay safe and informed in unfamiliar cities.

**Pain points:** Language barriers, unfamiliar transit systems, cost of solo travel, safety in foreign environments, fragmented planning.

---

### 6.2 Local Diaspora Helper
**Who:** A person of a given nationality (or cultural affinity) currently living in a host country or city.

**Goals:**
- Help incoming fans from their home country.
- Share local knowledge and practical guidance.
- Build reputation and community standing.
- Optionally earn income through guide or concierge services.

**Pain points:** No structured channel to offer help; matching with right fans; trust and safety concerns.

---

### 6.3 Resident Fan (Domestic)
**Who:** A local fan in the host country who follows the sport and wants to connect with international visitors.

**Goals:**
- Meet fans from visiting countries.
- Join community events and matchday meetups.
- Share local knowledge.

---

### 6.4 Community Moderator
**Who:** A trusted, verified platform community leader responsible for a country community in a given event.

**Goals:**
- Keep community channels accurate and safe.
- Pin verified guides.
- Escalate issues.
- Coordinate official announcements.

---

### 6.5 Business Partner
**Who:** A local business (restaurant, transport provider, tour guide, accommodation) that wants to reach incoming international fans.

**Goals:**
- Offer verified services to fans who share their nationality or language.
- Gain visibility in community channels.
- Provide country-specific offerings (e.g., halal food, Korean BBQ, Bollywood nights).

---

### 6.6 Platform Admin
**Who:** RoarPass internal staff.

**Goals:**
- Create and configure events.
- Manage trust and safety.
- Monitor moderation queues.
- Handle escalations.
- Manage business partner onboarding.

---

## 7. Functional Requirements

### 7.1 Event Registry and Configuration

The platform must support a configurable event management system that admins use to set up any new sports event.

| Field | Description |
|---|---|
| Event name | Full name of the event |
| Sport category | Football, Cricket, Athletics, Tennis, etc. |
| Event type | Global, Regional, Domestic, Formula series |
| Host cities | List of venues and cities with coordinates |
| Host countries | One or more countries |
| Match/session schedule | Structured data: date, time, venue, teams |
| Participating teams/countries | Auto-generates communities |
| Start date / End date | Duration of community activation |
| Fan information feeds | Official sources, RSS, webhooks |
| Languages supported | Default set for the event |

**Activation logic:** When an event is created and published, the platform auto-generates a country community for every participating nation, seeded with city sub-communities for each host city.

---

### 7.2 User Identity and Onboarding

#### 7.2.1 Registration
- Email, phone, or social OAuth (Google, Apple, Facebook).
- Mandatory: Name, nationality, country of residence, languages spoken.
- Optional: Profile photo, bio, supporter team, travel style, dietary preferences, accessibility needs.

#### 7.2.2 Event Activation
- From their profile, a user activates one or more events.
- They select matches or sessions they plan to attend.
- They declare host cities they will visit.
- Platform auto-joins them to relevant country and city communities.

#### 7.2.3 Role Selection
- I am a traveling fan.
- I am a local helper (triggers additional verification flow).
- I am a local resident fan.
- I am a business offering services to fans.
- I am both a traveling fan and a helper for a different country.

#### 7.2.4 Verification Tiers

| Tier | Method | Badge | Required for |
|---|---|---|---|
| Basic | Email + phone | — | All users |
| Verified Identity | Government ID via third-party (e.g., Stripe Identity) | ✓ Verified | Helpers, trip organizers |
| Local Helper | Address proof + community review | 🌟 Trusted Helper | Active helper listings |
| Business Verified | Business registration docs | 🏢 Verified Business | Business partner listings |

---

### 7.3 Country Communities

Communities are the core social unit of RoarPass. They are event-scoped, country-specific, and city-segmented.

#### 7.3.1 Community Hierarchy
```
Event
└── Country Community  (e.g., South Korea · FIFA World Cup 2026)
    ├── City Sub-Community  (e.g., South Korea · Los Angeles)
    │   ├── General
    │   ├── Travel & Transport
    │   ├── Accommodation
    │   ├── Food & Restaurants
    │   ├── Safety Tips
    │   ├── Local Help Requests
    │   └── Match-Day Coordination
    └── Match Thread  (e.g., Korea vs. Brazil — Match Day 2)
```

#### 7.3.2 Community Features
- Pinned posts and verified guides by moderators.
- Announcements (moderator-only broadcasts).
- Polls.
- Event calendar (shared meetups, guided tours, watch parties).
- Community Q&A (upvoted threads).
- Local helper directory filtered by city.
- Member map showing approximate locations of active fans.

#### 7.3.3 Cross-Country Communities
- Some communities should bridge countries — for example, "South Asia Fans in Los Angeles" or "Korean & Japanese Fans in San Francisco."
- These can be created by moderators or admin as affinity communities beyond the standard country model.

---

### 7.4 Smart Fan Matching

The platform must surface relevant connections automatically, without requiring fans to search manually.

#### 7.4.1 Match Criteria
- Same event + country community (primary).
- Same host city during overlapping dates.
- Same match or session attending.
- Same arrival airport on similar dates.
- Same hotel neighborhood (if disclosed).
- Same intercity route (e.g., Houston → Dallas between matches).
- Similar travel style (budget, premium, family, solo, group).
- Shared languages.

#### 7.4.2 Suggested Connection Cards
The app surfaces contextual suggestion cards:
- "14 Korean fans are arriving at LAX between June 14–16."
- "8 Korean-speaking locals in Los Angeles are available to help."
- "6 fans from your country are doing the Dallas → Houston route after Match Day 3."
- "3 fans in your area are looking for a shared Uber to the stadium tomorrow."

#### 7.4.3 Opt-In Visibility
All matching is opt-in. Users control:
- Whether their city is shown.
- Whether their arrival dates are shown.
- Whether they appear in match-based suggestions.

---

### 7.5 Trip Planning and Itinerary Coordination

#### 7.5.1 Personal Itinerary
- Match calendar synced from the event registry.
- Add flights, hotels, transfers, tours, and free-time plans.
- Calendar view and list view.
- Export to Apple Calendar, Google Calendar, or PDF.
- Offline access on mobile.

#### 7.5.2 Shared Group Itinerary
- Create a trip group (e.g., "Korea Squad — Dallas + Houston + SF").
- Invite members.
- Shared itinerary visible to all.
- Each member can add their own legs.
- Coordination chat thread attached.
- Group voting on plans (poll for: "Which restaurant after the match?").

#### 7.5.3 Intercity Coordination
This is a key differentiator for multi-city events.
- Define origin city → destination city → travel date.
- Platform shows other fans doing the same route.
- Create or join a shared travel group (road trip, shared Amtrak booking coordination, carpool).
- Local tips for each city-to-city route (e.g., "Dallas to Houston: best bus option is FlixBus, 4 hours, $25").
- For multi-country events: border crossing tips, visa reminders, entry requirement alerts.

#### 7.5.4 Trip Objects

| Object | Fields |
|---|---|
| Flight | Airline, flight number, origin, destination, date/time, shared? |
| Ground Transfer | Type (taxi, rideshare, bus, train), route, date/time, seats available |
| Accommodation | Hotel/area, dates, neighborhood, shared? |
| Match Session | Event match reference, stadium, seats area |
| Meetup | Title, location, organizer, capacity, date/time, RSVP |
| Tour | Provider, description, date, capacity, language |
| Free Time | User note, city, date |

---

### 7.6 Local Helper Network

This is the platform's highest-trust and highest-value feature.

#### 7.6.1 Helper Profile
- City of residence.
- Nationality and cultural affiliations.
- Languages spoken.
- Offering categories (see below).
- Availability calendar.
- Verification tier.
- Ratings and reviews.
- Number of fans helped (cross-event).

#### 7.6.2 Offering Categories

| Category | Examples |
|---|---|
| Airport Greeting | Pickup coordination, transit orientation |
| Local Transit Help | Bus/metro guidance, rideshare advice |
| Neighborhood Guide | Safe areas, things to avoid, local food |
| Language Assistance | Real-time translation, calls with locals |
| Emergency Support | Accompaniment, hospital or police nav |
| Cultural Tips | Tipping, dress, behavior norms |
| Halal / Dietary | Where to find suitable food options |
| Kid-Friendly | Family-safe areas, parks, kid activities |
| Budget Tips | Cheap eats, free attractions, transit passes |
| Stadium Guidance | Gate access, parking, pre/post game areas |
| Accommodation Help | Recommendations, safe areas by budget |
| Hosted Meetup | Helper organizes a fan gathering |

#### 7.6.3 Helper Economics
- Basic helping: Free (reputation and community driven).
- Optional paid offerings: Guides can list paid city tours, language support sessions, or concierge packages.
- Platform takes a small commission on paid services.
- Freemium tier: Helpers get premium badge and visibility boost for a nominal monthly fee during active event periods.

#### 7.6.4 Availability and Request Flow
1. Fan submits a help request (category, city, dates, language preference).
2. Platform matches to available helpers.
3. Helper accepts or declines.
4. Chat opens.
5. Post-interaction: both parties leave ratings.

---

### 7.7 Communications

#### 7.7.1 Messaging Channels
- Direct message (1:1, encrypted).
- Group chat (trip groups, meetup groups).
- Community channels (threaded, public within community).
- Announcements (moderator broadcast, read-only).
- Match-day live chat (high-volume, real-time, per-match thread).

#### 7.7.2 In-App Translation
- Auto-detect message language.
- Offer one-tap translation to user's preferred language.
- Powered by a translation API (DeepL, Google Translate, or Azure Cognitive Services).
- Displayed as non-destructive overlay — original text remains visible.

#### 7.7.3 Voice Notes
- For coordination-critical messages where typing is inconvenient (e.g., navigating an airport).
- Max 60 seconds per voice note.
- Auto-transcribed on receipt.

#### 7.7.4 Notifications
- Match reminders.
- Trip group updates.
- Helper response received.
- Meetup changes (cancellation, reschedule).
- Community announcements.
- Official event alerts (stadium access changes, transport disruptions).
- Safety alerts for host city (weather, security, crowd issues).
- Border crossing or visa reminders for multi-country events.

---

### 7.8 Official Information Layer

#### 7.8.1 City Guides (per event, per host city)
- Structured, moderated, and pinned content.
- Sections: Getting around, Accommodation areas, Stadium access, Fan zones, Emergency contacts, Visa/entry, Currency, Safety tips, Wi-Fi and connectivity.
- Sourced from official channels, event organizers, and government tourism bodies.
- Updated by moderators and platform admins.

#### 7.8.2 Match and Schedule Feed
- Live synced from event data registry.
- Venue, date, time, local time conversion.
- Travel time from city center.
- Stadium entry guidance.

#### 7.8.3 Alert System
- Admins can broadcast safety, weather, or operational alerts to any community or city group.
- Alerts appear as banners and push notifications.
- Fans can subscribe to alert categories.

#### 7.8.4 Visa and Entry Intelligence
- For multi-country events: visa requirements by nationality for each host country.
- Reminders for ESTA, eTA, or tourist visa applications.
- Links to official government application portals.
- Border crossing tips (US-Mexico, US-Canada, etc.).
- This feature is especially high-value for ICC Cricket World Cup (South Africa, Zimbabwe, Namibia in 2027) or events crossing multiple sovereignty zones.[cite:30]

---

### 7.9 Discovery and Recommendations Engine

#### 7.9.1 Fan Discovery
- "Fans from your country near you."
- "People attending the same match."
- "Fans doing your same intercity route."
- "New helpers just listed in your next city."

#### 7.9.2 Place and Experience Recommendations
- Curated by verified locals, not just algorithm.
- Filtered by fan preferences: budget, dietary, family, accessibility.
- Tagged by country community ("Recommended by Korean fans in LA").

#### 7.9.3 AI Trip Assistant (Phase 2)
- Conversational assistant aware of the user's match schedule, cities, and preferences.
- Suggests optimal intercity routes and timing.
- "You have Match Day 2 in Houston and Match Day 4 in Dallas. Here is the best way to get between them, and here are Korean-speaking helpers in Dallas."
- Powered by a large language model with event data, helper availability, and the user's itinerary as context.

---

### 7.10 Safety and Trust System

#### 7.10.1 User Verification (see Section 7.2.4)
- Tiered verification with progressive trust signals.

#### 7.10.2 Community Safety
- Reporting and blocking.
- Moderation queue with SLA (24-hour response for standard, 2-hour for flagged safety issues).
- Auto-moderation for scam patterns (ticket resale, fake accommodation offers).
- Community standards enforced consistently across all events.

#### 7.10.3 Meetup Safety
- Check-in flow: organizer marks meetup as started, attendees check in.
- Check-out flow: attendees mark themselves safe after meetup.
- Trusted contact feature: user can share meetup details with a home contact.

#### 7.10.4 Special Safety Modes
- **Solo Traveler Mode:** Check-in reminders, location sharing with trusted contacts, emergency SOS.
- **Women Traveler Mode:** Women-only group option, verified-women-only helper listings.
- **Family Mode:** Family-friendly content filter, kid-safe meetup categories.
- **Accessibility Mode:** Helper listings filtered by accessibility support category.

#### 7.10.5 Emergency SOS
- In-app SOS button visible from any screen.
- Triggers: local emergency number display, option to alert trusted contacts, option to alert platform moderator.
- Pre-populated emergency phrase cards in local language.

---

### 7.11 Business Partner Portal

Local businesses can register as verified partners.

#### 7.11.1 Listing Features
- Business profile with description, location, country affinity, languages supported, category.
- Menu or service list.
- Community visibility (pinned in relevant country+city communities by admin approval).
- Native language listings (Korean signage, Arabic menus, etc.).

#### 7.11.2 Promotion Tools
- Sponsored placement in community discovery.
- Fan discount offers visible only to RoarPass users.
- Group booking tools for large fan parties.

#### 7.11.3 Partner Categories
- Restaurants and food courts.
- Ground transport providers.
- Local tour guides.
- SIM card and connectivity services.
- Accommodation partners.
- Event souvenir and merchandise.
- Cultural experience providers.
- Language schools or interpretation services.

---

### 7.12 Admin and Moderation Console

#### 7.12.1 Event Management
- Create, configure, publish, archive events.
- Manage participating teams and countries.
- Update match schedule data.
- Configure official info feeds.

#### 7.12.2 Community Management
- Create or disable country and city communities.
- Appoint and remove moderators.
- Broadcast alerts to any community.
- Pin or unpin verified guides.

#### 7.12.3 User and Trust Management
- View and approve verification requests.
- Approve local helper badge applications.
- Review and act on reports.
- Suspend or ban users.
- Audit log of all moderation actions.

#### 7.12.4 Analytics Dashboard
- Active users by event, country, host city.
- Trip groups and meetups created.
- Helper requests submitted and fulfilled.
- Message volume by community.
- Incident reports by type and resolution time.
- Business partner engagement.
- Retention rates across multi-event users.

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target |
|---|---|
| API response time (p95) | < 300ms |
| Real-time message delivery | < 500ms |
| Match-day peak traffic support | 10x baseline |
| Notification delivery SLA | < 5 seconds |
| App cold start (mobile) | < 3 seconds |
| Offline itinerary availability | Full read access offline |

### 8.2 Scalability
- Platform must support concurrent activation of multiple events without degradation.
- Community and messaging services must scale independently.
- Event data (match schedules, host cities) must be isolated per event to allow parallel operation.
- Helper matching must support fan bases across 200+ countries per event.

### 8.3 Security
- Encryption in transit (TLS 1.3).
- Encryption at rest for all PII.
- OAuth 2.0 and JWT-based authentication.
- Role-based access control for admin, moderator, business, and fan roles.
- Rate limiting on all public APIs.
- Audit logging for all moderation and admin actions.
- OWASP Top 10 mitigations enforced.
- Penetration testing before each major event activation.

### 8.4 Privacy and Compliance
- GDPR-compliant for EU users.
- CCPA-compliant for California users.
- PDPA-aware for users from South/Southeast Asia.
- User-controlled data export and deletion.
- Location sharing is explicit, opt-in, and revocable.
- No selling of user data to third parties.
- Consent required for identity verification data retention.
- Cookie and tracking consent for web versions.

### 8.5 Reliability
- Uptime SLA: 99.9% during non-event periods; 99.99% during active event windows.
- Graceful degradation: if recommendation service fails, base community features remain operational.
- Data backup: daily backups, point-in-time recovery.
- Incident response: < 30-minute triage for P1 incidents during live event windows.

### 8.6 Internationalization (i18n)
- UI support for at least 20 languages at launch; expandable.
- Right-to-left (RTL) layout support (Arabic, Hebrew, Urdu, Farsi).
- Locale-aware date, time, currency, and number formatting.
- Host city timezone conversion built into all schedule displays.
- Community-level language preference settings.

### 8.7 Accessibility
- WCAG 2.1 AA compliance.
- Screen reader support on iOS (VoiceOver) and Android (TalkBack).
- Minimum touch target size: 44×44px.
- Color contrast compliance for all text.
- Keyboard-navigable web version.

---

## 9. Platform Architecture (Recommended)

This section describes the recommended technical architecture for Abhijit's engineering team.

### 9.1 Deployment Model
- Cloud-native on AWS.
- Multi-region deployment for global low-latency (US, Europe, Asia-Pacific, at minimum).
- Event-driven architecture using AWS EventBridge for inter-service communication.
- Each major event can optionally be given dedicated capacity scaling groups.

### 9.2 Service Domains

| Service | Responsibilities | Suggested Stack |
|---|---|---|
| Identity Service | Auth, registration, verification, roles | AWS Cognito + custom claims |
| Event Registry Service | Event CRUD, schedule, teams, cities | PostgreSQL + REST API |
| Community Service | Communities, channels, posts, moderation | PostgreSQL + Elasticsearch |
| Messaging Service | Real-time chat, notifications | WebSockets + Redis Pub/Sub + DynamoDB |
| Trip Service | Itineraries, trip groups, intercity coordination | PostgreSQL |
| Helper Service | Helper profiles, listings, requests, ratings | PostgreSQL + recommendation layer |
| Matching Service | Fan discovery, smart suggestions | Redis + lightweight ML scoring |
| Notification Service | Push, SMS, email, in-app | AWS SNS + SES + FCM/APNs |
| Translation Service | Message translation, phrase cards | External API (DeepL or Azure) |
| Business Partner Service | Partner onboarding, listings, promotions | PostgreSQL |
| Admin Console | Event mgmt, moderation, analytics | React + GraphQL |
| Analytics Service | Usage tracking, event metrics, dashboards | AWS Kinesis + Redshift or OpenSearch |

### 9.3 API Design
- REST APIs for all synchronous CRUD operations (OpenAPI 3.x specification).
- WebSocket connections for real-time messaging and presence.
- GraphQL optional for admin console and complex relationship queries.
- API versioning from day one (v1, v2).
- Rate limiting and API keys for all external-facing endpoints.

### 9.4 Mobile
- React Native (preferred for shared codebase) or Flutter.
- Offline-first itinerary module using local SQLite.
- Push notifications via FCM (Android) and APNs (iOS).
- Deep links for community invites, trip shares, and helper profiles.

### 9.5 Web
- Next.js (React) for web app and admin console.
- Server-side rendering for SEO on public community and event discovery pages.
- Progressive Web App (PWA) capabilities for offline itinerary access.

---

## 10. MVP Definition

The MVP should be ready for activation no later than 4 weeks before any major event.

### 10.1 MVP Features (Phase 1)

- User registration, onboarding, and profile.
- Event activation flow.
- Country and city communities for the active event.
- Community channels: General, Travel, Accommodation, Food, Match-Day.
- Match-attendance tagging.
- Personal itinerary builder.
- Basic trip group creation and group chat.
- Local helper directory (browse and message).
- 1:1 messaging.
- Community announcements and pinned guides.
- Official info hub (city guides).
- Reporting and moderation.
- Push notifications.
- Mobile app (iOS + Android) + web.

### 10.2 Phase 2 Features

- Smart fan matching and suggestion cards.
- In-app translation layer.
- Intercity coordination with route matching.
- Helper availability calendar and structured request flow.
- Business partner listings.
- Safety modes (Solo, Women, Family, Accessibility).
- Emergency SOS flow.
- Verified identity tier.
- Cross-event profile persistence and reputation score.
- Admin console with analytics dashboard.

### 10.3 Phase 3 Features

- AI trip assistant (LLM-powered, event-aware).
- Expense splitting for group trips.
- Visa and entry intelligence module.
- Domestic league mode (EPL, IPL, NFL season-mode communities).
- Paid helper services marketplace.
- B2B API for fan club integrations.
- Data partnerships with official event bodies (FIFA, ICC, IOC).

---

## 11. Business Model

### 11.1 Revenue Streams

| Stream | Model | Notes |
|---|---|---|
| Fan Premium | $4.99/month or $9.99/event | Unlimited trip groups, AI assistant, premium matching |
| Helper Premium | $9.99/event period | Priority listing, verified badge boost |
| Business Partner Listings | $49–$299/event | Verified listing in community + promoted placement |
| Paid Helper Services | 15% commission | On guided tours, paid language support, concierge |
| Sponsored Community Content | Negotiated | Tourism boards, airlines, transport partners |
| B2B API Licensing | Negotiated | Fan clubs, diaspora associations, tour operators |
| Data and Insights | Negotiated | Anonymized aggregate fan movement data for cities and sponsors |

### 11.2 Free Tier
The core community, basic messaging, and personal itinerary remain free forever. Monetization is additive, not access-blocking. Trust and critical safety features are always free.

---

## 12. Go-to-Market Strategy

### 12.1 Launch Sequence
1. **Activate for FIFA World Cup 2026** (current) — US/Canada/Mexico. Test the full platform with the world's largest sports audience.
2. **Activate for ICC T20 / Cricket World Cup 2027** — South Africa. Capture massive South Asian diaspora travel.
3. **Activate for LA 2028 Olympics** — largest multi-sport event, 200+ countries.
4. **Activate for domestic leagues (EPL, IPL, NFL)** — move from events to ongoing fan relationship.
5. **Open B2B API** for fan clubs, diaspora associations, and tour operators.

### 12.2 Community-Led Growth
- Partner with diaspora community organizations in key cities.
- Outreach to official supporter clubs for national teams.
- Influencer partnerships with football/cricket/sports travel content creators.
- PR around the "local helper" story — human interest angle.

### 12.3 Institutional Partnerships
- Tourism boards of host countries.
- National Olympic and Sports Committees.
- Airlines with large international sports traveler base (Emirates, Korean Air, Air India, LATAM).
- Ground transport partners (FlixBus, Amtrak, MegaBus) for intercity coordination.

---

## 13. Success Metrics

### 13.1 Launch Metrics (First Event)
- 50,000 registered fans.
- Active country communities for 90%+ of participating nations.
- 500+ verified local helpers across host cities.
- 10,000+ trip group memberships.
- Helper response rate > 80% within 48 hours.
- App store rating ≥ 4.2.

### 13.2 Platform Health Metrics (Ongoing)
- Monthly Active Users (MAU) per event.
- Cross-event user retention rate (users who activate a second event).
- Helper network coverage: helpers available in every host city for every participating country.
- Safety: incident rate per 1,000 users; moderation resolution time.
- Community quality: average messages per community channel; moderator escalation rate.
- Business partner: partner listing fill rate; fan engagement with partner content.

---

## 14. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Safety incident between fans and helpers | High | Tiered verification, meetup check-in/out, SOS, reputation scoring |
| Scam listings (fake accommodation, ticket fraud) | High | Auto-moderation, community reporting, listing review flow |
| Low helper supply in key cities | Medium | Proactive recruitment via diaspora orgs before each event |
| Spike traffic on match days | High | Load testing, auto-scaling, graceful degradation |
| GDPR/CCPA non-compliance | High | Privacy by design, DPA for EU data, legal review per region |
| Dependency on specific events (if event is canceled) | Medium | Multi-event diversification, domestic league mode for year-round engagement |
| Competitive risk (WhatsApp groups, Reddit) | Low-Medium | Differentiate on structure, safety, helpers, and official info integration |
| Official event body blocking or IP conflicts | Medium | Avoid using official logos/names without permission; brand independently |

---

## 15. Open Questions for Phase 1 Planning

1. Should the MVP be mobile-first only, or web + mobile from day one?
2. Which identity verification provider to use (Stripe Identity, Onfido, Jumio)?
3. Will local helper services be moderated pre-listing or post-listing?
4. Does the platform handle any payment processing in Phase 1, or is everything free?
5. What is the content moderation SLA commitment at launch, and how is the moderation team staffed?
6. Will RoarPass seek an official data partnership with FIFA for the World Cup 2026 match schedule feed?
7. What languages should the app support at MVP launch, given that Phase 1 targets the World Cup?
8. Should community moderators be volunteer-based, paid, or a mix?

---

*Document version 1.0. All sections subject to revision as product discovery proceeds.*
