import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TripItemType, TripStatus } from '@roarpass/shared';
import { PersonalItineraryEntity } from './personal-itinerary.entity';

@Entity('trip_items')
export class TripItemEntity {
  @PrimaryGeneratedColumn('uuid')
  item_id!: string;

  @Column('uuid')
  @Index()
  itinerary_id!: string;

  // For group-trip shared items, group_trip_id is set
  @Column('uuid', { nullable: true })
  @Index()
  group_trip_id!: string | null;

  @ManyToOne(() => PersonalItineraryEntity, (it) => it.items, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary!: PersonalItineraryEntity | null;

  @Column({
    type: 'enum',
    enum: TripItemType,
  })
  type!: TripItemType;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamp with time zone' })
  start_at!: Date;

  @Column({ type: 'timestamp with time zone' })
  end_at!: Date;

  @Column({ length: 50 })
  timezone!: string;

  @Column({ type: 'uuid', nullable: true })
  host_city_id!: string | null;

  @Column({ length: 200, nullable: true })
  location_name!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  location_lat!: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 7, nullable: true })
  location_lng!: number | null;

  @Column({
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.DRAFT,
  })
  status!: TripStatus;

  @Column({ type: 'jsonb', default: {} })
  type_specific_data!: Record<string, unknown>;

  @Column({ default: false })
  is_pinned!: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}