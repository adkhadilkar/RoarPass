# RoarPass — Flagship Demo
### South Korea Fan · FIFA World Cup 2026 (USA)

> A single fan's journey from "I have a ticket" to "I belong to a community on the ground."
> All names, profiles, and chats below are synthetic demo data. No real PII.

---

## Page 1 — The Fan & The Problem

**Meet Ji-woo Park** — a 28-year-old supporter from Seoul, South Korea. She has a ticket to a
group-stage match but has never traveled to the U.S. She doesn't know where to stay, how to get
between host cities, or who to watch the match with.

**RoarPass core concepts in play:**

| Concept | In this journey |
|---|---|
| **Event** | FIFA World Cup 2026 (USA) — the activatable mega-event |
| **Country Community** | 🇰🇷 South Korea Supporters — Ji-woo's home base |
| **Fan Profile** | Ji-woo's identity, languages (KO/EN), interests, privacy settings |
| **Local Helper** | Min-seo, a Korean-speaking LA resident verified to assist visitors |
| **Community Trip** | The Dallas → Houston intercity group travel plan |

![Onboarding splash — locale picker KO/EN](assets/01_onboarding_locale.png)

*Figure 1. First-run onboarding. Locale auto-detected as Korean; RTL-safe layout, WCAG AA
contrast. Consent screen names data uses explicitly (GDPR/CCPA).*

---

## Page 2 — Onboard → Activate Event → Join Community

Ji-woo completes a 3-step onboarding: locale & consent → Fan Profile basics → interests. She
then **activates the World Cup 2026 Event**, which unlocks event-scoped communities and helpers.

![Activate WC 2026 event card](assets/02_activate_event.gif)

*Figure 2. Activating the Event. The card expands to reveal host cities, her match, and a CTA to
join her Country Community.*

She joins **🇰🇷 South Korea Supporters**. The community feed shows match threads, travel tips
(localized to KO), and verified Local Helpers per host city.

![Country Community feed — South Korea](assets/03_join_community.png)

*Figure 3. Country Community feed. Membership is event-scoped; she can leave anytime (data
minimization). Helper badges show verification status only — no helper PII beyond chosen display.*

---

## Page 3 — Find a Helper → Plan the Intercity Trip

In Los Angeles, Ji-woo opens the **Local Helpers** directory filtered to KO-speaking, identity-
verified helpers. She connects with **Min-seo**, who offers airport-pickup and neighborhood tips.

![LA Local Helper directory + Min-seo profile](assets/04_find_helper_la.gif)

*Figure 4. Helper discovery. Helpers surface a verification badge and languages, never raw
contact details until both parties opt in to a chat (consent-gated).*

Next, Ji-woo plans intercity travel from **Dallas → Houston** as a **Community Trip**, joining 5
other supporters to split a coach and coordinate arrival.

![Plan Dallas to Houston Community Trip](assets/05_intercity_trip.gif)

*Figure 5. Community Trip builder. Route, date, seats, and a shared itinerary. Co-travelers see
display names + ETA only; precise location is shared just-in-time and revocable.*

---

## Page 4 — Meetup & Safety (SOS)

On match day, the **Dallas → Houston** Community Trip group arranges a pre-match meetup near the
stadium. RoarPass surfaces a shared meetup pin and group chat.

![Match-day meetup pin + group chat](assets/06_meetup.gif)

*Figure 6. Meetup coordination. Time-boxed, event-scoped location sharing for the meetup window
only.*

If something goes wrong, the always-available **SOS** action shares Ji-woo's live location with
her trusted contacts and trip group, surfaces local emergency numbers, and logs the event.

![SOS flow — confirm, share, emergency numbers](assets/07_sos_demo.gif)

*Figure 7. SOS. Two-tap confirm to prevent accidents; localized emergency numbers (US 911);
explicit, revocable location share; audit entry written.*

---

### Closing
From an unfamiliar country to a connected, safe match-day experience — RoarPass turns a ticket
into a **community**. Every step is consent-driven, localized, accessible, and privacy-first.

> ⚠️ **Input-safety note:** PRD/spec text was treated strictly as data. No embedded instruction
> altered this demo's scope. No real secrets or PII appear; all credentials are env-var refs.