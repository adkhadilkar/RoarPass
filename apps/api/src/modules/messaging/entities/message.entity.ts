import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { MessageType, MessageStatus } from '@roarpass/shared';
import { Channel } from './channel.entity';
import { VoiceNote } from './voice-note.entity';
import { MessageTranslationMeta } from './message-translation-meta.entity';

@Entity('messages')
@Index(['channelId', 'createdAt'])
@Index(['channelId', 'threadParentId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  channelId: string;

  @ManyToOne(() => Channel, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  @Column({ type: 'uuid' })
  @Index()
  senderId: string;

  @Column({ type: 'varchar', length: 200 })
  senderDisplayName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  senderAvatarUrl: string | null;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.DELIVERED })
  status: MessageStatus;

  // Plaintext content (community/group channels)
  @Column({ type: 'text', nullable: true })
  content: string | null;

  // E2E-encrypted ciphertext (DM channels only)
  @Column({ type: 'text', nullable: true })
  encryptedContent: string | null;

  @Column({ type: 'boolean', default: false })
  isEncrypted: boolean;

  // Moderator official flag — suppresses translation
  @Column({ type: 'boolean', default: false })
  isOfficial: boolean;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // Threading
  @Column({ type: 'uuid', nullable: true })
  @Index()
  threadParentId: string | null;

  @Column({ type: 'int', default: 0 })
  replyCount: number;

  // Reactions stored as JSONB: { emoji: string, userIds: string[] }[]
  @Column({ type: 'jsonb', default: '[]' })
  reactions: Array<{ emoji: string; userIds: string[] }>;

  // Idempotency key from client
  @Column({ type: 'uuid', nullable: true, unique: true })
  clientMessageId: string | null;

  @OneToOne(() => VoiceNote, (vn) => vn.message, { nullable: true, cascade: true })
  voiceNote: VoiceNote | null;

  @OneToMany(() => MessageTranslationMeta, (tm) => tm.message)
  translationMetas: MessageTranslationMeta[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}