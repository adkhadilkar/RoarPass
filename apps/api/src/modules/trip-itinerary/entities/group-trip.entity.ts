import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { GroupTripMemberEntity } from './group-trip-member.entity';
import { GroupPollEntity } from './group-poll.entity';
import { TripItemEntity } from './trip-item.entity';

@Entity('group_trips')
export class GroupTripEntity {
  @PrimaryGeneratedColumn('uuid')
  group_trip_id!: string;

  @Column('uuid')
  @Index()
  event_id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  banner_url!: string | null;

  @Column('uuid')
  @Index()
  created_by!: string;

  @Column({ type: 'uuid', nullable: true })
  chat_channel_id!: string | null;

  @Column({ length: 20, unique: true, nullable: true })
  invite_code!: string | null;

  @Column({ type: 'int', default: 20 })
  max_members!: number;

  @Column({ default: false })
  is_public!: boolean;

  @OneToMany(() => GroupTripMemberEntity, (m) => m.group_trip, {
    cascade: true,
    eager: false,
  })
  members!: GroupTripMemberEntity[];

  @OneToMany(() => GroupPollEntity, (p) => p.group_trip, {
    cascade: true,
    eager: false,
  })
  polls!: GroupPollEntity[];

  @OneToMany(() => TripItemEntity, (item) => item.group_trip_id, {
    cascade: true,
    eager: false,
  })
  shared_items!: TripItemEntity[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}