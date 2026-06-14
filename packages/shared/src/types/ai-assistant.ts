import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const AssistantSessionStatus = z.enum(["active", "expired", "cleared"]);
export type AssistantSessionStatus = z.infer<typeof AssistantSessionStatus>;

export const AssistantRole = z.enum(["user", "assistant"]);
export type AssistantRole = z.infer<typeof AssistantRole>;

export const FeedbackRating = z.enum(["positive", "negative"]);
export type FeedbackRating = z.infer<typeof FeedbackRating>;

export const FeedbackReasonCategory = z.enum([
  "wrong_info",
  "not_helpful",
  "missing_options",
  "other",
]);
export type FeedbackReasonCategory = z.infer<typeof FeedbackReasonCategory>;

export const SuggestionType = z.enum(["route", "helper", "alert", "itinerary"]);
export type SuggestionType = z.infer<typeof SuggestionType>;

// ─── Core Entities ────────────────────────────────────────────────────────────

export const AssistantSession = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid(),
  started_at: z.string().datetime(),
  last_active_at: z.string().datetime(),
  language_code: z.string().min(2).max(10), // BCP-47
  turn_count: z.number().int().nonnegative(),
  status: AssistantSessionStatus,
});
export type AssistantSession = z.infer<typeof AssistantSession>;

export const AssistantTurn = z.object({
  turn_id: z.string().uuid(),
  session_id: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  role: AssistantRole,
  content_encrypted: z.string(),
  content_hash: z.string(),
  created_at: z.string().datetime(),
  tokens_used: z.number().int().nonnegative().optional(),
  model_version: z.string().optional(),
});
export type AssistantTurn = z.infer<typeof AssistantTurn>;

export const AssistantFeedback = z.object({
  feedback_id: z.string().uuid(),
  turn_id: z.string().uuid(),
  rating: FeedbackRating,
  reason_category: FeedbackReasonCategory.nullable().optional(),
  reason_text: z.string().max(500).nullable().optional(),
  created_at: z.string().datetime(),
});
export type AssistantFeedback = z.infer<typeof AssistantFeedback>;

// ─── Suggestions ──────────────────────────────────────────────────────────────

export const RouteSuggestion = z.object({
  type: z.literal("route"),
  summary: z.string(),
  duration_minutes: z.number().int().positive(),
  estimated_cost_usd: z.number().nonnegative().nullable().optional(),
  depart_by: z.string().datetime().optional(),
  deep_link: z.string(),
  transport_mode: z.string().optional(),
  border_notes: z.string().optional(),
});
export type RouteSuggestion = z.infer<typeof RouteSuggestion>;

export const HelperSuggestion = z.object({
  type: z.literal("helper"),
  helper_id: z.string().uuid(),
  display_name: z.string(),
  trust_tier: z.string(),
  languages: z.array(z.string()),
  offering_categories: z.array(z.string()).optional(),
  availability_status: z.string().optional(),
  deep_link: z.string(),
});
export type HelperSuggestion = z.infer<typeof HelperSuggestion>;

export const AssistantSuggestion = z.discriminatedUnion("type", [
  RouteSuggestion,
  HelperSuggestion,
]);
export type AssistantSuggestion = z.infer<typeof AssistantSuggestion>;

// ─── API Request / Response Shapes ───────────────────────────────────────────

export const StartSessionRequest = z.object({
  event_id: z.string().uuid(),
  language_code: z.string().min(2).max(10).optional(),
});
export type StartSessionRequest = z.infer<typeof StartSessionRequest>;

export const StartSessionResponse = z.object({
  session_id: z.string().uuid(),
  status: AssistantSessionStatus,
  trial_queries_remaining: z.number().int().nonnegative().nullable(),
});
export type StartSessionResponse = z.infer<typeof StartSessionResponse>;

export const SendTurnRequest = z.object({
  content: z.string().min(1).max(4000),
  session_preference_overrides: z
    .object({
      travel_style: z.string().optional(),
      budget_only: z.boolean().optional(),
    })
    .optional(),
});
export type SendTurnRequest = z.infer<typeof SendTurnRequest>;

export const SendTurnResponse = z.object({
  turn_id: z.string().uuid(),
  sequence: z.number().int(),
  role: z.literal("assistant"),
  content: z.string(),
  suggestions: z.array(AssistantSuggestion).optional(),
  active_alerts_surfaced: z.array(z.string()).optional(),
  safety_disclaimer_shown: z.boolean(),
  tokens_used: z.number().int().nonnegative().optional(),
  created_at: z.string().datetime(),
});
export type SendTurnResponse = z.infer<typeof SendTurnResponse>;

export const FeedbackRequest = z.object({
  rating: FeedbackRating,
  reason_category: FeedbackReasonCategory.optional(),
  reason_text: z.string().max(500).optional(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

export const AssistantStatus = z.object({
  assistant_available: z.boolean(),
  premium_active: z.boolean(),
  trial_queries_remaining: z.number().int().nonnegative().nullable(),
  trial_queries_total: z.number().int().positive(),
});
export type AssistantStatus = z.infer<typeof AssistantStatus>;