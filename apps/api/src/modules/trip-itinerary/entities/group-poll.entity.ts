import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { VoteStatus } from '@roarpass/shared';
import { GroupTripEntity } from './group-trip.entity';
import { VoteChoiceEntity } from './vote-choice.entity';

@Entity('group_polls')
export class GroupPollEntity {
  @PrimaryGeneratedColumn('uuid')
  poll_id!: string;

  @Column('uuid')
  @Index()
  group_trip_id!: string;

  @Column('uuid')
  created_by!: string;

  @Column({ length: 500 })
  question!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: VoteStatus,
    default: VoteStatus.OPEN,
  })
  status!: VoteStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  closes_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  result_choice_id!: string | null;

  @OneToMany(() => VoteChoiceEntity, (c) => c.poll, {
    cascade: true,
    eager: false,
  })
  choices!: VoteChoiceEntity[];

  @ManyToOne(() => GroupTripEntity, (g) => g.polls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_trip_id' })
  group_trip!: GroupTripEntity;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}