import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('assistant_sessions')
@Index(['user_id', 'event_id'])
export class AssistantSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  session_id: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @Column({ type: 'uuid' })
  event_id: string;

  @Column({ type: 'varchar', length: 20 })
  language_code: string;

  @Column({ type: 'int', default: 0 })
  turn_count: number;

  @Column({
    type: 'enum',
    enum: ['active', 'expired', 'cleared'],
    default: 'active',
  })
  status: 'active' | 'expired' | 'cleared';

  @CreateDateColumn({ type: 'timestamptz' })
  started_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  last_active_at: Date;
}