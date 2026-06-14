import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { GroupPollEntity } from './group-poll.entity';
import { PollVoteEntity } from './poll-vote.entity';

@Entity('vote_choices')
export class VoteChoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  choice_id!: string;

  @Column('uuid')
  poll_id!: string;

  @Column({ length: 200 })
  option_text!: string;

  @Column({ type: 'jsonb', nullable: true })
  item_data!: Record<string, unknown> | null;

  @ManyToOne(() => GroupPollEntity, (p) => p.choices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll!: GroupPollEntity;

  @OneToMany(() => PollVoteEntity, (v) => v.choice)
  votes!: PollVoteEntity[];

  get vote_count(): number {
    return this.votes?.length ?? 0;
  }
}