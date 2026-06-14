import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { VisibilityLevel } from '@roarpass/shared';

@Entity('discovery_preferences')
export class DiscoveryPreferenceEntity {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: VisibilityLevel,
    default: VisibilityLevel.HIDDEN,
  })
  @Index()
  visibilityLevel: VisibilityLevel;

  @Column({ default: false })
  shareCity: boolean;

  @Column({ default: false })
  shareTravelDates: boolean;

  @Column({ default: false })
  shareMatchInterests: boolean;

  @Column({ default: true })
  shareLanguages: boolean;

  @Column({ default: true })
  shareCountryCommunity: boolean;

  @Column({ default: true })
  allowHelperSuggestions: boolean;

  @Column({ default: true })
  allowTripSuggestions: boolean;

  @Column({ default: false })
  allowFanMatching: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}