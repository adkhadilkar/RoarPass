import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VoteChoiceEntity } from './vote-choice.entity';

@Entity('poll_votes')
@Index(['poll_id', 'user_id'], { unique: true })
export class PollVoteEntity {
  @PrimaryGeneratedColumn('uuid')
  vote_id!: string;

  @Column('uuid')
  @Index()
  poll_id!: string;

  @Column('uuid')
  @Index()
  user_id!: string;

  @Column('uuid')
  choice_id!: string;

  @ManyToOne(() => VoteChoiceEntity, (c) => c.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'choice_id' })
  choice!: VoteChoiceEntity;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}