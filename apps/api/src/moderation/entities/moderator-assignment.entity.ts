import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { ModeratorRole } from '@roarpass/shared';

@Entity('moderator_assignments')
@Index(['community_id', 'user_id'], { unique: true })
@Index(['user_id'])
export class ModeratorAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  assignment_id!: string;

  @Column('uuid')
  @Index()
  community_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'enum', enum: ModeratorRole })
  role!: ModeratorRole;

  @Column('uuid')
  appointed_by!: string;

  @Column({ type: 'jsonb', default: '[]' })
  permissions!: object[];

  @Column({ default: true })
  is_active!: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  appointed_at!: Date;
}