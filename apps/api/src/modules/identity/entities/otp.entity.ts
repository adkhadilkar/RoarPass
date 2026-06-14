import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('otps')
export class OtpEntity {
  @PrimaryGeneratedColumn('uuid')
  otp_id: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  phone_e164: string;

  /** bcrypt hash of 6-digit OTP */
  @Column({ type: 'varchar', length: 72, select: false })
  code_hash: string;

  @Column({ type: 'int', default: 0 })
  attempt_count: number;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}