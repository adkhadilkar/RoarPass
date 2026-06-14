import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { MemberRole, JoinStatus } from '@roarpass/shared';

@Entity('community_members')
@Unique(['community_id', 'user_id'])
@Index(['user_id'])
@Index(['community_id', 'role'])
export class CommunityMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  membership_id: string;

  @Column({ type: 'uuid' })
  community_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 16, default: 'MEMBER' })
  role: MemberRole;

  @Column({ type: 'varchar', length: 16, default: 'MEMBER' })
  join_status: JoinStatus;

  @CreateDateColumn()
  joined_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}