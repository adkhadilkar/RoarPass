import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('matches')
@Index(['event_id', 'kickoff_utc'])
@Index(['event_id', 'host_city_id'])
export class MatchEntity {
  @PrimaryGeneratedColumn('uuid')
  match_id: string;

  @Column('uuid')
  @Index()
  event_id: string;

  @Column('uuid')
  host_city_id: string;

  @Column({ length: 300 })
  venue_name: string;

  @Column({ type: 'text' })
  venue_address: string;

  // Stored as JSON strings for flexibility
  @Column({ type: 'text', nullable: true })
  home_team: string | null; // serialised Team JSON

  @Column({ type: 'text', nullable: true })
  away_team: string | null;

  // Denormalised for query filter
  @Column({ type: 'uuid', nullable: true })
  home_team_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  away_team_id: string | null;

  @Column({ length: 100, nullable: true })
  match_round: string | null;

  @Column({ type: 'int' })
  match_number: number;

  @Column({ type: 'timestamptz' })
  kickoff_utc: Date;

  @Column({ length: 50 })
  local_timezone: string; // IANA TZ

  @Column({ length: 30 })
  status: string;

  @Column({ type: 'int', default: 90 })
  stadium_gates_open_minutes_before: number;

  @Column({ type: 'int', nullable: true })
  attendance_capacity: number | null;

  @Column({ type: 'text', nullable: true })
  ticket_info_url: string | null;

  @Column({ type: 'simple-array', nullable: true })
  broadcast_info: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}