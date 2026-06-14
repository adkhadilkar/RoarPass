import { Router } from "express";
import { z } from "zod";
import { authenticate, requireOwnerOrAdmin } from "../middleware/auth.middleware";
import { validateBody, validateParams } from "../middleware/validate.middleware";
import { gdprService } from "../services/gdpr.service";
import { createAuditLog } from "../services/audit.service";

const router = Router();

const UserIdParam = z.object({ userId: z.string().uuid() });

const ConsentUpdateBody = z.object({
  purpose: z.enum([
    "analytics", "marketing", "ai_assistant",
    "translation_third_party", "push_notifications", "location",
  ]),
  granted: z.boolean(),
  version: z.string().min(1),
});

/**
 * GET /v1/users/:userId/privacy/consents
 * Returns all consent records for the user.
 */
router.get(
  "/users/:userId/privacy/consents",
  authenticate,
  requireOwnerOrAdmin,
  validateParams(UserIdParam),
  async (req, res) => {
    try {
      const consents = await gdprService.getConsents(req.params["userId"]!);
      res.json({ consents });
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

/**
 * PUT /v1/users/:userId/privacy/consents
 * Update (grant or revoke) a consent purpose.
 */
router.put(
  "/users/:userId/privacy/consents",
  authenticate,
  requireOwnerOrAdmin,
  validateParams(UserIdParam),
  validateBody(ConsentUpdateBody),
  async (req, res) => {
    try {
      const userId = req.params["userId"]!;
      const { purpose, granted, version } = req.body as z.infer<typeof ConsentUpdateBody>;

      const record = await gdprService.upsertConsent({
        user_id: userId,
        purpose,
        granted,
        version,
        ip_address_hash: hashIP(req.ip ?? ""),
        user_agent: req.headers["user-agent"]?.slice(0, 512) ?? "",
      });

      await createAuditLog({
        event: granted ? "CONSENT_GRANTED" : "CONSENT_REVOKED",
        user_id: userId,
        metadata: { purpose, version },
      });

      res.json({ consent: record });
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

/**
 * POST /v1/users/:userId/privacy/data-export
 * Initiates a GDPR/CCPA right-to-access data export.
 */
router.post(
  "/users/:userId/privacy/data-export",
  authenticate,
  requireOwnerOrAdmin,
  validateParams(UserIdParam),
  validateBody(z.object({ regulation: z.enum(["GDPR", "CCPA", "PDPA"]) })),
  async (req, res) => {
    try {
      const userId = req.params["userId"]!;
      const { regulation } = req.body as { regulation: "GDPR" | "CCPA" | "PDPA" };

      const request = await gdprService.initiateDataExport(userId, regulation);

      await createAuditLog({
        event: "DATA_EXPORT_REQUESTED",
        user_id: userId,
        metadata: { regulation, request_id: request.request_id },
      });

      res.status(202).json({ request });
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

/**
 * GET /v1/users/:userId/privacy/data-export/:requestId
 * Polls status of an export request.
 */
router.get(
  "/users/:userId/privacy/data-export/:requestId",
  authenticate,
  requireOwnerOrAdmin,
  validateParams(z.object({ userId: z.string().uuid(), requestId: z.string().uuid() })),
  async (req, res) => {
    try {
      const request = await gdprService.getExportStatus(
        req.params["userId"]!,
        req.params["requestId"]!,
      );
      if (!request) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.json({ request });
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

/**
 * DELETE /v1/users/:userId/privacy/account
 * Initiates right-to-erasure (GDPR Art. 17 / CCPA).
 * Must cascade to all downstream systems asynchronously.
 */
router.delete(
  "/users/:userId/privacy/account",
  authenticate,
  requireOwnerOrAdmin,
  validateParams(UserIdParam),
  validateBody(z.object({ regulation: z.enum(["GDPR", "CCPA", "PDPA"]) })),
  async (req, res) => {
    try {
      const userId = req.params["userId"]!;
      const { regulation } = req.body as { regulation: "GDPR" | "CCPA" | "PDPA" };

      const deletionRequest = await gdprService.initiateAccountDeletion(userId, regulation);

      await createAuditLog({
        event: "ACCOUNT_DELETION_REQUESTED",
        user_id: userId,
        metadata: { regulation, request_id: deletionRequest.request_id },
      });

      // Return 202 — deletion is async across downstream systems
      res.status(202).json({ request: deletionRequest });
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

// ─── Helpers ───────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export { router as gdprRouter };