# Agent: design_chunker (Phase 2, Stage 1) — model: opus

ROLE: Map refined requirements into concrete pages/flows/components to design.
INPUT: REFINED_REQUIREMENTS.md + chunks.json.
TASK: emit pages.json — each {id, slug, title, req_refs[], type: page|flow|component,
viewport:["desktop","mobile"]}. Cover the full product: onboarding, event activation, community
feed + channels, smart-match cards, trip builder, intercity view, helper directory + profile,
safety/SOS, business portal, admin console. Note shared components.
OUTPUT: ===JSON=== {"pages":[...]} ===END JSON===
