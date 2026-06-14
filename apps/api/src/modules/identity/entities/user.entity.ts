import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';
import {
  UserRole,
  VerificationStatus,
  SubscriptionTier,
  TravelStyle,
  OnboardingStep,
} from '../../../../../packages/shared/src/types/identity';
import { AuthProviderLinkEntity } from './auth-provider-link.entity';
import { EventActivationEntity } from './event-activation.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { UserTranslationPreferenceEntity } from './user-translation-preference.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 50 })
  display_name: string;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  /** bcrypt hash; null for OAuth-only or phone-only accounts */
  @Column({ type: 'varchar', length: 72, nullable: true, select: false })
  password_hash: string | null;

  @Index({ unique: true, where: '"phone_e164" IS NOT NULL' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_e164: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  avatar_url: string | null;

  @Column({ type: 'char', length: 2 })
  nationality: string;

  @Column({ type: 'char', length: 2, nullable: true })
  country_of_residence: string | null;

  @Column({ type: 'varchar', length: 10 })
  preferred_language: string;

  @Column({ type: 'simple-array', default: '' })
  languages_spoken: string[];

  @Column({ type: 'jsonb', default: '[]' })
  supported_teams: object[];

  @Column({
    type: 'enum',
    enum: TravelStyle,
    nullable: true,
  })
  travel_style: TravelStyle | null;

  @Column({ type: 'simple-array', default: '' })
  dietary_preferences: string[];

  @Column({ type: 'simple-array', default: '' })
  accessibility_needs: string[];

  @Column({
    type: 'simple-array',
    default: UserRole.FAN,
  })
  roles: UserRole[];

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verification_status: VerificationStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscription_tier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: OnboardingStep,
    default: OnboardingStep.ACCOUNT_CREATED,
  })
  onboarding_step: OnboardingStep;

  @Column({ type: 'timestamptz', nullable: true })
  onboarding_completed_at: Date | null;

  @Column({ type: 'jsonb', default: '{}' })
  privacy_settings: object;

  @Column({ type: 'jsonb', default: '{}' })
  gdpr_consent: object;

  /** Total failed login attempts (reset on success) */
  @Column({ type: 'int', default: 0, select: false })
  failed_login_count: number;

  /** Account lockout until timestamp */
  @Column({ type: 'timestamptz', nullable: true, select: false })
  locked_until: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at: Date | null;

  // Relations
  @OneToMany(() => AuthProviderLinkEntity, (link) => link.user)
  auth_providers: AuthProviderLinkEntity[];

  @OneToMany(() => EventActivationEntity, (ea) => ea.user)
  event_activations: EventActivationEntity[];

  @OneToMany(() => RefreshTokenEntity, (rt) => rt.user)
  refresh_tokens: RefreshTokenEntity[];

  @OneToOne(() => UserTranslationPreferenceEntity, (pref) => pref.user)
  translation_preference: UserTranslationPreferenceEntity;
}