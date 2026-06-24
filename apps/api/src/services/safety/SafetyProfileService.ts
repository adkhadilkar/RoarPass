import { db } from '../../db';
import {
  SafetyProfile,
  UpsertSafetyProfileInput,
} from '@roarpass/shared/types/safety';

export class SafetyProfileService {
  async getOrCreate(userId: string): Promise<SafetyProfile> {
    const existing = await db('safety_profiles').where({ user_id: userId }).first();
    if (existing) return this.mapRow(existing);

    const now = new Date().toISOString();
    const row = {
      user_id: userId,
      safety_mode: 'STANDARD',
      location_share_scope: 'TRUSTED_CONTACTS_ONLY',
      location_sharing_enabled: false,
      location_share_expires_at: null,
      checkin_interval_minutes: 60,
      auto_sos_if_overdue: false,
      auto_sos_overdue_threshold_minutes: 90,
      sos_countdown_seconds: 10,
      last_known_location: null,
      updated_at: now,
    };
    await db('safety_profiles').insert(row);
    return this.mapRow(row);
  }

  async update(userId: string, input: UpsertSafetyProfileInput): Promise<SafetyProfile> {
    const now = new Date().toISOString();
    await db('safety_profiles')
      .where({ user_id: userId })
      .update({ ...input, updated_at: now });
    return this.getOrCreate(userId);
  }

  private mapRow(row: Record<string, unknown>): SafetyProfile {
    return {
      user_id: row.user_id as string,
      safety_mode: row.safety_mode as SafetyProfile['safety_mode'],
      location_share_scope: row.location_share_scope as SafetyProfile['location_share_scope'],
      location_sharing_enabled: Boolean(row.location_sharing_enabled),
      location_share_expires_at: row.location_share_expires_at as string | null,
      checkin_interval_minutes: Number(row.checkin_interval_minutes),
      auto_sos_if_overdue: Boolean(row.auto_sos_if_overdue),
      auto_sos_overdue_threshold_minutes: Number(row.auto_sos_overdue_threshold_minutes),
      sos_countdown_seconds: Number(row.sos_countdown_seconds),
      last_known_location: row.last_known_location
        ? JSON.parse(row.last_known_location as string)
        : null,
      updated_at: row.updated_at as string,
    };
  }
}