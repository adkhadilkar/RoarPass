import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuthProvider } from '../../../../../packages/shared/src/types/identity';
import { UserEntity } from './user.entity';

@Entity('auth_provider_links')
@Index(['provider', 'provider_user_id'], { unique: true })
export class AuthProviderLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  link_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255 })
  provider_user_id: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'boolean', default: false })
  is_primary: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  linked_at: Date;

  @ManyToOne(() => UserEntity, (user) => user.auth_providers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}