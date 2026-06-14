import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('e2e_public_key_bundles')
export class E2EPublicKeyBundle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  userId: string;

  @Column({ type: 'text' })
  identityKey: string; // base64 X25519 public key

  @Column({ type: 'text' })
  signedPreKey: string;

  @Column({ type: 'text' })
  signedPreKeySignature: string;

  @Column({ type: 'text', array: true, default: '{}' })
  oneTimePreKeys: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}