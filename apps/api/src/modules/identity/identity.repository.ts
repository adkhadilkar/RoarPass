import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type {
  FanProfile,
  AuthCredential,
  EventActivation,
  UserTranslationPreference,
  RegisterWithEmailInput,
  UpdateProfileInput,
  UserRole,
  OnboardingStep,
  AuthProvider,
} from '@roarpass/shared';

export class IdentityRepository {
  constructor(private readonly pool: Pool) {}

  // ─── Fan Profile CRUD ──────────────────────────────────────────────────────

  async createProfile(
    data: Pick<
      FanProfile,
      | 'display_name'
      | 'nationality'
      | 'preferred_language'
      | 'roles'
      | 'gdpr_consented_at'
    > & { user_id?: string }
  ): Promise<FanProfile> {
    const now = new Date().toISOString();
    const userId = data.user_id ?? uuidv4();

    const result = await this.pool.query<FanProfile>(
      `INSERT INTO fan_profiles (
        user_id, display_name, nationality, preferred_language,
        languages_spoken, roles, verification_tier, onboarding_step,
        activated_event_ids, is_active, gdpr_consented_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        userId,
        data.display_name,
        data.nationality,
        data.preferred_language,
        JSON.stringify([data.preferred_language]),
        JSON.stringify(data.roles),
        'UNVERIFIED',
        'ACCOUNT_CREATED',
        JSON.stringify([]),
        true,
        data.gdpr_consented_at ?? null,
        now,
        now,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(userId: string): Promise<FanProfile | null> {
    const result = await this.pool.query<FanProfile>(
      'SELECT * FROM fan_profiles WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileInput
  ): Promise<FanProfile | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      updates.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (data.display_name !== undefined) addField('display_name', data.display_name);
    if (data.avatar_url !== undefined) addField('avatar_url', data.avatar_url);
    if (data.bio !== undefined) addField('bio', data.bio);
    if (data.nationality !== undefined) addField('nationality', data.nationality);
    if (data.preferred_language !== undefined)
      addField('preferred_language', data.preferred_language);
    if (data.languages_spoken !== undefined)
      addField('languages_spoken', JSON.stringify(data.languages_spoken));
    if (data.travel_style !== undefined) addField('travel_style', data.travel_style);
    if (data.dietary_preferences !== undefined)
      addField('dietary_preferences', JSON.stringify(data.dietary_preferences));
    if (data.accessibility_needs !== undefined)
      addField('accessibility_needs', JSON.stringify(data.accessibility_needs));

    if (updates.length === 0) return this.findById(userId);

    addField('updated_at', new Date().toISOString());
    values.push(userId);

    const result = await this.pool.query<FanProfile>(
      `UPDATE fan_profiles SET ${updates.join(', ')}
       WHERE user_id = $${idx} AND is_active = true
       RETURNING *`,
      values
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateOnboardingStep(
    userId: string,
    step: OnboardingStep
  ): Promise<void> {
    await this.pool.query(
      `UPDATE fan_profiles SET onboarding_step = $1, updated_at = $2
       WHERE user_id = $3`,
      [step, new Date().toISOString(), userId]
    );
  }

  async updateRoles(userId: string, roles: UserRole[]): Promise<FanProfile | null> {
    const result = await this.pool.query<FanProfile>(
      `UPDATE fan_profiles
       SET roles = $1, updated_at = $2
       WHERE user_id = $3 AND is_active = true
       RETURNING *`,
      [JSON.stringify(roles), new Date().toISOString(), userId]
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  async softDelete(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE fan_profiles SET is_active = false, updated_at = $1 WHERE user_id = $2`,
      [new Date().toISOString(), userId]
    );
  }

  async addActivatedEvent(userId: string, eventId: string): Promise<void> {
    await this.pool.query(
      `UPDATE fan_profiles
       SET activated_event_ids = (
         SELECT jsonb_agg(DISTINCT val)
         FROM jsonb_array_elements_text(activated_event_ids::jsonb || $1::jsonb) val
       ),
       updated_at = $2
       WHERE user_id = $3`,
      [JSON.stringify([eventId]), new Date().toISOString(), userId]
    );
  }

  // ─── Auth Credentials ──────────────────────────────────────────────────────

  async createCredential(data: {
    user_id: string;
    provider: AuthProvider;
    provider_subject: string;
    is_primary: boolean;
    password_hash?: string;
  }): Promise<AuthCredential> {
    const now = new Date().toISOString();
    const result = await this.pool.query<AuthCredential>(
      `INSERT INTO auth_credentials (
        credential_id, user_id, provider, provider_subject,
        is_primary, password_hash, verified_at, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING credential_id, user_id, provider, provider_subject,
                is_primary, verified_at, created_at`,
      [
        uuidv4(),
        data.user_id,
        data.provider,
        data.provider_subject,
        data.is_primary,
        data.password_hash ?? null,
        null,
        now,
      ]
    );
    return result.rows[0];
  }

  async findCredentialBySubject(
    provider: AuthProvider,
    providerSubject: string
  ): Promise<(AuthCredential & { password_hash: string | null }) | null> {
    const result = await this.pool.query(
      `SELECT c.*, fp.is_active as profile_active
       FROM auth_credentials c
       JOIN fan_profiles fp ON fp.user_id = c.user_id
       WHERE c.provider = $1 AND c.provider_subject = $2`,
      [provider, providerSubject]
    );
    return result.rows[0] ?? null;
  }

