import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ChannelType } from '@roarpass/shared';

@Entity('community_channels')
@Index(['community_id', 'slug'], { unique: true })
@Index(['community_id', 'sort_order'])
export class CommunityChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  channel_id: string;

  @Column({ type: 'uuid' })
  @Index()
  community_id: string;

  @Column({ type: 'varchar', length: 32 })
  type: ChannelType;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * ISO 639-1; consumed by translation-layer as channel-level default language.
   * See REQ-TRANS-10 in translation-layer spec.
   */
  @Column({ type: 'char', length: 8, nullable: true })
  community_default_language: string | null;

  @Column({ type: 'boolean', default: false })
  is_readonly: boolean;

  @Column({ type: 'boolean', default: false })
  is_pinned: boolean;

  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  @Column({ type: 'integer', default: 0 })
  message_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}