import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { ParticipantRole } from '@roarpass/shared';
import { Channel } from './channel.entity';

@Entity('channel_participants')
@Unique(['channelId', 'userId'])
export class ChannelParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  channelId: string;

  @ManyToOne(() => Channel, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'enum', enum: ParticipantRole, default: ParticipantRole.MEMBER })
  role: ParticipantRole;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId: string | null;

  @Column({ type: 'boolean', default: false })
  isMuted: boolean;

  @Column({ type: 'boolean', default: true })
  notificationsEnabled: boolean;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}