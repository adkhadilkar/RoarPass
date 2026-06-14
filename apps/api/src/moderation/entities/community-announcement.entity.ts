import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('community_announcements')
@Index(['community_id', 'is_pinned'])
@Index(['community_id', 'created_at'])
export class CommunityAnnouncementEntity {
  @PrimaryGeneratedColumn('uuid')
  announcement_id!: string;

  @Column('uuid')
  @Index()
  community_id!: string;

  @Column({ length: 300 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ default: false })
  is_pinned!: boolean;

  @Column({ default: false })
  is_official!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'NORMAL' })
  priority!: 'NORMAL' | 'URGENT';

  @Column('uuid')
  author_id!: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at?: Date;

  @Column({ type: 'varchar', length: 30, default: 'ALL' })
  target_audience!: 'ALL' | 'VERIFIED_ONLY' | 'HELPERS_ONLY';

  @Column({ default: false })
  push_notification_sent!: boolean;

  @Column({ length: 20, default: 'en' })
  language_code!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}