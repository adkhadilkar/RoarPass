import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';
import { AutoModRuleType, AutoModAction, ContentType } from '@roarpass/shared';

@Entity('auto_mod_rules')
@Index(['community_id', 'is_active'])
@Index(['is_active', 'rule_type'])
export class AutoModRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  rule_id!: string;

  @Column('uuid', { nullable: true })
  @Index()
  community_id?: string;

  @Column({ type: 'enum', enum: AutoModRuleType })
  rule_type!: AutoModRuleType;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  pattern?: string;

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ type: 'enum', enum: AutoModAction })
  action!: AutoModAction;

  @Column({ type: 'float', nullable: true })
  confidence_threshold?: number;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ type: 'simple-array' })
  applies_to!: ContentType[];

  @Column('uuid')
  created_by!: string;

  @Column({ type: 'int', default: 0 })
  trigger_count!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}