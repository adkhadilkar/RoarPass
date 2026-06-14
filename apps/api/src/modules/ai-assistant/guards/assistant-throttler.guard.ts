import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Per-user rate limiting enforced at application layer as secondary control.
 * Primary enforcement MUST be at the API gateway layer (REQ-AI-NFR-19).
 * 100 queries/hour/user — REQ-AI-28.
 */
@Injectable()
export class AssistantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = (req as any).user?.user_id;
    // Key on user_id not IP to prevent shared-IP bypass
    return `assistant_throttle_${userId}`;
  }
}