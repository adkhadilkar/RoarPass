import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';
import {
  ContentType, ReportReason, ModerationStatus, SLAPriority, ModerationAction,
} from '@roarpass/shared';

@Entity('content_reports')
@Index(['status', 'priority'])
@Index(['community_id', 'status'])
@Index(['sla_deadline'])
export class ContentReportEntity {
  @PrimaryGeneratedColumn('uuid')
  report_id!: string;

  @Column('uuid')
  @Index()
  reporter_id!: string;

  @Column({ type: 'enum', enum: ContentType })
  content_type!: ContentType;

  @Column('uuid')
  @Index()
  content_id!: string;

  @Column('uuid')
  content_author_id!: string;

  @Column('uuid', { nullable: true })
  @Index()
  community_id?: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason!: ReportReason;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'simple-array', nullable: true })
  evidence_urls?: string[];

  @Column({ type: 'enum', enum: ModerationStatus, default: ModerationStatus.PENDING })
  status!: ModerationStatus;

  @Column({ type: 'enum', enum: SLAPriority })
  priority!: SLAPriority;

  @Column({ type: 'timestamp with time zone' })
  sla_deadline!: Date;

  @Column('uuid', { nullable: true })
  assigned_to?: string;

  @Column({ type: 'text', nullable: true })
  resolution_notes?: string;

  @Column({ type: 'enum', enum: ModerationAction, nullable: true })
  action_taken?: ModerationAction;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolved_at?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}