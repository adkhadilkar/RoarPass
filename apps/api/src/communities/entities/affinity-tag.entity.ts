import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('affinity_tags')
export class AffinityTagEntity {
  @PrimaryGeneratedColumn('uuid')
  tag_id: string;

  @Column({ type: 'varchar', length: 64 })
  @Index({ unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}