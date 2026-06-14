import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TripItemEntity } from './trip-item.entity';

@Entity('personal_itineraries')
@Index(['user_id', 'event_id'], { unique: true })
export class PersonalItineraryEntity {
  @PrimaryGeneratedColumn('uuid')
  itinerary_id!: string;

  @Column('uuid')
  @Index()
  user_id!: string;

  @Column('uuid')
  @Index()
  event_id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => TripItemEntity, (item) => item.itinerary, {
    cascade: true,
    eager: false,
  })
  items!: TripItemEntity[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_synced_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}