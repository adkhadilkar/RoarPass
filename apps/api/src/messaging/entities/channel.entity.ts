import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ChannelType } from '@roarpass/shared';

@Entity('channels')
export class ChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['DIRECT', 'GROUP', 'COMMUNITY', 'ANNOUNCEMENT', 'MATCH_DAY'] })
  type: ChannelType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  communityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  eventId: string | null;

  @Column({ type: 'uuid', nullable: true })
  matchId: string | null;

  /**
   * JSONB map: userId → base64-encoded public key (for DIRECT channels).
   * Stored encrypted at rest; never served to non-members.
   */
  @Column({ type: 'jsonb', nullable: true })
  encryptionKeys: Record<string, string> | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  communityDefaultLanguage: string | null;

  @Column({ type: 'boolean', default: false })
  isReadOnly: boolean;

  @Column({ type: 'int', default: 0 })
  memberCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}