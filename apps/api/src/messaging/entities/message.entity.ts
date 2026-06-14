import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MessageType, MessageStatus } from '@roarpass/shared';
import { ChannelEntity } from './channel.entity';

@Entity('messages')
@Index(['channelId', 'createdAt'])
@Index(['threadParentId'])
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  channelId: string;

  @ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: ChannelEntity;

  @Column({ type: 'uuid' })
  @Index()
  senderId: string;

  @Column({ type: 'enum', enum: ['TEXT', 'VOICE_NOTE', 'SYSTEM', 'ANNOUNCEMENT'] })
  type: MessageType;

  /** Plaintext for non-E2E channels; null for DIRECT */
  @Column({ type: 'text', nullable: true })
  text: string | null;

  /** AES-GCM ciphertext for DIRECT channels */
  @Column({ type: 'text', nullable: true })
  encryptedText: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  threadParentId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  voiceNote: {
    storageKey: string;
    durationSeconds: number;
    transcription: string | null;
    transcriptionStatus: 'PENDING' | 'DONE' | 'FAILED';
    transcriptionLanguage: string | null;
  } | null;

  /** Populated async by language-detection queue */
  @Column({ type: 'char', length: 10, nullable: true })
  detectedLanguage: string | null;

  @Column({ type: 'float4', nullable: true })
  detectionConfidence: number | null;

  /** When true, translation is suppressed (moderator announcements) */
  @Column({ type: 'boolean', default: false })
  isOfficial: boolean;

  @Column({ type: 'int', default: 0 })
  replyCount: number;

  @Column({ type: 'jsonb', default: {} })
  reactions: Record<string, number>;

  @Column({ type: 'enum', enum: ['SENDING', 'DELIVERED', 'READ', 'FAILED', 'DELETED'], default: 'DELIVERED' })
  status: MessageStatus;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}