import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { MemberRole } from '@roarpass/shared';

@Entity('channel_members')
@Index(['userId', 'leftAt'])
export class ChannelMemberEntity {
  @PrimaryColumn('uuid')
  channelId: string;

  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'enum', enum: ['OWNER', 'MODERATOR', 'MEMBER'], default: 'MEMBER' })
  role: MemberRole;

  @Column({ type: 'timestamptz', nullable: true })
  mutedUntil: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  leftAt: Date | null;
}