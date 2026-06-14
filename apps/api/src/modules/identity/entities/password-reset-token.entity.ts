import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  token_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  token_hash: string;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}