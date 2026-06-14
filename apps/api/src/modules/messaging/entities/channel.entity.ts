import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ChannelType } from '@roarpass/shared';
import { Message } from './message.entity';
import { ChannelParticipant } from './channel-participant.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ChannelType })
  @Index()
  type: ChannelType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'uuid' })
  @Index()
  createdBy: string;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @Column({ type: 'boolean', default: false })
  isReadOnly: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @OneToMany(() => Message, (msg) => msg.channel)
  messages: Message[];

  @OneToMany(() => ChannelParticipant, (p) => p.channel)
  participants: ChannelParticipant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}