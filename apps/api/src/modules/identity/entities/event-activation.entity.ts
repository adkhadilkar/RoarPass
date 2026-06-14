import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EventActivationStatus } from '../../../../../packages/shared/src/types/identity';
import { UserEntity } from './user.entity';

@Entity('event_activations')
@Index(['user_id', 'event_id'], { unique: true })
export class EventActivationEntity {
  @PrimaryGeneratedColumn('uuid')
  activation_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  event_id: string;

  @Column({
    type: 'enum',
    enum: EventActivationStatus,
    default: EventActivationStatus.ACTIVE,
  })
  status: EventActivationStatus;

  @Column({ type: 'simple-array', default: '' })
  host_cities: string[];

  @Column({ type: 'simple-array', default: '' })
  attending_matches: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  activated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deactivated_at: Date | null;

  @ManyToOne(() => UserEntity, (user) => user.event_activations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}