import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { ModerationAction } from '@roarpass/shared';

@Entity('moderation_decisions')
@Index(['report_id'])
@Index(['moderator_id'])
export class ModerationDecisionEntity {
  @PrimaryGeneratedColumn('uuid')
  decision_id!: string;

  @Column('uuid')
  @Index()
  report_id!: string;

  @Column('uuid')
  moderator_id!: string;

  @Column({ type: 'enum', enum: ModerationAction })
  action!: ModerationAction;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  internal_notes?: string;

  @Column({ type: 'int', nullable: true })
  duration_hours?: number;

  @Column({ default: true })
  notify_reporter!: boolean;

  @Column({ default: true })
  notify_subject!: boolean;

  @Column({ default: false })
  is_appealed!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  appeal_outcome?: 'UPHELD' | 'OVERTURNED' | 'PENDING';

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}