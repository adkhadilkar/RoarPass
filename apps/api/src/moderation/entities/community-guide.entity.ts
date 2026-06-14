import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index, VersionColumn,
} from 'typeorm';

@Entity('community_guides')
@Index(['community_id', 'is_pinned'])
@Index(['community_id', 'is_published'])
export class CommunityGuideEntity {
  @PrimaryGeneratedColumn('uuid')
  guide_id!: string;

  @Column('uuid')
  @Index()
  community_id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 20, default: 'MARKDOWN' })
  content_format!: 'MARKDOWN' | 'PLAIN';

  @Column({ default: false })
  is_pinned!: boolean;

  @Column({ type: 'int', nullable: true })
  pin_order?: number;

  @Column({ default: false })
  is_published!: boolean;

  @Column('uuid')
  author_id!: string;

  @Column('uuid', { nullable: true })
  last_edited_by?: string;

  @Column({ length: 20, default: 'en' })
  language_code!: string;

  @Column({ type: 'jsonb', default: '[]' })
  translations!: object[];

  @VersionColumn()
  version!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}