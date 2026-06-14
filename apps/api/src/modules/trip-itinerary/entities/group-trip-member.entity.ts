import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GroupTripRole } from '@roarpass/shared';
import { GroupTripEntity } from './group-trip.entity';

@Entity('group_trip_members')
@Index(['group_trip_id', 'user_id'], { unique: true })
export class GroupTripMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  membership_id!: string;

  @Column('uuid')
  @Index()
  group_trip_id!: string;

  @Column('uuid')
  @Index()
  user_id!: string;

  @Column({
    type: 'enum',
    enum: GroupTripRole,
    default: GroupTripRole.MEMBER,
  })
  role!: GroupTripRole;

  @Column({ length: 100 })
  display_name!: string;

  @Column({ type: 'text', nullable: true })
  avatar_url!: string | null;

  @Column({ default: true })
  is_active!: boolean;

  @ManyToOne(() => GroupTripEntity, (g) => g.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_trip_id' })
  group_trip!: GroupTripEntity;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  joined_at!: Date;
}