  async verifyCredential(credentialId: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth_credentials SET verified_at = $1 WHERE credential_id = $2`,
      [new Date().toISOString(), credentialId]
    );
  }

  // ─── Event Activations ─────────────────────────────────────────────────────

  async createEventActivation(data: {
    user_id: string;
    event_id: string;
    roles_for_event: UserRole[];
    host_city_ids: string[];
  }): Promise<EventActivation> {
    const now = new Date().toISOString();
    const result = await this.pool.query<EventActivation>(
      `INSERT INTO event_activations (
        activation_id, user_id, event_id, activated_at, roles_for_event, host_city_ids
      ) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id, event_id) DO UPDATE
        SET roles_for_event = EXCLUDED.roles_for_event,
            host_city_ids = EXCLUDED.host_city_ids,
            activated_at = EXCLUDED.activated_at
      RETURNING *`,
      [
        uuidv4(),
        data.user_id,
        data.event_id,
        now,
        JSON.stringify(data.roles_for_event),
        JSON.stringify(data.host_city_ids),
      ]
    );
    return this.mapActivationRow(result.rows[0]);
  }

  async findEventActivations(userId: string): Promise<EventActivation[]> {
    const result = await this.pool.query<EventActivation>(
      'SELECT * FROM event_activations WHERE user_id = $1 ORDER BY activated_at DESC',
      [userId]
    );
    return result.rows.map(this.mapActivationRow);
  }

  async findEventActivation(
    userId: string,
    eventId: string
  ): Promise<EventActivation | null> {
    const result = await this.pool.query<EventActivation>(
      'SELECT * FROM event_activations WHERE user_id = $1 AND event_id = $2',
      [userId, eventId]
    );
    if (!result.rows[0]) return null;
    return this.mapActivationRow(result.rows[0]);
  }

  // ─── Translation Preferences ───────────────────────────────────────────────

  async upsertTranslationPreference(
    data: Omit<UserTranslationPreference, 'updated_at'>
  ): Promise<UserTranslationPreference> {
    const now = new Date().toISOString();
    const result = await this.pool.query<UserTranslationPreference>(
      `INSERT INTO user_translation_preferences (
        user_id, preferred_language, auto_translate_enabled,
        auto_translate_threshold, updated_at
      ) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_language = EXCLUDED.preferred_language,
        auto_translate_enabled = EXCLUDED.auto_translate_enabled,
        auto_translate_threshold = EXCLUDED.auto_translate_threshold,
        updated_at = EXCLUDED.updated_at
      RETURNING *`,
      [
        data.user_id,
        data.preferred_language,
        data.auto_translate_enabled,
        data.auto_translate_threshold,
        now,
      ]
    );
    return result.rows[0];
  }

  async findTranslationPreference(
    userId: string
  ): Promise<UserTranslationPreference | null> {
    const result = await this.pool.query<UserTranslationPreference>(
      'SELECT * FROM user_translation_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] ?? null;
  }

  // ─── GDPR helpers ──────────────────────────────────────────────────────────

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [profile, credentials, activations, translationPref] = await Promise.all([
      this.findById(userId),
      this.pool.query(
        `SELECT credential_id, provider, provider_subject, is_primary, verified_at, created_at
         FROM auth_credentials WHERE user_id = $1`,
        [userId]
      ),
      this.findEventActivations(userId),
      this.findTranslationPreference(userId),
    ]);

    return {
      profile,
      credentials: credentials.rows,
      event_activations: activations,
      translation_preference: translationPref,
    };
  }

  async deleteUserData(userId: string, client?: PoolClient): Promise<void> {
    const exec = client ?? this.pool;
    await exec.query(
      'DELETE FROM user_translation_preferences WHERE user_id = $1',
      [userId]
    );
    await exec.query(
      'DELETE FROM event_activations WHERE user_id = $1',
      [userId]
    );
    await exec.query(
      'DELETE FROM auth_credentials WHERE user_id = $1',
      [userId]
    );
    await exec.query(
      `UPDATE fan_profiles SET
        display_name = '[deleted]',
        avatar_url = NULL,
        bio = NULL,
        nationality = 'XX',
        preferred_language = 'en',
        languages_spoken = '[]',
        is_active = false,
        updated_at = $1
       WHERE user_id = $2`,
      [new Date().toISOString(), userId]
    );
  }

  // ─── Row mappers ───────────────────────────────────────────────────────────

  private mapRow(row: Record<string, unknown>): FanProfile {
    return {
      ...(row as FanProfile),
      languages_spoken: this.parseJsonArray(row.languages_spoken),
      roles: this.parseJsonArray(row.roles),
      dietary_preferences: this.parseJsonArray(row.dietary_preferences),
      accessibility_needs: this.parseJsonArray(row.accessibility_needs),
      activated_event_ids: this.parseJsonArray(row.activated_event_ids),
    };
  }

  private mapActivationRow(row: Record<string, unknown>): EventActivation {
    return {
      ...(row as EventActivation),
      roles_for_event: this.parseJsonArray(row.roles_for_event),
      host_city_ids: this.parseJsonArray(row.host_city_ids),
    };
  }

  private parseJsonArray(val: unknown): string[] {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return [];
  }
}