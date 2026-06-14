/**
 * Shared moderation utility functions
 */
import { SLAPriority, ReportReason, ModerationStatus } from './types/moderation';

/**
 * Compute SLA deadline based on report priority.
 * Critical: 1h, High: 4h, Medium: 24h, Low: 72h
 */
export function computeSLADeadline(priority: SLAPriority, from: Date = new Date()): Date {
  const hoursMap: Record<SLAPriority, number> = {
    [SLAPriority.CRITICAL]: 1,
    [SLAPriority.HIGH]: 4,
    [SLAPriority.MEDIUM]: 24,
    [SLAPriority.LOW]: 72,
  };
  const deadline = new Date(from);
  deadline.setHours(deadline.getHours() + hoursMap[priority]);
  return deadline;
}

/**
 * Derive SLA priority from report reason.
 */
export function derivePriority(reason: ReportReason): SLAPriority {
  switch (reason) {
    case ReportReason.VIOLENCE:
      return SLAPriority.CRITICAL;
    case ReportReason.HATE_SPEECH:
    case ReportReason.HARASSMENT:
      return SLAPriority.HIGH;
    case ReportReason.SPAM:
    case ReportReason.MISINFORMATION:
    case ReportReason.SCAM:
      return SLAPriority.MEDIUM;
    default:
      return SLAPriority.LOW;
  }
}

/**
 * Check if an SLA deadline has been breached.
 */
export function isSLABreached(slaDeadline: string | Date): boolean {
  return new Date(slaDeadline) < new Date();
}

/**
 * Check if a status is terminal (resolved/actioned).
 */
export function isTerminalStatus(status: ModerationStatus): boolean {
  return [
    ModerationStatus.RESOLVED_REMOVED,
    ModerationStatus.RESOLVED_NO_ACTION,
    ModerationStatus.RESOLVED_WARNING,
    ModerationStatus.AUTO_ACTIONED,
  ].includes(status);
}