import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  token_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  token_hash: string; // SHA-256 of actual token; never store raw

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_fingerprint: string | null;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => UserEntity, (user) => user.refresh_tokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}