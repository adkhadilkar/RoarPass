/**
 * Safety-Trust-System ↔ Matching-Engine shared contract.
 * This file is the authoritative interface definition ensuring blocked/reported
 * users are never surfaced as match suggestions.
 */

export interface SafetyTrustContract {
  /**
   * Returns a set of user IDs that should be excluded from any match/discovery
   * results for the given viewer.
   *
   * Includes:
   *  - users the viewer has explicitly blocked
   *  - users that have blocked the viewer (mutual exclusion)
   *  - users that have been reported by the viewer (pending moderation)
   *  - users that have been platform-banned or shadow-restricted
   */
  getExcludedUserIds(viewerUserId: string, eventId: string): Promise<Set<string>>;

  /**
   * Returns true if a specific user pair has any block/report relationship.
   * Used for fast single-pair checks before surfacing a suggestion.
   */
  isUserPairBlocked(viewerUserId: string, targetUserId: string): Promise<boolean>;
}