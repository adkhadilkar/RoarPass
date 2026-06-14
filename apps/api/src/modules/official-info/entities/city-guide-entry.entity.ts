import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('city_guide_entries')
@Index(['event_id', 'host_city_id', 'is_published'])
@Index(['event_id', 'category'])
export class CityGuideEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  entry_id: string;

  @Column('uuid')
  @Index()
  event_id: string;

  @Column('uuid')
  host_city_id: string;

  @Column({ length: 200 })
  city_name: string;

  @Column({ length: 2 })
  country_code: string;

  @Column({ length: 50 })
  category: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 2 })
  content_language: string;

  @Column({ type: 'text', nullable: true })
  official_source_url: string | null;

  @Column({ default: true })
  is_published: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_verified_at: Date | null;

  @Column('uuid')
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}