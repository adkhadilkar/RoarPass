import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { ContentType, AutoModAction, ModerationStatus } from '@roarpass/shared';

@Entity('auto_mod_logs')
@Index(['rule_id'])
@Index(['content_author_id'])
@Index(['created_at'])
export class AutoModLogEntity {
  @PrimaryGeneratedColumn('uuid')
  log_id!: string;

  @Column('uuid')
  @Index()
  rule_id!: string;

  @Column({ type: 'enum', enum: ContentType })
  content_type!: ContentType;

  @Column('uuid')
  content_id!: string;

  @Column('uuid')
  content_author_id!: string;

  @Column({ type: 'text', nullable: true })
  matched_pattern?: string;

  @Column({ type: 'enum', enum: AutoModAction })
  action_taken!: AutoModAction;

  @Column({ type: 'float', nullable: true })
  confidence?: number;

  @Column('uuid', { nullable: true })
  community_id?: string;

  @Column('uuid', { nullable: true })
  reviewed_by?: string;

  @Column({ type: 'enum', enum: ModerationStatus, nullable: true })
  review_outcome?: ModerationStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}