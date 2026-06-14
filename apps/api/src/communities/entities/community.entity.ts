import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CommunityType, CommunityVisibility } from '@roarpass/shared';

@Entity('communities')
@Index(['event_id', 'type'])
@Index(['event_id', 'slug'], { unique: true })
@Index(['parent_community_id'])
export class CommunityEntity {
  @PrimaryGeneratedColumn('uuid')
  community_id: string;

  @Column({ type: 'uuid' })
  @Index()
  event_id: string;

  @Column({ type: 'varchar', length: 32 })
  type: CommunityType;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'char', length: 2, nullable: true })
  country_code: string | null;

  @Column({ type: 'uuid', nullable: true })
  city_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  parent_community_id: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  affinity_tags: string[];

  @Column({ type: 'varchar', length: 16, default: 'PUBLIC' })
  visibility: CommunityVisibility;

  /**
   * Used by translation-layer (REQ-TRANS-10) as community-level default.
   * ISO 639-1 code.
   */
  @Column({ type: 'char', length: 8, nullable: true })
  community_default_language: string | null;

  @Column({ type: 'integer', default: 0 })
  member_count: number;

  @Column({ type: 'text', nullable: true })
  banner_image_url: string | null;

  @Column({ type: 'text', nullable: true })
  icon_url: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}