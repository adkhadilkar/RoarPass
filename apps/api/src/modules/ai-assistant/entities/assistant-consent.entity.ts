import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('assistant_consent')
@Index(['user_id'], { unique: true })
export class AssistantConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  consent_id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  /** Consent to use itinerary data as LLM context. REQ-AI-NFR-05a */
  @Column({ type: 'boolean', default: false })
  itinerary_context_consent!: boolean;

  /** Consent to transmit anonymized data to third-party LLM providers. REQ-AI-NFR-05b */
  @Column({ type: 'boolean', default: false })
  llm_provider_transmission_consent!: boolean;

  /** Consent to retain anonymized feedback for model improvement. REQ-AI-NFR-05c */
  @Column({ type: 'boolean', default: false })
  feedback_improvement_consent!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  consented_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}