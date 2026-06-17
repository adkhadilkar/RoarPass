import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  SafetyPreferences,
  TrustedContact,
  MeetupCheckIn,
  SOSAlert,
  LocationShare,
  UserReport,
  BlockRecord,
  SafetyMode,
  CheckInStatus,
  SOSStatus,
  LocationSharingMode,
  TrustedContactRole,
  BlockStatus,
} from '@roarpass/shared/types/safety';

export class SafetyRepository {
  constructor(private readonly pool: Pool) {}

  // ─── Safety Preferences ──────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<SafetyPreferences | null> {
    const result = await this.pool.query(
      `SELECT * FROM safety_preferences WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async upsertPreferences(
    userId: string,
    patch: Partial<Omit<SafetyPreferences, 'user_id' | 'updated_at'>>,
  ): Promise<SafetyPreferences> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO safety_preferences
         (user_id, active_mode, location_sharing_mode, check_in_interval_minutes,
          auto_sos_on_overdue, sos_message_custom, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET
         active_mode               = COALESCE(EXCLUDED.active_mode, safety_preferences.active_mode),
         location_sharing_mode     = COALESCE(EXCLUDED.location_sharing_mode, safety_preferences.location_sharing_mode),
         check_in_interval_minutes = COALESCE(EXCLUDED.check_in_interval_minutes, safety_preferences.check_in_interval_minutes),
         auto_sos_on_overdue       = COALESCE(EXCLUDED.auto_sos_on_overdue, safety_preferences.auto_sos_on_overdue),
         sos_message_custom        = COALESCE(EXCLUDED.sos_message_custom, safety_preferences.sos_message_custom),
         updated_at                = EXCLUDED.updated_at
       RETURNING *`,
      [
        userId,
        patch.active_mode ?? SafetyMode.STANDARD,
        patch.location_sharing_mode ?? LocationSharingMode.DISABLED,
        patch.check_in_interval_minutes ?? 60,
        patch.auto_sos_on_overdue ?? false,
        patch.sos_message_custom ?? null,
        now,
      ],
    );
    return result.rows[0];
  }

  // ─── Trusted Contacts ────────────────────────────────────────────────────

  async listTrustedContacts(ownerUserId: string): Promise<TrustedContact[]> {
    const result = await this.pool.query(
      `SELECT * FROM trusted_contacts WHERE owner_user_id = $1 ORDER BY created_at ASC`,
      [ownerUserId],
    );
    return result.rows;
  }

  async getTrustedContact(contactId: string, ownerUserId: string): Promise<TrustedContact | null> {
    const result = await this.pool.query(
      `SELECT * FROM trusted_contacts WHERE contact_id = $1 AND owner_user_id = $2`,
      [contactId, ownerUserId],
    );
    return result.rows[0] ?? null;
  }

  async createTrustedContact(
    ownerUserId: string,
    data: {
      contact_user_id?: string | null;
      contact_name: string;
      contact_phone?: string | null;
      contact_email?: string | null;
      role: TrustedContactRole;
    },
  ): Promise<TrustedContact> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO trusted_contacts
         (contact_id, owner_user_id, contact_user_id, contact_name,
          contact_phone, contact_email, role, confirmed, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$8)
       RETURNING *`,
      [
        uuidv4(),
        ownerUserId,
        data.contact_user_id ?? null,
        data.contact_name,
        data.contact_phone ?? null,
        data.contact_email ?? null,
        data.role,
        now,
      ],
    );
    return result.rows[0];
  }

  async deleteTrustedContact(contactId: string, ownerUserId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM trusted_contacts WHERE contact_id = $1 AND owner_user_id = $2`,
      [contactId, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countTrustedContacts(ownerUserId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM trusted_contacts WHERE owner_user_id = $1`,
      [ownerUserId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  // ─── Meetup Check-In / Check-Out ─────────────────────────────────────────

  async getActiveCheckIn(userId: string, meetupId: string): Promise<MeetupCheckIn | null> {
    const result = await this.pool.query(
      `SELECT * FROM meetup_checkins
       WHERE user_id = $1 AND meetup_id = $2 AND status NOT IN ('CHECKED_OUT','CANCELLED')
       ORDER BY created_at DESC LIMIT 1`,
      [userId, meetupId],
    );
    return result.rows[0] ?? null;
  }

  async createCheckIn(
    userId: string,
    meetupId: string,
    data: {
      expected_checkout_at?: string;
      location_lat?: number;
      location_lng?: number;
    },
  ): Promise<MeetupCheckIn> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO meetup_checkins
         (checkin_id, meetup_id, user_id, status, checked_in_at,
          expected_checkout_at, location_lat, location_lng, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$5,$5)
       RETURNING *`,
      [
        uuidv4(),
        meetupId,
        userId,
        CheckInStatus.CHECKED_IN,
        now,
        data.expected_checkout_at ?? null,
        data.location_lat ?? null,
        data.location_lng ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateCheckIn(
    checkinId: string,
    userId: string,
    data: Partial<Pick<MeetupCheckIn, 'status' | 'checked_out_at' | 'location_lat' | 'location_lng'>>,
  ): Promise<MeetupCheckIn | null> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE meetup_checkins SET
         status          = COALESCE($3, status),
         checked_out_at  = COALESCE($4, checked_out_at),
         location_lat    = COALESCE($5, location_lat),
         location_lng    = COALESCE($6, location_lng),
         updated_at      = $7
       WHERE checkin_id = $1 AND user_id = $2
       RETURNING *`,
      [
        checkinId,
        userId,
        data.status ?? null,
        data.checked_out_at ?? null,
        data.location_lat ?? null,
        data.location_lng ?? null,
        now,
      ],
    );
    return result.rows[0] ?? null;
  }

  async markOverdueCheckIns(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE meetup_checkins
       SET status = $1, updated_at = NOW()
       WHERE status = $2 AND expected_checkout_at < NOW()
       RETURNING checkin_id, user_id`,
      [CheckInStatus.OVERDUE, CheckInStatus.CHECKED_IN],
    );
    return result.rowCount ?? 0;
  }

  // ─── SOS Alerts ──────────────────────────────────────────────────────────

  async createSOS(
    userId: string,
    data: {
      location_lat?: number;
      location_lng?: number;
      location_accuracy_meters?: number;
      message?: string;
      event_id?: string;
    },
  ): Promise<SOSAlert> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO sos_alerts
         (sos_id, user_id, status, triggered_at, location_lat, location_lng,
          location_accuracy_meters, message, notified_contact_ids, event_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$4,$4)
       RETURNING *`,
      [
        uuidv4(),
        userId,
        SOSStatus.ACTIVE,
        now,
        data.location_lat ?? null,
        data.location_lng ?? null,
        data.location_accuracy_meters ?? null,
        data.message ?? null,
        JSON.stringify([]),
        data.event_id ?? null,
      ],
    );
    return result.rows[0];
  }

  async getActiveSOS(userId: string): Promise<SOSAlert | null> {
    const result = await this.pool.query(
      `SELECT * FROM sos_alerts WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY triggered_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async getSOS(sosId: string, userId: string): Promise<SOSAlert | null> {
    const result = await this.pool.query(
      `SELECT * FROM sos_alerts WHERE sos_id = $1 AND user_id = $2`,
      [sosId, userId],
    );
    return result.rows[0] ?? null;
  }

  async resolveSOS(sosId: string, userId: string, note?: string): Promise<SOSAlert | null> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE sos_alerts
       SET status = $3, resolved_at = $4, updated_at = $4
       WHERE sos_id = $1 AND user_id = $2 AND status = 'ACTIVE'
       RETURNING *`,
      [sosId, userId, SOSStatus.RESOLVED, now],
    );
    if (note && result.rows[0]) {
      // Store resolution note in audit_log — not in sos_alerts to avoid PII leakage
      await this.pool.query(
        `INSERT INTO safety_audit_log (log_id, entity_type, entity_id, actor_user_id, action, metadata, created_at)
         VALUES ($1,'sos_alert',$2,$3,'RESOLVED',$4,NOW())`,
        [uuidv4(), sosId, userId, JSON.stringify({ note })],
      );
    }
    return result.rows[0] ?? null;
  }

  async cancelSOS(sosId: string, userId: string): Promise<SOSAlert | null> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE sos_alerts
       SET status = $3, updated_at = $4
       WHERE sos_id = $1 AND user_id = $2 AND status = 'ACTIVE'
       RETURNING *`,
      [sosId, userId, SOSStatus.CANCELLED, now],
    );
    return result.rows[0] ?? null;
  }

  async updateSOSNotifiedContacts(sosId: string, contactIds: string[]): Promise<void> {
    await this.pool.query(
      `UPDATE sos_alerts SET notified_contact_ids = $2, updated_at = NOW() WHERE sos_id = $1`,
      [sosId, JSON.stringify(contactIds)],
    );
  }

  // ─── Location Sharing ────────────────────────────────────────────────────

  async createLocationShare(
    sharerUserId: string,
    recipientUserId: string,
    expiresAt: string,
    eventId?: string,
  ): Promise<LocationShare> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO location_shares
         (share_id, sharer_user_id, recipient_user_id, event_id, expires_at, revoked, created_at)
       VALUES ($1,$2,$3,$4,$5,false,$6)
       RETURNING *`,
      [uuidv4(), sharerUserId, recipientUserId, eventId ?? null, expiresAt, now],
    );
    return result.rows[0];
  }

  async revokeLocationShare(shareId: string, sharerUserId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE location_shares SET revoked = true WHERE share_id = $1 AND sharer_user_id = $2`,
      [shareId, sharerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveLocationShares(sharerUserId: string): Promise<LocationShare[]> {
    const result = await this.pool.query(
      `SELECT * FROM location_shares
       WHERE sharer_user_id = $1 AND revoked = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [sharerUserId],
    );
    return result.rows;
  }

  async getSharesWithMe(recipientUserId: string): Promise<LocationShare[]> {
    const result = await this.pool.query(
      `SELECT * FROM location_shares
       WHERE recipient_user_id = $1 AND revoked = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [recipientUserId],
    );
    return result.rows;
  }

  // ─── User Reports ────────────────────────────────────────────────────────

  async createReport(
    reporterUserId: string,
    data: {
      reported_user_id: string;
      category: string;
      description: string;
      evidence_urls: string[];
    },
  ): Promise<UserReport> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO user_reports
         (report_id, reporter_user_id, reported_user_id, category,
          description, evidence_urls, reviewed, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,$7)
       RETURNING *`,
      [
        uuidv4(),
        reporterUserId,
        data.reported_user_id,
        data.category,
        data.description,
        JSON.stringify(data.evidence_urls),
        now,
      ],
    );
    return result.rows[0];
  }

  async listReportsByReporter(reporterUserId: string): Promise<UserReport[]> {
    // Returns only non-PII fields to reporter to avoid exposing reviewer notes
    const result = await this.pool.query(
      `SELECT report_id, reporter_user_id, category, reviewed, created_at
       FROM user_reports WHERE reporter_user_id = $1 ORDER BY created_at DESC`,
      [reporterUserId],
    );
    return result.rows;
  }

  // ─── Block Records ───────────────────────────────────────────────────────

  async createBlock(blockerUserId: string, blockedUserId: string, reason?: string): Promise<BlockRecord> {
    const now = new Date().toISOString();
    // Upsert — re-activating a previously lifted block
    const result = await this.pool.query(
      `INSERT INTO block_records (block_id, blocker_user_id, blocked_user_id, status, reason, created_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,$5)
       ON CONFLICT (blocker_user_id, blocked_user_id) DO UPDATE
         SET status = 'ACTIVE', reason = EXCLUDED.reason, created_at = EXCLUDED.created_at, lifted_at = NULL
       RETURNING *`,
      [uuidv4(), blockerUserId, blockedUserId, reason ?? null, now],
    );
    return result.rows[0];
  }

  async removeBlock(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE block_records SET status = 'LIFTED', lifted_at = $3
       WHERE blocker_user_id = $1 AND blocked_user_id = $2 AND status = 'ACTIVE'`,
      [blockerUserId, blockedUserId, now],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM block_records
       WHERE blocker_user_id = $1 AND blocked_user_id = $2 AND status = 'ACTIVE' LIMIT 1`,
      [blockerUserId, blockedUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listBlocks(blockerUserId: string): Promise<BlockRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM block_records WHERE blocker_user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC`,
      [blockerUserId],
    );
    return result.rows;
  }

  // ─── Audit Log ───────────────────────────────────────────────────────────

  async writeAuditLog(
    entityType: string,
    entityId: string,
    actorUserId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Ensure no PII fields are included in metadata
    const sanitized: Record<string, unknown> = {};
    for (const key in metadata) {
      if (
        key !== 'email' &&
        key !== 'phone' &&
        key !== 'name' &&
        key !== 'description' &&
        key !== 'message' &&
        key !== 'reason' &&
        key !== 'note'
      ) {
        sanitized[key] = metadata[key];
      }
    }
    await this.pool.query(
      `INSERT INTO safety_audit_log (log_id, entity_type, entity_id, actor_user_id, action, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [uuidv4(), entityType, entityId, actorUserId, action, JSON.stringify(sanitized)],
    );
  }
}