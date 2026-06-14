import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('assistant_feedback')
export class AssistantFeedbackEntity {
  @PrimaryGeneratedColumn('uuid')
  feedback_id: string;

  @Column({ type: 'uuid' })
  @Index()
  turn_id: string;

  @Column({ type: 'enum', enum: ['positive', 'negative'] })
  rating: 'positive' | 'negative';

  @Column({
    type: 'enum',
    enum: ['wrong_info', 'not_helpful', 'missing_options', 'other'],
    nullable: true,
  })
  reason_category: string | null;

  /**
   * Anonymized before leaving the platform for ML pipelines.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason_text: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}