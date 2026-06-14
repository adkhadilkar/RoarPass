import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { VisibilityLevel } from '@roarpass/shared';

@Entity('fan_match_profiles')
@Unique(['userId', 'eventId'])
@Index(['eventId', 'discoverability'])   // composite index for candidate loading
export class FanMatchProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @Column('uuid')
  @Index()
  eventId: string;

  @Column('simple-array', { nullable: true })
  citiesAttending: string[];

  @Column('jsonb', { nullable: true })
  travelDates: Array<{ cityId: string; arrivalDate: string; departureDate: string }>;

  @Column('simple-array', { nullable: true })
  matchesAttending: string[];

  @Column('simple-array', { nullable: true })
  languagesSpoken: string[];

  @Column('uuid', { nullable: true })
  countryCommunityId: string | null;

  @Column({ default: false })
  isHelper: boolean;

  @Column({ nullable: true })
  helperTrustTier: string | null;

  @Column('simple-array', { nullable: true })
  helperLanguages: string[];

  @Column('simple-array', { nullable: true })
  helperOfferingCategories: string[];

  @Column({
    type: 'enum',
    enum: VisibilityLevel,
    default: VisibilityLevel.HIDDEN,
  })
  @Index()
  discoverability: VisibilityLevel;

  @Column('simple-array', { nullable: true })
  tripIds: string[];

  @Column({ nullable: true, length: 2 })
  nationality: string | null;

  @Column({ default: 'en' })
  preferredLocale: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}