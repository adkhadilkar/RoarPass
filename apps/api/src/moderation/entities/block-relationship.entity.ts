import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  Index, Unique,
} from 'typeorm';
import { BlockRelationshipType, ReportReason } from '@roarpass/shared';

@Entity('block_relationships')
@Unique(['initiator_id', 'target_id', 'relationship_type'])
@Index(['initiator_id'])
@Index(['target_id'])
export class BlockRelationshipEntity {
  @PrimaryGeneratedColumn('uuid')
  relationship_id!: string;

  @Column('uuid')
  initiator_id!: string;

  @Column('uuid')
  target_id!: string;

  @Column({ type: 'enum', enum: BlockRelationshipType })
  relationship_type!: BlockRelationshipType;

  @Column({ type: 'enum', enum: ReportReason, nullable: true })
  reason?: ReportReason;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}