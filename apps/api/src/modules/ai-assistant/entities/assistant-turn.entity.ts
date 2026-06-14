import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('assistant_turns')
@Index(['session_id', 'sequence'])
export class AssistantTurnEntity {
  @PrimaryGeneratedColumn('uuid')
  turn_id: string;

  @Column({ type: 'uuid' })
  @Index()
  session_id: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'enum', enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  /**
   * Content is AES-256-GCM encrypted at rest.
   * The application layer decrypts using CONTENT_ENCRYPTION_KEY env var.
   */
  @Column({ type: 'text' })
  content_encrypted: string;

  @Column({ type: 'varchar', length: 64 })
  content_hash: string;

  @Column({ type: 'int', default: 0 })
  tokens_used: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model_version: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}