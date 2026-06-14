import crypto from "crypto";
import {
  AssistantSession,
  AssistantTurn,
  AssistantFeedback,
  AssistantSuggestion,
  SendTurnResponse,
  StartSessionResponse,
  AssistantStatus,
} from "@roarpass/shared/types/ai-assistant";
import { AIGateway } from "./ai-gateway.service";
import { ContextAssembler } from "./context-assembler.service";
import { ContentSafetyFilter } from "./content-safety-filter.service";
import { PremiumGuard } from "../billing/premium-guard.service";
import { db } from "../../db";
import { redis } from "../../redis";
import { logger } from "../../logger";

const TRIAL_QUERY_LIMIT = 5;
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const MAX_TURNS_IN_CONTEXT = 20;
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export class AIAssistantService {
  constructor(
    private readonly gateway: AIGateway,
    private readonly contextAssembler: ContextAssembler,
    private readonly safetyFilter: ContentSafetyFilter,
    private readonly premiumGuard: PremiumGuard
  ) {}

  // ─── Premium / Trial Gating ─────────────────────────────────────────────────

  async getAssistantStatus(userId: string): Promise<AssistantStatus> {
    const isPremium = await this.premiumGuard.isPremium(userId);
    const trialUsed = await this.getTrialQueriesUsed(userId);
    return {
      assistant_available: true,
      premium_active: isPremium,
      trial_queries_remaining: isPremium
        ? null
        : Math.max(0, TRIAL_QUERY_LIMIT - trialUsed),
      trial_queries_total: TRIAL_QUERY_LIMIT,
    };
  }

  private async getTrialQueriesUsed(userId: string): Promise<number> {
    const key = `assistant:trial:${userId}`;
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  private async incrementTrialQueries(userId: string): Promise<void> {
    const key = `assistant:trial:${userId}`;
    await redis.incr(key);
    // TTL is indefinite per event — do not expire trial counter
  }

  // ─── Rate Limiting ──────────────────────────────────────────────────────────

  async checkRateLimit(userId: string): Promise<boolean> {
    const key = `assistant:ratelimit:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }
    return count <= RATE_LIMIT_MAX;
  }

  // ─── Session Management ──────────────────────────────────────────────────────

  async startOrResumeSession(
    userId: string,
    eventId: string,
    languageCode?: string
  ): Promise<StartSessionResponse> {
    const isPremium = await this.premiumGuard.isPremium(userId);
    const trialUsed = await this.getTrialQueriesUsed(userId);

    // Check for existing active session
    const existing = await db.assistantSession.findFirst({
      where: { user_id: userId, event_id: eventId, status: "active" },
      orderBy: { last_active_at: "desc" },
    });
    if (existing) {
      return {
        session_id: existing.session_id,
        status: "active",
        trial_queries_remaining: isPremium
          ? null
          : Math.max(0, TRIAL_QUERY_LIMIT - trialUsed),
      };
    }

    // Resolve language from profile if not provided
    const resolvedLang =
      languageCode ??
      (await db.fanProfile.findUnique({ where: { user_id: userId } }))
        ?.preferred_language ??
      "en";

    const session = await db.assistantSession.create({
      data: {
        session_id: crypto.randomUUID(),
        user_id: userId,
        event_id: eventId,
        started_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        language_code: resolvedLang,
        turn_count: 0,
        status: "active",
      },
    });

    // Cache session metadata in Redis for fast lookup
    await redis.set(
      `assistant:session:${session.session_id}`,
      JSON.stringify(session),
      "EX",
      SESSION_TTL_SECONDS
    );

    return {
      session_id: session.session_id,
      status: "active",
      trial_queries_remaining: isPremium
        ? null
        : Math.max(0, TRIAL_QUERY_LIMIT - trialUsed),
    };
  }

  async clearSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.resolveSession(sessionId, userId);
    await db.assistantSession.update({
      where: { session_id: session.session_id },
      data: { status: "cleared" },
    });
    await redis.del(`assistant:session:${sessionId}`);
  }

  // ─── Turn Processing ─────────────────────────────────────────────────────────

  async sendTurn(
    sessionId: string,
    userId: string,
    content: string,
    sessionOverrides?: Record<string, unknown>
  ): Promise<SendTurnResponse> {
    const session = await this.resolveSession(sessionId, userId);

    // Enforce premium/trial gate
    const isPremium = await this.premiumGuard.isPremium(userId);
    if (!isPremium) {
      const trialUsed = await this.getTrialQueriesUsed(userId);
      if (trialUsed >= TRIAL_QUERY_LIMIT) {
        throw new PremiumRequiredError(trialUsed);
      }
    }

    // Content safety: detect prompt injection
    const injectionDetected = await this.safetyFilter.detectPromptInjection(content);
    if (injectionDetected) {
      logger.warn({ userId, sessionId }, "Prompt injection attempt detected and neutralized");
      // Continue processing but the gateway will use guardrail-sanitized version
    }

    // Build context
    const context = await this.contextAssembler.assemble(userId, session);

    // Retrieve recent turns for multi-turn dialogue (last 20)
    const recentTurns = await this.getRecentTurns(sessionId, MAX_TURNS_IN_CONTEXT);

    // Store user turn
    const userTurnId = crypto.randomUUID();
    const userContent = injectionDetected
      ? this.safetyFilter.sanitizeInput(content)
      : content;
    const userTurn = await this.storeTurn(sessionId, {
      turn_id: userTurnId,
      role: "user",
      content: userContent,
      sequence: session.turn_count,
    });

    // Call LLM via gateway
    let llmResult: { content: string; suggestions: AssistantSuggestion[]; tokensUsed: number; modelVersion: string };
    try {
      llmResult = await this.gateway.complete({
        systemContext: context,
        history: recentTurns,
        userMessage: userContent,
        languageCode: session.language_code,
        sessionOverrides,
      });
    } catch (err) {
      logger.error({ err, sessionId }, "LLM gateway error");
      throw new AssistantUnavailableError();
    }

    // Post-process: content safety filter on response
    const safeContent = await this.safetyFilter.filterResponse(llmResult.content);

    // Validate and clean suggestions (deep-link validation)
    const validatedSuggestions = await this.validateSuggestions(llmResult.suggestions);

    // Store assistant turn (encrypted at rest by DB layer)
    const assistantTurnId = crypto.randomUUID();
    const assistantTurnSeq = session.turn_count + 1;
    await this.storeTurn(sessionId, {
      turn_id: assistantTurnId,
      role: "assistant",
      content: safeContent,
      sequence: assistantTurnSeq,
      tokensUsed: llmResult.tokensUsed,
      modelVersion: llmResult.modelVersion,
    });

    // Update session turn count and last_active
    await db.assistantSession.update({
      where: { session_id: sessionId },
      data: {
        turn_count: assistantTurnSeq + 1,
        last_active_at: new Date().toISOString(),
        language_code: this.detectLanguageShift(session.language_code, content) ?? session.language_code,
      },
    });

    // Increment trial usage
    if (!isPremium) {
      await this.incrementTrialQueries(userId);
    }

    // Active alerts surfaced
    const activeAlerts = context.activeAlerts.map((a: { alert_id: string }) => a.alert_id);

    return {
      turn_id: assistantTurnId,
      sequence: assistantTurnSeq,
      role: "assistant",
      content: safeContent,
      suggestions: validatedSuggestions,
      active_alerts_surfaced: activeAlerts,
      safety_disclaimer_shown: true,
      tokens_used: llmResult.tokensUsed,
      created_at: new Date().toISOString(),
    };
  }

  // ─── Session History ─────────────────────────────────────────────────────────

  async getSessionTurns(
    sessionId: string,
    userId: string,
    limit = 20,
    beforeSequence?: number
  ): Promise<{ turns: AssistantTurn[]; total: number }> {
    await this.resolveSession(sessionId, userId);

    const where: Record<string, unknown> = { session_id: sessionId };
    if (beforeSequence !== undefined) {
      where.sequence = { lt: beforeSequence };
    }

    const [turns, total] = await Promise.all([
      db.assistantTurn.findMany({
        where,
        orderBy: { sequence: "asc" },
        take: limit,
      }),
      db.assistantTurn.count({ where: { session_id: sessionId } }),
    ]);

    // Decrypt content for authorized user
    return {
      turns: turns.map((t: { turn_id: string; session_id: string; sequence: number; role: string; content_encrypted: string; content_hash: string; created_at: Date; tokens_used?: number; model_version?: string }) => ({
        turn_id: t.turn_id,
        session_id: t.session_id,
        sequence: t.sequence,
        role: t.role as "user" | "assistant",
        content_encrypted: t.content_encrypted, // Return encrypted; client decrypts or use separate decryption endpoint
        content_hash: t.content_hash,
        created_at: t.created_at.toISOString(),
        tokens_used: t.tokens_used,
        model_version: t.model_version,
      })),
      total,
    };
  }

  // ─── Feedback ────────────────────────────────────────────────────────────────

  async submitFeedback(
    turnId: string,
    userId: string,
    rating: "positive" | "negative",
    reasonCategory?: string,
    reasonText?: string
  ): Promise<{ feedback_id: string }> {
    // Verify the turn belongs to a session owned by this user
    const turn = await db.assistantTurn.findUnique({ where: { turn_id: turnId } });
    if (!turn) throw new NotFoundError("Turn not found");
    const session = await db.assistantSession.findUnique({
      where: { session_id: turn.session_id },
    });
    if (!session || session.user_id !== userId) throw new ForbiddenError();
    if (turn.role !== "assistant") throw new BadRequestError("Feedback only on assistant turns");

    const feedbackId = crypto.randomUUID();
    await db.assistantFeedback.create({
      data: {
        feedback_id: feedbackId,
        turn_id: turnId,
        rating,
        reason_category: reasonCategory ?? null,
        reason_text: reasonText ? reasonText.slice(0, 500) : null,
        created_at: new Date().toISOString(),
      },
    });

    // Log to audit pipeline (anonymized — no user_id)
    logger.info({ feedbackId, turnId, rating, reasonCategory }, "assistant_feedback");

    return { feedback_id: feedbackId };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveSession(sessionId: string, userId: string): Promise<AssistantSession> {
    // Try cache first
    const cached = await redis.get(`assistant:session:${sessionId}`);
    let session: AssistantSession | null = cached ? JSON.parse(cached) : null;

    if (!session) {
      const dbSession = await db.assistantSession.findUnique({
        where: { session_id: sessionId },
      });
      if (!dbSession) throw new NotFoundError("Session not found");
      session = dbSession as unknown as AssistantSession;
    }

    if (session.user_id !== userId) throw new ForbiddenError();
    if (session.status !== "active") throw new BadRequestError("Session is not active");

    return session;
  }

  private async storeTurn(
    sessionId: string,
    turn: { turn_id: string; role: string; content: string; sequence: number; tokensUsed?: number; modelVersion?: string }
  ): Promise<void> {
    const encrypted = this.encryptContent(turn.content);
    const hash = crypto.createHash("sha256").update(turn.content).digest("hex");

    await db.assistantTurn.create({
      data: {
        turn_id: turn.turn_id,
        session_id: sessionId,
        sequence: turn.sequence,
        role: turn.role,
        content_encrypted: encrypted,
        content_hash: hash,
        created_at: new Date().toISOString(),
        tokens_used: turn.tokensUsed ?? null,
        model_version: turn.modelVersion ?? null,
      },
    });
  }

  private async getRecentTurns(sessionId: string, limit: number) {
    const turns = await db.assistantTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { sequence: "desc" },
      take: limit,
    });
    return turns.reverse().map((t: { role: string; content_encrypted: string }) => ({
      role: t.role,
      content: this.decryptContent(t.content_encrypted),
    }));
  }

  private encryptContent(content: string): string {
    const key = Buffer.from(process.env.ASSISTANT_ENCRYPTION_KEY!, "hex");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  private decryptContent(encryptedBase64: string): string {
    const key = Buffer.from(process.env.ASSISTANT_ENCRYPTION_KEY!, "hex");
    const buf = Buffer.from(encryptedBase64, "base64");
    const iv = buf.slice(0, 16);
    const tag = buf.slice(16, 32);
    const encrypted = buf.slice(32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  private async validateSuggestions(
    suggestions: AssistantSuggestion[]
  ): Promise<AssistantSuggestion[]> {
    const validated: AssistantSuggestion[] = [];
    for (const s of suggestions) {
      if (s.type === "helper") {
        // Verify helper still exists and is discoverable
        const helper = await db.helperProfile.findUnique({
          where: { helper_id: s.helper_id },
        });
        if (!helper || !helper.is_discoverable) continue;
      }
      validated.push(s);
    }
    return validated;
  }

  private detectLanguageShift(currentLang: string, content: string): string | null {
    // Lightweight heuristic: if content contains Arabic/RTL characters, update language_code
    const arabicPattern = /[\u0600-\u06FF]/;
    const koreanPattern = /[\uAC00-\uD7AF]/;
    const japanesePattern = /[\u3040-\u30FF]/;

    if (arabicPattern.test(content) && currentLang !== "ar") return "ar";
    if (koreanPattern.test(content) && currentLang !== "ko") return "ko";
    if (japanesePattern.test(content) && currentLang !== "ja") return "ja";
    return null;
  }
}

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class PremiumRequiredError extends Error {
  readonly trialQueriesUsed: number;
  constructor(trialQueriesUsed: number) {
    super("premium_required");
    this.trialQueriesUsed = trialQueriesUsed;
  }
}

export class AssistantUnavailableError extends Error {
  constructor() {
    super("assistant_temporarily_unavailable");
  }
}

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {
  constructor() { super("forbidden"); }
}
export class BadRequestError extends Error {}